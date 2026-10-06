#!/usr/bin/env python3
"""Inventory every artifact in the SFDX source (salesforce/force-app).

Parses the metadata offline (stdlib only, no org) and emits
docs/migration/inventory.json plus a short docs/migration/inventory.md.
The output is deterministic (no timestamps, sorted collections) and the
script asserts that every file under force-app is claimed by exactly one
inventory entry.

    python3 tools/inventory/inventory.py            # regenerate both files
    python3 tools/inventory/inventory.py --check    # fail if committed output is stale
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://soap.sforce.com/2006/04/metadata}"
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "salesforce" / "force-app"
DEFAULT_JSON = REPO_ROOT / "docs" / "migration" / "inventory.json"
DEFAULT_MD = REPO_ROOT / "docs" / "migration" / "inventory.md"

CUSTOM_SUFFIXES = ("__c", "__mdt", "__e", "__x", "__b", "__kav", "__Share", "__History", "__Feed")
LDS_MODULES = {
    "lightning/uiRecordApi",
    "lightning/uiObjectInfoApi",
    "lightning/uiListApi",
    "lightning/uiListsApi",
    "lightning/uiRelatedListApi",
    "lightning/uiAppsApi",
    "lightning/uiSearchApi",
}
SOQL_KEYWORDS = {
    "select", "from", "where", "and", "or", "not", "in", "like", "limit", "offset", "order", "by",
    "asc", "desc", "nulls", "first", "last", "group", "having", "with", "user_mode", "system_mode",
    "security_enforced", "true", "false", "null", "count", "for", "update", "view", "reference",
    "includes", "excludes", "using", "scope", "typeof", "when", "then", "else", "end",
}
DML_VERBS = ("insert", "update", "delete", "upsert", "undelete", "merge")


# --------------------------------------------------------------------------- helpers
PATH_BASE = REPO_ROOT


def relPath(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(PATH_BASE).as_posix()
    except ValueError:
        return resolved.relative_to(REPO_ROOT).as_posix()


def isCustomSObject(name: str) -> bool:
    return name.endswith(CUSTOM_SUFFIXES)


def readXml(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def tag(elem: ET.Element) -> str:
    return elem.tag.replace(NS, "")


def childText(elem: ET.Element | None, name: str, default=None):
    if elem is None:
        return default
    found = elem.find(NS + name)
    if found is None or found.text is None:
        return default
    return found.text.strip()


def childTexts(elem: ET.Element, name: str) -> list[str]:
    return [c.text.strip() for c in elem.findall(NS + name) if c.text]


def childBool(elem: ET.Element | None, name: str, default=None):
    text = childText(elem, name)
    if text is None:
        return default
    return text.lower() == "true"


def childInt(elem: ET.Element | None, name: str):
    text = childText(elem, name)
    return int(text) if text is not None and text.isdigit() else None


def elemToDict(elem: ET.Element):
    """Generic XML -> dict conversion (repeated children become lists)."""
    children = list(elem)
    if not children:
        text = (elem.text or "").strip()
        if text.lower() in ("true", "false"):
            return text.lower() == "true"
        return text
    result: dict = {}
    for child in children:
        key = tag(child)
        value = elemToDict(child)
        if key in result:
            if not isinstance(result[key], list):
                result[key] = [result[key]]
            result[key].append(value)
        else:
            result[key] = value
    return result


def uniqSorted(items) -> list:
    return sorted(set(items))


class Coverage:
    """Tracks which force-app files have been claimed by an inventory entry."""

    def __init__(self, sourceRoot: Path):
        global PATH_BASE
        self.sourceRoot = sourceRoot
        PATH_BASE = REPO_ROOT if sourceRoot.resolve().is_relative_to(REPO_ROOT) else sourceRoot.resolve().parent
        self.allFiles = sorted(relPath(p) for p in sourceRoot.rglob("*") if p.is_file())
        self.claims: dict[str, str] = {}

    def claim(self, path: Path | str, owner: str) -> str:
        rel = path if isinstance(path, str) else relPath(path)
        if rel in self.claims and self.claims[rel] != owner:
            raise AssertionError(f"{rel} claimed twice: {self.claims[rel]} and {owner}")
        self.claims[rel] = owner
        return rel

    def claimDir(self, directory: Path, owner: str) -> list[str]:
        return [self.claim(p, owner) for p in sorted(directory.rglob("*")) if p.is_file()]

    def report(self) -> dict:
        unaccounted = [f for f in self.allFiles if f not in self.claims]
        return {
            "sourceRoot": relPath(self.sourceRoot),
            "filesInForceApp": len(self.allFiles),
            "filesClaimed": len(self.claims),
            "unaccounted": unaccounted,
        }


class References:
    """Reverse index: who uses which artifact."""

    def __init__(self):
        self.edges: set[tuple[str, str, str, str, str]] = set()

    def add(self, fromKind: str, fromName: str, toKind: str, toName: str, via: str = ""):
        self.edges.add((fromKind, fromName, toKind, toName, via))

    def usedBy(self, toKind: str, toName: str) -> dict[str, list[str]]:
        result: dict[str, set[str]] = {}
        for fromKind, fromName, kind, name, via in self.edges:
            if kind == toKind and name == toName:
                label = f"{fromName} ({via})" if via else fromName
                result.setdefault(fromKind, set()).add(label)
        return {k: sorted(v) for k, v in sorted(result.items())}


# --------------------------------------------------------------------------- objects
FIELD_SIMPLE_ATTRS = [
    "label", "type", "required", "unique", "externalId", "length", "precision", "scale",
    "visibleLines", "defaultValue", "formula", "formulaTreatBlanksAs", "description",
    "inlineHelpText", "displayLocationInDecimal", "caseSensitive", "trackHistory",
    "trackFeedHistory", "trackTrending", "deleteConstraint", "relationshipName",
    "relationshipLabel", "referenceTo", "writeRequiresMasterRead", "reparentableMasterDetail",
]


def parseField(path: Path) -> dict:
    root = readXml(path)
    field: dict = {"name": childText(root, "fullName") or path.name.split(".")[0], "path": relPath(path)}
    for attr in FIELD_SIMPLE_ATTRS:
        value = childText(root, attr)
        if value is None:
            continue
        if value.lower() in ("true", "false"):
            field[attr] = value.lower() == "true"
        elif value.isdigit() and attr in ("length", "precision", "scale", "visibleLines"):
            field[attr] = int(value)
        else:
            field[attr] = value
    field.setdefault("required", False)
    if "referenceTo" in field:
        field["lookupTarget"] = field["referenceTo"]
    if "formula" in field:
        field["isFormula"] = True
    valueSet = root.find(NS + "valueSet")
    if valueSet is not None:
        picklist: dict = {"restricted": childBool(valueSet, "restricted", False)}
        definition = valueSet.find(NS + "valueSetDefinition")
        if definition is not None:
            picklist["sorted"] = childBool(definition, "sorted", False)
            picklist["values"] = [
                {
                    "fullName": childText(v, "fullName"),
                    "label": childText(v, "label"),
                    "default": childBool(v, "default", False),
                }
                for v in definition.findall(NS + "value")
            ]
        globalValueSet = childText(valueSet, "valueSetName")
        if globalValueSet:
            picklist["globalValueSet"] = globalValueSet
        field["picklist"] = picklist
    return field


def parseObjects(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    objectsDir = sourceRoot / "main" / "default" / "objects"
    objects = []
    for objDir in sorted(p for p in objectsDir.iterdir() if p.is_dir()) if objectsDir.exists() else []:
        name = objDir.name
        owner = f"object:{name}"
        entry: dict = {"name": name, "kind": "custom" if isCustomSObject(name) else "standard", "path": relPath(objDir)}
        metaFile = objDir / f"{name}.object-meta.xml"
        if metaFile.exists():
            root = readXml(metaFile)
            coverage.claim(metaFile, owner)
            entry.update(
                {
                    "label": childText(root, "label"),
                    "pluralLabel": childText(root, "pluralLabel"),
                    "sharingModel": childText(root, "sharingModel"),
                    "deploymentStatus": childText(root, "deploymentStatus"),
                    "visibility": childText(root, "visibility"),
                    "compactLayoutAssignment": childText(root, "compactLayoutAssignment"),
                    "nameField": elemToDict(root.find(NS + "nameField")) if root.find(NS + "nameField") is not None else None,
                    "features": {
                        tag(c): (c.text or "").strip().lower() == "true"
                        for c in root
                        if tag(c).startswith("enable") or tag(c) == "allowInChatterGroups"
                    },
                    "actionOverrides": [
                        {"actionName": childText(a, "actionName"), "type": childText(a, "type"), "content": childText(a, "content")}
                        for a in root.findall(NS + "actionOverrides")
                    ],
                }
            )
            inlineValidation = root.findall(NS + "validationRules")
            inlineRecordTypes = root.findall(NS + "recordTypes")
        else:
            inlineValidation, inlineRecordTypes = [], []

        fields = []
        for fieldFile in sorted((objDir / "fields").glob("*.field-meta.xml")) if (objDir / "fields").exists() else []:
            coverage.claim(fieldFile, owner)
            field = parseField(fieldFile)
            fields.append(field)
            if field.get("lookupTarget"):
                refs.add("object", name, "object", field["lookupTarget"], f"field {field['name']}")
        entry["fields"] = fields

        validationRules = [elemToDict(v) for v in inlineValidation]
        for ruleFile in sorted((objDir / "validationRules").glob("*.validationRule-meta.xml")) if (objDir / "validationRules").exists() else []:
            coverage.claim(ruleFile, owner)
            rule = elemToDict(readXml(ruleFile))
            rule["path"] = relPath(ruleFile)
            validationRules.append(rule)
        entry["validationRules"] = validationRules

        recordTypes = [elemToDict(v) for v in inlineRecordTypes]
        for rtFile in sorted((objDir / "recordTypes").glob("*.recordType-meta.xml")) if (objDir / "recordTypes").exists() else []:
            coverage.claim(rtFile, owner)
            rt = elemToDict(readXml(rtFile))
            rt["path"] = relPath(rtFile)
            recordTypes.append(rt)
        entry["recordTypes"] = recordTypes

        listViews = []
        for lvFile in sorted((objDir / "listViews").glob("*.listView-meta.xml")) if (objDir / "listViews").exists() else []:
            coverage.claim(lvFile, owner)
            root = readXml(lvFile)
            listViews.append(
                {
                    "name": childText(root, "fullName"),
                    "label": childText(root, "label"),
                    "columns": childTexts(root, "columns"),
                    "filterScope": childText(root, "filterScope"),
                    "filters": [elemToDict(f) for f in root.findall(NS + "filters")],
                    "path": relPath(lvFile),
                }
            )
        entry["listViews"] = listViews

        compactLayouts = []
        for clFile in sorted((objDir / "compactLayouts").glob("*.compactLayout-meta.xml")) if (objDir / "compactLayouts").exists() else []:
            coverage.claim(clFile, owner)
            root = readXml(clFile)
            compactLayouts.append(
                {"name": childText(root, "fullName"), "label": childText(root, "label"), "fields": childTexts(root, "fields"), "path": relPath(clFile)}
            )
        entry["compactLayouts"] = compactLayouts

        # Any other sub-folder (webLinks, fieldSets, businessProcesses, ...) is still inventoried generically.
        other = {}
        for sub in sorted(p for p in objDir.iterdir() if p.is_dir()):
            if sub.name in ("fields", "validationRules", "recordTypes", "listViews", "compactLayouts"):
                continue
            items = []
            for f in sorted(sub.rglob("*")):
                if f.is_file():
                    coverage.claim(f, owner)
                    items.append({"name": f.name.split(".")[0], "path": relPath(f)})
            other[sub.name] = items
        if other:
            entry["otherComponents"] = other
        objects.append(entry)
    return objects


# --------------------------------------------------------------------------- apex
def stripApexComments(source: str) -> str:
    out = []
    i, n = 0, len(source)
    while i < n:
        c = source[i]
        if c == "'":
            j = i + 1
            while j < n and source[j] != "'":
                j += 2 if source[j] == "\\" else 1
            out.append(source[i : j + 1])
            i = j + 1
        elif source.startswith("//", i):
            j = source.find("\n", i)
            i = n if j == -1 else j
        elif source.startswith("/*", i):
            j = source.find("*/", i + 2)
            i = n if j == -1 else j + 2
            out.append(" ")
        else:
            out.append(c)
            i += 1
    return "".join(out)


def skipString(text: str, i: int) -> int:
    quote = text[i]
    j = i + 1
    while j < len(text) and text[j] != quote:
        j += 2 if text[j] == "\\" else 1
    return j + 1


def matchBrace(text: str, openIdx: int, openChar="{", closeChar="}") -> int:
    depth = 0
    i = openIdx
    while i < len(text):
        c = text[i]
        if c == "'":
            i = skipString(text, i)
            continue
        if c == openChar:
            depth += 1
        elif c == closeChar:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced braces")


def splitMembers(body: str) -> list[tuple[str, str | None]]:
    members = []
    i, start, depthParen = 0, 0, 0
    while i < len(body):
        c = body[i]
        if c == "'":
            i = skipString(body, i)
            continue
        if c == "(":
            depthParen += 1
        elif c == ")":
            depthParen -= 1
        elif c == ";" and depthParen == 0:
            header = body[start:i].strip()
            if header:
                members.append((header, None))
            start = i + 1
        elif c == "{" and depthParen == 0:
            j = matchBrace(body, i)
            members.append((body[start:i].strip(), body[i + 1 : j]))
            start = j + 1
            i = j
        i += 1
    tail = body[start:].strip()
    if tail:
        members.append((tail, None))
    return members


ANNOTATION_RE = re.compile(r"@(\w+)(?:\s*\(([^)]*)\))?")
MODIFIERS = ("public", "private", "protected", "global", "static", "override", "virtual", "abstract", "testMethod", "webService", "final", "transient")
MODIFIER_RE = r"(?:(?:" + "|".join(MODIFIERS) + r")\s+)*"
CLASS_RE = re.compile(
    r"^(?P<mods>" + MODIFIER_RE + r")(?:(?P<sharing>with|without|inherited)\s+sharing\s+)?(?:(?P<virt>virtual|abstract)\s+)?"
    r"(?P<kind>class|interface|enum)\s+(?P<name>\w+)(?:\s+extends\s+(?P<extends>[\w.<>, ]+?))?(?:\s+implements\s+(?P<implements>[\w.<>, ]+?))?\s*$",
    re.S,
)
METHOD_RE = re.compile(r"^(?P<mods>" + MODIFIER_RE + r")(?P<type>[\w.<>\[\],\s]+?)\s+(?P<name>\w+)\s*\((?P<params>.*)\)\s*$", re.S)
CTOR_RE = re.compile(r"^(?P<mods>" + MODIFIER_RE + r")(?P<name>\w+)\s*\((?P<params>.*)\)\s*$", re.S)
FIELD_RE = re.compile(r"^(?P<mods>" + MODIFIER_RE + r")(?P<type>[\w.<>\[\],\s]+?)\s+(?P<name>\w+)\s*(?:=\s*(?P<init>.+))?$", re.S)


def splitAnnotations(header: str) -> tuple[list[dict], str]:
    annotations = []
    rest = header.strip()
    while rest.startswith("@"):
        m = ANNOTATION_RE.match(rest)
        if not m:
            break
        annotations.append({"name": m.group(1), "params": " ".join((m.group(2) or "").split()) or None})
        rest = rest[m.end() :].strip()
    return annotations, rest


def splitParams(params: str) -> list[dict]:
    result, depth, current = [], 0, []
    for ch in params:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth -= 1
        if ch == "," and depth == 0:
            result.append("".join(current))
            current = []
        else:
            current.append(ch)
    if "".join(current).strip():
        result.append("".join(current))
    out = []
    for p in result:
        parts = p.strip().split()
        if len(parts) >= 2:
            out.append({"type": " ".join(parts[:-1]), "name": parts[-1]})
    return out


def visibilityOf(mods: str) -> str:
    for v in ("global", "public", "protected", "private"):
        if re.search(r"\b" + v + r"\b", mods):
            return v
    return "private"


def findSoql(body: str) -> list[tuple[int, int, str]]:
    spans = []
    i = 0
    while i < len(body):
        c = body[i]
        if c == "'":
            i = skipString(body, i)
            continue
        if c == "[":
            m = re.match(r"\[\s*(SELECT|FIND)\b", body[i:], re.I)
            if m:
                j = matchBrace(body, i, "[", "]")
                spans.append((i, j + 1, body[i + 1 : j]))
                i = j + 1
                continue
        i += 1
    return spans


def soqlFields(clause: str) -> list[str]:
    fields = []
    for token in re.findall(r"[A-Za-z_][\w.]*(?:\(\))?", clause):
        base = token.rstrip("()")
        if base.lower() in SOQL_KEYWORDS or base.startswith(":"):
            continue
        if re.fullmatch(r"\d+", base):
            continue
        fields.append(token if not token.endswith("()") else token.upper())
    return fields


def describeSoql(query: str) -> dict:
    normalized = " ".join(query.split())
    kind = "SOSL" if normalized.upper().startswith("FIND") else "SOQL"
    info: dict = {"kind": kind, "query": normalized}
    if kind == "SOQL":
        fromMatch = re.search(r"\bFROM\s+(\w+)", normalized, re.I)
        info["sobject"] = fromMatch.group(1) if fromMatch else None
        selectMatch = re.search(r"\bSELECT\s+(.*?)\s+FROM\b", normalized, re.I | re.S)
        selected = soqlFields(selectMatch.group(1)) if selectMatch else []
        whereMatch = re.search(r"\bWHERE\s+(.*?)(?:\s+WITH\s+|\s+ORDER\s+BY\s+|\s+GROUP\s+BY\s+|\s+LIMIT\s+|\s+OFFSET\s+|$)", normalized, re.I | re.S)
        whereFields = []
        if whereMatch:
            whereClause = re.sub(r"'[^']*'", "''", whereMatch.group(1))
            whereClause = re.sub(r":\w+", "", whereClause)
            whereFields = soqlFields(whereClause)
        orderMatch = re.search(r"\bORDER\s+BY\s+(.*?)(?:\s+LIMIT\s+|\s+OFFSET\s+|$)", normalized, re.I | re.S)
        orderFields = soqlFields(orderMatch.group(1)) if orderMatch else []
        info["selectedFields"] = selected
        info["filterFields"] = uniqSorted(whereFields)
        info["orderBy"] = orderFields
        info["bindVariables"] = uniqSorted(re.findall(r":(\w+)", normalized))
        securityMatch = re.search(r"\bWITH\s+(USER_MODE|SYSTEM_MODE|SECURITY_ENFORCED)\b", normalized, re.I)
        info["securityMode"] = securityMatch.group(1).upper() if securityMatch else None
        info["aggregate"] = bool(re.search(r"\bCOUNT\s*\(", normalized, re.I))
        info["hasLimit"] = bool(re.search(r"\bLIMIT\b", normalized, re.I))
        info["hasOffset"] = bool(re.search(r"\bOFFSET\b", normalized, re.I))
    else:
        info["sobjects"] = uniqSorted(re.findall(r"RETURNING\s+(\w+)", normalized, re.I))
    return info


def resolveDeclaredType(body: str, params: list[dict], identifier: str) -> str | None:
    for p in params:
        if p["name"] == identifier:
            return p["type"]
    m = re.search(r"\b((?:List|Set|Map)\s*<[^>]+>|[\w.]+)\s+" + re.escape(identifier) + r"\s*(?:=|;|,|\))", body)
    return m.group(1).replace(" ", "") if m else None


def sobjectFromType(apexType: str | None) -> str | None:
    if not apexType:
        return None
    m = re.match(r"(?:List|Set)<(\w+)>", apexType)
    if m:
        return m.group(1)
    m = re.match(r"Map<\w+,\s*(\w+)>", apexType)
    if m:
        return m.group(1)
    return apexType if re.fullmatch(r"\w+", apexType) else None


def findDml(body: str, params: list[dict], soqlSpans) -> list[dict]:
    operations = []

    def insideSoql(pos: int) -> bool:
        return any(s <= pos < e for s, e, _ in soqlSpans)

    for m in re.finditer(r"(?<![\w.])(" + "|".join(DML_VERBS) + r")\s+(?=[\w\[(])", body, re.I):
        if insideSoql(m.start()):
            continue
        end = body.find(";", m.end())
        target = " ".join(body[m.end() : end if end != -1 else None].split())
        op = {"operation": m.group(1).lower(), "target": target, "sobject": None}
        if target.startswith("["):
            fromMatch = re.search(r"\bFROM\s+(\w+)", target, re.I)
            op["sobject"] = fromMatch.group(1) if fromMatch else None
        elif target.startswith("new "):
            newMatch = re.match(r"new\s+(?:List<\s*)?(\w+)", target)
            op["sobject"] = newMatch.group(1) if newMatch else None
        else:
            ident = re.match(r"\w+", target)
            op["sobject"] = sobjectFromType(resolveDeclaredType(body, params, ident.group(0))) if ident else None
        operations.append(op)
    for m in re.finditer(r"\bDatabase\.(" + "|".join(DML_VERBS) + r"|query|queryWithBinds|getQueryLocator|executeBatch|convertLead|emptyRecycleBin)\s*\(", body, re.I):
        end = matchBrace(body, m.end() - 1, "(", ")")
        args = " ".join(body[m.end() : end].split())
        firstArg = args.split(",")[0].strip()
        ident = re.match(r"\w+$", firstArg)
        operations.append(
            {
                "operation": f"Database.{m.group(1)}",
                "target": args,
                "sobject": sobjectFromType(resolveDeclaredType(body, params, ident.group(0))) if ident else None,
            }
        )
    return operations


def resolveStringValue(identifier: str, body: str, constants: dict[str, str]) -> str | None:
    if identifier in constants:
        return constants[identifier]
    m = re.search(r"\b" + re.escape(identifier) + r"\s*=\s*([^;]+);", body)
    if not m:
        return None
    value = m.group(1).strip()
    lit = re.match(r"^'([^']*)'$", value)
    if lit:
        return lit.group(1)
    ident = re.match(r"^(\w+)$", value)
    if ident:
        return constants.get(ident.group(1))
    return None


def findCallouts(body: str, constants: dict[str, str]) -> list[dict]:
    callouts = []
    httpUsed = bool(re.search(r"\bnew\s+Http(Request)?\s*\(|\.send\s*\(", body))
    for m in re.finditer(r"\.setEndpoint\s*\(\s*([^)]*)\)", body):
        arg = m.group(1).strip()
        lit = re.match(r"^'([^']*)'", arg)
        endpoint = lit.group(1) if lit else resolveStringValue(re.match(r"\w+", arg).group(0), body, constants) if re.match(r"\w+", arg) else None
        entry = {"type": "http", "endpointExpression": arg, "endpoint": endpoint}
        named = re.match(r"callout:(\w+)", endpoint or arg)
        if named:
            entry["namedCredential"] = named.group(1)
        callouts.append(entry)
    if httpUsed and not callouts:
        callouts.append({"type": "http", "endpointExpression": None, "endpoint": None})
    for m in re.finditer(r"\bnew\s+(\w+\.\w+)\s*\(", body):
        if m.group(1).lower().endswith(("soap", "port", "service")) and "Http" not in m.group(1):
            callouts.append({"type": "soap", "stub": m.group(1), "endpoint": None})
    return callouts


def parseApexBody(className: str, body: str, parentConstants: dict[str, str] | None = None) -> dict:
    members = splitMembers(body)
    constants: dict[str, str] = dict(parentConstants or {})
    fields, properties, methods, innerClasses, initializers = [], [], [], [], []

    # First pass: constants (string literals) so method analysis can resolve them.
    for header, block in members:
        annotations, rest = splitAnnotations(header)
        if block is None or "=" in rest.split("(")[0]:
            fm = FIELD_RE.match(rest)
            if fm and fm.group("init"):
                lit = re.match(r"^'([^']*)'\s*$", fm.group("init").strip())
                if lit:
                    constants[fm.group("name")] = lit.group(1)

    for header, block in members:
        annotations, rest = splitAnnotations(header)
        annotationNames = [a["name"] for a in annotations]
        cm = CLASS_RE.match(rest)
        if cm and block is not None:
            inner = parseApexBody(cm.group("name"), block, constants)
            inner.update(
                {
                    "name": cm.group("name"),
                    "kind": cm.group("kind"),
                    "visibility": visibilityOf(cm.group("mods")),
                    "annotations": annotations,
                    "implements": [s.strip() for s in (cm.group("implements") or "").split(",") if s.strip()],
                    "extends": cm.group("extends"),
                }
            )
            innerClasses.append(inner)
            continue
        if block is not None and not rest:
            initializers.append({"kind": "instance initializer"})
            continue
        if block is not None and rest == "static":
            initializers.append({"kind": "static initializer"})
            continue
        if block is not None and "=" not in rest.split("(")[0]:
            mm = METHOD_RE.match(rest)
            if mm is None:
                cc = CTOR_RE.match(rest)
                if cc and cc.group("name") == className:
                    mm = cc
            if mm and "(" in rest:
                params = splitParams(mm.group("params"))
                soqlSpans = findSoql(block)
                mods = mm.group("mods")
                method = {
                    "name": mm.group("name"),
                    "visibility": visibilityOf(mods),
                    "static": bool(re.search(r"\bstatic\b", mods)),
                    "returnType": " ".join(mm.group("type").split()) if "type" in mm.groupdict() and mm.groupdict().get("type") else None,
                    "parameters": params,
                    "annotations": annotations,
                    "isTest": "isTest" in annotationNames or bool(re.search(r"\btestMethod\b", mods)),
                    "soql": [describeSoql(q) for _, _, q in soqlSpans],
                    "dml": findDml(block, params, soqlSpans),
                    "callouts": findCallouts(block, constants),
                    "exposure": [],
                }
                if "AuraEnabled" in annotationNames:
                    method["exposure"].append("AuraEnabled")
                if "InvocableMethod" in annotationNames:
                    method["exposure"].append("InvocableMethod")
                for httpAnn in ("HttpGet", "HttpPost", "HttpPut", "HttpPatch", "HttpDelete"):
                    if httpAnn in annotationNames:
                        method["exposure"].append(httpAnn)
                if re.search(r"\bwebService\b", mods):
                    method["exposure"].append("webService")
                if "RemoteAction" in annotationNames:
                    method["exposure"].append("RemoteAction")
                if method["visibility"] in ("public", "global") and not method["exposure"] and not method["isTest"]:
                    method["exposure"].append(method["visibility"])
                methods.append(method)
                continue
            # property with accessors
            pm = FIELD_RE.match(rest)
            if pm:
                properties.append(
                    {
                        "name": pm.group("name"),
                        "type": " ".join(pm.group("type").split()),
                        "visibility": visibilityOf(pm.group("mods")),
                        "static": bool(re.search(r"\bstatic\b", pm.group("mods"))),
                        "annotations": annotations,
                        "accessors": " ".join(block.split()),
                    }
                )
                continue
        fm = FIELD_RE.match(rest)
        if fm:
            init = fm.group("init")
            if init is None and block is not None:
                init = "{" + " ".join(block.split()) + "}"
            fields.append(
                {
                    "name": fm.group("name"),
                    "type": " ".join(fm.group("type").split()),
                    "visibility": visibilityOf(fm.group("mods")),
                    "static": bool(re.search(r"\bstatic\b", fm.group("mods"))),
                    "final": bool(re.search(r"\bfinal\b", fm.group("mods"))),
                    "annotations": annotations,
                    "initializer": " ".join(init.split()) if init else None,
                }
            )
    return {"fields": fields, "properties": properties, "methods": methods, "innerClasses": innerClasses, "initializers": initializers}


def collectMethods(node: dict, prefix: str = "") -> list[tuple[str, dict]]:
    out = [(prefix + m["name"], m) for m in node.get("methods", [])]
    for inner in node.get("innerClasses", []):
        out.extend(collectMethods(inner, prefix + inner["name"] + "."))
    return out


def parseApexClass(path: Path, coverage: Coverage) -> dict:
    owner = f"apexClass:{path.stem}"
    coverage.claim(path, owner)
    meta = path.with_name(path.name + "-meta.xml")
    entry: dict = {"name": path.stem, "path": relPath(path)}
    if meta.exists():
        coverage.claim(meta, owner)
        root = readXml(meta)
        entry["apiVersion"] = childText(root, "apiVersion")
        entry["status"] = childText(root, "status")
    source = stripApexComments(path.read_text(encoding="utf-8"))
    headerEnd = source.find("{")
    header = source[:headerEnd]
    annotations, rest = splitAnnotations(header)
    cm = CLASS_RE.match(rest.strip())
    body = source[headerEnd + 1 : matchBrace(source, headerEnd)]
    parsed = parseApexBody(path.stem, body)
    entry.update(
        {
            "kind": cm.group("kind") if cm else "class",
            "visibility": visibilityOf(cm.group("mods")) if cm else None,
            "sharing": (cm.group("sharing") + " sharing") if cm and cm.group("sharing") else "omitted",
            "isAbstractOrVirtual": cm.group("virt") if cm else None,
            "extends": cm.group("extends") if cm else None,
            "implements": [s.strip() for s in (cm.group("implements") or "").split(",") if s.strip()] if cm else [],
            "annotations": annotations,
            "isTest": any(a["name"] == "isTest" for a in annotations),
        }
    )
    restResource = next((a for a in annotations if a["name"] == "RestResource"), None)
    entry["restResource"] = restResource["params"] if restResource else None
    entry.update(parsed)
    allMethods = collectMethods(parsed)
    entry["summary"] = {
        "methodCount": len(allMethods),
        "exposedMethods": sorted(name for name, m in allMethods if set(m["exposure"]) & {"AuraEnabled", "InvocableMethod", "webService", "RemoteAction", "HttpGet", "HttpPost", "HttpPut", "HttpPatch", "HttpDelete"}),
        "testMethods": sorted(name for name, m in allMethods if m["isTest"]),
        "soqlObjects": uniqSorted(q.get("sobject") for _, m in allMethods for q in m["soql"] if q.get("sobject")),
        "dmlObjects": uniqSorted(d["sobject"] for _, m in allMethods for d in m["dml"] if d["sobject"]),
        "dmlOperations": uniqSorted(d["operation"] for _, m in allMethods for d in m["dml"]),
        "callouts": [c for _, m in allMethods for c in m["callouts"]],
        "stringConstants": {f["name"]: f["initializer"] for f in parsed["fields"] if f["final"] and f["initializer"] and f["initializer"].startswith("'")},
    }
    return entry


def parseApexTrigger(path: Path, coverage: Coverage) -> dict:
    owner = f"apexTrigger:{path.stem}"
    coverage.claim(path, owner)
    meta = path.with_name(path.name + "-meta.xml")
    entry: dict = {"name": path.stem, "path": relPath(path)}
    if meta.exists():
        coverage.claim(meta, owner)
        root = readXml(meta)
        entry["apiVersion"] = childText(root, "apiVersion")
        entry["status"] = childText(root, "status")
    source = stripApexComments(path.read_text(encoding="utf-8"))
    m = re.match(r"\s*trigger\s+(\w+)\s+on\s+(\w+)\s*\(([^)]*)\)\s*\{", source)
    body = source[source.find("{") + 1 : matchBrace(source, source.find("{"))]
    soqlSpans = findSoql(body)
    entry.update(
        {
            "sobject": m.group(2) if m else None,
            "events": [e.strip() for e in m.group(3).split(",")] if m else [],
            "soql": [describeSoql(q) for _, _, q in soqlSpans],
            "dml": findDml(body, [], soqlSpans),
            "handlerClasses": uniqSorted(re.findall(r"\b([A-Z]\w+)\.\w+\s*\(", body)),
        }
    )
    return entry


def parseApex(sourceRoot: Path, coverage: Coverage, refs: References) -> dict:
    classesDir = sourceRoot / "main" / "default" / "classes"
    triggersDir = sourceRoot / "main" / "default" / "triggers"
    classes = [parseApexClass(p, coverage) for p in sorted(classesDir.glob("*.cls"))] if classesDir.exists() else []
    triggers = [parseApexTrigger(p, coverage) for p in sorted(triggersDir.glob("*.trigger"))] if triggersDir.exists() else []
    classNames = {c["name"] for c in classes}
    sources = {c["name"]: stripApexComments((PATH_BASE / c["path"]).read_text(encoding="utf-8")) for c in classes}

    for cls in classes:
        referenced = set()
        for other in classNames - {cls["name"]}:
            if re.search(r"\b" + re.escape(other) + r"\b", sources[cls["name"]]):
                referenced.add(other)
        cls["referencedClasses"] = sorted(referenced)
    for cls in classes:
        cls["testClasses"] = sorted(t["name"] for t in classes if t["isTest"] and cls["name"] in t["referencedClasses"]) if not cls["isTest"] else []
        cls["classesUnderTest"] = sorted(c for c in cls["referencedClasses"] if c in classNames and not next(x for x in classes if x["name"] == c)["isTest"]) if cls["isTest"] else []
        for obj in cls["summary"]["soqlObjects"]:
            refs.add("apexClass", cls["name"], "object", obj, "SOQL")
        for obj in cls["summary"]["dmlObjects"]:
            refs.add("apexClass", cls["name"], "object", obj, "DML")
        for name, m in collectMethods(cls):
            for q in m["soql"]:
                if q.get("sobject") == "StaticResource":
                    for res in re.findall(r"Name\s*=\s*'(\w+)'", q["query"]):
                        refs.add("apexClass", cls["name"], "staticResource", res, f"{name} SOQL")
                if q.get("sobject") == "PermissionSet":
                    for res in re.findall(r"Name\s*=\s*'(\w+)'", q["query"]):
                        refs.add("apexClass", cls["name"], "permissionSet", res, f"{name} SOQL")
        for other in cls["referencedClasses"]:
            refs.add("apexClass", cls["name"], "apexClass", other, "test" if cls["isTest"] else "reference")
    for trg in triggers:
        if trg["sobject"]:
            refs.add("apexTrigger", trg["name"], "object", trg["sobject"], "trigger")
        for h in trg["handlerClasses"]:
            if h in classNames:
                refs.add("apexTrigger", trg["name"], "apexClass", h, "handler")
    return {"classes": classes, "triggers": triggers}


# --------------------------------------------------------------------------- LWC / Aura
IMPORT_RE = re.compile(r"import\s+(?P<clause>[\w$\s{},*]+?)\s+from\s+['\"](?P<module>[^'\"]+)['\"]\s*;?|import\s+['\"](?P<bare>[^'\"]+)['\"]\s*;?", re.S)
WIRE_RE = re.compile(r"@wire\s*\(\s*(?P<adapter>[\w.]+)\s*(?:,\s*(?P<rest>.*?))?\)\s*\n\s*(?P<target>[\w$]+)\s*(?P<isMethod>\()?", re.S)


def parseImportClause(clause: str) -> list[dict]:
    bindings = []
    clause = clause.strip()
    named = re.search(r"\{([^}]*)\}", clause)
    if named:
        for spec in named.group(1).split(","):
            spec = spec.strip()
            if not spec:
                continue
            parts = re.split(r"\s+as\s+", spec)
            bindings.append({"imported": parts[0].strip(), "local": parts[-1].strip()})
        clause = clause[: named.start()] + clause[named.end() :]
    star = re.search(r"\*\s+as\s+(\w+)", clause)
    if star:
        bindings.append({"imported": "*", "local": star.group(1)})
        clause = clause.replace(star.group(0), "")
    default = clause.replace(",", " ").strip()
    if default:
        bindings.append({"imported": "default", "local": default.split()[0]})
    return bindings


def kebabToCamel(name: str) -> str:
    parts = name.split("-")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def analyzeLwcJs(source: str, lwcNames: set[str]) -> dict:
    deps: dict = {
        "apexMethods": [],
        "apexUtilities": [],
        "ldsWires": [],
        "wires": [],
        "schema": [],
        "messageChannels": [],
        "staticResources": [],
        "labels": [],
        "lightningModules": [],
        "salesforceModules": [],
        "childModules": [],
        "templates": [],
        "otherImports": [],
    }
    localNames: dict[str, tuple[str, str]] = {}
    for m in IMPORT_RE.finditer(source):
        module = m.group("module") or m.group("bare")
        bindings = parseImportClause(m.group("clause")) if m.group("clause") else []
        for b in bindings:
            localNames[b["local"]] = (module, b["imported"])
        if module.startswith("@salesforce/apex/"):
            deps["apexMethods"].append({"method": module[len("@salesforce/apex/") :], "local": bindings[0]["local"] if bindings else None})
        elif module == "@salesforce/apex":
            deps["apexUtilities"].extend(b["imported"] for b in bindings)
        elif module.startswith("@salesforce/schema/"):
            deps["schema"].extend([module[len("@salesforce/schema/") :]])
        elif module.startswith("@salesforce/messageChannel/"):
            deps["messageChannels"].append({"channel": module[len("@salesforce/messageChannel/") :], "local": bindings[0]["local"] if bindings else None})
        elif module.startswith("@salesforce/resourceUrl/"):
            deps["staticResources"].append(module[len("@salesforce/resourceUrl/") :])
        elif module.startswith("@salesforce/label/"):
            deps["labels"].append(module[len("@salesforce/label/") :])
        elif module.startswith("@salesforce/"):
            deps["salesforceModules"].append(module)
        elif module.startswith("lightning/"):
            deps["lightningModules"].append({"module": module, "imports": sorted(b["imported"] for b in bindings)})
        elif module.startswith("c/"):
            deps["childModules"].append(module[2:])
        elif module.startswith("./"):
            deps["templates"].append(module)
        elif module == "lwc":
            pass
        else:
            deps["otherImports"].append(module)

    # Resolve constant arrays of schema fields: const FIELDS = [A_FIELD, B_FIELD];
    constArrays: dict[str, list[str]] = {}
    for cm in re.finditer(r"const\s+(\w+)\s*=\s*\[([^\]]*)\]", source, re.S):
        items = [i.strip() for i in cm.group(2).split(",") if i.strip()]
        constArrays[cm.group(1)] = items
    constStrings: dict[str, str] = {m.group(1): m.group(2) for m in re.finditer(r"const\s+(\w+)\s*=\s*['\"]([^'\"]+)['\"]", source)}

    def resolveSchema(identifier: str) -> str:
        if identifier in localNames and localNames[identifier][0].startswith("@salesforce/schema/"):
            return localNames[identifier][0][len("@salesforce/schema/") :]
        if identifier in constStrings:
            return constStrings[identifier]
        return identifier.strip("'\"")

    for wm in WIRE_RE.finditer(source):
        adapter = wm.group("adapter")
        config = " ".join((wm.group("rest") or "").split())
        module, imported = localNames.get(adapter, (None, adapter))
        wire = {"adapter": adapter, "module": module, "target": wm.group("target"), "targetIsMethod": bool(wm.group("isMethod")), "config": config or None}
        if module in LDS_MODULES:
            wire["kind"] = "lds"
            fieldsMatch = re.search(r"\bfields\s*:\s*(\w+|\[[^\]]*\])", config) or re.search(r"(?:\{|,)\s*(fields)\s*(?:,|\})", config)
            resolvedFields: list[str] = []
            if fieldsMatch:
                expr = fieldsMatch.group(1)
                items = constArrays.get(expr, []) if not expr.startswith("[") else [i.strip() for i in expr[1:-1].split(",") if i.strip()]
                resolvedFields = [resolveSchema(i) for i in items]
            wire["fields"] = resolvedFields
            deps["schema"].extend(f for f in resolvedFields if re.fullmatch(r"\w+\.\w+", f))
            deps["ldsWires"].append(wire)
        elif module and module.startswith("@salesforce/apex/"):
            wire["kind"] = "apex"
            wire["apexMethod"] = module[len("@salesforce/apex/") :]
        elif module == "lightning/messageService":
            wire["kind"] = "messageService"
        else:
            wire["kind"] = "other"
        deps["wires"].append(wire)

    wiredApex = {w["apexMethod"] for w in deps["wires"] if w.get("kind") == "apex"}
    for am in deps["apexMethods"]:
        local = am["local"]
        am["usage"] = []
        if am["method"] in wiredApex:
            am["usage"].append("wire")
        if local and re.search(r"(?<![\w.@])" + re.escape(local) + r"\s*\(", source):
            am["usage"].append("imperative")
    for mc in deps["messageChannels"]:
        local = mc["local"]
        mc["roles"] = []
        if local and re.search(r"\bpublish\s*\([^)]*\b" + re.escape(local) + r"\b", source, re.S):
            mc["roles"].append("publish")
        if local and re.search(r"\bsubscribe\s*\([^)]*\b" + re.escape(local) + r"\b", source, re.S):
            mc["roles"].append("subscribe")
    deps["apiProperties"] = uniqSorted(re.findall(r"@api\s+(?:get\s+)?(\w+)", source))
    deps["navigation"] = "NavigationMixin" in source
    deps["toasts"] = "ShowToastEvent" in source
    deps["mobileCapabilities"] = uniqSorted(re.findall(r"\b(get\w+(?:Scanner|Service))\b", source)) if "lightning/mobileCapabilities" in source else []
    deps["schema"] = uniqSorted(deps["schema"])
    deps["staticResources"] = uniqSorted(deps["staticResources"])
    deps["childModules"] = uniqSorted(deps["childModules"])
    deps["apexUtilities"] = uniqSorted(deps["apexUtilities"])
    return deps


def parseLwc(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    lwcDir = sourceRoot / "main" / "default" / "lwc"
    if not lwcDir.exists():
        return []
    lwcNames = {p.name for p in lwcDir.iterdir() if p.is_dir()}
    components = []
    for compDir in sorted(p for p in lwcDir.iterdir() if p.is_dir()):
        name = compDir.name
        owner = f"lwc:{name}"
        files = coverage.claimDir(compDir, owner)
        entry: dict = {"name": name, "path": relPath(compDir), "files": files}
        meta = compDir / f"{name}.js-meta.xml"
        if meta.exists():
            root = readXml(meta)
            entry["apiVersion"] = childText(root, "apiVersion")
            entry["isExposed"] = childBool(root, "isExposed", False)
            entry["masterLabel"] = childText(root, "masterLabel")
            entry["description"] = childText(root, "description")
            targets = root.find(NS + "targets")
            entry["targets"] = childTexts(targets, "target") if targets is not None else []
            entry["targetConfigs"] = [elemToDict(tc) for tc in root.findall(NS + "targetConfigs")]
        jsFiles = sorted(p for p in compDir.glob("*.js"))
        source = "\n".join(p.read_text(encoding="utf-8") for p in jsFiles)
        entry["kind"] = "module" if not any(compDir.glob("*.html")) else "component"
        entry.update(analyzeLwcJs(source, lwcNames))
        htmlSource = "\n".join(p.read_text(encoding="utf-8") for p in sorted(compDir.rglob("*.html")))
        childTags = uniqSorted(kebabToCamel(t) for t in re.findall(r"<c-([a-z0-9-]+)", htmlSource))
        entry["childComponents"] = uniqSorted(childTags + [c for c in entry["childModules"] if c in lwcNames])
        entry["baseComponents"] = uniqSorted(re.findall(r"<(lightning-[a-z0-9-]+)", htmlSource))
        entry["tests"] = [f for f in files if "/__tests__/" in f]
        entry["hasCss"] = any(compDir.glob("*.css"))
        components.append(entry)

        for am in entry["apexMethods"]:
            cls = am["method"].split(".")[0]
            refs.add("lwc", name, "apexClass", cls, am["method"].split(".")[1])
        for s in entry["schema"]:
            refs.add("lwc", name, "object", s.split(".")[0], f"schema {s}")
        for mc in entry["messageChannels"]:
            refs.add("lwc", name, "messageChannel", mc["channel"].replace("__c", ""), "/".join(mc["roles"]) or "import")
        for sr in entry["staticResources"]:
            refs.add("lwc", name, "staticResource", sr, "resourceUrl")
        for child in entry["childComponents"]:
            refs.add("lwc", name, "lwc", child, "template" if child in childTags else "import")
    return components


def parseAura(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    auraDir = sourceRoot / "main" / "default" / "aura"
    if not auraDir.exists():
        return []
    bundles = []
    for bundleDir in sorted(p for p in auraDir.iterdir() if p.is_dir()):
        name = bundleDir.name
        owner = f"aura:{name}"
        files = coverage.claimDir(bundleDir, owner)
        entry: dict = {"name": name, "path": relPath(bundleDir), "files": files}
        cmp = bundleDir / f"{name}.cmp"
        app = bundleDir / f"{name}.app"
        markupFile = cmp if cmp.exists() else app if app.exists() else None
        entry["bundleType"] = "component" if cmp.exists() else "application" if app.exists() else "other"
        if markupFile:
            markup = markupFile.read_text(encoding="utf-8")
            rootTag = re.search(r"<aura:(component|application)\b([^>]*)>", markup, re.S)
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', rootTag.group(2))) if rootTag else {}
            entry["implements"] = [s.strip() for s in attrs.get("implements", "").split(",") if s.strip()]
            entry["access"] = attrs.get("access")
            entry["description"] = attrs.get("description")
            entry["apexController"] = attrs.get("controller")
            entry["attributes"] = [dict(re.findall(r'(\w+)="([^"]*)"', a)) for a in re.findall(r"<aura:attribute\b([^>]*)/?>", markup)]
            entry["baseComponents"] = uniqSorted(re.findall(r"<(lightning:[\w]+|force:[\w]+|ui:[\w]+)", markup))
            entry["childComponents"] = uniqSorted(re.findall(r"<c:(\w+)", markup))
            entry["ldsComponents"] = uniqSorted(re.findall(r"<(force:recordData|lightning:recordForm|lightning:recordEditForm|lightning:recordViewForm)", markup))
            if entry["apexController"]:
                refs.add("aura", name, "apexClass", entry["apexController"], "controller")
            for child in entry["childComponents"]:
                refs.add("aura", name, "lwc", child, "markup")
        meta = bundleDir / f"{name}.cmp-meta.xml"
        if meta.exists():
            root = readXml(meta)
            entry["apiVersion"] = childText(root, "apiVersion")
        design = bundleDir / f"{name}.design"
        if design.exists():
            designMarkup = design.read_text(encoding="utf-8")
            labelMatch = re.search(r'<design:component[^>]*label="([^"]*)"', designMarkup)
            entry["designLabel"] = labelMatch.group(1) if labelMatch else None
            entry["templateRegions"] = [dict(re.findall(r'(\w+)="([^"]*)"', r)) for r in re.findall(r"<flexipage:region\b([^>]*)>", designMarkup)]
        jsSource = "\n".join(p.read_text(encoding="utf-8") for p in sorted(bundleDir.glob("*.js")))
        entry["apexActions"] = uniqSorted(re.findall(r"component\.get\(\s*['\"]c\.(\w+)['\"]\s*\)", jsSource))
        bundles.append(entry)
    return bundles


# --------------------------------------------------------------------------- flows / pages / layouts
FLOW_ELEMENT_TAGS = (
    "actionCalls", "apexPluginCalls", "assignments", "collectionProcessors", "decisions", "loops", "recordCreates",
    "recordDeletes", "recordLookups", "recordUpdates", "recordRollbacks", "screens", "subflows", "waits", "steps",
    "transforms", "customErrors", "orchestratedStages",
)


def parseFlows(sourceRoot: Path, coverage: Coverage, refs: References, lwcNames: set[str], apexNames: set[str]) -> list[dict]:
    flowsDir = sourceRoot / "main" / "default" / "flows"
    if not flowsDir.exists():
        return []
    flows = []
    for flowFile in sorted(flowsDir.glob("*.flow-meta.xml")):
        name = flowFile.name.replace(".flow-meta.xml", "")
        coverage.claim(flowFile, f"flow:{name}")
        root = readXml(flowFile)
        start = root.find(NS + "start")
        entry: dict = {
            "name": name,
            "path": relPath(flowFile),
            "label": childText(root, "label"),
            "processType": childText(root, "processType"),
            "status": childText(root, "status"),
            "apiVersion": childText(root, "apiVersion"),
            "interviewLabel": childText(root, "interviewLabel"),
            "triggerType": childText(start, "triggerType") if start is not None else None,
            "triggerObject": childText(start, "object") if start is not None else None,
            "startElement": childText(start.find(NS + "connector"), "targetReference") if start is not None and start.find(NS + "connector") is not None else None,
            "runInMode": childText(root, "runInMode"),
        }
        elements: dict = {}
        apexActions, objects, screenComponents, lwcComponents, flowVariables = [], [], [], [], []
        for elementTag in FLOW_ELEMENT_TAGS:
            items = []
            for el in root.findall(NS + elementTag):
                item: dict = {"name": childText(el, "name"), "label": childText(el, "label")}
                obj = childText(el, "object")
                if obj:
                    item["object"] = obj
                    objects.append(obj)
                if elementTag == "actionCalls":
                    item["actionType"] = childText(el, "actionType")
                    item["actionName"] = childText(el, "actionName")
                    item["inputParameters"] = [childText(p, "name") for p in el.findall(NS + "inputParameters")]
                    item["outputParameters"] = [childText(p, "name") for p in el.findall(NS + "outputParameters")]
                    if item["actionType"] == "apex":
                        apexActions.append(item["actionName"])
                if elementTag in ("recordCreates", "recordUpdates"):
                    item["inputAssignments"] = [childText(a, "field") for a in el.findall(NS + "inputAssignments")]
                    item["inputReference"] = childText(el, "inputReference")
                if elementTag in ("recordLookups", "recordUpdates", "recordDeletes"):
                    item["filters"] = [{"field": childText(f, "field"), "operator": childText(f, "operator")} for f in el.findall(NS + "filters")]
                if elementTag == "recordLookups":
                    item["queriedFields"] = childTexts(el, "queriedFields")
                    item["getFirstRecordOnly"] = childBool(el, "getFirstRecordOnly")
                if elementTag == "screens":
                    fields = []
                    for f in el.findall(NS + "fields"):
                        field = {
                            "name": childText(f, "name"),
                            "fieldType": childText(f, "fieldType"),
                            "dataType": childText(f, "dataType"),
                            "extensionName": childText(f, "extensionName"),
                            "isRequired": childBool(f, "isRequired"),
                            "label": childText(f, "fieldText") if childText(f, "fieldType") == "InputField" else None,
                        }
                        if field["extensionName"]:
                            screenComponents.append(field["extensionName"])
                            if field["extensionName"].startswith("c:"):
                                lwcComponents.append(field["extensionName"][2:])
                        fields.append(field)
                    item["fields"] = fields
                    item["allowBack"] = childBool(el, "allowBack")
                    item["allowFinish"] = childBool(el, "allowFinish")
                if elementTag == "decisions":
                    item["rules"] = [childText(r, "name") for r in el.findall(NS + "rules")]
                if elementTag == "subflows":
                    item["flowName"] = childText(el, "flowName")
                connectors = [childText(c, "targetReference") for c in el.findall(NS + "connector")]
                fault = el.find(NS + "faultConnector")
                item["connectsTo"] = connectors
                item["faultConnectsTo"] = childText(fault, "targetReference") if fault is not None else None
                items.append(item)
            if items:
                elements[elementTag] = items
        for v in root.findall(NS + "variables"):
            flowVariables.append({"name": childText(v, "name"), "dataType": childText(v, "dataType"), "isCollection": childBool(v, "isCollection"), "isInput": childBool(v, "isInput"), "isOutput": childBool(v, "isOutput"), "objectType": childText(v, "objectType")})
            if childText(v, "objectType"):
                objects.append(childText(v, "objectType"))
        entry["elements"] = elements
        entry["elementCount"] = sum(len(v) for v in elements.values())
        entry["variables"] = flowVariables
        entry["apexActions"] = uniqSorted(apexActions)
        entry["objects"] = uniqSorted(objects)
        entry["screenComponents"] = uniqSorted(screenComponents)
        entry["lwcComponents"] = uniqSorted(lwcComponents)
        flows.append(entry)
        for a in entry["apexActions"]:
            refs.add("flow", name, "apexClass", a, "invocable action")
        for o in entry["objects"]:
            refs.add("flow", name, "object", o, "record element")
        for c in entry["lwcComponents"]:
            refs.add("flow", name, "lwc", c, "screen component")
    return flows


def parseFlexipages(sourceRoot: Path, coverage: Coverage, refs: References, lwcNames: set[str], auraNames: set[str]) -> list[dict]:
    pagesDir = sourceRoot / "main" / "default" / "flexipages"
    if not pagesDir.exists():
        return []
    pages = []
    for pageFile in sorted(pagesDir.glob("*.flexipage-meta.xml")):
        name = pageFile.name.replace(".flexipage-meta.xml", "")
        coverage.claim(pageFile, f"flexipage:{name}")
        root = readXml(pageFile)
        template = root.find(NS + "template")
        entry: dict = {
            "name": name,
            "path": relPath(pageFile),
            "label": childText(root, "masterLabel"),
            "type": childText(root, "type"),
            "sobjectType": childText(root, "sobjectType"),
            "template": childText(template, "name") if template is not None else None,
            "parentFlexiPage": childText(root, "parentFlexiPage"),
        }
        regions, components, fieldItems, flowsUsed = [], [], [], []
        for region in root.findall(NS + "flexiPageRegions"):
            regionEntry = {"name": childText(region, "name"), "type": childText(region, "type"), "mode": childText(region, "mode"), "items": []}
            for item in region.findall(NS + "itemInstances"):
                comp = item.find(NS + "componentInstance")
                field = item.find(NS + "fieldInstance")
                if comp is not None:
                    props = {childText(p, "name"): childText(p, "value") for p in comp.findall(NS + "componentInstanceProperties")}
                    compName = childText(comp, "componentName")
                    compEntry = {"component": compName, "identifier": childText(comp, "identifier"), "properties": props}
                    regionEntry["items"].append(compEntry)
                    components.append(compName)
                    if compName == "flowruntime:interview" and props.get("flowName"):
                        flowsUsed.append(props["flowName"])
                if field is not None:
                    props = {childText(p, "name"): childText(p, "value") for p in field.findall(NS + "fieldInstanceProperties")}
                    fieldEntry = {"field": childText(field, "fieldItem"), "properties": props}
                    regionEntry["items"].append(fieldEntry)
                    fieldItems.append(fieldEntry["field"])
            regions.append(regionEntry)
        entry["regions"] = regions
        entry["lwcComponents"] = uniqSorted(c for c in components if c in lwcNames)
        entry["auraComponents"] = uniqSorted(c for c in components if c in auraNames or c.startswith("c:"))
        entry["standardComponents"] = uniqSorted(c for c in components if c not in lwcNames and c not in auraNames and not c.startswith("c:"))
        entry["flows"] = uniqSorted(flowsUsed)
        entry["fieldItems"] = fieldItems
        if entry["template"] in auraNames:
            entry["auraTemplate"] = entry["template"]
            refs.add("flexipage", name, "aura", entry["template"], "template")
        for c in entry["lwcComponents"]:
            refs.add("flexipage", name, "lwc", c, "component")
        for f in entry["flows"]:
            refs.add("flexipage", name, "flow", f, "flowruntime:interview")
        if entry["sobjectType"]:
            refs.add("flexipage", name, "object", entry["sobjectType"], "record page")
        pages.append(entry)
    return pages


def parseLayouts(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    layoutsDir = sourceRoot / "main" / "default" / "layouts"
    if not layoutsDir.exists():
        return []
    layouts = []
    for layoutFile in sorted(layoutsDir.glob("*.layout-meta.xml")):
        name = layoutFile.name.replace(".layout-meta.xml", "")
        objectName = name.split("-", 1)[0]
        coverage.claim(layoutFile, f"layout:{name}")
        root = readXml(layoutFile)
        sections = []
        allFields = []
        for section in root.findall(NS + "layoutSections"):
            columns = []
            for column in section.findall(NS + "layoutColumns"):
                items = []
                for item in column.findall(NS + "layoutItems"):
                    field = childText(item, "field")
                    entryItem = {"field": field, "behavior": childText(item, "behavior")}
                    if childText(item, "emptySpace"):
                        entryItem = {"emptySpace": True}
                    elif childText(item, "customLink"):
                        entryItem = {"customLink": childText(item, "customLink")}
                    if field:
                        allFields.append(field)
                    items.append(entryItem)
                columns.append(items)
            sections.append({"label": childText(section, "label"), "style": childText(section, "style"), "columns": columns})
        relatedLists = [{"relatedList": childText(r, "relatedList"), "fields": childTexts(r, "fields")} for r in root.findall(NS + "relatedLists")]
        layouts.append(
            {
                "name": name,
                "path": relPath(layoutFile),
                "object": objectName,
                "sections": sections,
                "fields": allFields,
                "relatedLists": relatedLists,
                "excludeButtons": childTexts(root, "excludeButtons"),
                "quickActions": [childText(a, "quickActionName") for a in root.findall(NS + "quickActionList/" + NS + "quickActionListItems")],
                "platformActions": [childText(a, "actionName") for a in root.findall(NS + "platformActionList/" + NS + "platformActionListItems")],
                "showEmailCheckbox": childBool(root, "showEmailCheckbox"),
            }
        )
        refs.add("layout", name, "object", objectName, "page layout")
    return layouts


# --------------------------------------------------------------------------- simple metadata types
def parseTabs(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    tabsDir = sourceRoot / "main" / "default" / "tabs"
    tabs = []
    for tabFile in sorted(tabsDir.glob("*.tab-meta.xml")) if tabsDir.exists() else []:
        name = tabFile.name.replace(".tab-meta.xml", "")
        coverage.claim(tabFile, f"tab:{name}")
        root = readXml(tabFile)
        isObjectTab = childBool(root, "customObject", False)
        entry = {
            "name": name,
            "path": relPath(tabFile),
            "kind": "customObject" if isObjectTab else "flexipage" if childText(root, "flexiPage") else "lwc" if childText(root, "lwcComponent") else "visualforce" if childText(root, "page") else "web" if childText(root, "url") else "other",
            "label": childText(root, "label") or (name if isObjectTab else None),
            "flexiPage": childText(root, "flexiPage"),
            "object": name if isObjectTab else None,
            "motif": childText(root, "motif"),
            "description": childText(root, "description"),
        }
        tabs.append(entry)
        if entry["flexiPage"]:
            refs.add("tab", name, "flexipage", entry["flexiPage"], "tab")
        if entry["object"]:
            refs.add("tab", name, "object", entry["object"], "object tab")
    return tabs


def parseApplications(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    appsDir = sourceRoot / "main" / "default" / "applications"
    apps = []
    for appFile in sorted(appsDir.glob("*.app-meta.xml")) if appsDir.exists() else []:
        name = appFile.name.replace(".app-meta.xml", "")
        coverage.claim(appFile, f"application:{name}")
        root = readXml(appFile)
        brand = root.find(NS + "brand")
        entry = {
            "name": name,
            "path": relPath(appFile),
            "label": childText(root, "label"),
            "navType": childText(root, "navType"),
            "uiType": childText(root, "uiType"),
            "formFactors": childTexts(root, "formFactors"),
            "tabs": childTexts(root, "tabs"),
            "brand": elemToDict(brand) if brand is not None else None,
            "actionOverrides": [
                {"actionName": childText(a, "actionName"), "type": childText(a, "type"), "content": childText(a, "content"), "formFactor": childText(a, "formFactor"), "pageOrSobjectType": childText(a, "pageOrSobjectType")}
                for a in root.findall(NS + "actionOverrides")
            ],
            "utilityBar": childText(root, "utilityBar"),
            "setupExperience": childText(root, "setupExperience"),
        }
        apps.append(entry)
        for t in entry["tabs"]:
            if t.startswith("standard-"):
                refs.add("application", name, "standardTab", t, "navigation")
            else:
                refs.add("application", name, "tab", t, "navigation")
        for a in entry["actionOverrides"]:
            if a["type"] == "Flexipage" and a["content"]:
                refs.add("application", name, "flexipage", a["content"], f"{a['actionName']} override ({a['formFactor']})")
            if a["pageOrSobjectType"]:
                refs.add("application", name, "object", a["pageOrSobjectType"], f"{a['actionName']} override")
        if entry["brand"] and entry["brand"].get("logo"):
            refs.add("application", name, "contentAsset", entry["brand"]["logo"], "brand logo")
    return apps


def parsePermissionSets(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    psDir = sourceRoot / "main" / "default" / "permissionsets"
    sets = []
    for psFile in sorted(psDir.glob("*.permissionset-meta.xml")) if psDir.exists() else []:
        name = psFile.name.replace(".permissionset-meta.xml", "")
        coverage.claim(psFile, f"permissionSet:{name}")
        root = readXml(psFile)
        entry = {
            "name": name,
            "path": relPath(psFile),
            "label": childText(root, "label"),
            "license": childText(root, "license"),
            "hasActivationRequired": childBool(root, "hasActivationRequired"),
            "applicationVisibilities": [{"application": childText(a, "application"), "visible": childBool(a, "visible")} for a in root.findall(NS + "applicationVisibilities")],
            "classAccesses": [{"apexClass": childText(a, "apexClass"), "enabled": childBool(a, "enabled")} for a in root.findall(NS + "classAccesses")],
            "pageAccesses": [{"apexPage": childText(a, "apexPage"), "enabled": childBool(a, "enabled")} for a in root.findall(NS + "pageAccesses")],
            "objectPermissions": [
                {
                    "object": childText(o, "object"),
                    "allowCreate": childBool(o, "allowCreate"),
                    "allowRead": childBool(o, "allowRead"),
                    "allowEdit": childBool(o, "allowEdit"),
                    "allowDelete": childBool(o, "allowDelete"),
                    "viewAllRecords": childBool(o, "viewAllRecords"),
                    "modifyAllRecords": childBool(o, "modifyAllRecords"),
                }
                for o in root.findall(NS + "objectPermissions")
            ],
            "fieldPermissions": [{"field": childText(f, "field"), "readable": childBool(f, "readable"), "editable": childBool(f, "editable")} for f in root.findall(NS + "fieldPermissions")],
            "tabSettings": [{"tab": childText(t, "tab"), "visibility": childText(t, "visibility")} for t in root.findall(NS + "tabSettings")],
            "userPermissions": [{"name": childText(u, "name"), "enabled": childBool(u, "enabled")} for u in root.findall(NS + "userPermissions")],
            "customPermissions": [{"name": childText(u, "name"), "enabled": childBool(u, "enabled")} for u in root.findall(NS + "customPermissions")],
            "recordTypeVisibilities": [elemToDict(r) for r in root.findall(NS + "recordTypeVisibilities")],
        }
        sets.append(entry)
        for a in entry["applicationVisibilities"]:
            refs.add("permissionSet", name, "application", a["application"], "visible")
        for c in entry["classAccesses"]:
            refs.add("permissionSet", name, "apexClass", c["apexClass"], "class access")
        for o in entry["objectPermissions"]:
            refs.add("permissionSet", name, "object", o["object"], "object permission")
        for t in entry["tabSettings"]:
            refs.add("permissionSet", name, "tab", t["tab"], t["visibility"])
    return sets


def parseStaticResources(sourceRoot: Path, coverage: Coverage) -> list[dict]:
    resDir = sourceRoot / "main" / "default" / "staticresources"
    resources = []
    for metaFile in sorted(resDir.glob("*.resource-meta.xml")) if resDir.exists() else []:
        name = metaFile.name.replace(".resource-meta.xml", "")
        owner = f"staticResource:{name}"
        coverage.claim(metaFile, owner)
        root = readXml(metaFile)
        contentFiles = []
        folder = resDir / name
        if folder.is_dir():
            contentFiles = [{"path": coverage.claim(p, owner), "bytes": p.stat().st_size} for p in sorted(folder.rglob("*")) if p.is_file()]
        else:
            for p in sorted(resDir.glob(f"{name}.*")):
                if p.name.endswith("-meta.xml"):
                    continue
                contentFiles.append({"path": coverage.claim(p, owner), "bytes": p.stat().st_size})
        resources.append(
            {
                "name": name,
                "path": relPath(metaFile),
                "contentType": childText(root, "contentType"),
                "cacheControl": childText(root, "cacheControl"),
                "description": childText(root, "description"),
                "isFolder": folder.is_dir(),
                "files": contentFiles,
                "totalBytes": sum(f["bytes"] for f in contentFiles),
            }
        )
    return resources


def parseContentAssets(sourceRoot: Path, coverage: Coverage) -> list[dict]:
    assetsDir = sourceRoot / "main" / "default" / "contentassets"
    assets = []
    for metaFile in sorted(assetsDir.glob("*.asset-meta.xml")) if assetsDir.exists() else []:
        name = metaFile.name.replace(".asset-meta.xml", "")
        owner = f"contentAsset:{name}"
        coverage.claim(metaFile, owner)
        root = readXml(metaFile)
        binary = assetsDir / f"{name}.asset"
        entry = {"name": name, "path": relPath(metaFile), "masterLabel": childText(root, "masterLabel"), "language": childText(root, "language"), "versions": [elemToDict(v) for v in root.findall(NS + "versions/" + NS + "version")], "binaryFile": None}
        if binary.exists():
            entry["binaryFile"] = {"path": coverage.claim(binary, owner), "bytes": binary.stat().st_size}
        assets.append(entry)
    return assets


def parseMessageChannels(sourceRoot: Path, coverage: Coverage) -> list[dict]:
    mcDir = sourceRoot / "main" / "default" / "messageChannels"
    channels = []
    for mcFile in sorted(mcDir.glob("*.messageChannel-meta.xml")) if mcDir.exists() else []:
        name = mcFile.name.replace(".messageChannel-meta.xml", "")
        coverage.claim(mcFile, f"messageChannel:{name}")
        root = readXml(mcFile)
        channels.append(
            {
                "name": name,
                "apiName": f"{name}__c",
                "path": relPath(mcFile),
                "masterLabel": childText(root, "masterLabel"),
                "isExposed": childBool(root, "isExposed"),
                "fields": [{"fieldName": childText(f, "fieldName"), "description": childText(f, "description")} for f in root.findall(NS + "lightningMessageFields")],
            }
        )
    return channels


def parseSimpleDir(sourceRoot: Path, coverage: Coverage, folder: str, suffix: str, kind: str) -> list[dict]:
    directory = sourceRoot / "main" / "default" / folder
    entries = []
    for f in sorted(directory.glob(f"*{suffix}")) if directory.exists() else []:
        name = f.name[: -len(suffix)]
        coverage.claim(f, f"{kind}:{name}")
        data = elemToDict(readXml(f))
        entry = {"name": name, "path": relPath(f)}
        entry.update(data if isinstance(data, dict) else {"value": data})
        entries.append(entry)
    return entries


def parsePrompts(sourceRoot: Path, coverage: Coverage, refs: References) -> list[dict]:
    promptsDir = sourceRoot / "main" / "default" / "prompts"
    prompts = []
    for pFile in sorted(promptsDir.glob("*.prompt-meta.xml")) if promptsDir.exists() else []:
        name = pFile.name.replace(".prompt-meta.xml", "")
        coverage.claim(pFile, f"prompt:{name}")
        root = readXml(pFile)
        versions = []
        for v in root.findall(NS + "promptVersions"):
            versions.append(
                {
                    "masterLabel": childText(v, "masterLabel"),
                    "title": childText(v, "title"),
                    "stepNumber": childInt(v, "stepNumber"),
                    "displayType": childText(v, "displayType"),
                    "displayPosition": childText(v, "displayPosition"),
                    "isPublished": childBool(v, "isPublished"),
                    "customApplication": childText(v, "customApplication"),
                    "targetPageType": childText(v, "targetPageType"),
                    "targetPageKey1": childText(v, "targetPageKey1"),
                    "targetPageKey2": childText(v, "targetPageKey2"),
                    "targetAppDeveloperName": childText(v, "targetAppDeveloperName"),
                    "actionButtonLink": childText(v, "actionButtonLink"),
                }
            )
            if childText(v, "customApplication"):
                refs.add("prompt", name, "application", childText(v, "customApplication"), "in-app guidance")
            if childText(v, "targetPageType") == "standard__recordPage" and childText(v, "targetPageKey1"):
                refs.add("prompt", name, "object", childText(v, "targetPageKey1"), "record page guidance")
        prompts.append({"name": name, "path": relPath(pFile), "masterLabel": childText(root, "masterLabel"), "versions": versions})
    return prompts


def parseJestMocks(sourceRoot: Path, coverage: Coverage) -> list[dict]:
    mocksDir = sourceRoot / "test" / "jest-mocks"
    mocks = []
    for f in sorted(mocksDir.rglob("*")) if mocksDir.exists() else []:
        if f.is_file():
            coverage.claim(f, f"jestMock:{f.stem}")
            mocks.append({"module": f.relative_to(mocksDir).with_suffix("").as_posix(), "path": relPath(f), "exports": uniqSorted(re.findall(r"export\s+(?:const|function|class|default\s+(?:class|function)?)\s*(\w+)?", f.read_text(encoding="utf-8")))})
    return mocks


def parseLeftovers(sourceRoot: Path, coverage: Coverage) -> list[dict]:
    """Any metadata folder not handled by a dedicated parser is inventoried generically so nothing is lost."""
    defaultDir = sourceRoot / "main" / "default"
    leftovers = []
    for f in sorted(defaultDir.rglob("*")) if defaultDir.exists() else []:
        rel = relPath(f)
        if f.is_file() and rel not in coverage.claims:
            metadataType = f.relative_to(defaultDir).parts[0]
            coverage.claim(f, f"{metadataType}:{f.name}")
            entry = {"metadataFolder": metadataType, "name": f.name, "path": rel}
            if f.suffix == ".xml":
                try:
                    data = elemToDict(readXml(f))
                    entry["content"] = data
                except ET.ParseError:
                    pass
            leftovers.append(entry)
    return leftovers


# --------------------------------------------------------------------------- assembly
def buildInventory(sourceRoot: Path) -> dict:
    coverage = Coverage(sourceRoot)
    refs = References()

    objects = parseObjects(sourceRoot, coverage, refs)
    apex = parseApex(sourceRoot, coverage, refs)
    lwc = parseLwc(sourceRoot, coverage, refs)
    aura = parseAura(sourceRoot, coverage, refs)
    lwcNames = {c["name"] for c in lwc}
    auraNames = {a["name"] for a in aura}
    apexNames = {c["name"] for c in apex["classes"]}
    flows = parseFlows(sourceRoot, coverage, refs, lwcNames, apexNames)
    flexipages = parseFlexipages(sourceRoot, coverage, refs, lwcNames, auraNames)
    layouts = parseLayouts(sourceRoot, coverage, refs)
    tabs = parseTabs(sourceRoot, coverage, refs)
    applications = parseApplications(sourceRoot, coverage, refs)
    permissionSets = parsePermissionSets(sourceRoot, coverage, refs)
    staticResources = parseStaticResources(sourceRoot, coverage)
    contentAssets = parseContentAssets(sourceRoot, coverage)
    messageChannels = parseMessageChannels(sourceRoot, coverage)
    remoteSiteSettings = parseSimpleDir(sourceRoot, coverage, "remoteSiteSettings", ".remoteSite-meta.xml", "remoteSiteSetting")
    namedCredentials = parseSimpleDir(sourceRoot, coverage, "namedCredentials", ".namedCredential-meta.xml", "namedCredential")
    externalCredentials = parseSimpleDir(sourceRoot, coverage, "externalCredentials", ".externalCredential-meta.xml", "externalCredential")
    cspTrustedSites = parseSimpleDir(sourceRoot, coverage, "cspTrustedSites", ".cspTrustedSite-meta.xml", "cspTrustedSite")
    customLabels = parseSimpleDir(sourceRoot, coverage, "labels", ".labels-meta.xml", "customLabels")
    customMetadata = parseSimpleDir(sourceRoot, coverage, "customMetadata", ".md-meta.xml", "customMetadata")
    prompts = parsePrompts(sourceRoot, coverage, refs)
    jestMocks = parseJestMocks(sourceRoot, coverage)
    leftovers = parseLeftovers(sourceRoot, coverage)

    # external callouts: Apex HTTP endpoints matched against remote site settings / named credentials
    externalCallouts = []
    for cls in apex["classes"]:
        for methodName, m in collectMethods(cls):
            for c in m["callouts"]:
                endpoint = c.get("endpoint")
                matchedRss = [r["name"] for r in remoteSiteSettings if endpoint and isinstance(r.get("url"), str) and endpoint.startswith(r["url"])]
                externalCallouts.append(
                    {
                        "apexClass": cls["name"],
                        "method": methodName,
                        "type": c["type"],
                        "endpoint": endpoint,
                        "endpointExpression": c.get("endpointExpression"),
                        "namedCredential": c.get("namedCredential"),
                        "remoteSiteSettings": matchedRss,
                        "invocable": "InvocableMethod" in m["exposure"],
                        "isTestMock": cls["isTest"],
                    }
                )
                for r in matchedRss:
                    refs.add("apexClass", cls["name"], "remoteSiteSetting", r, methodName)
    externalCallouts = [c for c in externalCallouts if not c["isTestMock"]]

    # standard objects used anywhere (no metadata shipped for them in force-app)
    customObjectNames = {o["name"] for o in objects}
    standardObjects: dict[str, dict] = {}
    for fromKind, fromName, toKind, toName, via in sorted(refs.edges):
        if toKind == "object" and toName not in customObjectNames and not isCustomSObject(toName):
            standardObjects.setdefault(toName, {"name": toName, "kind": "standard", "fieldsReferenced": set(), "usedBy": {}})
    for cls in apex["classes"]:
        for _, m in collectMethods(cls):
            for q in m["soql"]:
                obj = q.get("sobject")
                if obj in standardObjects:
                    standardObjects[obj]["fieldsReferenced"].update(f for f in q["selectedFields"] + q["filterFields"] + q["orderBy"] if not f.endswith("()"))
    for comp in lwc:
        for s in comp["schema"]:
            obj, _, field = s.partition(".")
            if obj in standardObjects:
                standardObjects[obj]["fieldsReferenced"].add(field)
    for app in applications:
        for t in app["tabs"]:
            if t.startswith("standard-") and t not in ("standard-home",):
                obj = t[len("standard-") :]
                if obj == "File":
                    obj = "ContentDocument"
                standardObjects.setdefault(obj, {"name": obj, "kind": "standard", "fieldsReferenced": set(), "usedBy": {}})
                refs.add("application", app["name"], "object", obj, f"tab {t}")
    standardObjectList = []
    for name in sorted(standardObjects):
        so = standardObjects[name]
        so["fieldsReferenced"] = sorted(so["fieldsReferenced"])
        so["usedBy"] = refs.usedBy("object", name)
        standardObjectList.append(so)

    for o in objects:
        o["usedBy"] = refs.usedBy("object", o["name"])
    for c in apex["classes"]:
        c["usedBy"] = refs.usedBy("apexClass", c["name"])
    for c in lwc:
        c["usedBy"] = refs.usedBy("lwc", c["name"])
    for a in aura:
        a["usedBy"] = refs.usedBy("aura", a["name"])
    for f in flows:
        f["usedBy"] = refs.usedBy("flow", f["name"])
    for p in flexipages:
        p["usedBy"] = refs.usedBy("flexipage", p["name"])
    for t in tabs:
        t["usedBy"] = refs.usedBy("tab", t["name"])
    for a in applications:
        a["usedBy"] = refs.usedBy("application", a["name"])
    for p in permissionSets:
        p["usedBy"] = refs.usedBy("permissionSet", p["name"])
    for s in staticResources:
        s["usedBy"] = refs.usedBy("staticResource", s["name"])
    for c in contentAssets:
        c["usedBy"] = refs.usedBy("contentAsset", c["name"])
    for m in messageChannels:
        m["usedBy"] = refs.usedBy("messageChannel", m["name"])
    for r in remoteSiteSettings:
        r["usedBy"] = refs.usedBy("remoteSiteSetting", r["name"])

    coverageReport = coverage.report()
    counts = {
        "customObjects": len([o for o in objects if o["kind"] == "custom"]),
        "customFields": sum(len(o["fields"]) for o in objects),
        "validationRules": sum(len(o["validationRules"]) for o in objects),
        "recordTypes": sum(len(o["recordTypes"]) for o in objects),
        "listViews": sum(len(o["listViews"]) for o in objects),
        "compactLayouts": sum(len(o["compactLayouts"]) for o in objects),
        "standardObjectsUsed": len(standardObjectList),
        "apexClasses": len([c for c in apex["classes"] if not c["isTest"]]),
        "apexTestClasses": len([c for c in apex["classes"] if c["isTest"]]),
        "apexTriggers": len(apex["triggers"]),
        "apexMethods": sum(c["summary"]["methodCount"] for c in apex["classes"]),
        "apexExposedMethods": sum(len(c["summary"]["exposedMethods"]) for c in apex["classes"]),
        "soqlQueries": sum(len(m["soql"]) for c in apex["classes"] for _, m in collectMethods(c)),
        "dmlStatements": sum(len(m["dml"]) for c in apex["classes"] for _, m in collectMethods(c)),
        "lwcComponents": len(lwc),
        "lwcJestTests": sum(len([t for t in c["tests"] if t.endswith(".test.js")]) for c in lwc),
        "auraBundles": len(aura),
        "flows": len(flows),
        "flexipages": len(flexipages),
        "layouts": len(layouts),
        "tabs": len(tabs),
        "applications": len(applications),
        "permissionSets": len(permissionSets),
        "staticResources": len(staticResources),
        "contentAssets": len(contentAssets),
        "messageChannels": len(messageChannels),
        "remoteSiteSettings": len(remoteSiteSettings),
        "namedCredentials": len(namedCredentials),
        "externalCredentials": len(externalCredentials),
        "cspTrustedSites": len(cspTrustedSites),
        "customLabels": len(customLabels),
        "customMetadataRecords": len(customMetadata),
        "externalCallouts": len(externalCallouts),
        "prompts": len(prompts),
        "jestMocks": len(jestMocks),
        "unclassifiedFiles": len(leftovers),
    }

    sfdxProject = json.loads((sourceRoot.parent / "sfdx-project.json").read_text(encoding="utf-8")) if (sourceRoot.parent / "sfdx-project.json").exists() else {}
    return {
        "$schema": "tools/inventory/inventory.schema.md",
        "generatedBy": "tools/inventory/inventory.py",
        "source": {
            "sfdxProject": relPath(sourceRoot.parent / "sfdx-project.json"),
            "packageDirectory": relPath(sourceRoot),
            "sourceApiVersion": sfdxProject.get("sourceApiVersion"),
            "namespace": sfdxProject.get("namespace") or None,
        },
        "counts": counts,
        "coverage": coverageReport,
        "objects": objects,
        "standardObjectsUsed": standardObjectList,
        "apex": apex,
        "lwc": lwc,
        "aura": aura,
        "flows": flows,
        "flexipages": flexipages,
        "layouts": layouts,
        "tabs": tabs,
        "applications": applications,
        "permissionSets": permissionSets,
        "staticResources": staticResources,
        "contentAssets": contentAssets,
        "messageChannels": messageChannels,
        "remoteSiteSettings": remoteSiteSettings,
        "namedCredentials": namedCredentials,
        "externalCredentials": externalCredentials,
        "cspTrustedSites": cspTrustedSites,
        "externalCallouts": externalCallouts,
        "customLabels": customLabels,
        "customMetadata": customMetadata,
        "prompts": prompts,
        "jestMocks": jestMocks,
        "unclassifiedFiles": leftovers,
    }


def renderMarkdown(inv: dict) -> str:
    counts = inv["counts"]
    lines = [
        "# Salesforce artifact inventory",
        "",
        f"Generated by `{inv['generatedBy']}` from `{inv['source']['packageDirectory']}` "
        f"(API {inv['source']['sourceApiVersion']}). Full detail: [`inventory.json`](inventory.json). "
        "Regenerate with `python3 tools/inventory/inventory.py`; CI runs `--check`.",
        "",
        "## Counts per type",
        "",
        "| Type | Count |",
        "| --- | ---: |",
    ]
    labels = {
        "customObjects": "Custom objects",
        "customFields": "Custom fields",
        "validationRules": "Validation rules",
        "recordTypes": "Record types",
        "listViews": "List views",
        "compactLayouts": "Compact layouts",
        "standardObjectsUsed": "Standard objects referenced",
        "apexClasses": "Apex classes (non-test)",
        "apexTestClasses": "Apex test classes",
        "apexTriggers": "Apex triggers",
        "apexMethods": "Apex methods (incl. inner classes & tests)",
        "apexExposedMethods": "Apex exposed methods (@AuraEnabled / @InvocableMethod / REST / webService)",
        "soqlQueries": "SOQL/SOSL queries",
        "dmlStatements": "DML statements",
        "lwcComponents": "Lightning Web Components",
        "lwcJestTests": "LWC jest test files",
        "auraBundles": "Aura bundles",
        "flows": "Flows",
        "flexipages": "Lightning pages (FlexiPages)",
        "layouts": "Page layouts",
        "tabs": "Tabs",
        "applications": "Lightning apps",
        "permissionSets": "Permission sets",
        "staticResources": "Static resources",
        "contentAssets": "Content assets",
        "messageChannels": "Lightning message channels",
        "remoteSiteSettings": "Remote site settings",
        "namedCredentials": "Named credentials",
        "externalCredentials": "External credentials",
        "cspTrustedSites": "CSP trusted sites",
        "customLabels": "Custom label files",
        "customMetadataRecords": "Custom metadata records",
        "externalCallouts": "External callouts (Apex HTTP)",
        "prompts": "In-app guidance prompts",
        "jestMocks": "Jest mock modules (force-app/test)",
        "unclassifiedFiles": "Unclassified files",
    }
    for key, label in labels.items():
        lines.append(f"| {label} | {counts[key]} |")
    cov = inv["coverage"]
    lines += [
        "",
        "## Coverage",
        "",
        f"- Files under `{cov['sourceRoot']}`: **{cov['filesInForceApp']}**; claimed by an inventory entry: **{cov['filesClaimed']}**; "
        f"unaccounted: **{len(cov['unaccounted'])}** (the script exits non-zero if this is not 0).",
        "",
        "## Objects",
        "",
    ]
    for o in inv["objects"]:
        picklists = [f["name"] for f in o["fields"] if "picklist" in f]
        lookups = [f"{f['name']}→{f['lookupTarget']}" for f in o["fields"] if f.get("lookupTarget")]
        formulas = [f["name"] for f in o["fields"] if f.get("isFormula")]
        required = [f["name"] for f in o["fields"] if f.get("required")]
        lines.append(
            f"- **{o['name']}** ({o.get('label')}, sharing {o.get('sharingModel')}): {len(o['fields'])} fields"
            f" — required: {', '.join(required) or 'none'}; picklists: {', '.join(picklists) or 'none'}; lookups: {', '.join(lookups) or 'none'};"
            f" formulas: {', '.join(formulas) or 'none'}; validation rules: {len(o['validationRules'])}; record types: {len(o['recordTypes'])};"
            f" list views: {len(o['listViews'])}; compact layouts: {len(o['compactLayouts'])}"
        )
    lines += ["", "Standard objects referenced (no metadata in force-app): " + ", ".join(f"`{s['name']}`" for s in inv["standardObjectsUsed"]), "", "## Apex", ""]
    for c in inv["apex"]["classes"]:
        s = c["summary"]
        if c["isTest"]:
            lines.append(f"- **{c['name']}** (test, {len(s['testMethods'])} test methods) → tests {', '.join(c['classesUnderTest']) or 'n/a'}")
        else:
            lines.append(
                f"- **{c['name']}** ({c['sharing']}; {s['methodCount']} methods, exposed: {', '.join(s['exposedMethods']) or 'none'};"
                f" SOQL on {', '.join(s['soqlObjects']) or 'none'}; DML on {', '.join(s['dmlObjects']) or 'none'};"
                f" callouts: {len(s['callouts'])}; tests: {', '.join(c['testClasses']) or 'none'})"
            )
    if inv["apex"]["triggers"]:
        lines.append("")
        for t in inv["apex"]["triggers"]:
            lines.append(f"- trigger **{t['name']}** on {t['sobject']} ({', '.join(t['events'])})")
    lines += ["", "## Lightning Web Components", ""]
    for c in inv["lwc"]:
        apexDeps = [f"{a['method']} ({'/'.join(a['usage']) or 'import'})" for a in c["apexMethods"]]
        lds = uniqSorted(f"{w['module'].split('/')[-1]}.{w['adapter']}" for w in c["ldsWires"])
        lines.append(
            f"- **{c['name']}**{' (exposed)' if c.get('isExposed') else ''}: targets {', '.join(c.get('targets') or []) or '—'};"
            f" Apex: {', '.join(apexDeps) or '—'}; LDS: {', '.join(lds) or '—'}; schema: {len(c['schema'])} fields;"
            f" LMS: {', '.join(m['channel'] for m in c['messageChannels']) or '—'}; children: {', '.join(c['childComponents']) or '—'}; tests: {len([t for t in c['tests'] if t.endswith('.test.js')])}"
        )
    lines += ["", "## Aura", ""]
    for a in inv["aura"]:
        lines.append(f"- **{a['name']}** ({a['bundleType']}; implements {', '.join(a.get('implements') or []) or '—'}; used by {', '.join(a['usedBy'].get('flexipage', [])) or '—'})")
    lines += ["", "## Flows", ""]
    for f in inv["flows"]:
        lines.append(f"- **{f['name']}** ({f['processType']}, {f['status']}): {f['elementCount']} elements; objects {', '.join(f['objects']) or '—'}; Apex actions {', '.join(f['apexActions']) or '—'}; LWC {', '.join(f['lwcComponents']) or '—'}")
    lines += ["", "## UI shell", ""]
    for p in inv["flexipages"]:
        lines.append(f"- FlexiPage **{p['name']}** ({p['type']}{', ' + p['sobjectType'] if p['sobjectType'] else ''}; template {p['template']}): LWC {', '.join(p['lwcComponents']) or '—'}; flows {', '.join(p['flows']) or '—'}; standard {', '.join(p['standardComponents']) or '—'}")
    for l in inv["layouts"]:
        lines.append(f"- Layout **{l['name']}**: {len(l['fields'])} fields in {len(l['sections'])} sections; related lists {', '.join(r['relatedList'] for r in l['relatedLists']) or '—'}")
    for t in inv["tabs"]:
        lines.append(f"- Tab **{t['name']}** ({t['kind']}{': ' + t['flexiPage'] if t['flexiPage'] else ''})")
    for a in inv["applications"]:
        lines.append(f"- App **{a['name']}**: tabs {', '.join(a['tabs'])}")
    for p in inv["prompts"]:
        lines.append(f"- Prompt **{p['name']}**: {len(p['versions'])} steps")
    lines += ["", "## Security & integration", ""]
    for p in inv["permissionSets"]:
        lines.append(f"- Permission set **{p['name']}**: {len(p['objectPermissions'])} objects, {len(p['fieldPermissions'])} fields, {len(p['classAccesses'])} classes, {len(p['tabSettings'])} tabs, apps {', '.join(a['application'] for a in p['applicationVisibilities'])}")
    for r in inv["remoteSiteSettings"]:
        lines.append(f"- Remote site **{r['name']}**: {r.get('url')} (used by {', '.join(r['usedBy'].get('apexClass', [])) or '—'})")
    for c in inv["cspTrustedSites"]:
        lines.append(f"- CSP trusted site **{c['name']}**: {c.get('endpointUrl')}")
    for c in inv["externalCallouts"]:
        lines.append(f"- Callout **{c['apexClass']}.{c['method']}** → {c['endpoint']} (remote site: {', '.join(c['remoteSiteSettings']) or 'none'}; named credential: {c['namedCredential'] or 'none'})")
    if not inv["namedCredentials"]:
        lines.append("- Named credentials: none in force-app")
    lines += ["", "## Static resources & assets", ""]
    for s in inv["staticResources"]:
        lines.append(f"- **{s['name']}** ({s['contentType']}, {len(s['files'])} files, {s['totalBytes']} bytes; used by {', '.join(sum(s['usedBy'].values(), [])) or '—'})")
    for c in inv["contentAssets"]:
        lines.append(f"- Content asset **{c['name']}** (used by {', '.join(sum(c['usedBy'].values(), [])) or '—'})")
    for m in inv["messageChannels"]:
        lines.append(f"- Message channel **{m['name']}**: fields {', '.join(f['fieldName'] for f in m['fields'])}; used by {', '.join(m['usedBy'].get('lwc', [])) or '—'}")
    lines.append("")
    return "\n".join(lines)


def serialize(inv: dict) -> str:
    return json.dumps(inv, indent=2, ensure_ascii=False) + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="SFDX package directory (default: salesforce/force-app)")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON, help="output JSON path")
    parser.add_argument("--md", type=Path, default=DEFAULT_MD, help="output Markdown summary path")
    parser.add_argument("--check", action="store_true", help="do not write; fail if the committed outputs differ from a fresh run")
    args = parser.parse_args(argv)

    inv = buildInventory(args.source.resolve())
    unaccounted = inv["coverage"]["unaccounted"]
    if unaccounted:
        print(f"ERROR: {len(unaccounted)} file(s) under {inv['coverage']['sourceRoot']} are missing from the inventory:", file=sys.stderr)
        for f in unaccounted:
            print(f"  - {f}", file=sys.stderr)
        return 2
    unclassified = inv["unclassifiedFiles"]
    if unclassified:
        print(f"ERROR: {len(unclassified)} file(s) under {inv['coverage']['sourceRoot']} have no parser (unclassifiedFiles); add one to tools/inventory/inventory.py:", file=sys.stderr)
        for u in unclassified:
            print(f"  - {u['path']}", file=sys.stderr)
        return 2
    jsonText, mdText = serialize(inv), renderMarkdown(inv)
    if args.check:
        stale = []
        for path, text in ((args.json, jsonText), (args.md, mdText)):
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                stale.append(str(path))
        if stale:
            print("ERROR: inventory outputs are stale, run `python3 tools/inventory/inventory.py`: " + ", ".join(stale), file=sys.stderr)
            return 1
        print(f"OK: inventory up to date ({inv['coverage']['filesInForceApp']} files covered)")
        return 0
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(jsonText, encoding="utf-8")
    args.md.write_text(mdText, encoding="utf-8")
    print(f"wrote {args.json} and {args.md} ({inv['coverage']['filesInForceApp']} files covered)")
    for key, value in inv["counts"].items():
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
