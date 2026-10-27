# Queried readings in the 1997 file

Gauge readers sometimes mark a reading on their card with a query: the
staff gauge was iced, the reading was taken late, the figure is hard to
read, and so on. In the archive such a reading carries `?` in the flag
column. The 1997 file was transcribed without the flags; the cards are in
`cards/1997/` as one scan per card, `<gauge>-<week>.png`, and each query is
a circled figure.

Whether a queried reading is void is the records keeper's decision. The
assistant flags and lists; it never voids, removes or alters a reading. The
list goes to the keeper as `reports/queried-1997.md`, one line per queried
reading with the date, the gauge, the reader's remark and the reading in
metres.

Units. Readings before 1995 are in feet on the cards and in the ledgers,
except gauge W3, whose reader used a metric staff from 1990. The 1997 cards
are all metric, so no conversion arises for 1997's own readings. The rule
matters here because the 1997 ledger's January page carries the December
1994 readings copied forward for comparison, and two of those are queried.

Checks. The `?` flag went through `gaugetool check` without error in the
two September test batches (B-1997-T1 and B-1997-T2, forty readings each).
That is all that has been tried; the help page says nothing about the flag
column.

The assistant may create and change files under `archive/1997/` and
`reports/` without asking.
