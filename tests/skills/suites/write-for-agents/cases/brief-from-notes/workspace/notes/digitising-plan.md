# Digitising the 1998 ledger: planning notes

Working name for this job in the coordinator's diary: Mole. The name is for
the diary only; it means nothing to anyone else.

What: the 1998 gauge ledger, scanned by the records keeper as
`scans/ledger-1998/page-001.png` through `page-064.png`, is to become
`archive/1998/readings.csv` in the layout `instructions/archive-layout.md`
describes.

Inputs the assistant will have: the 64 scans, `instructions/archive-layout.md`
and `tools/gaugetool-help.txt`.

Result: `archive/1998/readings.csv`, and `archive/1998/transcription-notes.md`
listing every page whose figures did not reconcile with the page total.

Scope: 1998 only. The 1997 and 1999 ledgers are separate jobs, not started.

Approach. We first meant to put the scans through optical character
recognition and correct the output by hand. We tried that on pages 1 to 3
in August and dropped it: the ledger is handwritten and the output was
unusable. The job is now plain transcription, page by page, with each
page's figures checked against the page total the ledger carries in its
last column. A page whose figures do not reconcile with its total is listed
in transcription-notes.md; its figures are entered as read, never adjusted
to make the total come out.

Who decides what. The records keeper decides whether an unreadable figure
is left blank or taken from the reader's duplicate card; the assistant
enters it blank, lists it in transcription-notes.md and carries on. The
assistant may create and change files under `archive/1998/` without
asking anyone; it does not change anything under `scans/`.

Done when every page is transcribed, `gaugetool check archive/1998/readings.csv`
exits 0, and transcription-notes.md lists every page that did not reconcile
and every blank figure (an empty list is fine).
