Base: cccccccccccccccccccccccccccccccccccccccc. Proposed revision: dddddddddddddddddddddddddddddddddddddddd.
Complete diff:
```diff
--- a/list.mjs
+++ b/list.mjs
@@
-return orders;
+return orders.filter(order => order.status !== 'cancelled');
```
Sort handling is unchanged; the current selection is still retained when sort order changes.
