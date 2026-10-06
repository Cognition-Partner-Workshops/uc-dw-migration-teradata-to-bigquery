-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "property_status" AS ENUM ('Contracted', 'Pre Market', 'Available', 'Under Agreement', 'Closed');

-- CreateTable
CREATE TABLE "brokers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sf_id" CHAR(18),
    "name" VARCHAR(80) NOT NULL,
    "broker_id" DECIMAL(18,0),
    "title" VARCHAR(30),
    "phone" VARCHAR(40),
    "mobile_phone" VARCHAR(40),
    "email" VARCHAR(80),
    "picture" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(128),
    "owner_id" VARCHAR(128),

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sf_id" CHAR(18),
    "name" VARCHAR(80) NOT NULL,
    "address" VARCHAR(100),
    "city" VARCHAR(50),
    "state" VARCHAR(20),
    "zip" VARCHAR(10),
    "description" TEXT,
    "tags" VARCHAR(255),
    "price" DECIMAL(18,2),
    "price_sold" DECIMAL(18,2),
    "assessed_value" DECIMAL(18,2),
    "beds" INTEGER,
    "baths" INTEGER,
    "status" "property_status",
    "date_listed" DATE,
    "date_pre_market" DATE,
    "date_contracted" DATE,
    "date_agreement" DATE,
    "date_closed" DATE,
    "location_latitude" DECIMAL(10,7),
    "location_longitude" DECIMAL(10,7),
    "picture" VARCHAR(255),
    "thumbnail" VARCHAR(255),
    "broker_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(128),
    "owner_id" VARCHAR(128),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sf_id" CHAR(18),
    "first_name" VARCHAR(40),
    "last_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(80),
    "phone" VARCHAR(40),
    "mobile_phone" VARCHAR(40),
    "title" VARCHAR(128),
    "mailing_street" VARCHAR(255),
    "mailing_city" VARCHAR(40),
    "mailing_state" VARCHAR(80),
    "mailing_postal_code" VARCHAR(20),
    "mailing_country" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(128),
    "owner_id" VARCHAR(128),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brokers_sf_id_key" ON "brokers"("sf_id");

-- CreateIndex
CREATE INDEX "brokers_broker_id_idx" ON "brokers"("broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "properties_sf_id_key" ON "properties"("sf_id");

-- CreateIndex
CREATE INDEX "properties_broker_id_idx" ON "properties"("broker_id");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_date_listed_idx" ON "properties"("date_listed");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_sf_id_key" ON "contacts"("sf_id");

-- CreateIndex
CREATE INDEX "contacts_last_name_first_name_idx" ON "contacts"("last_name", "first_name");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-maintained part (Prisma does not model CHECK constraints, views or triggers).
-- Salesforce field-level rules that are pure value checks become CHECK constraints;
-- see docs/migration/schema-mapping.md "Constraints".
-- ---------------------------------------------------------------------------

-- Salesforce record Ids are 15/18-character base-62 strings; we store the 18-char form.
ALTER TABLE "brokers"    ADD CONSTRAINT "brokers_sf_id_check"    CHECK ("sf_id" ~ '^[A-Za-z0-9]{18}$');
ALTER TABLE "properties" ADD CONSTRAINT "properties_sf_id_check" CHECK ("sf_id" ~ '^[A-Za-z0-9]{18}$');
ALTER TABLE "contacts"   ADD CONSTRAINT "contacts_sf_id_check"   CHECK ("sf_id" ~ '^[A-Za-z0-9]{18}$');

-- Broker__c.Broker_Id__c: Number(18,0) -> 18 integer digits
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_broker_id_check" CHECK (abs("broker_id") < 1e18);

-- Property__c.Beds__c / Baths__c: Number(2,0) -> 0..99
ALTER TABLE "properties" ADD CONSTRAINT "properties_beds_check"  CHECK ("beds"  BETWEEN 0 AND 99);
ALTER TABLE "properties" ADD CONSTRAINT "properties_baths_check" CHECK ("baths" BETWEEN 0 AND 99);

-- Property__c.Price__c / Price_Sold__c: Currency(8,0) -> 8 integer digits; Assessed_Value__c: Currency(18,0)
ALTER TABLE "properties" ADD CONSTRAINT "properties_price_check"          CHECK (abs("price") < 1e8);
ALTER TABLE "properties" ADD CONSTRAINT "properties_price_sold_check"     CHECK (abs("price_sold") < 1e8);
ALTER TABLE "properties" ADD CONSTRAINT "properties_assessed_value_check" CHECK (abs("assessed_value") < 1e18);

-- Property__c.Location__c: Salesforce rejects latitudes outside [-90, 90] and longitudes outside [-180, 180]
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_latitude_check"  CHECK ("location_latitude"  BETWEEN -90  AND 90);
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_longitude_check" CHECK ("location_longitude" BETWEEN -180 AND 180);
-- A compound Geolocation is either fully set or null
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_check"
    CHECK (("location_latitude" IS NULL) = ("location_longitude" IS NULL));

-- LastModifiedDate semantics for writes that bypass Prisma (bulk loads, psql): keep updated_at current.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;
CREATE TRIGGER brokers_set_updated_at    BEFORE UPDATE ON "brokers"    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER properties_set_updated_at BEFORE UPDATE ON "properties" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_set_updated_at   BEFORE UPDATE ON "contacts"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Property__c.Days_On_Market__c (formula TODAY() - Date_Listed__c, blanks as zero) is not immutable,
-- so it cannot be a generated column: it is a view column (and PropertyDto.daysOnMarket in the API).
CREATE VIEW "properties_v" AS
SELECT p.*,
       CASE WHEN p."date_listed" IS NULL THEN 0
            ELSE (CURRENT_DATE - p."date_listed") END AS "days_on_market"
FROM "properties" p;
