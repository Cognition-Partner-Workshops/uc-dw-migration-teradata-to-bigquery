"""Regression tests for the mapping matrix tool (python3 -m unittest tools/mapping/test_mapping.py)."""

import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import mapping  # noqa: E402

INV = json.loads(mapping.DEFAULT_INVENTORY.read_text(encoding="utf-8"))
DOC = mapping.loadYaml(mapping.DEFAULT_MAPPING)


def firstRow(doc, prefix):
    return next(row for row in doc["rows"] if row["id"].startswith(prefix))


class InventoryIdTests(unittest.TestCase):
    def test_ids_are_unique_and_cover_every_inventory_section(self):
        ids = mapping.inventoryIds(INV)
        self.assertEqual(len(ids), len(set(ids)))
        kinds = {meta["kind"] for meta in ids.values()}
        for kind in ("object", "field", "apexClass", "apexMethod", "lwc", "flow", "flexipage", "permissionSet", "permission", "callout", "prompt", "jestMock"):
            self.assertIn(kind, kinds)
        self.assertIn("object:Property__c", ids)
        self.assertIn("apexMethod:PropertyController.getPagedPropertyList", ids)
        self.assertIn("apexMethod:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl.respond", ids)

    def test_ids_are_deterministic(self):
        self.assertEqual(list(mapping.inventoryIds(INV)), list(mapping.inventoryIds(json.loads(json.dumps(INV)))))


class CommittedMappingTests(unittest.TestCase):
    def test_committed_mapping_is_valid_and_complete(self):
        self.assertEqual(mapping.validateMapping(DOC, INV), [])
        self.assertEqual(sorted(row["id"] for row in DOC["rows"]), sorted(mapping.inventoryIds(INV)))

    def test_committed_markdown_is_current(self):
        self.assertEqual(mapping.DEFAULT_MD.read_text(encoding="utf-8"), mapping.renderMarkdown(DOC, INV))

    def test_platform_only_features_have_explicit_disposition(self):
        rows = {row["id"]: row for row in DOC["rows"]}
        self.assertEqual(rows["lwc:barcodeScanner"]["disposition"], "substitute")
        self.assertEqual(rows["lwc:listContactsFromDevice"]["disposition"], "dropped")
        for prompt in ("Property", "PropertyExplorer", "PropertyFinder"):
            self.assertEqual(rows[f"prompt:{prompt}"]["disposition"], "dropped")
        self.assertIn("LDS caching", DOC["conventions"]["platform_only_features"])
        for row in DOC["rows"]:
            if row["disposition"] != "port":
                self.assertTrue(row.get("reason"), f"{row['id']} needs a reason")


