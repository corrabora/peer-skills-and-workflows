# Readings files: the quarterly check

Every readings file under `archive/<year>/` is `readings.csv`, with a
header line naming the year and the gauges it covers. Each quarter the data
assistant runs `gaugetool check` on every readings file changed during the
quarter and saves each output as `checks/<year>-q<n>.txt`, where `<year>`
is the year of the file and `<n>` the quarter just ended. A file with gaps
is listed in the quarter's report to the coordinator, `reports/<year>-q<n>.md`;
the assistant fills no gaps. The assistant may create and change files
under `checks/` and `reports/` without asking.
