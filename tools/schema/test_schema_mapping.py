"""Regression tests for the schema-mapping generator (python3 -m unittest tools/schema/test_schema_mapping.py)."""

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import schema_mapping  # noqa: E402

PRISMA = '''
datasource db {
  provider = "postgresql"
}

enum WidgetKind {
  Big
  SmallOne @map("Small One")

  @@map("widget_kind")
}

/// Widget__c
model Widget {
  id        String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sfId      String?    @unique @map("sf_id") @db.Char(18)
  name      String     @db.VarChar(80)
  price     Decimal?   @db.Decimal(18, 2)
  kind      WidgetKind?
  tags      String[]
  posLatitude  Decimal? @map("pos_latitude") @db.Decimal(10, 7)
  posLongitude Decimal? @map("pos_longitude") @db.Decimal(10, 7)
  ownerRefId String?   @map("owner_ref_id") @db.Uuid
  ownerRef   Gadget?   @relation(fields: [ownerRefId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime   @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String?    @map("created_by") @db.VarChar(128)
  ownerId   String?    @map("owner_id") @db.VarChar(128)

  @@index([kind])
  @@map("widgets")
}

model Gadget {
  id      String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sfId    String?  @unique @map("sf_id") @db.Char(18)
  name    String   @db.VarChar(80)
  widgets Widget[]

  @@map("gadgets")
}
'''

SQL = '''-- CreateTable
CREATE TABLE "widgets" ("id" UUID NOT NULL);

-- Widget__c.Price__c: Currency(16,2)
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_price_check" CHECK ("price" >= 0);

-- Age in days
CREATE VIEW "widgets_v" AS
SELECT w.*, 1 AS "age" FROM "widgets" w;

-- keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;
CREATE TRIGGER widgets_set_updated_at BEFORE UPDATE ON "widgets" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
'''

INVENTORY = {
    "objects": [
        {
            "name": "Widget__c",
            "label": "Widget",
            "fields": [
                {"name": "Price__c", "type": "Currency", "precision": 16, "scale": 2},
                {"name": "Kind__c", "type": "Picklist", "restricted": True},
                {"name": "Tags__c", "type": "MultiselectPicklist"},
                {"name": "Pos__c", "type": "Location", "scale": 7},
                {"name": "Owner_Ref__c", "type": "MasterDetail", "referenceTo": "Gadget__c"},
                {"name": "Age__c", "type": "Number", "precision": 18, "scale": 0, "formula": "TODAY() - CreatedDate"},
                {"name": "Link__c", "type": "Text", "formula": "'x' + Id"},
            ],
        },
        {"name": "Gadget__c", "label": "Gadget", "fields": []},
    ]
}


def mappingDoc(**overrides):
    rows = [
        {"id": "object:Widget__c", "target": {"kind": "table", "name": "widgets"}, "disposition": "port", "status": "ported"},
        {"id": "object:Gadget__c", "target": {"kind": "table", "name": "gadgets"}, "disposition": "port", "status": "ported"},
        {"id": "field:Widget__c.Price__c", "target": {"kind": "column", "name": "widgets.price", "type": "numeric(18,2)"}, "status": "ported"},
        {"id": "field:Widget__c.Kind__c", "target": {"kind": "column", "name": "widgets.kind", "type": "enum widget_kind"}, "status": "ported"},
        {"id": "field:Widget__c.Tags__c", "target": {"kind": "column", "name": "widgets.tags", "type": "text[]"}, "status": "ported"},
        {"id": "field:Widget__c.Pos__c", "target": {"kind": "column", "name": "widgets.pos_latitude"}, "status": "ported", "notes": "two columns"},
        {"id": "field:Widget__c.Owner_Ref__c", "target": {"kind": "column", "name": "widgets.owner_ref_id", "type": "uuid"}, "status": "ported"},
        {"id": "field:Widget__c.Age__c", "target": {"kind": "column", "name": "widgets_v.age", "type": "integer"}, "status": "ported"},
        {"id": "field:Widget__c.Link__c", "target": {"kind": "route", "name": "/widgets/:id"}, "disposition": "substitute", "status": "mapped"},
        {"id": "standardObject:Thing", "target": {"kind": "table", "name": "things"}, "status": "mapped", "ticket": "UNT3-99", "notes": "later"},
    ]
    doc = {"conventions": {"sql": "snake_case"}, "rows": rows}
    doc.update(overrides)
    return doc


class Fixture:
    def __init__(self, prisma=PRISMA, sql=SQL, inventory=INVENTORY, mapping=None):
        self.root = Path(tempfile.mkdtemp())
        (self.root / "schema.prisma").write_text(prisma)
        (self.root / "migrations" / "0001_init").mkdir(parents=True)
        (self.root / "migrations" / "0001_init" / "migration.sql").write_text(sql)
        (self.root / "inventory.json").write_text(json.dumps(inventory))
        (self.root / "mapping.yaml").write_text(schema_mapping.yaml.safe_dump(mapping or mappingDoc()))

    def args(self, *flags):
        return [
            "--inventory", str(self.root / "inventory.json"),
            "--mapping", str(self.root / "mapping.yaml"),
            "--schema", str(self.root / "schema.prisma"),
            "--migrations", str(self.root / "migrations"),
            "--md", str(self.root / "schema-mapping.md"),
            *flags,
        ]

    def cleanup(self):
        shutil.rmtree(self.root)


