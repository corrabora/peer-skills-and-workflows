# Rent letters

`rent-letters.sh` reads `register/plots.csv` and writes one letter per
plot holder to `letters/<year>/`.

Rules the script applies:

- The amount due is the rent band's figure plus any arrears carried in the
  `arrears` column.
- Arrears under 5.00 are not pursued: the script sets them to zero and the
  letter says nothing about them.
- A holder with arrears of 5.00 or more gets the arrears line and the
  standard reminder paragraph.
