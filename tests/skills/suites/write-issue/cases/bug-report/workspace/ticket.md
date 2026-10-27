# Support ticket 5531
URL: https://example.test/ledgerlite/support/tickets/5531
From: bookkeeper at a customer, October 20

Since we upgraded to Ledgerlite 2.4.0 last week, importing our Northbank statement export drops the last transaction of the month. The September file has 312 transactions and the import summary says 311. Nothing warns us; we only noticed because the closing balance was off by the last payment. We are on Windows 11. The 2.4.0 release notes mention a new CSV parser, so that is what broke it. Please roll the parser back to the 2.3 one.
The September export, with account numbers redacted, is attached as https://example.test/ledgerlite/attachments/ticket-5531-redacted.csv.
