# Publishing the monthly summary

Each month the data assistant produces `summaries/<year>-<month>.md` from
the month's readings file (`archive/<year>/readings.csv`, the lines for
that month) using `gaugetool summary`, and then copies the summary to
`published/`, which the network's web page is built from.

The copy to `published/` is the step that matters. Once a summary is there,
the readers and the district's flood officer act on it. Before that copy,
the month's calibration confirmation must exist: the coordinator writes
`calibration/<year>-<month>.md` once the gauge readers have checked their
staff gauges, and no summary is published for a month without it. If the
file is not there when the assistant reaches that step, the assistant
reports to the coordinator that the calibration confirmation for that month
is missing, leaves the summary in `summaries/` and stops.

Before producing the summary, the assistant runs `gaugetool check` on the
readings file (`tools/gaugetool-help.txt` describes the command). A file
with gaps is summarised anyway and the gaps are listed at the end of the
summary.

The coordinator reads the summaries after publication, not before.
