# The 2026 rain totals table

The data assistant is to produce `levels/rain-2026.csv`: the monthly
rainfall total for each of the three rain gauges (R1 Askerby village, R2
Scar Foot, R3 Carr Lane), one line per gauge per month,
`month,gauge,total_mm`, from the rain lines in `archive/2026/readings.csv`
(gauge R1, R2 or R3; the reading is the day's rainfall in millimetres).

A month in which a gauge has any day without a reading is written as
`incomplete` in the total column rather than summed. Totals are whole
millimetres. The table is rebuilt from scratch each time; the assistant may
create and change `levels/rain-2026.csv` without asking.

Done when the table has a line for every gauge and every month from
January to the last complete month in the readings file.

For the coordinator, who will read the table: the three gauges are all on
the valley floor, so the totals say nothing about rainfall on the fells,
where most of the beck's water comes from; an `incomplete` month means a
card was missing or a day was not read, not that no rain fell; and the
totals are of what the readers recorded, not corrected for gauge exposure
or wind.
