# Run 71
Retained URL: https://example.test/orderdesk/actions/runs/71
Revision: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
Command: node checks/export-acceptance.mjs
Exit: 0
- csv-empty-and-utf8: PASS. Asserts exact bytes `id,item,quantity\n`, UTF-8 without BOM, for the empty CSV export.
- csv-roundtrip: PASS. Runs CSV export with item strings containing a comma, double quotes and a newline; parses the result using an independent CSV parser and compares every field and column order with the inputs.
- json-compatibility: PASS. Compares JSON command output byte-for-byte against the baseline for empty and nonempty orders.
These are retained observed results for the proposed revision, not requested future checks.
