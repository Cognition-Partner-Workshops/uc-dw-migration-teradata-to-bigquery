# Salesforce artifact inventory

`inventory.py` (Python 3.10+, standard library only) parses the SFDX source under
`salesforce/force-app` and writes:

- `docs/migration/inventory.json` — every object, field, Apex class/trigger (methods,
  SOQL, DML, callouts, test classes), LWC/Aura bundle (Apex, LDS, schema, LMS and
  static-resource dependencies), flow, FlexiPage, layout, tab, app, permission set,
  static resource, remote site setting, named credential, CSP site, prompt and jest
  mock, plus a reverse `usedBy` index and a coverage report.
- `docs/migration/inventory.md` — a short summary with counts per type.

```bash
python3 tools/inventory/inventory.py          # regenerate both files
python3 tools/inventory/inventory.py --check  # CI: fail if outputs are stale (exit 1)
python3 -m unittest tools/inventory/test_inventory.py
```

The script asserts that **every** file under `force-app` is claimed by exactly one
inventory entry; unknown metadata types are listed as `unclassifiedFiles` and make the
script exit 2 until a parser is added, so nothing in the source estate can go missing silently. Output is
sorted at every level and carries no timestamps, so regenerating is a no-op until
the Salesforce source changes.