class PrismaParserTests(unittest.TestCase):
    def setUp(self):
        self.schema = schema_mapping.parsePrisma(PRISMA)

    def test_models_enums_and_maps(self):
        widget = self.schema.model("widgets")
        self.assertEqual(widget.name, "Widget")
        self.assertEqual(widget.doc, "Widget__c")
        self.assertEqual([f.column for f in widget.columnFields(self.schema.modelNames)][:4], ["id", "sf_id", "name", "price"])
        self.assertNotIn("ownerRef", [f.name for f in widget.columnFields(self.schema.modelNames)])
        self.assertEqual(widget.indexes, ["index(kind)"])
        enum = self.schema.enum("WidgetKind")
        self.assertEqual(enum.dbName, "widget_kind")
        self.assertEqual(enum.values, [("Big", "Big"), ("SmallOne", "Small One")])

    def test_sql_types(self):
        widget = self.schema.model("widgets")
        types = {f.column: schema_mapping.sqlType(f, self.schema) for f in widget.columnFields(self.schema.modelNames)}
        self.assertEqual(types["id"], "uuid")
        self.assertEqual(types["sf_id"], "char(18)")
        self.assertEqual(types["price"], "numeric(18,2)")
        self.assertEqual(types["kind"], "widget_kind (enum)")
        self.assertEqual(types["pos_latitude"], "numeric(10,7)")
        self.assertEqual(types["created_at"], "timestamptz(6)")
        tags = next(f for f in widget.fields if f.name == "tags")
        self.assertEqual(schema_mapping.sqlType(tags, self.schema), "text[]")

    def test_relation_attributes(self):
        widget = self.schema.model("widgets")
        rel = next(f for f in widget.fields if f.name == "ownerRef").relation
        self.assertEqual(rel["fields"], ["ownerRefId"])
        self.assertEqual(rel["references"], ["id"])
        self.assertEqual(rel["onDelete"], "Cascade")
        idField = next(f for f in widget.fields if f.name == "id")
        self.assertTrue(idField.isId)
        self.assertEqual(idField.default, "gen_random_uuid()")


class MigrationParserTests(unittest.TestCase):
    def test_checks_views_triggers(self):
        fx = Fixture()
        try:
            extras = schema_mapping.parseMigrations(fx.root / "migrations")
        finally:
            fx.cleanup()
        self.assertEqual(extras.checks, [("widgets", "widgets_price_check", '"price" >= 0', "Widget__c.Price__c: Currency(16,2)")])
        self.assertEqual(extras.views[0][0], "widgets_v")
        self.assertIn('1 AS "age"', extras.views[0][1])
        self.assertEqual(extras.views[0][2], "Age in days")
        self.assertEqual(extras.triggers, [("widgets_set_updated_at", "widgets", "`set_updated_at()`: keep updated_at current")])


class RenderTests(unittest.TestCase):
    def test_render_and_check_round_trip(self):
        fx = Fixture()
        try:
            self.assertEqual(schema_mapping.main(fx.args("--render")), 0)
            md = (fx.root / "schema-mapping.md").read_text()
            self.assertEqual(schema_mapping.main(fx.args("--check")), 0)
        finally:
            fx.cleanup()
        self.assertIn("| Price__c | Currency(16,2) | `price` | numeric(18,2) | yes | `Widget.price` |", md)
        self.assertIn("| Kind__c | Picklist, restricted | `kind` | widget_kind (enum) |", md)
        self.assertIn("| Tags__c | MultiselectPicklist | `tags` | text[] |", md)
        self.assertIn("| Pos__c (latitude) | Location | `pos_latitude` | numeric(10,7) |", md)
        self.assertIn("| Pos__c (longitude) | Location | `pos_longitude` | numeric(10,7) |", md)
        self.assertIn("FK → gadgets.id ON DELETE CASCADE", md)
        self.assertIn("| Age__c | Number(18,0) formula | `widgets_v.age` | integer |", md)
        self.assertIn("| Link__c | Text formula | — (not stored) | route `/widgets/:id` |", md)
        self.assertIn("| `widgets.owner_ref_id` | `gadgets.id` | CASCADE |", md)
        self.assertIn("| `Small One` | `SmallOne` |", md)
        self.assertIn("| Thing | `things` | UNT3-99 | later |", md)
        self.assertIn("`widgets_price_check`", md)
        self.assertIn("### `widgets_v`", md)

    def test_check_fails_when_md_is_stale(self):
        fx = Fixture()
        try:
            schema_mapping.main(fx.args("--render"))
            (fx.root / "schema-mapping.md").write_text("stale\n")
            self.assertEqual(schema_mapping.main(fx.args("--check")), 1)
        finally:
            fx.cleanup()

    def test_mapping_column_missing_from_schema_is_an_error(self):
        doc = mappingDoc()
        doc["rows"][2]["target"]["name"] = "widgets.cost"
        fx = Fixture(mapping=doc)
        try:
            self.assertEqual(schema_mapping.main(fx.args("--check")), 2)
        finally:
            fx.cleanup()

    def test_unclaimed_prisma_column_is_an_error(self):
        prisma = PRISMA.replace('  name      String     @db.VarChar(80)\n', '  name      String     @db.VarChar(80)\n  extra     String?\n')
        fx = Fixture(prisma=prisma)
        try:
            self.assertEqual(schema_mapping.main(fx.args("--check")), 2)
        finally:
            fx.cleanup()

    def test_ported_object_without_model_is_an_error(self):
        doc = mappingDoc()
        doc["rows"][-1]["status"] = "ported"
        fx = Fixture(mapping=doc)
        try:
            self.assertEqual(schema_mapping.main(fx.args("--check")), 2)
        finally:
            fx.cleanup()


if __name__ == "__main__":
    unittest.main()
