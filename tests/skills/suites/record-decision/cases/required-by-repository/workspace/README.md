# Hollin Field Allotment Society: register repository

This repository holds the society's plot register and the records that go
with it.

- `register/plots.csv`: the plots, their holders and rent bands.
- `register/waiting-list.csv`: applicants in waiting-list order.
- `minutes/`: committee minutes, one file per meeting.
- `docs/adr/`: decision records.

Roles: the register keeper maintains the register and this repository; the
plots committee decides plot matters and meets monthly; the treasurer
collects rent and keeps the accounts; the water steward manages the
standpipes and the volunteer rota.

Every change to the rent rules (amounts, bands, due date, arrears) is recorded as a decision record in `docs/adr/` before the treasurer applies it.

The register keeper merges changes to `main`.
