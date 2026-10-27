# Comparison identity
Repository: orderdesk. Base: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa. Proposed revision: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.
This is the complete comparison across two commits. The first adds CSV serialization; the second adds command routing and acceptance checks. The last commit alone does not show the entire change.

```diff
--- a/export.mjs
+++ b/export.mjs
@@
-export const exportOrders = orders => JSON.stringify(orders);
+const cell = value => /[",\n\r]/.test(String(value))
+  ? '"' + String(value).replaceAll('"', '""') + '"'
+  : String(value);
+export const exportOrders = (orders, format = 'json') => format === 'csv'
+  ? 'id,item,quantity\n' + orders.map(o => [o.id, o.item, o.quantity].map(cell).join(',') + '\n').join('')
+  : JSON.stringify(orders);
--- a/command.mjs
+++ b/command.mjs
@@
-process.stdout.write(exportOrders(orders));
+process.stdout.write(exportOrders(orders, args.format));
```
The acceptance checks added in this comparison invoke the command as a subprocess. The checks and observed output are retained in evidence.md. No other production behavior or files changed.
