# Issue 18: Support CSV order export
URL: https://example.test/orderdesk/issues/18
Accepted criteria:
- AC1: `orders export --format csv` writes id,item,quantity in that order, with a header-only result for no orders.
- AC2: Item values containing commas, quotes and newlines round-trip through a CSV parser.
- AC3: Existing JSON export output is byte-for-byte unchanged.
Accepted clarification: UTF-8 output, without a byte-order mark. This qualifies AC1.
