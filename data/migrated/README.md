# data/migrated — the migrated data set loaded by `make seed`

Target of the data-migration phase: the extract (UNT3-12) and transform/load (UNT3-13)
tickets write the records extracted from the live Salesforce org here, one file per target
table, and `make seed` (`app/api/scripts/seed.ts`, env `SEED_DIR`, mounted read-only at
`/seed` in the API dev container) loads them into the local PostgreSQL. The E2E suite and
every worker's local stack therefore run against the same data the AWS environment gets.

Nothing is committed here yet besides this file: until UNT3-13 lands, `make seed` only checks
the database is reachable and migrated, and reports what it finds in this directory. Files you
drop here are not ignored by git — do not commit anything that came out of the org without
the ticket that owns it.
