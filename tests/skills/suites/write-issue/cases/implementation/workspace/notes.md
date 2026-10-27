The support team currently copies orders by hand into a spreadsheet. The maintainer has agreed to add CSV to `orders export --format csv`.
The column names and order are exactly id,item,quantity. Item names containing commas, quotes or newlines must round-trip through a CSV parser. An empty order list produces the header and no data rows. Existing JSON export stays unchanged.
The choice of CSV library is left to the implementer. A suggestion to also export customer email was rejected for this issue. No execution or test has happened yet.
