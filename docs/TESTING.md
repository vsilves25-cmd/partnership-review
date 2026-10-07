# Testing

## Automated: 135 tests

```powershell
.\run-tests.ps1            # all tests, in Edge, no window. Exit code 0 on success.
.\run-tests.ps1 -Failures  # only what failed
```

Or double-click `tests\tests.html` (or the self-contained `dist\tests.html`) and read the page.

No install is needed. The runner is `tests\runner.js`, about 60 lines. Every test uses
made-up people in the real column layouts (`tests\fixtures.js`). Exports are built into real
`.xlsx` files in memory and read back through SheetJS, so tests go down the same path a
dropped file does.

| File | Tests | Covers |
|---|---|---|
| `core.test.js` | 29 | The logic lifted from V16: dates, money, stages, note choice, agent-name merging, reading an export, required-column errors, day counts, the three close-rate bases, medians, the monthly chart, a sourced benchmark |
| `workspace.test.js` | 10 | The team file: round trip, hand-edited file, damaged file, newer-version file, step-by-step upgrade, gap filling, change-log cap |
| `profile.test.js` | 6 | A loan officer's own details: defaults, NMLS clean-up, the footer line, round trip, not confused with a team file |
| `reconcile.test.js` | 23 | Every row of [RECONCILIATION.md](RECONCILIATION.md), and *since last time* |
| `edits.test.js` | 14 | Corrections, notes, private notes, hiding, agent renames, the private watch list, closing soon |
| `store.test.js` | 22 | Saving against a pretend folder and browser: both layers, `.bak`, permission, conflict, full disk, nothing writable, last-moment save, damaged file, delete; a person's details in the browser and the folder, moved to a new PC, newer copy wins |
| `report.test.js` | 12 | What is on the page: hostile text, presenter and print carry nothing private, benchmark off until sourced, dates, single-agent view; the officer's side comes only from their details |
| `ui.test.js` | 19 | The working screen driven by typing and clicking: a note saves itself, survives a reopen, survives a tab closed mid-word; stage change, hide, Undo; import preview; a real dropped file; conflict; full disk; rollback from `.bak`; first-time details, details typed on the report, details loaded from a file |

Tests that pin the stated requirement, "nobody types a note twice":

- *a note saves itself while it is being typed, with no click and no redraw*
- *the note is there when the tool is closed and opened again*
- *typed and the tab closed straight away: still not lost*
- *typing without ever pausing still reaches the file about a second in*
- *a full disk does not lose the change: it stays in the browser and is recovered*
- *next export: Encompass facts update, the loan officer's work stays*

## Checked on this laptop, 7 October 2026

Run in real Edge, headless, against the built file with its production security policy.

| Check | Result |
|---|---|
| `run-tests.ps1` against `tests\tests.html` | PASS 135/135 |
| Nothing of the first user's is left in the built files (name, NMLS number, photo) | Confirmed by search of `dist\` and the whole folder |
| The first user's saved details file is accepted by the tool | Yes: name, NMLS number, footer and photo all read back |
| The same tests from the single-file `dist\tests.html` | PASS |
| `dist\Partnership Review.html` opens and draws the Teams page with no network | Yes |
| The built file contains no `http://` or `https://` source or link, and app code makes no network call | Confirmed by search |
| Both real exports, in order, through the built tool | See below |
| No real borrower name, agent name or address appears in any file in this folder | 84 names and addresses searched in 28 files, 0 found |

The two real exports (counts only; the temporary page and browser profile used for this were
deleted afterwards):

| | Result |
|---|---|
| First export (28 Aug) | 38 buyers, 38 distinct identifiers, 11 closed |
| Second export (4 Sep), preview | "27 already on this team, 4 with changes. 0 new. 11 no longer in the export." |
| After adding it | Still 38 buyers. Still 11 closed and the same closed volume, although 3 closed loans had left the export. 11 marked not in latest export |
| Since the last export | 1 newly pre-approved, 3 moved stage |
| Encompass comments | 19 offered as suggestions, 0 placed on the report |
| Same file again | Recognised as already added |
| Presenter view | Nothing editable, nothing private |
| "Our average" | Not shown (no source entered) |
| Team file size | 61 KB |

Two bugs in V16's own logic were found by the tests and fixed; see [CHANGELOG.md](CHANGELOG.md).

## Still to check by hand

These need a person and a real window. None could be automated: Edge's folder picker and
print dialog cannot be driven by a script.

**On the build laptop, then on each new user's PC** (steps 1, 3 and 4 are enough there).
Results below are from the build laptop, 7 October 2026, on version 17. None has been run on
another PC yet, and the *My details* screens added in version 18 have only been tested
automatically and by screenshot.

| # | Do this | Expect | Result |
|---|---|---|---|
| 1 | Open `tools\probe.html` in Edge. Click the button, pick an empty folder, allow. | `"folder": "WORKS: ..."` and `"idb"` shows `"wrote": true` | Build laptop, 7 Oct 2026: folder write works. Other PCs: not yet run |
| 2 | Open `dist\Partnership Review - DEMO.html`. Click around. | A made-up team with two weeks of history | Pass (build laptop, 7 Oct 2026) |
| 3 | Open `dist\Partnership Review.html`. **Choose a folder.** Drop an export. | A `.partnership.json` appears in the folder; the top bar says *Saved hh:mm* | Pass. The team file appeared in the chosen folder |
| 4 | Type a note. Close Edge at once, without clicking anywhere. Reopen, open the team. | The note is there | Pass. A note typed and Edge closed mid-word was there on reopening |
| 5 | Restart the PC. Open the tool. | *Open my teams folder* (one click), then the teams list | Pass. Edge had remembered the permission, so the teams list came straight up with no click |
| 6 | Drop the second export. | The preview box; then *Since we last met* | Pass for adding the export. The hand test typed its note in a different team, so carry-over was confirmed another way: that saved team plus the second export, run in memory, kept the note unchanged on the same buyer |
| 7 | **Save as PDF.** | No yellow notes, no controls, no *For you only* panel, no empty photo circle | Pass. The print preview is the clean view |
| 8 | **Presenter view**, then Esc. | Clean page; Esc returns to the working view | Pass |
| 9 | Copy `dist\Partnership Review.html` over the one in use. Open it. | Teams open unchanged | Pass. A copy opened from a different location (the Desktop) found the teams folder without asking |
| 10 | Disconnect from the network. Open the tool, open a team, edit, save. | Everything works | Not run by hand. Run in Edge with every network name lookup blocked: all tests pass and the tool imports two exports and saves |

If step 1 reports that the folder does not work on someone's PC, the tool still saves every
change inside Edge and says *Saved in this browser*. Tell whoever maintains the tool: the
file copy would then depend on **Save a copy**, which is not good enough to rely on.

## Adding a test

Add a `test("what it should do", function(){ ... })` to the matching file in `tests\`.
`eq(got, want)`, `ok(value)`, `no(value)`, `throws(fn, /message/)` are the assertions.
`async` tests are awaited. Use `fx({...})` to describe an export row and `importInto(...)`
to add an export to a team.
