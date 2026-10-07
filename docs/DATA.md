# What is stored, and where

Borrower data lives in exactly three kinds of place, all on the loan officer's own PC. None of them is the
tool itself.

## Where data is

| Place | What | How it gets there | How to remove it |
|---|---|---|---|
| The teams folder the loan officer picked | `<Team>.partnership.json` and `<Team>.partnership.json.bak` | Written by the tool on every change | Delete the files, or **Delete this team** in the controls |
| Inside Edge (site data for the page) | A second copy of each team; the remembered folder; a random device id | Written by the tool on every change | **Delete this team**, or clear Edge's site data |
| Wherever the loan officer puts them | The Encompass exports they download; any **Save a copy** file; any PDF they print | By the loan officer | By the loan officer |

The tool never writes anywhere else and never sends anything over the network. The built
file contains no borrower data: `docs\TESTING.md` records the check.

## The loan officer's own details

`My details.partnership-profile.json` in the teams folder, with a copy inside Edge. It holds
the officer's name, title, NMLS number, footer name, photo and optional background photo. It
holds no borrower data. Team files never contain it.

## What a team file holds

Only the fields the report uses. The rest of each export row is discarded on import.

| Per buyer | From |
|---|---|
| Borrower name, buyer's agent name | Export |
| Milestone, milestone dates, file start date | Export |
| Pre-approval flag and date | Export |
| Loan amount, loan type, loan number (if exported) | Export |
| Estimated closing date, days to lock expiration, lock status | Export |
| Appraisal ordered / received dates | Export |
| The newest Encompass comment line | Export |
| Corrections, note, private note, hidden flag, why it went missing | the loan officer |

Per team: name, lead's name and role, photo, logo, benchmark numbers and their source,
agent renames.

History: one record per export (file name, a hash of the file, its date, column names, row
counts), one per meeting marked as presented (headline numbers and where each buyer stood),
and a change log capped at 1,500 entries.

**Not kept:** property address, seller's agent, referral source, lead source, Encompass
alerts, and every other column.

## Things worth knowing

- **Private notes are in the team file.** They do not print and do not show in presenter
  view, but anyone who opens the `.json` in Notepad can read them.
- **Edge keeps one store for every page opened from disk.** That is why a new copy of the
  tool finds the teams folder wherever it is saved. It also means any other HTML file opened
  from disk in the same Edge profile could read the browser copy of a team. Do not open HTML
  files from sources you do not trust on a PC that holds teams.
- **The file is not encrypted.** It relies on the PC's own protection (BitLocker, the NFM
  login) and on where the folder is. Put the teams folder somewhere NFM approves for borrower
  data.
- **A company-synced folder gives backups for free.** If the teams folder is inside an
  NFM OneDrive, each team file gets version history. The tool detects a file changed
  underneath it and asks before overwriting.
- **A printed PDF is a new copy of borrower data.** Sending it is outside this tool.
- **Photos and logos** are stored inside the team file as images, scaled down on the way in.
- **The change log is a convenience, not an audit trail.** Anyone who can edit the file can
  edit the log.

## Development

Tests and the demo use made-up people only (`tests\fixtures.js`, `tools\demo-data.js`).
Real exports must never be placed inside `partnership-review\`. The `.gitignore` blocks
`*.xlsx`, `*.xls`, `*.csv`, `*.partnership.json` and `*.bak`.
