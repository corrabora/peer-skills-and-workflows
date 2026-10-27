# Monthly summary

## Task

Produce `summaries/<year>-<month>.md` for the month just ended from the
month's lines in `archive/<year>/readings.csv`, using `gaugetool summary`,
and copy it to `published/`.

## Inputs

`archive/<year>/readings.csv`; `tools/gaugetool-help.txt` for the commands.
You may create and change files under `summaries/`, `published/` and
`checks/`.

## Checks before publishing

Before copying the summary to `published/`, confirm that the coordinator
has emailed the month's calibration confirmation. Run `gaugetool check` on
the readings file: exit status 0 means the file is valid; exit status 2
means it has gaps, which you list at the end of the summary and publish
anyway. Treat any other exit status as a reason to halt and tell the
coordinator.

## Completion

Done when the summary is in `published/` and the check output is saved
under `checks/`.
