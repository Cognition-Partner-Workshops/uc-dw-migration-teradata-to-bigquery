#!/usr/bin/env python3
"""Generate docs/migration/schema-mapping.md: every Salesforce field -> Postgres column with its type.

Inputs (all committed, so the output is deterministic):
  docs/migration/inventory.json          Salesforce objects/fields (tools/inventory)
  docs/migration/mapping.yaml            the 1:1 mapping matrix (which column each field became)
  app/api/prisma/schema.prisma           the target model (tables, columns, native types, FKs, indexes)
  app/api/prisma/migrations/*/migration.sql  hand-written CHECK constraints, views and triggers

    python3 tools/schema/schema_mapping.py --render   # write schema-mapping.md
    python3 tools/schema/schema_mapping.py --check    # CI: validate + fail if the md is stale

--check also fails when a mapping.yaml row targets a `table.column` that does not exist in the
Prisma schema, or when a Prisma column (other than the id / sf_id / audit columns) is not claimed
by any mapping row. Stdlib only, apart from PyYAML which tools/mapping already requires.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    raise

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INVENTORY = REPO_ROOT / "docs" / "migration" / "inventory.json"
DEFAULT_MAPPING = REPO_ROOT / "docs" / "migration" / "mapping.yaml"
DEFAULT_SCHEMA = REPO_ROOT / "app" / "api" / "prisma" / "schema.prisma"
DEFAULT_MIGRATIONS = REPO_ROOT / "app" / "api" / "prisma" / "migrations"
DEFAULT_MD = REPO_ROOT / "docs" / "migration" / "schema-mapping.md"

# Salesforce standard/system fields that every table carries, keyed by target column.
STANDARD_COLUMNS: dict[str, tuple[str, str, str]] = {
    "id": ("Id (surrogate)", "Id", "new UUID primary key; the Salesforce Id is kept in sf_id"),
    "sf_id": ("Id", "Id (18-char)", "traceability / reconciliation key, unique, CHECK ^[A-Za-z0-9]{18}$"),
    "name": ("Name", "Text(80)", "record name"),
    "created_at": ("CreatedDate", "DateTime", "audit; DEFAULT now()"),
    "updated_at": ("LastModifiedDate", "DateTime", "audit; @updatedAt + set_updated_at() trigger for non-Prisma writes"),
    "created_by": ("CreatedById", "Lookup(User)", "audit; stored as the Cognito/user identifier (no users table, see mapping.yaml)"),
    "owner_id": ("OwnerId", "Lookup(User)", "audit; stored as the Cognito/user identifier (no users table, see mapping.yaml)"),
}

# Standard Contact fields: Contact is a standard object, so its fields are not in inventory.json.
CONTACT_FIELDS: dict[str, tuple[str, str]] = {
    "first_name": ("FirstName", "Text(40)"),
    "last_name": ("LastName", "Text(80)"),
    "email": ("Email", "Email"),
    "phone": ("Phone", "Phone"),
    "mobile_phone": ("MobilePhone", "Phone"),
    "title": ("Title", "Text(128)"),
    "mailing_street": ("MailingStreet", "TextArea(255)"),
    "mailing_city": ("MailingCity", "Text(40)"),
    "mailing_state": ("MailingState", "Text(80)"),
    "mailing_postal_code": ("MailingPostalCode", "Text(20)"),
    "mailing_country": ("MailingCountry", "Text(80)"),
}

# Salesforce Files: ContentDocument + latest ContentVersion + ContentDocumentLink collapsed into `files`
# (mapping.yaml standardObject:ContentDocument / ContentVersion / ContentDocumentLink); standard objects,
# so not in inventory.json either. Rendered under both object sections.
FILES_FIELDS: dict[str, tuple[str, str, str]] = {
    "title": ("ContentVersion.Title", "Text(255)", "filename minus its extension"),
    "file_type": ("ContentDocument.FileType", "Text(20)", "upper-case extension (PNG, JPG, GIF, PDF, ...); PropertyController.getPictures filters IN ('PNG','JPG','GIF')"),
    "s3_key": ("ContentVersion.VersionData", "Base64 (blob)", "the body is an S3 object; this is its key files/<id>/<filename>"),
    "record_id": ("ContentDocumentLink.LinkedEntityId", "Lookup (polymorphic)", "FK → properties.id ON DELETE CASCADE (properties is the only linked entity today)"),
}

STANDARD_OBJECT_FIELDS: dict[str, dict[str, tuple[str, ...]]] = {
    "Contact": CONTACT_FIELDS,
    "ContentDocument": FILES_FIELDS,
    "ContentVersion": FILES_FIELDS,
}

PRISMA_DEFAULT_SQL = {
    "String": "text",
    "Int": "integer",
    "BigInt": "bigint",
    "Float": "double precision",
    "Decimal": "numeric(65,30)",
    "Boolean": "boolean",
    "DateTime": "timestamp(3)",
    "Json": "jsonb",
    "Bytes": "bytea",
}

NATIVE_SQL = {
    "VarChar": "varchar({0})",
    "Char": "char({0})",
    "Text": "text",
    "Uuid": "uuid",
    "Decimal": "numeric({0},{1})",
    "Integer": "integer",
    "SmallInt": "smallint",
    "BigInt": "bigint",
    "DoublePrecision": "double precision",
    "Real": "real",
    "Boolean": "boolean",
    "Date": "date",
    "Time": "time({0})",
    "Timestamp": "timestamp({0})",
    "Timestamptz": "timestamptz({0})",
    "JsonB": "jsonb",
    "Json": "json",
    "Inet": "inet",
    "Money": "money",
}


# ----------------------------------------------------------------------------- Prisma parsing


@dataclass
class PrismaField:
    name: str
    prismaType: str
    optional: bool
    isList: bool
    attributes: str
    doc: str = ""

    @property
    def column(self) -> str:
        m = re.search(r'@map\("([^"]+)"\)', self.attributes)
        return m.group(1) if m else self.name

    @property
    def isId(self) -> bool:
        return "@id" in self.attributes

    @property
    def isUnique(self) -> bool:
        return "@unique" in self.attributes

    @property
    def default(self) -> str | None:
        m = re.search(r"@default\((.*?)\)(?=\s|$|@)", self.attributes)
        if not m:
            return None
        raw = m.group(1)
        inner = re.match(r'dbgenerated\("(.*)"\)', raw)
        return inner.group(1) if inner else raw

    @property
    def relation(self) -> dict | None:
        m = re.search(r"@relation\((.*)\)", self.attributes)
        if not m:
            return None
        body = m.group(1)
        out: dict = {}
        for key in ("fields", "references"):
            mm = re.search(rf"{key}:\s*\[([^\]]*)\]", body)
            out[key] = [s.strip() for s in mm.group(1).split(",")] if mm else []
        for key in ("onDelete", "onUpdate"):
            mm = re.search(rf"{key}:\s*(\w+)", body)
            out[key] = mm.group(1) if mm else None
        return out


@dataclass
class PrismaModel:
    name: str
    fields: list[PrismaField] = field(default_factory=list)
    blockAttributes: list[str] = field(default_factory=list)
    doc: str = ""

    @property
    def table(self) -> str:
        for attr in self.blockAttributes:
            m = re.match(r'@@map\("([^"]+)"\)', attr)
            if m:
                return m.group(1)
        return self.name

    @property
    def indexes(self) -> list[str]:
        out = []
        for attr in self.blockAttributes:
            m = re.match(r"@@(index|unique)\(\[([^\]]*)\]", attr)
            if m:
                out.append(f"{m.group(1)}({m.group(2).replace(' ', '')})")
        return out

    def columnFields(self, modelNames: set[str] | None = None) -> list[PrismaField]:
        """Scalar fields that become columns (relation fields and relation lists are skipped)."""
        modelNames = modelNames or set()
        return [f for f in self.fields if f.relation is None and f.prismaType not in modelNames]


@dataclass
class PrismaEnum:
    name: str
    values: list[tuple[str, str]]  # (prisma value, db value)
    blockAttributes: list[str] = field(default_factory=list)

    @property
    def dbName(self) -> str:
        for attr in self.blockAttributes:
            m = re.match(r'@@map\("([^"]+)"\)', attr)
            if m:
                return m.group(1)
        return self.name


@dataclass
class PrismaSchema:
    models: list[PrismaModel]
    enums: list[PrismaEnum]

    @property
    def modelNames(self) -> set[str]:
        return {m.name for m in self.models}

    def model(self, table: str) -> PrismaModel | None:
        return next((m for m in self.models if m.table == table), None)

    def enum(self, name: str) -> PrismaEnum | None:
        return next((e for e in self.enums if e.name == name), None)


def parsePrisma(text: str) -> PrismaSchema:
    models: list[PrismaModel] = []
    enums: list[PrismaEnum] = []
    block: str | None = None
    current: PrismaModel | PrismaEnum | None = None
    pendingDoc: list[str] = []
    for rawLine in text.splitlines():
        line = rawLine.strip()
        if not line:
            pendingDoc = []
            continue
        if line.startswith("///"):
            pendingDoc.append(line[3:].strip())
            continue
        if line.startswith("//"):
            continue
        m = re.match(r"^(model|enum|datasource|generator)\s+(\w+)\s*\{$", line)
        if m:
            block = m.group(1)
            if block == "model":
                current = PrismaModel(m.group(2), doc=" ".join(pendingDoc))
                models.append(current)
            elif block == "enum":
                current = PrismaEnum(m.group(2), [])
                enums.append(current)
            else:
                current = None
            pendingDoc = []
            continue
        if line == "}":
            block, current = None, None
            pendingDoc = []
            continue
        if block == "model" and isinstance(current, PrismaModel):
            if line.startswith("@@"):
                current.blockAttributes.append(line)
            else:
                mm = re.match(r"^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$", line)
                if mm:
                    current.fields.append(
                        PrismaField(
                            name=mm.group(1),
                            prismaType=mm.group(2),
                            isList=bool(mm.group(3)),
                            optional=bool(mm.group(4)),
                            attributes=mm.group(5),
                            doc=" ".join(pendingDoc),
                        )
                    )
            pendingDoc = []
        elif block == "enum" and isinstance(current, PrismaEnum):
            if line.startswith("@@"):
                current.blockAttributes.append(line)
            else:
                mm = re.match(r'^(\w+)(?:\s+@map\("([^"]+)"\))?', line)
                if mm:
                    current.values.append((mm.group(1), mm.group(2) or mm.group(1)))
            pendingDoc = []
    return PrismaSchema(models, enums)


def sqlType(f: PrismaField, schema: PrismaSchema) -> str:
    m = re.search(r"@db\.(\w+)(?:\(([^)]*)\))?", f.attributes)
    if m:
        template = NATIVE_SQL.get(m.group(1), m.group(1).lower())
        args = [a.strip() for a in (m.group(2) or "").split(",") if a.strip()]
        try:
            base = template.format(*args)
        except IndexError:
            base = template.split("(")[0]
    else:
        enum = schema.enum(f.prismaType)
        if enum:
            base = f"{enum.dbName} (enum)"
        else:
            base = PRISMA_DEFAULT_SQL.get(f.prismaType, f.prismaType.lower())
    return base + ("[]" if f.isList else "")


# ----------------------------------------------------------------------------- migration SQL parsing


@dataclass
class MigrationExtras:
    checks: list[tuple[str, str, str, str]]  # (table, constraint, expression, comment)
    views: list[tuple[str, str, str]]  # (view, definition, comment)
    triggers: list[tuple[str, str, str]]  # (trigger, table, purpose)


def parseMigrations(migrationsDir: Path) -> MigrationExtras:
    checks, views, triggers = [], [], []
    functions: dict[str, str] = {}
    if not migrationsDir.exists():
        return MigrationExtras(checks, views, triggers)
    for sqlFile in sorted(migrationsDir.glob("*/migration.sql")):
        text = sqlFile.read_text()
        statements = splitStatements(text)
        for comment, stmt in statements:
            flat = " ".join(stmt.split())
            m = re.match(r'ALTER TABLE "?(\w+)"? ADD CONSTRAINT "?(\w+)"? CHECK \((.*)\)$', flat, re.S)
            if m:
                checks.append((m.group(1), m.group(2), m.group(3), comment))
                continue
            m = re.match(r'CREATE (?:OR REPLACE )?VIEW "?(\w+)"? AS (.*)$', flat, re.S)
            if m:
                views.append((m.group(1), m.group(2), comment))
                continue
            m = re.match(r"CREATE (?:OR REPLACE )?FUNCTION (\w+)\(", flat)
            if m:
                functions[m.group(1)] = comment
                continue
            m = re.match(r'CREATE (?:OR REPLACE )?TRIGGER "?(\w+)"? .*? ON "?(\w+)"?.*?EXECUTE (?:FUNCTION|PROCEDURE) (\w+)\(', flat, re.S)
            if m:
                purpose = comment or f"`{m.group(3)}()`" + (f": {functions[m.group(3)]}" if functions.get(m.group(3)) else "")
                triggers.append((m.group(1), m.group(2), purpose))
    return MigrationExtras(checks, views, triggers)


def splitStatements(text: str) -> list[tuple[str, str]]:
    """Split SQL into (leading comment, statement) pairs; dollar-quoted bodies are kept whole."""
    out: list[tuple[str, str]] = []
    comment: list[str] = []
    buf: list[str] = []
    inDollar = False
    for line in text.splitlines():
        stripped = line.strip()
        if not buf and stripped.startswith("--"):
            comment.append(stripped.lstrip("- ").strip())
            continue
        if not buf and not stripped:
            comment = []
            continue
        buf.append(line)
        if stripped.count("$$") % 2 == 1:
            inDollar = not inDollar
        if not inDollar and stripped.endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";")
            out.append((" ".join(comment), stmt))
            buf, comment = [], []
    return out


# ----------------------------------------------------------------------------- mapping / inventory


def loadJson(path: Path) -> dict:
    return json.loads(path.read_text())


def loadYaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text()) or {}


def mappingRows(doc: dict) -> dict[str, dict]:
    return {str(r["id"]): r for r in doc.get("rows", []) if isinstance(r, dict) and "id" in r}


def columnTarget(row: dict | None) -> tuple[str, str] | None:
    """(table, column) for a mapping row whose target is `kind: column, name: table.column`."""
    if not row:
        return None
    target = row.get("target") or {}
    if target.get("kind") != "column" or "." not in str(target.get("name", "")):
        return None
    table, column = str(target["name"]).split(".", 1)
    return table, column


def fieldTypeLabel(f: dict) -> str:
    t = f.get("type", "")
    extra = []
    if f.get("length"):
        extra.append(str(f["length"]))
    if f.get("precision") is not None and f.get("scale") is not None:
        extra.append(f"{f['precision']},{f['scale']}")
    label = f"{t}({', '.join(extra)})" if extra else t
    if f.get("formula"):
        label += " formula"
    if f.get("referenceTo"):
        label += f" → {f['referenceTo']}"
    if f.get("required"):
        label += ", required"
    if f.get("unique"):
        label += ", unique"
    if f.get("externalId"):
        label += ", external id"
    if f.get("restricted"):
        label += ", restricted"
    return label


def inventoryObjects(inv: dict) -> list[dict]:
    return list(inv.get("objects", []))


# ----------------------------------------------------------------------------- build the document model


@dataclass
class Row:
    sfField: str
    sfType: str
    column: str
    sqlType: str
    nullable: str
    prismaField: str
    notes: str


@dataclass
class Problem:
    message: str


def buildTableRows(
    table: str,
    model: PrismaModel,
    schema: PrismaSchema,
    sfFields: list[dict],
    rows: dict[str, dict],
    objectApiName: str,
    problems: list[Problem],
) -> tuple[list[Row], list[Row]]:
    """Returns (rows for the field table, rows for fields with no stored column)."""
    byColumn = {f.column: f for f in model.columnFields(schema.modelNames)}
    claimed: set[str] = set()
    out: list[Row] = []
    unstored: list[Row] = []

    def rowFor(sfField: str, sfType: str, f: PrismaField, notes: str) -> Row:
        claimed.add(f.column)
        extra = []
        if f.isId:
            extra.append("PK")
        if f.isUnique:
            extra.append("unique")
        if f.default:
            extra.append(f"default {f.default}")
        rel = f.relation
        return Row(
            sfField=sfField,
            sfType=sfType,
            column=f.column,
            sqlType=sqlType(f, schema) + ((" — " + ", ".join(extra)) if extra else ""),
            nullable="yes" if f.optional else "no",
            prismaField=f"{model.name}.{f.name}",
            notes=notes if not rel else notes,
        )

    for column in ("id", "sf_id", "name"):
        if column in byColumn:
            sfName, sfType, note = STANDARD_COLUMNS[column]
            out.append(rowFor(sfName, sfType, byColumn[column], note))

    for sf in sfFields:
        apiName = sf["name"]
        if apiName == "Name":
            continue
        rowId = f"field:{objectApiName}.{apiName}"
        row = rows.get(rowId)
        notes = str((row or {}).get("notes") or "")
        if sf.get("type") == "Location":
            base = re.sub(r"__c$", "", apiName)
            base = re.sub(r"(?<!^)(?=[A-Z])", "_", base).lower()
            pair = [c for c in (f"{base}_latitude", f"{base}_longitude") if c in byColumn]
            if len(pair) != 2:
                problems.append(Problem(f"{rowId}: expected columns {base}_latitude/{base}_longitude in {table}"))
            for i, column in enumerate(pair):
                out.append(rowFor(f"{apiName} ({'latitude' if i == 0 else 'longitude'})", fieldTypeLabel(sf), byColumn[column], notes if i == 0 else "see above"))
            continue
        target = columnTarget(row)
        if target and target[0] == table and target[1] in byColumn:
            f = byColumn[target[1]]
            if f.relation or any(ff.relation and target[1] in (ff.relation or {}).get("fields", []) or ff.relation and f.name in (ff.relation or {}).get("fields", []) for ff in model.fields):
                fk = next((ff for ff in model.fields if ff.relation and f.name in ff.relation["fields"]), None)
                if fk:
                    other = next((mm for mm in schema.models if mm.name == fk.prismaType), None)
                    refTable = other.table if other else fk.prismaType
                    fkNote = f"FK → {refTable}.{','.join(fk.relation['references'])} ON DELETE {toSql(fk.relation['onDelete'])}"
                    notes = notes if "FK" in notes else (f"{fkNote}; {notes}" if notes else fkNote)
            out.append(rowFor(apiName, fieldTypeLabel(sf), f, notes))
            continue
        if target:
            # Column on a view or another table (formula -> view column).
            viewName = target[0]
            unstored.append(Row(apiName, fieldTypeLabel(sf), f"{viewName}.{target[1]}", str((row or {}).get("target", {}).get("type") or "—"), "—", "—", notes or f"{(row or {}).get('disposition')} ({(row or {}).get('status')})"))
            if viewName == table:
                problems.append(Problem(f"{rowId}: mapping targets {table}.{target[1]} but the Prisma model {model.name} has no such column"))
            continue
        if row is None:
            problems.append(Problem(f"{rowId}: no mapping.yaml row"))
            continue
        t = row.get("target") or {}
        label = f"{t.get('kind', row.get('disposition'))} `{t.get('name', '')}`".strip()
        unstored.append(Row(apiName, fieldTypeLabel(sf), "— (not stored)", label, "—", "—", notes or f"{row.get('disposition')} ({row.get('status')})"))

    for column, spec in STANDARD_OBJECT_FIELDS.get(objectApiName, {}).items():
        if column in byColumn:
            sfName, sfType = spec[0], spec[1]
            out.append(rowFor(sfName, sfType, byColumn[column], spec[2] if len(spec) > 2 else ""))

    for column in ("created_at", "updated_at", "created_by", "owner_id"):
        if column in byColumn:
            sfName, sfType, note = STANDARD_COLUMNS[column]
            out.append(rowFor(sfName, sfType, byColumn[column], note))

    for column, f in byColumn.items():
        if column not in claimed:
            problems.append(Problem(f"{table}.{column} ({model.name}.{f.name}) is not claimed by any Salesforce field / mapping row"))
    return out, unstored


def toSql(action: str | None) -> str:
    return {"SetNull": "SET NULL", "Cascade": "CASCADE", "Restrict": "RESTRICT", "NoAction": "NO ACTION", "SetDefault": "SET DEFAULT"}.get(action or "", action or "NO ACTION")


def tableForObject(rows: dict[str, dict], rowId: str) -> str | None:
    row = rows.get(rowId)
    target = (row or {}).get("target") or {}
    if target.get("kind") == "table":
        return str(target["name"])
    return None


def mdEscape(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def table(headers: list[str], rows: list[list[str]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(mdEscape(c) for c in r) + " |")
    out.append("")
    return out


def render(inv: dict, mapping: dict, schema: PrismaSchema, extras: MigrationExtras) -> tuple[str, list[Problem]]:
    rows = mappingRows(mapping)
    problems: list[Problem] = []
    out = ["# Schema mapping: Salesforce fields → Postgres columns", ""]
    out.append(
        "Generated by `python3 tools/schema/schema_mapping.py --render` from [`inventory.json`](inventory.json), "
        "[`mapping.yaml`](mapping.yaml), [`app/api/prisma/schema.prisma`](../../app/api/prisma/schema.prisma) and "
        "[`app/api/prisma/migrations`](../../app/api/prisma/migrations); CI runs `--check`. Do not edit by hand."
    )
    out.append("")

    objects: list[tuple[str, str, list[dict], str]] = []  # (apiName, table, fields, label)
    for obj in inventoryObjects(inv):
        tbl = tableForObject(rows, f"object:{obj['name']}")
        if tbl:
            objects.append((obj["name"], tbl, obj.get("fields", []), obj.get("label", obj["name"])))
        else:
            problems.append(Problem(f"object:{obj['name']} has no table target in mapping.yaml"))
    for rowId, row in rows.items():
        if rowId.startswith("standardObject:"):
            tbl = tableForObject(rows, rowId)
            if tbl:
                objects.append((rowId.split(":", 1)[1], tbl, [], rowId.split(":", 1)[1]))

    modelsCovered: set[str] = set()
    summary = []
    sections: list[str] = []
    totalColumns = 0
    pending: list[list[str]] = []
    for apiName, tbl, sfFields, label in objects:
        model = schema.model(tbl)
        if model is None:
            row = rows.get(f"object:{apiName}") or rows.get(f"standardObject:{apiName}") or {}
            if row.get("status") in ("mapped", None):
                pending.append([apiName, f"`{tbl}`", str(row.get("ticket") or "—"), str(row.get("notes") or "")])
            else:
                problems.append(Problem(f"mapping.yaml says {apiName} -> table {tbl} is {row.get('status')} but schema.prisma has no model mapped to it"))
            continue
        modelsCovered.add(model.name)
        fieldRows, unstored = buildTableRows(tbl, model, schema, sfFields, rows, apiName, problems)
        totalColumns += len(fieldRows)
        summary.append([apiName, f"`{tbl}`", f"`{model.name}`", str(len(fieldRows)), str(len(unstored)), ", ".join(f"`{i}`" for i in model.indexes) or "—"])
        sections.append(f"## {label} (`{apiName}`) → `{tbl}`")
        sections.append("")
        if model.doc and model.doc != apiName:
            sections.append(model.doc)
            sections.append("")
        sections.extend(
            table(
                ["Salesforce field", "Salesforce type", "Column", "Postgres type", "Nullable", "Prisma field", "Notes"],
                [[r.sfField, r.sfType, f"`{r.column}`", r.sqlType, r.nullable, f"`{r.prismaField}`", r.notes] for r in fieldRows],
            )
        )
        if unstored:
            sections.append(f"### `{apiName}` fields without a stored column")
            sections.append("")
            sections.extend(
                table(
                    ["Salesforce field", "Salesforce type", "Target", "Type", "Notes"],
                    [[r.sfField, r.sfType, f"`{r.column}`" if r.column.startswith("—") is False else r.column, r.sqlType, r.notes] for r in unstored],
                )
            )
        checks = [c for c in extras.checks if c[0] == tbl]
        if checks:
            sections.append(f"### `{tbl}` CHECK constraints")
            sections.append("")
            checkRows = []
            for i, c in enumerate(checks):
                mirrors = c[3] or ("same as above" if i and checks[i - 1][3] is not None and i > 0 else "—")
                checkRows.append([f"`{c[1]}`", f"`{c[2]}`", mirrors])
            sections.extend(table(["Constraint", "Expression", "Mirrors"], checkRows))

    for model in schema.models:
        if model.name not in modelsCovered:
            problems.append(Problem(f"Prisma model {model.name} (table {model.table}) is not the target of any object row in mapping.yaml"))

    out.append("## Summary")
    out.append("")
    out.append(f"- Objects/tables: **{len(summary)}**, stored columns: **{totalColumns}**, enums: **{len(schema.enums)}**, "
               f"views: **{len(extras.views)}**, CHECK constraints: **{len(extras.checks)}**, triggers: **{len(extras.triggers)}**")
    conv = (mapping.get("conventions") or {}).get("sql")
    if conv:
        out.append(f"- SQL conventions (from `mapping.yaml`): {conv}")
    out.append("")
    out.extend(table(["Object", "Table", "Prisma model", "Stored columns", "Unstored fields", "Indexes"], summary))
    if pending:
        out.append("Tables mapped but not yet in `schema.prisma` (their object row is still `mapped`):")
        out.append("")
        out.extend(table(["Object", "Table", "Ticket", "Notes"], pending))

    out.append("## Type rules")
    out.append("")
    out.extend(
        table(
            ["Salesforce type", "Postgres type"],
            [
                ["Text(n) / Email / Phone / Url", "varchar(n) (Email 80, Phone 40, Url 255)"],
                ["TextArea / LongTextArea / Html", "text"],
                ["Currency(p,s)", "numeric(18,2)"],
                ["Number(p,0)", "integer (p ≤ 9) or numeric(p,0)"],
                ["Percent(p,s)", "numeric(p,s)"],
                ["Date / DateTime", "date / timestamptz(6)"],
                ["Checkbox", "boolean"],
                ["Picklist", "Postgres enum (values keep the Salesforce API names)"],
                ["MultiselectPicklist", "text[]"],
                ["Location", "two numeric(10,7) columns `<field>_latitude` / `<field>_longitude` + CHECK (both or neither, in range)"],
                ["Lookup / MasterDetail", "uuid FK → `<table>.id` (lookup: Salesforce deleteConstraint, master-detail: ON DELETE CASCADE)"],
                ["Formula", "view column (`<table>_v`) when not immutable, otherwise computed in the API DTO"],
                ["Roll-up summary", "view"],
                ["Id / CreatedDate / LastModifiedDate / CreatedById / OwnerId", "`sf_id char(18) unique` + `created_at` / `updated_at` timestamptz(6) / `created_by` / `owner_id` varchar(128)"],
            ],
        )
    )

    out.extend(sections)

    if schema.enums:
        out.append("## Enums")
        out.append("")
        for enum in schema.enums:
            out.append(f"### `{enum.dbName}` (Prisma `{enum.name}`)")
            out.append("")
            out.extend(table(["Postgres value", "Prisma value"], [[f"`{db}`", f"`{p}`"] for p, db in enum.values]))

    fks = []
    for model in schema.models:
        for f in model.fields:
            rel = f.relation
            if rel and rel.get("fields"):
                other = next((mm for mm in schema.models if mm.name == f.prismaType), None)
                col = next((ff.column for ff in model.fields if ff.name in rel["fields"]), rel["fields"][0])
                fks.append([f"`{model.table}.{col}`", f"`{other.table if other else f.prismaType}.{','.join(rel['references'])}`", toSql(rel.get("onDelete")), toSql(rel.get("onUpdate")) if rel.get("onUpdate") else "NO ACTION"])
    out.append("## Foreign keys")
    out.append("")
    out.extend(table(["Column", "References", "ON DELETE", "ON UPDATE"], fks) if fks else ["(none)", ""])

    if extras.views:
        out.append("## Views")
        out.append("")
        for name, definition, comment in extras.views:
            out.append(f"### `{name}`")
            out.append("")
            if comment:
                out.append(comment)
                out.append("")
            out.append("```sql")
            out.append(definition)
            out.append("```")
            out.append("")

    if extras.triggers:
        out.append("## Triggers")
        out.append("")
        out.extend(table(["Trigger", "Table", "Purpose"], [[f"`{t[0]}`", f"`{t[1]}`", t[2] or "—"] for t in extras.triggers]))

    out.append("## Validation rules")
    out.append("")
    vrs = [(obj["name"], vr) for obj in inventoryObjects(inv) for vr in obj.get("validationRules", [])]
    if vrs:
        out.extend(table(["Object", "Rule", "Target"], [[o, vr.get("name", ""), vr.get("target", "API validator")] for o, vr in vrs]))
    else:
        out.append("The source objects declare no validation rules; pure field checks (field lengths, picklist values, "
                   "number ranges, geolocation pairs, `sf_id` shape) are the CHECK constraints and native types listed above. "
                   "Anything beyond a single-row field check belongs in the NestJS DTO validators, tracked per field in `mapping.yaml`.")
        out.append("")

    return "\n".join(out).rstrip() + "\n", problems


# ----------------------------------------------------------------------------- CLI


def generate(args) -> tuple[str, list[Problem]]:
    inv = loadJson(args.inventory)
    mapping = loadYaml(args.mapping)
    schema = parsePrisma(args.schema.read_text())
    extras = parseMigrations(args.migrations)
    return render(inv, mapping, schema, extras)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--migrations", type=Path, default=DEFAULT_MIGRATIONS)
    parser.add_argument("--md", type=Path, default=DEFAULT_MD)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--render", action="store_true", help="write schema-mapping.md")
    group.add_argument("--check", action="store_true", help="validate and fail if schema-mapping.md is stale (CI)")
    args = parser.parse_args(argv)

    text, problems = generate(args)
    for p in problems:
        print(f"schema-mapping: {p.message}", file=sys.stderr)
    if args.render:
        args.md.write_text(text)
        print(f"wrote {args.md}")
        return 2 if problems else 0
    if problems:
        return 2
    current = args.md.read_text() if args.md.exists() else ""
    if current != text:
        print(f"schema-mapping: {args.md} is stale; run python3 tools/schema/schema_mapping.py --render", file=sys.stderr)
        return 1
    print(f"schema-mapping OK: {args.md} matches schema.prisma + mapping.yaml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
