# tools/mapping — the 1:1 mapping matrix

`mapping.py` owns [`docs/migration/mapping.yaml`](../../docs/migration/mapping.yaml) (the
matrix) and its rendering [`docs/migration/mapping.md`](../../docs/migration/mapping.md).
It needs Python 3.10+ and PyYAML (`pip install pyyaml`); everything else is stdlib.

```
python3 tools/mapping/mapping.py --check     # CI: exact coverage, conventions, md current (exit 1 on any error)
python3 tools/mapping/mapping.py --render    # rewrite mapping.md from mapping.yaml
python3 tools/mapping/mapping.py --sync      # after the inventory changed: add stub rows for new ids, sort, rewrite both files
python3 tools/mapping/mapping.py --ids       # list the inventory ids with a one-line source summary
python3 -m unittest tools/mapping/test_mapping.py
```

## Row contract

One row per inventory id (derived deterministically from `docs/migration/inventory.json`,
so `tools/inventory/inventory.py` is the upstream of this file). `--check` fails when an id
is missing, duplicated or stale.

| key | meaning |
| --- | --- |
| `id` | `<sourceKind>:<apiName>` — see `--ids`. |
| `source` | one-line summary copied from the inventory (informational, refreshed by `--sync` for new rows only). |
| `target` | `{kind, name[, type]}` or `null` (only when `disposition: dropped`). `kind` ∈ table, column, computed, module, service, serviceMethod, endpoint, dto, hook, job, spec, fixture, component, util, route, store, config, env, httpClient, role, policy, infra, asset, dependency, mock. Each kind has a naming regex (`TARGET_KINDS`) and each source kind an allow-list of target kinds (`SOURCE_TO_TARGET`). Columns must be `<table>.<snake_case(field)>` (`_id` suffix for lookups) unless `convention_exception` explains why. |
| `disposition` | `port` (1:1 counterpart), `substitute` (different mechanism, `reason` required), `dropped` (no counterpart, `reason` required, `target: null`). |
| `status` | `mapped` → `ported` → `tested` → `passing`; `dropped` is terminal. `tested`/`passing` require `parity_tests`. |
| `ticket` | board ticket that owns the next status transition. |
| `parity_tests` | kebab-case E2E scenario ids from `tests/parity/` (filled by UNT3-25). `--check --require-coverage` additionally fails on ported rows with none; turn that on in CI once the scenarios exist. |
| `reason` / `notes` / `convention_exception` | free text; `reason` is mandatory for non-`port` rows. |

Later phases only move `status` forward and append `parity_tests`; the parity report reads
this file. Do not hand-edit `mapping.md`.
