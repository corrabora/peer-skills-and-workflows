# Digitise the 1999 ledger

Transcribe the 1999 ledger scans under `scans/ledger-1999/` into
`archive/1999/readings.csv`, gauge by gauge, in the archive layout. After
each gauge, run `gaugetool check` on the file and save the output under
`checks/` as `B-1999-<gauge number>.txt`. You may create and change files
under `archive/1999/` and `checks/`; change nothing under `scans/` and copy
nothing to `published/`.

Done when all nine gauges are transcribed and the last check exits 0.
