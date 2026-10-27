# Catalogue script notes

The librarian's notes on the script that checks `catalogue/tools.csv` after a
stocktake, as `docs/contracts/stocktake.md` describes the count.

The script reads the file one record at a time, a record being one row of the
CSV. It builds an index from tool id to row so that the desk sheet can be
matched against it. Rows whose status is `missing` are flagged in the output.
Rows are processed in batches of fifty so that a long catalogue does not hold
the desk sheet up. The condition grade in each row is the grade the stocktake
gave, as the stocktake rules define it; the script does not change it.
