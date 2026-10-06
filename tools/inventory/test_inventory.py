"""Regression tests for the Salesforce inventory generator (python3 -m unittest tools/inventory/test_inventory.py)."""

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import inventory  # noqa: E402


class CoverageTests(unittest.TestCase):
    def test_duplicate_claim_by_different_owner_is_an_error(self):
        root = Path(tempfile.mkdtemp())
        try:
            (root / "a.txt").write_text("x")
            cov = inventory.Coverage(root)
            cov.claim(root / "a.txt", "one")
            cov.claim(root / "a.txt", "one")
            with self.assertRaises(AssertionError):
                cov.claim(root / "a.txt", "two")
        finally:
            shutil.rmtree(root)

    def test_unknown_file_is_reported_and_fails_check(self):
        root = Path(tempfile.mkdtemp())
        try:
            src = root / "force-app"
            shutil.copytree(inventory.DEFAULT_SOURCE, src)
            (src / "main" / "default" / "mystery.bin").write_bytes(b"\x00\x01")
            inv = inventory.buildInventory(src)
            self.assertEqual(inv["coverage"]["unaccounted"], [])
            self.assertEqual([u["path"] for u in inv["unclassifiedFiles"]], ["force-app/main/default/mystery.bin"])
            exitCode = inventory.main(
                ["--source", str(src), "--json", str(root / "i.json"), "--md", str(root / "i.md"), "--check"]
            )
            self.assertEqual(exitCode, 2)
        finally:
            shutil.rmtree(root)


class ApexParsingTests(unittest.TestCase):
    SOURCE = """
    @RestResource(urlMapping='/widgets/*')
    global with sharing class WidgetApi {
        private static final String ENDPOINT = 'https://api.example.com/v1';
        @HttpGet
        global static List<Widget__c> doGet() {
            return [SELECT Id, Name, Owner.Name FROM Widget__c WHERE Status__c = 'Open' WITH USER_MODE ORDER BY Name LIMIT 10];
        }
        @AuraEnabled(cacheable=true)
        public static Integer countOpen(String status) {
            return [SELECT COUNT() FROM Widget__c WHERE Status__c = :status];
        }
        public static void save(List<Widget__c> widgets) {
            upsert widgets;
            Account acc = new Account(Name = 'x');
            insert acc;
            Database.delete(widgets, false);
            HttpRequest req = new HttpRequest();
            req.setEndpoint(ENDPOINT + '/widgets');
            new Http().send(req);
        }
        private class Inner { public String label; }
    }
    """

    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp())
        clsPath = cls.root / "WidgetApi.cls"
        clsPath.write_text(cls.SOURCE)
        cls.parsed = inventory.parseApexClass(clsPath, inventory.Coverage(cls.root))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.root)

    def methods(self):
        return {m["name"]: m for m in self.parsed["methods"]}

    def test_class_header(self):
        self.assertEqual(self.parsed["sharing"], "with sharing")
        self.assertEqual([a["name"] for a in self.parsed["annotations"]], ["RestResource"])
        self.assertIn("/widgets/*", self.parsed["restResource"])
        self.assertEqual([c["name"] for c in self.parsed["innerClasses"]], ["Inner"])
        self.assertEqual(self.parsed["summary"]["exposedMethods"], ["countOpen", "doGet"])

    def test_exposed_methods(self):
        methods = self.methods()
        self.assertEqual(methods["doGet"]["exposure"], ["HttpGet"])
        self.assertEqual(methods["doGet"]["visibility"], "global")
        self.assertEqual(methods["countOpen"]["exposure"], ["AuraEnabled"])
        self.assertEqual(methods["save"]["exposure"], ["public"])
        self.assertEqual(methods["save"]["visibility"], "public")

    def test_soql(self):
        q = self.methods()["doGet"]["soql"][0]
        self.assertEqual(q["sobject"], "Widget__c")
        self.assertEqual(q["selectedFields"], ["Id", "Name", "Owner.Name"])
        self.assertEqual(q["filterFields"], ["Status__c"])
        self.assertEqual(q["securityMode"], "USER_MODE")
        self.assertTrue(q["hasLimit"])
        agg = self.methods()["countOpen"]["soql"][0]
        self.assertTrue(agg["aggregate"])
        self.assertEqual(agg["bindVariables"], ["status"])

    def test_dml_and_callouts(self):
        save = self.methods()["save"]
        self.assertEqual(
            [(d["operation"], d["sobject"]) for d in save["dml"]],
            [("upsert", "Widget__c"), ("insert", "Account"), ("Database.delete", "Widget__c")],
        )
        self.assertEqual(save["callouts"][0]["endpoint"], "https://api.example.com/v1")


