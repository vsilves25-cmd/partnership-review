# Status

Where the project stands and what is open. Update this in the same commit as any change
that alters it. Dates are absolute.

Last updated: 7 October 2026.

## Now

- **Version 18.0.0**, tagged `v18.0.0`. Person-neutral: each loan officer enters their own
  name, NMLS number and photo. 135 automated tests pass.
- **The repository's home is a private GitHub repository** belonging to the owner (`origin`;
  `git remote -v` shows it). First pushed 7 October 2026. Checked from outside without
  signing in: it is not visible.
- Version control began with 18.0.0. Builds 17.0.0 and 17.0.1 were overwritten and are not
  recoverable. `Pipeline Report V13` to `V16` exist only on the first build laptop, beside
  this folder.

## Checked by hand

On the first build laptop, 7 October 2026, with version 17 (see `TESTING.md` for the table):
folder saving, a note surviving Edge closed mid-word, adding a second export, print,
presenter view, a copy opened from another location, a PC restart. All passed.

## Not yet checked

- **The My details screens added in 18.0.0** have not been clicked through in a real Edge
  window: the set-up dialog, typing a name and NMLS number on the report, dropping and
  reframing a photo, a custom background. They are covered by automated tests and were
  looked at in screenshots.
- **No second PC has run the tool.** The first user's PC is to be checked in the week of
  12 October 2026: `probe.html`, then steps 3 and 4 of the hand checks.

## Open decisions (the owner's)

1. **Hero background.** It is a skyline photo of one city, from V16. Each person can replace
   it under My details. Option: make the default a plain NFM navy for everyone.
2. **Compliance footer.** The report shows the officer's name and NMLS number. It has no
   company NMLS number, Equal Housing Lender mark or disclaimer. To be raised with NFM
   before a wide rollout.

## Known limits that matter for other loan officers

- **Column headers must match exactly**, including capital letters. Four are required
  (Borrower Name, Buyers Agent Contact Name, a milestone column, a pre-approval column). A
  view that names them differently is refused, even though the data is there.
- **Milestone names are fixed** in `STAGES` in `src\core.js`. Unknown ones land under *Status
  to confirm* and stay off the funnel.

## Next change, if wanted

A one-time "match your columns" step per loan officer: when a required or useful column is
not found by name, ask which of the export's columns it is, and remember the answer with
their details. The same for milestone names. Not started.

## Outside this repository, on the first build laptop only

These hold personal or borrower data and must stay out of the repository.

| What | Where |
|---|---|
| The first user's saved details (name, NMLS number, photo) | a folder beside this one named for that user; one `My details.partnership-profile.json` |
| Two real Encompass exports used for checking | the parent folder |
| The owner's test team | a `Teams` folder the owner moved out of this project |
| A zip of the project taken just before version control began | `..\snapshots\` |
| Portable Git | `C:\NFM\tools\git` |
