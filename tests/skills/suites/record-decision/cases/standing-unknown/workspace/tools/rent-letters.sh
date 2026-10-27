#!/bin/sh
# Writes one rent letter per plot holder from register/plots.csv into letters/<year>/.
# Arrears under 5.00 are zeroed and not mentioned in the letter.
year=$(date +%Y)
mkdir -p "letters/$year"
tail -n +2 register/plots.csv | while IFS=, read -r plot holder band arrears; do
  if [ "$(printf '%s < 5.00\n' "$arrears" | bc)" = 1 ]; then arrears=0.00; fi
  printf 'Plot %s, band %s, arrears %s\n' "$plot" "$band" "$arrears" > "letters/$year/$plot.txt"
done
