#!/usr/bin/env python3
"""1:1 mapping matrix: every Salesforce inventory id -> its target counterpart.

docs/migration/mapping.yaml is the hand-maintained matrix (one row per inventory
id); docs/migration/mapping.md is rendered from it. The inventory ids are derived
deterministically from docs/migration/inventory.json (tools/inventory), so the
matrix can be checked against the inventory in CI.

    python3 tools/mapping/mapping.py --check     # CI: ids 1:1, conventions, mapping.md current
    python3 tools/mapping/mapping.py --render    # rewrite docs/migration/mapping.md
    python3 tools/mapping/mapping.py --sync      # add stub rows for new inventory ids, re-sort, re-render
    python3 tools/mapping/mapping.py --ids       # print the inventory ids

Requires PyYAML (pip install pyyaml).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, OrderedDict
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INVENTORY = REPO_ROOT / "docs" / "migration" / "inventory.json"
DEFAULT_MAPPING = REPO_ROOT / "docs" / "migration" / "mapping.yaml"
DEFAULT_MD = REPO_ROOT / "docs" / "migration" / "mapping.md"

STATUSES = ("mapped", "ported", "tested", "passing", "dropped")
DISPOSITIONS = ("port", "substitute", "dropped")
ROW_KEYS = ("id", "source", "target", "disposition", "status", "ticket", "parity_tests", "reason", "convention_exception", "notes")
REQUIRED_ROW_KEYS = ("id", "target", "disposition", "status", "ticket", "parity_tests")
TICKET_RE = re.compile(r"^UNT3-\d+$")
SCENARIO_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")

# Source kind -> ordered list of ids is produced by inventoryIds(); this is the display order.
SOURCE_KINDS = OrderedDict([
    ("object", "Custom objects"),
    ("field", "Custom fields"),
    ("validationRule", "Validation rules"),
    ("recordType", "Record types"),
    ("listView", "List views"),
    ("compactLayout", "Compact layouts"),
    ("standardObject", "Standard objects referenced"),
    ("apexClass", "Apex classes"),
    ("apexInnerClass", "Apex inner classes"),
    ("apexMethod", "Apex methods"),
    ("apexTrigger", "Apex triggers"),
    ("lwc", "Lightning Web Components"),
    ("lwcTest", "LWC jest tests"),
    ("aura", "Aura bundles"),
    ("flow", "Flows"),
    ("flexipage", "Lightning pages (FlexiPages)"),
    ("layout", "Page layouts"),
    ("tab", "Tabs"),
    ("application", "Lightning apps"),
    ("permissionSet", "Permission sets"),
    ("permission", "Permission set entries"),
    ("staticResource", "Static resources"),
    ("contentAsset", "Content assets"),
    ("messageChannel", "Lightning message channels"),
    ("remoteSiteSetting", "Remote site settings"),
    ("namedCredential", "Named credentials"),
    ("externalCredential", "External credentials"),
    ("cspTrustedSite", "CSP trusted sites"),
    ("callout", "External callouts"),
    ("customLabel", "Custom labels"),
    ("customMetadata", "Custom metadata"),
    ("prompt", "In-app guidance prompts"),
    ("jestMock", "Jest mock modules"),
])

# Target kinds and the naming convention each target name must follow (architecture phase, app/api/README.md "Naming").
TARGET_KINDS = OrderedDict([
    ("table", (r"^[a-z][a-z0-9_]*s$", "snake_case, plural (properties, brokers)")),
    ("column", (r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$", "table.column, snake_case")),
    ("constraint", (r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$", "table.constraint_name, snake_case")),
    ("enum", (r"^[a-z][a-z0-9_]*$", "Postgres enum type, snake_case")),
    ("computed", (r"^[A-Z][A-Za-z0-9]*Dto\.[a-z][A-Za-z0-9]*$", "response DTO field computed by the API (SomeDto.someField)")),
    ("module", (r"^app/api/src/modules/[a-z][a-z0-9-]*$", "Nest module directory, kebab-case")),
    ("service", (r"^[A-Z][A-Za-z0-9]*Service$", "Nest service class, PascalCase + Service")),
    ("serviceMethod", (r"^[A-Z][A-Za-z0-9]*Service\.[a-z][A-Za-z0-9]*$", "ServiceClass.methodName")),
    ("endpoint", (r"^(GET|POST|PUT|PATCH|DELETE) /[a-z0-9\-{}/]*$", "METHOD /kebab-case/path/{id}")),
    ("dto", (r"^[A-Z][A-Za-z0-9]*Dto$", "DTO class, PascalCase + Dto")),
    ("hook", (r"^[A-Z][A-Za-z0-9]*Service\.(before|after)[A-Z][A-Za-z0-9]*$", "domain hook ServiceClass.before|afterXxx")),
    ("job", (r"^app/api/src/jobs/[a-z][a-z0-9-]*$", "AWS job module (ECS task / EventBridge), kebab-case")),
    ("spec", (r"^(app/(api|web)/|tests/parity/)[A-Za-z0-9_./\-]+\.(spec|test)\.tsx?(::[A-Za-z0-9_ ]+)?$", "Vitest spec path, optionally ::case name")),
    ("fixture", (r"^(app/(api|web)/|tests/parity/)[A-Za-z0-9_./\-]+$", "test fixture / data file path")),
    ("component", (r"^[A-Z][A-Za-z0-9]*$", "React component, PascalCase")),
    ("route", (r"^/[a-z0-9\-/:]*$", "React Router path, kebab-case, :param")),
    ("util", (r"^app/web/src/[A-Za-z0-9_./\-]+\.tsx?(::[A-Za-z0-9_]+)?$", "web module path, optionally ::exportName")),
    ("store", (r"^app/web/src/[A-Za-z0-9_./\-]+\.tsx?$", "shared client state module path")),
    ("config", (r"^(app/(api|web)/|infra/)[A-Za-z0-9_./\-]+(::[A-Za-z0-9_.]+)?$", "config file path, optionally ::key")),
    ("env", (r"^[A-Z][A-Z0-9_]*$", "environment variable, UPPER_SNAKE")),
    ("httpClient", (r"^[A-Z][A-Za-z0-9]*Service\.[a-z][A-Za-z0-9]*$", "outbound HTTP client ServiceClass.method")),
    ("role", (r"^[a-z][a-z0-9-]*$", "Cognito group / API role, kebab-case")),
    ("policy", (r"^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$", "authorization policy key (resource.action)")),
    ("infra", (r"^infra/[A-Za-z0-9_./\-]+(::[A-Za-z0-9_.\-]+)?$", "Terraform file path, optionally ::resource")),
    ("asset", (r"^app/web/public/[A-Za-z0-9_./\-]+$", "static web asset path")),
    ("dependency", (r"^(@[a-z0-9\-]+/)?[a-z0-9\-.]+$", "npm package name")),
    ("mock", (r"^(app/web/src/test|tests/parity/mocks)/[A-Za-z0-9_./\-]+\.tsx?(::[A-Za-z0-9_]+)?$", "web test helper or parity mock path, optionally ::exportName")),
])

# Which target kinds are acceptable for each source kind (null target only when dropped).
KIND_MATRIX = {
    "object": {"table"},
    "field": {"column", "computed", "component", "route"},
    "validationRule": {"constraint", "serviceMethod"},
    "recordType": {"enum", "column"},
    "listView": {"config", "route"},
    "compactLayout": {"config"},
    "standardObject": {"table", "column", "service", "role", "fixture"},
    "apexClass": {"service", "dto", "spec", "module"},
    "apexInnerClass": {"dto", "mock", "spec"},
    "apexMethod": {"endpoint", "serviceMethod", "spec", "fixture", "hook", "mock"},
    "apexTrigger": {"hook"},
    "lwc": {"component", "util", "store"},
    "lwcTest": {"spec"},
    "aura": {"component"},
    "flow": {"component", "route"},
    "flexipage": {"route", "component"},
    "layout": {"config"},
    "tab": {"route", "config"},
    "application": {"component", "config"},
    "permissionSet": {"role"},
    "permission": {"policy", "config"},
    "staticResource": {"dependency", "fixture", "asset"},
    "contentAsset": {"asset"},
    "messageChannel": {"store"},
    "remoteSiteSetting": {"env", "config", "httpClient"},
    "namedCredential": {"env", "config", "httpClient"},
    "externalCredential": {"env", "config"},
    "cspTrustedSite": {"infra", "config"},
    "callout": {"httpClient"},
    "customLabel": {"config", "util"},
    "customMetadata": {"config", "table"},
    "prompt": {"component"},
    "jestMock": {"mock"},
}


# --------------------------------------------------------------------------- inventory ids
def fieldSummary(field: dict) -> str:
    kind = field.get("type") or "?"
    detail = []
    if field.get("isFormula"):
        detail.append("formula")
    if field.get("length"):
        detail.append(str(field["length"]))
    if field.get("precision") is not None and not field.get("isFormula"):
        detail.append(f"{field['precision']},{field.get('scale', 0)}")
    if field.get("referenceTo"):
        detail.append(f"-> {field['referenceTo']}")
    if field.get("picklist"):
        detail.append("/".join(v["fullName"] for v in field["picklist"].get("values", [])))
    return f"{field.get('label') or field['name']} ({kind}{(': ' + ' '.join(detail)) if detail else ''})"


def methodSummary(method: dict) -> str:
    params = ", ".join(f"{p['type']} {p['name']}" for p in method.get("parameters", []))
    annotations = "".join(f"@{a['name']} " for a in method.get("annotations", []))
    return f"{annotations}{method.get('returnType', 'void')} {method['name']}({params})"


def inventoryIds(inv: dict) -> "OrderedDict[str, dict]":
    """Every artifact in the inventory as {id: {kind, name, summary}} in display order."""
    rows: "OrderedDict[str, dict]" = OrderedDict()

    def add(kind: str, name: str, summary: str = "") -> None:
        rowId = f"{kind}:{name}"
        if rowId in rows:
            raise ValueError(f"duplicate inventory id {rowId}")
        rows[rowId] = {"kind": kind, "name": name, "summary": summary}

    for obj in inv.get("objects", []):
        add("object", obj["name"], f"{obj.get('label', obj['name'])} ({len(obj.get('fields', []))} fields, sharing {obj.get('sharingModel')})")
    for obj in inv.get("objects", []):
        for field in obj.get("fields", []):
            add("field", f"{obj['name']}.{field['name']}", fieldSummary(field))
    for obj in inv.get("objects", []):
        for rule in obj.get("validationRules", []):
            add("validationRule", f"{obj['name']}.{rule['name']}", rule.get("errorConditionFormula", ""))
    for obj in inv.get("objects", []):
        for rt in obj.get("recordTypes", []):
            add("recordType", f"{obj['name']}.{rt['name']}", rt.get("label", ""))
    for obj in inv.get("objects", []):
        for lv in obj.get("listViews", []):
            add("listView", f"{obj['name']}.{lv['name']}", f"{lv.get('label', lv['name'])}: {', '.join(lv.get('columns', []))}")
    for obj in inv.get("objects", []):
        for cl in obj.get("compactLayouts", []):
            add("compactLayout", f"{obj['name']}.{cl['name']}", f"{cl.get('label', cl['name'])}: {', '.join(cl.get('fields', []))}")
    for std in inv.get("standardObjectsUsed", []):
        users = sorted(u for us in std.get("usedBy", {}).values() for u in us)
        add("standardObject", std["name"], f"used by {', '.join(users)}" if users else "")

    apex = inv.get("apex", {})
    for cls in apex.get("classes", []):
        label = "test class" if cls.get("isTest") else "class"
        add("apexClass", cls["name"], f"{label}, {cls.get('sharing') or 'no sharing'}, {len(cls.get('methods', []))} methods")
    for cls in apex.get("classes", []):
        for inner in cls.get("innerClasses", []):
            impl = f" implements {', '.join(inner['implements'])}" if inner.get("implements") else ""
            add("apexInnerClass", f"{cls['name']}.{inner['name']}", f"{inner.get('kind', 'class')}{impl}, {len(inner.get('fields', []))} fields")
    for cls in apex.get("classes", []):
        for method in cls.get("methods", []):
            add("apexMethod", f"{cls['name']}.{method['name']}", methodSummary(method))
        for inner in cls.get("innerClasses", []):
            for method in inner.get("methods", []):
                add("apexMethod", f"{cls['name']}.{inner['name']}.{method['name']}", methodSummary(method))
    for trig in apex.get("triggers", []):
        add("apexTrigger", trig["name"], f"on {trig.get('sobject')} {', '.join(trig.get('events', []))}")

    for lwc in inv.get("lwc", []):
        targets = ", ".join(lwc.get("targets", [])) or "internal"
        add("lwc", lwc["name"], f"{lwc.get('masterLabel') or lwc['name']} ({targets})")
    for lwc in inv.get("lwc", []):
        for path in lwc.get("files", []):
            if "/__tests__/" in path and path.endswith(".test.js"):
                add("lwcTest", f"{lwc['name']}/{path.rsplit('/', 1)[-1]}", path)
    for aura in inv.get("aura", []):
        add("aura", aura["name"], f"{aura.get('bundleType')}: {aura.get('description') or ''}".strip())
    for flow in inv.get("flows", []):
        add("flow", flow["name"], f"{flow.get('label', flow['name'])} ({flow.get('processType')}, {flow.get('elementCount', 0)} elements)")
    for page in inv.get("flexipages", []):
        extra = f" for {page['sobjectType']}" if page.get("sobjectType") else ""
        add("flexipage", page["name"], f"{page.get('label', page['name'])} ({page.get('type')}{extra})")
    for layout in inv.get("layouts", []):
        add("layout", layout["name"], f"{layout.get('object')}: {len(layout.get('sections', []))} sections, {len(layout.get('fields', []))} fields")
    for tab in inv.get("tabs", []):
        add("tab", tab["name"], f"{tab.get('label', tab['name'])} ({tab.get('kind')})")
    for app in inv.get("applications", []):
        add("application", app["name"], f"{app.get('label', app['name'])}: tabs {', '.join(app.get('tabs', []))}")
    for ps in inv.get("permissionSets", []):
        add("permissionSet", ps["name"], f"{ps.get('label', ps['name'])}")
    for ps in inv.get("permissionSets", []):
        name = ps["name"]
        for av in ps.get("applicationVisibilities", []):
            add("permission", f"{name}.application.{av['application']}", f"application visible={av.get('visible')}")
        for ca in ps.get("classAccesses", []):
            add("permission", f"{name}.apexClass.{ca['apexClass']}", f"Apex class access enabled={ca.get('enabled')}")
        for pa in ps.get("pageAccesses", []):
            add("permission", f"{name}.page.{pa.get('apexPage')}", "Visualforce page access")
        for op in ps.get("objectPermissions", []):
            crud = ",".join(k[5:].lower() for k in ("allowCreate", "allowRead", "allowEdit", "allowDelete") if op.get(k))
            extra = ",".join(k for k in ("viewAllRecords", "modifyAllRecords") if op.get(k))
            add("permission", f"{name}.object.{op['object']}", f"object CRUD {crud}{(' + ' + extra) if extra else ''}")
        for fp in ps.get("fieldPermissions", []):
            add("permission", f"{name}.field.{fp['field']}", f"field readable={fp.get('readable')} editable={fp.get('editable')}")
        for ts in ps.get("tabSettings", []):
            add("permission", f"{name}.tab.{ts['tab']}", f"tab {ts.get('visibility')}")
        for up in ps.get("userPermissions", []):
            add("permission", f"{name}.user.{up.get('name')}", "user permission")
        for cp in ps.get("customPermissions", []):
            add("permission", f"{name}.custom.{cp.get('name')}", "custom permission")
        for rv in ps.get("recordTypeVisibilities", []):
            add("permission", f"{name}.recordType.{rv.get('recordType')}", "record type visibility")

    for sr in inv.get("staticResources", []):
        add("staticResource", sr["name"], f"{sr.get('description') or sr.get('contentType')} ({sr.get('totalBytes', 0)} bytes)")
    for ca in inv.get("contentAssets", []):
        add("contentAsset", ca["name"], ca.get("masterLabel", ""))
    for mc in inv.get("messageChannels", []):
        add("messageChannel", mc["name"], f"{mc.get('masterLabel', '')}: {', '.join(f['fieldName'] for f in mc.get('fields', []))}")
    for rs in inv.get("remoteSiteSettings", []):
        add("remoteSiteSetting", rs["name"], rs.get("url", ""))
    for nc in inv.get("namedCredentials", []):
        add("namedCredential", nc["name"], nc.get("endpoint", ""))
    for ec in inv.get("externalCredentials", []):
        add("externalCredential", ec["name"], ec.get("authenticationProtocol", ""))
    for csp in inv.get("cspTrustedSites", []):
        directives = ",".join(k[14:] for k in csp if k.startswith("isApplicableTo") and csp[k])
        add("cspTrustedSite", csp["name"], f"{csp.get('endpointUrl')} ({directives})")
    for call in inv.get("externalCallouts", []):
        add("callout", f"{call['apexClass']}.{call['method']}", f"{call.get('type')} {call.get('endpoint')}")
    for lbl in inv.get("customLabels", []):
        add("customLabel", lbl["name"], lbl.get("value", ""))
    for md in inv.get("customMetadata", []):
        add("customMetadata", md["name"], md.get("label", ""))
    for prompt in inv.get("prompts", []):
        add("prompt", prompt["name"], f"{prompt.get('masterLabel', prompt['name'])} ({len(prompt.get('versions', []))} steps)")
    for mock in inv.get("jestMocks", []):
        add("jestMock", mock["module"], f"exports {', '.join(mock.get('exports', []))}")
    return rows


# --------------------------------------------------------------------------- yaml io
HEADER = """# 1:1 mapping matrix: Salesforce (trailheadapps/dreamhouse-lwc) -> React + NestJS/Prisma + Postgres on AWS.
#
# One row per inventory id (docs/migration/inventory.json, ids derived by tools/mapping/mapping.py --ids).
# CI (`python3 tools/mapping/mapping.py --check`) enforces: every inventory id appears exactly once, target
# names follow the conventions below, dropped/substitute rows carry a reason, mapping.md is current.
# Keep this file current in every PR that touches an artifact; phases 3-6 move `status` forward and
# UNT3-25 writes the E2E scenario ids into `parity_tests`. Regenerate mapping.md with --render.
# Do not add comments below this header: --sync rewrites the file.
"""


def loadYaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


class _FlowDict(dict):
    """Marker so `target: {kind: ..., name: ...}` stays on one line while everything else is block style."""


class _Dumper(yaml.SafeDumper):
    pass


_Dumper.add_representer(_FlowDict, lambda dumper, data: dumper.represent_mapping("tag:yaml.org,2002:map", data, flow_style=True))
_Dumper.add_representer(
    list, lambda dumper, data: dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=all(isinstance(x, str) for x in data))
)


def dumpMapping(doc: dict) -> str:
    doc = dict(doc)
    doc["rows"] = [
        {key: (_FlowDict(value) if key == "target" and isinstance(value, dict) else value) for key, value in orderRow(row).items()}
        for row in doc.get("rows", [])
    ]
    body = yaml.dump(doc, Dumper=_Dumper, sort_keys=False, default_flow_style=False, width=1000, allow_unicode=True)
    return HEADER + "\n" + body


def orderRow(row: dict) -> dict:
    ordered = {key: row[key] for key in ROW_KEYS if key in row}
    for key in row:
        if key not in ordered:
            ordered[key] = row[key]
    return ordered


# --------------------------------------------------------------------------- checks
def snakeCase(apiName: str) -> str:
    name = re.sub(r"__(c|r|s)$", "", apiName)
    name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name)
    name = re.sub(r"[^A-Za-z0-9]+", "_", name)
    return re.sub(r"_+", "_", name).strip("_").lower()


def expectedColumn(objectTable: str, field: dict) -> str:
    base = snakeCase(field["name"])
    if field.get("type") == "Lookup" or field.get("type") == "MasterDetail":
        base += "_id"
    return f"{objectTable}.{base}"


def validateMapping(doc: dict, inv: dict) -> list[str]:
    errors: list[str] = []
    ids = inventoryIds(inv)
    rows = doc.get("rows")
    if not isinstance(rows, list):
        return ["mapping.yaml: top-level `rows` list is missing"]

    seen = Counter(row.get("id") for row in rows if isinstance(row, dict))
    for rowId, count in sorted(seen.items()):
        if rowId not in ids:
            errors.append(f"{rowId}: not an inventory id (stale row? run --sync)")
        elif count > 1:
            errors.append(f"{rowId}: appears {count} times (must be exactly once)")
    for rowId in ids:
        if rowId not in seen:
            errors.append(f"{rowId}: inventory id has no mapping row (run --sync)")

    objectTables = {}
    for row in rows:
        if isinstance(row, dict) and row.get("id", "").startswith("object:") and isinstance(row.get("target"), dict):
            objectTables[row["id"][len("object:"):]] = row["target"].get("name")
    fieldsByName = {f"{o['name']}.{f['name']}": f for o in inv.get("objects", []) for f in o.get("fields", [])}

    for index, row in enumerate(rows):
        where = f"rows[{index}]"
        if not isinstance(row, dict):
            errors.append(f"{where}: not a mapping")
            continue
        rowId = row.get("id")
        where = str(rowId or where)
        for key in REQUIRED_ROW_KEYS:
            if key not in row:
                errors.append(f"{where}: missing `{key}`")
        unknown = [key for key in row if key not in ROW_KEYS]
        if unknown:
            errors.append(f"{where}: unknown keys {unknown}")
        status = row.get("status")
        disposition = row.get("disposition")
        if status not in STATUSES:
            errors.append(f"{where}: status {status!r} not in {STATUSES}")
        if disposition not in DISPOSITIONS:
            errors.append(f"{where}: disposition {disposition!r} not in {DISPOSITIONS}")
        if (disposition == "dropped") != (status == "dropped"):
            errors.append(f"{where}: disposition `dropped` <=> status `dropped` (got {disposition}/{status})")
        if disposition in ("dropped", "substitute") and not str(row.get("reason") or "").strip():
            errors.append(f"{where}: {disposition} rows need a `reason`")
        ticket = row.get("ticket")
        if not isinstance(ticket, str) or not TICKET_RE.match(ticket):
            errors.append(f"{where}: ticket {ticket!r} must look like UNT3-12")
        tests = row.get("parity_tests")
        if not isinstance(tests, list) or any(not isinstance(t, str) or not SCENARIO_RE.match(t) for t in tests):
            errors.append(f"{where}: parity_tests must be a list of kebab-case scenario ids")
        elif len(set(tests)) != len(tests):
            errors.append(f"{where}: parity_tests has duplicates")
        if status in ("tested", "passing") and not tests:
            errors.append(f"{where}: status {status} requires at least one parity test")

        sourceKind = rowId.split(":", 1)[0] if isinstance(rowId, str) and ":" in rowId else None
        target = row.get("target")
        if disposition == "dropped":
            if target is not None:
                errors.append(f"{where}: dropped rows must have target: null")
            continue
        if not isinstance(target, dict) or not target.get("kind") or not target.get("name"):
            errors.append(f"{where}: target must be {{kind, name[, type]}} unless dropped")
            continue
        kind, name = target["kind"], str(target["name"])
        if kind not in TARGET_KINDS:
            errors.append(f"{where}: target kind {kind!r} not in {list(TARGET_KINDS)}")
            continue
        pattern, description = TARGET_KINDS[kind]
        if not re.match(pattern, name):
            errors.append(f"{where}: target name {name!r} violates the {kind} convention ({description})")
        allowed = KIND_MATRIX.get(sourceKind)
        if allowed is not None and kind not in allowed:
            errors.append(f"{where}: source kind {sourceKind} cannot map to target kind {kind} (allowed: {sorted(allowed)})")
        if sourceKind == "field" and kind == "column":
            field = fieldsByName.get(rowId[len("field:"):])
            objectName = rowId[len("field:"):].split(".", 1)[0]
            table = objectTables.get(objectName)
            if field is not None and table:
                expected = expectedColumn(table, field)
                if name != expected and not str(row.get("convention_exception") or "").strip():
                    errors.append(f"{where}: column {name!r} differs from the convention {expected!r}; set `convention_exception` with the reason")
            if not target.get("type"):
                errors.append(f"{where}: column targets need a `type`")
    return errors


def coverageErrors(doc: dict) -> list[str]:
    """UNT3-25: every ported/substitute row must be covered by at least one parity scenario."""
    errors = []
    for row in doc.get("rows", []):
        if row.get("disposition") in ("port", "substitute") and row.get("status") in ("ported", "tested", "passing") and not row.get("parity_tests"):
            errors.append(f"{row.get('id')}: {row.get('status')} but no parity_tests")
    return errors


# --------------------------------------------------------------------------- render
def mdEscape(text) -> str:
    return str(text if text is not None else "").replace("|", "\\|").replace("\n", " ")


def targetLabel(row: dict) -> str:
    target = row.get("target")
    if not target:
        return "—"
    label = f"`{target['name']}`"
    if target.get("type"):
        label += f" ({target['type']})"
    return f"{target['kind']} {label}"


def renderMarkdown(doc: dict, inv: dict) -> str:
    ids = inventoryIds(inv)
    rows = [row for row in doc.get("rows", []) if isinstance(row, dict)]
    byKind: dict[str, list[dict]] = {}
    for row in rows:
        byKind.setdefault(str(row.get("id", "")).split(":", 1)[0], []).append(row)

    out = ["# 1:1 mapping matrix", ""]
    out.append("Rendered from [`mapping.yaml`](mapping.yaml) by `python3 tools/mapping/mapping.py --render`; "
               "CI runs `--check`. One row per inventory id from [`inventory.json`](inventory.json). "
               "Edit the YAML, never this file.")
    out.append("")
    conventions = doc.get("conventions") or {}
    if conventions:
        out.append("## Conventions")
        out.append("")
        for key, value in conventions.items():
            if isinstance(value, dict):
                out.append(f"- **{key}**")
                for subKey, subValue in value.items():
                    out.append(f"  - {subKey}: {subValue}")
            elif isinstance(value, list):
                out.append(f"- **{key}**: {', '.join(f'`{v}`' for v in value)}")
            else:
                out.append(f"- **{key}**: {value}")
        out.append("")
    statusCounts = Counter(row.get("status") for row in rows)
    dispositionCounts = Counter(row.get("disposition") for row in rows)
    out.append("## Summary")
    out.append("")
    out.append(f"- Rows: **{len(rows)}** (inventory ids: {len(ids)})")
    out.append("- Status: " + ", ".join(f"{s} **{statusCounts.get(s, 0)}**" for s in STATUSES))
    out.append("- Disposition: " + ", ".join(f"{d} **{dispositionCounts.get(d, 0)}**" for d in DISPOSITIONS))
    out.append(f"- Rows with parity tests: **{sum(1 for r in rows if r.get('parity_tests'))}**")
    out.append("")
    out.append("| Source kind | Rows | mapped | ported | tested | passing | dropped | substitute |")
    out.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for kind, label in SOURCE_KINDS.items():
        kindRows = byKind.get(kind, [])
        if not kindRows:
            continue
        counts = Counter(r.get("status") for r in kindRows)
        substitutes = sum(1 for r in kindRows if r.get("disposition") == "substitute")
        out.append(f"| {label} | {len(kindRows)} | {counts.get('mapped', 0)} | {counts.get('ported', 0)} | {counts.get('tested', 0)} | {counts.get('passing', 0)} | {counts.get('dropped', 0)} | {substitutes} |")
    out.append("")
    for kind, label in SOURCE_KINDS.items():
        kindRows = byKind.get(kind, [])
        if not kindRows:
            continue
        out.append(f"## {label}")
        out.append("")
        out.append("| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |")
        out.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for row in kindRows:
            summary = row.get("source") or ids.get(row.get("id"), {}).get("summary", "")
            notes = row.get("notes") or ""
            if row.get("reason"):
                notes = f"**{row['disposition']}**: {row['reason']}" + (f" — {notes}" if notes else "")
            if row.get("convention_exception"):
                notes = f"{notes} (convention exception: {row['convention_exception']})".strip()
            tests = ", ".join(f"`{t}`" for t in row.get("parity_tests") or []) or "—"
            out.append(f"| `{mdEscape(row.get('id'))}` | {mdEscape(summary)} | {mdEscape(targetLabel(row))} | {row.get('disposition')} | {row.get('status')} | {row.get('ticket')} | {tests} | {mdEscape(notes)} |")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


# --------------------------------------------------------------------------- sync
def stubRow(rowId: str, meta: dict) -> dict:
    return {
        "id": rowId,
        "source": meta["summary"],
        "target": None,
        "disposition": "port",
        "status": "mapped",
        "ticket": "UNT3-4",
        "parity_tests": [],
        "notes": "TODO: new inventory artifact, map it (added by --sync)",
    }


def syncRows(doc: dict, inv: dict, prune: bool = False) -> tuple[dict, list[str]]:
    ids = inventoryIds(inv)
    existing = {row["id"]: row for row in doc.get("rows", []) if isinstance(row, dict) and "id" in row}
    messages = []
    rows = []
    for rowId, meta in ids.items():
        if rowId in existing:
            rows.append(orderRow(existing[rowId]))
        else:
            rows.append(stubRow(rowId, meta))
            messages.append(f"added stub row for {rowId}")
    for rowId in existing:
        if rowId not in ids:
            if prune:
                messages.append(f"pruned stale row {rowId}")
            else:
                rows.append(orderRow(existing[rowId]))
                messages.append(f"stale row {rowId} kept (use --prune to remove)")
    newDoc = dict(doc)
    newDoc["rows"] = rows
    return newDoc, messages


# --------------------------------------------------------------------------- cli
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    parser.add_argument("--md", type=Path, default=DEFAULT_MD)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--check", action="store_true", help="validate and fail if mapping.md is stale (CI)")
    group.add_argument("--render", action="store_true", help="write mapping.md from mapping.yaml")
    group.add_argument("--sync", action="store_true", help="add stub rows for new inventory ids, sort, rewrite yaml + md")
    group.add_argument("--ids", action="store_true", help="print the inventory ids")
    parser.add_argument("--prune", action="store_true", help="with --sync: drop rows whose id left the inventory")
    parser.add_argument("--require-coverage", action="store_true", help="with --check: ported/substitute rows need parity_tests (UNT3-25)")
    args = parser.parse_args(argv)

    inv = json.loads(args.inventory.read_text(encoding="utf-8"))
    if args.ids:
        for rowId, meta in inventoryIds(inv).items():
            print(f"{rowId}\t{meta['summary']}")
        return 0

    doc = loadYaml(args.mapping)
    if args.sync:
        doc, messages = syncRows(doc, inv, prune=args.prune)
        args.mapping.write_text(dumpMapping(doc), encoding="utf-8")
        args.md.write_text(renderMarkdown(doc, inv), encoding="utf-8")
        for message in messages:
            print(message)
        print(f"wrote {args.mapping} and {args.md} ({len(doc['rows'])} rows)")
        errors = validateMapping(doc, inv)
        for error in errors:
            print(f"WARN {error}")
        return 0

    errors = validateMapping(doc, inv)
    if args.render:
        args.md.write_text(renderMarkdown(doc, inv), encoding="utf-8")
        print(f"wrote {args.md}")
    if args.check:
        if args.require_coverage:
            errors += coverageErrors(doc)
        rendered = renderMarkdown(doc, inv)
        if not args.md.exists() or args.md.read_text(encoding="utf-8") != rendered:
            errors.append(f"{args.md.relative_to(REPO_ROOT) if args.md.is_relative_to(REPO_ROOT) else args.md} is stale: run python3 tools/mapping/mapping.py --render")
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"{len(errors)} mapping error(s)", file=sys.stderr)
        return 1
    rows = doc.get("rows", [])
    print(f"mapping OK: {len(rows)} rows cover {len(inventoryIds(inv))} inventory ids exactly once")
    return 0


if __name__ == "__main__":
    sys.exit(main())