class LwcParsingTests(unittest.TestCase):
    SOURCE = """
    import { LightningElement, api, wire } from 'lwc';
    import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
    import { subscribe, MessageContext } from 'lightning/messageService';
    import SELECTED from '@salesforce/messageChannel/PropertySelected__c';
    import NAME_FIELD from '@salesforce/schema/Property__c.Name';
    import getPictures from '@salesforce/apex/PropertyController.getPictures';
    import createFile from '@salesforce/apex/FileUtilities.createFile';
    import LEAFLET from '@salesforce/resourceUrl/leafletjs';
    const CITY = 'Property__c.City__c';
    const fields = [NAME_FIELD, CITY];
    export default class Demo extends LightningElement {
        @api recordId;
        @wire(MessageContext)
        messageContext;
        @wire(getRecord, { recordId: '$recordId', fields })
        property;
        @wire(getPictures, { propertyId: '$recordId' })
        pictures;
        handleClick() {
            createFile({ base64data: 'x' });
            subscribe(this.messageContext, SELECTED, () => {});
        }
    }
    """

    def test_dependencies(self):
        deps = inventory.analyzeLwcJs(self.SOURCE, set())
        self.assertEqual(sorted((a["method"], tuple(a["usage"])) for a in deps["apexMethods"]), [("FileUtilities.createFile", ("imperative",)), ("PropertyController.getPictures", ("wire",))])
        self.assertEqual([(w["adapter"], w["fields"]) for w in deps["ldsWires"]], [("getRecord", ["Property__c.Name", "Property__c.City__c"])])
        self.assertEqual(deps["schema"], ["Property__c.City__c", "Property__c.Name"])
        self.assertEqual(deps["messageChannels"], [{"channel": "PropertySelected__c", "local": "SELECTED", "roles": ["subscribe"]}])
        self.assertEqual(deps["staticResources"], ["leafletjs"])
        self.assertEqual(deps["apiProperties"], ["recordId"])


class EndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inv = inventory.buildInventory(inventory.DEFAULT_SOURCE)

    def test_every_file_is_covered(self):
        cov = self.inv["coverage"]
        self.assertEqual(cov["unaccounted"], [])
        self.assertEqual(cov["filesInForceApp"], cov["filesClaimed"])
        self.assertEqual(self.inv["unclassifiedFiles"], [])

    def test_output_is_deterministic(self):
        again = inventory.buildInventory(inventory.DEFAULT_SOURCE)
        self.assertEqual(inventory.serialize(self.inv), inventory.serialize(again))
        self.assertEqual(inventory.renderMarkdown(self.inv), inventory.renderMarkdown(again))

    def test_committed_outputs_match(self):
        self.assertEqual(inventory.DEFAULT_JSON.read_text(encoding="utf-8"), inventory.serialize(self.inv))
        self.assertEqual(inventory.DEFAULT_MD.read_text(encoding="utf-8"), inventory.renderMarkdown(self.inv))
        self.assertEqual(json.loads(inventory.DEFAULT_JSON.read_text(encoding="utf-8"))["counts"], self.inv["counts"])

    def test_dreamhouse_shape(self):
        objects = {o["name"]: o for o in self.inv["objects"]}
        self.assertEqual(sorted(objects), ["Broker__c", "Property__c"])
        broker = next(f for f in objects["Property__c"]["fields"] if f["name"] == "Broker__c")
        self.assertEqual(broker["type"], "Lookup")
        self.assertEqual(broker["referenceTo"], "Broker__c")
        status = next(f for f in objects["Property__c"]["fields"] if f["name"] == "Status__c")
        self.assertEqual(status["type"], "Picklist")
        self.assertEqual([v["fullName"] for v in status["picklist"]["values"]], ["Contracted", "Pre Market", "Available", "Under Agreement", "Closed"])
        classes = {c["name"]: c for c in self.inv["apex"]["classes"]}
        self.assertEqual(classes["PropertyController"]["testClasses"], ["TestPropertyController"])
        self.assertEqual(classes["GeocodingService"]["methods"][0]["callouts"][0]["endpoint"], "https://nominatim.openstreetmap.org/search?format=json")
        self.assertEqual(self.inv["externalCallouts"][0]["remoteSiteSettings"], ["nominatim_openstreetmap"])
        carousel = next(c for c in self.inv["lwc"] if c["name"] == "propertyCarousel")
        self.assertEqual(sorted(a["method"] for a in carousel["apexMethods"]), ["FileUtilities.createFile", "PropertyController.getPictures"])
        self.assertEqual(self.inv["flows"][0]["apexActions"], ["GeocodingService"])
        self.assertIn("Contact", [o["name"] for o in self.inv["standardObjectsUsed"]])


if __name__ == "__main__":
    unittest.main()