class ValidationTests(unittest.TestCase):
    def test_duplicate_id_is_an_error(self):
        doc = copy.deepcopy(DOC)
        doc["rows"].append(copy.deepcopy(doc["rows"][0]))
        errors = mapping.validateMapping(doc, INV)
        self.assertTrue(any("appears 2 times" in e for e in errors), errors)

    def test_missing_id_is_an_error(self):
        doc = copy.deepcopy(DOC)
        removed = doc["rows"].pop()
        errors = mapping.validateMapping(doc, INV)
        self.assertTrue(any(e.startswith(f"{removed['id']}: inventory id has no mapping row") for e in errors), errors)

    def test_stale_id_is_an_error(self):
        doc = copy.deepcopy(DOC)
        extra = copy.deepcopy(doc["rows"][0])
        extra["id"] = "object:Ghost__c"
        doc["rows"].append(extra)
        errors = mapping.validateMapping(doc, INV)
        self.assertTrue(any("object:Ghost__c: not an inventory id" in e for e in errors), errors)

    def test_target_naming_conventions_are_enforced(self):
        doc = copy.deepcopy(DOC)
        firstRow(doc, "object:")["target"]["name"] = "Property"  # not snake_case plural
        firstRow(doc, "apexClass:PropertyController")["target"]["name"] = "propertyService"  # not PascalCase
        firstRow(doc, "apexMethod:PropertyController.getPagedPropertyList")["target"]["name"] = "GET /Properties"  # not kebab-case
        firstRow(doc, "flexipage:")["target"]["name"] = "/BrokerRecordPage"
        errors = mapping.validateMapping(doc, INV)
        self.assertEqual(len([e for e in errors if "violates the" in e]), 4, errors)

    def test_column_name_must_follow_field_api_name(self):
        doc = copy.deepcopy(DOC)
        firstRow(doc, "field:Property__c.Price__c")["target"]["name"] = "properties.asking_price"
        errors = mapping.validateMapping(doc, INV)
        self.assertTrue(any("differs from the convention 'properties.price'" in e for e in errors), errors)

    def test_source_kind_target_kind_compatibility(self):
        doc = copy.deepcopy(DOC)
        firstRow(doc, "permissionSet:")["target"] = {"kind": "table", "name": "roles"}
        errors = mapping.validateMapping(doc, INV)
        self.assertTrue(any("cannot map to target kind table" in e for e in errors), errors)

    def test_dropped_and_substitute_rows_need_reason(self):
        doc = copy.deepcopy(DOC)
        dropped = firstRow(doc, "lwc:listContactsFromDevice")
        dropped.pop("reason")
        substitute = firstRow(doc, "lwc:barcodeScanner")
        substitute.pop("reason")
        errors = mapping.validateMapping(doc, INV)
        self.assertEqual(len([e for e in errors if "reason" in e]), 2, errors)

    def test_dropped_row_must_have_null_target_and_dropped_status(self):
        doc = copy.deepcopy(DOC)
        row = firstRow(doc, "lwc:listContactsFromDevice")
        row["target"] = {"kind": "component", "name": "ContactPicker"}
        row["status"] = "mapped"
        errors = mapping.validateMapping(doc, INV)
        self.assertEqual(len(errors), 2, errors)

    def test_tested_rows_need_parity_tests_and_ids_are_kebab_case(self):
        doc = copy.deepcopy(DOC)
        row = firstRow(doc, "apexMethod:PropertyController.getPagedPropertyList")
        row["status"] = "tested"
        self.assertTrue(any("requires at least one parity test" in e for e in mapping.validateMapping(doc, INV)))
        row["parity_tests"] = ["Property Finder Search"]
        self.assertTrue(any("kebab-case" in e for e in mapping.validateMapping(doc, INV)))
        row["parity_tests"] = ["property-finder-search"]
        self.assertEqual(mapping.validateMapping(doc, INV), [])

    def test_require_coverage_flags_ported_rows_without_scenarios(self):
        ported = [row for row in DOC["rows"] if row["status"] in ("ported", "tested", "passing") and not row["parity_tests"]]
        self.assertEqual(len(mapping.coverageErrors(DOC)), len(ported))
        doc = copy.deepcopy(DOC)
        for row in doc["rows"]:
            if row["status"] == "ported":
                row["parity_tests"] = ["api-scaffold-smoke"]
        self.assertEqual(mapping.coverageErrors(doc), [])


class CliTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.inventory = self.root / "inventory.json"
        self.mappingPath = self.root / "mapping.yaml"
        self.md = self.root / "mapping.md"
        shutil.copy(mapping.DEFAULT_INVENTORY, self.inventory)
        shutil.copy(mapping.DEFAULT_MAPPING, self.mappingPath)
        shutil.copy(mapping.DEFAULT_MD, self.md)

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_(self, *flags):
        return mapping.main(["--inventory", str(self.inventory), "--mapping", str(self.mappingPath), "--md", str(self.md), *flags])

    def test_check_passes_on_committed_files(self):
        self.assertEqual(self.run_("--check"), 0)

    def test_check_fails_when_markdown_is_stale(self):
        self.md.write_text("stale", encoding="utf-8")
        self.assertEqual(self.run_("--check"), 1)
        self.assertEqual(self.run_("--render"), 0)
        self.assertEqual(self.run_("--check"), 0)

    def test_sync_adds_stub_rows_for_new_inventory_ids_and_check_rejects_them(self):
        inv = json.loads(self.inventory.read_text(encoding="utf-8"))
        inv["objects"][0]["fields"].append({"name": "Fax__c", "label": "Fax", "type": "Phone"})
        self.inventory.write_text(json.dumps(inv), encoding="utf-8")
        self.assertEqual(self.run_("--check"), 1)
        self.assertEqual(self.run_("--sync"), 0)
        doc = mapping.loadYaml(self.mappingPath)
        stub = next(row for row in doc["rows"] if row["id"].endswith(".Fax__c"))
        self.assertIsNone(stub["target"])
        self.assertEqual(self.run_("--check"), 1)  # a stub row is not a mapped row

    def test_round_trip_dump_is_stable(self):
        text = self.mappingPath.read_text(encoding="utf-8")
        self.assertEqual(mapping.dumpMapping(mapping.loadYaml(self.mappingPath)), text)


if __name__ == "__main__":
    unittest.main()
