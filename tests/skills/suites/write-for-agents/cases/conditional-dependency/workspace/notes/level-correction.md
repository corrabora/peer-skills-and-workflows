# Correcting river levels for the tidal gauge

Of the nine river gauges one, W9 at the beck's mouth, is tidal: its raw
level includes the tide. Each gauge has a record at
`references/gauges/<id>.md`; a tidal gauge's record carries the line
`tidal: yes`, every other record `tidal: no`.

For a tidal gauge the corrected level is the raw level minus the predicted
tide height at the reading time. The predicted heights and the subtraction
procedure are in `references/tide-correction.md`, which applies to tidal
gauges only; the other eight gauges' levels are used as read. The records
keeper maintains the tide page and replaces its predictions every year when
the new tables arrive, so it is to be read when used, not copied into
briefs or tables.

When the assistant builds a monthly levels table, `levels/<year>-<month>.csv`,
it needs the corrected level for a tidal gauge and the raw level for the
others. The table has one line per gauge per day: `date,gauge,level`, the
level in metres to one decimal place. The readings come from
`archive/<year>/readings.csv`, the lines for that month.

The assistant may create and change files under `levels/` without asking.
