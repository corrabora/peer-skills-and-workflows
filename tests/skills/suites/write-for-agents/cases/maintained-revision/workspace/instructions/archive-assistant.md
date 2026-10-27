# Standing instructions for the data assistant

These instructions apply to every job the assistant does in this
repository unless a brief says otherwise.

## Files

Create and change files only under `archive/`, `briefs/`, `summaries/`,
`levels/`, `checks/`, `reports/` and `handoffs/`. Never change anything
under `scans/` or `references/`.

## Readings

Enter readings in metres to one decimal place. Mark a reading the gauge
reader has queried with `?` in the flag column. Never void a reading; the
records keeper does that.

## Checks

Run `gaugetool check` on each readings file as soon as you have changed
it, and save the output under `checks/` as `<year>-<gauge>.txt`.

## Reporting

Report to the coordinator by writing `reports/<date>.md`. Keep a report to
what the coordinator must act on.
