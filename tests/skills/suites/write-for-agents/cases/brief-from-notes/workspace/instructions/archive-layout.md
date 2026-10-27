# Archive layout

Each year has one readings file, `archive/<year>/readings.csv`, with the
header line `year,<year>,gauges,<ids>` and then one line per gauge per
date: `date,gauge,reading,flag,initials`. Dates are ISO (`1998-03-14`),
readings are metres to one decimal place, the flag column is empty or `?`,
and initials are the gauge reader's as written in the ledger.
