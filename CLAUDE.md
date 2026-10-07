# Partnership Review: read this first

Everything a new session needs is in this repository. Do not rely on memory from another
machine or an earlier conversation; neither follows the owner between computers.

Current state and open items: [docs/STATUS.md](docs/STATUS.md). Keep it up to date.

## What this is

One HTML file (`dist\Partnership Review.html`) that turns an Encompass pipeline export into
an NFM Lending co-branded review for a realtor team, and remembers each team between
meetings. Any NFM loan officer can use it. It is opened from disk in Edge. No server, no
install, no network.

## Rules that do not bend

1. **Borrower data never enters this repository and never leaves the PC it is on.** No
   Encompass exports, no `*.partnership.json`, no `*.bak`. Do not publish, upload, paste or
   push anything derived from them. Tests and the demo use made-up people only. When
   reporting on real data, give counts, not names.
2. **Nothing about any person is built in.** No names, NMLS numbers or photos in source,
   tests, docs or built files. Write "the loan officer". Each person's details live in their
   own `My details.partnership-profile.json`, outside this repository.
3. **It stays a local file.** Hosting was considered and rejected. The page's
   Content-Security-Policy forbids all network use; keep it that way.
4. **A note typed once is never typed again.** Every edit saves itself. Do not add a Save
   button anyone has to remember, and do not weaken the save paths.
5. **NFM branding stays as it is** unless the owner asks for a change.

## How changes are made

The owner's instruction, 7 October 2026: no more overwriting files. In practice:

- `git status` must be clean before starting. If it is not, stop and ask.
- **Small, targeted edits.** Do not rewrite a whole existing file, and do not run a
  find-and-replace across files, unless the owner has agreed to that specific change.
- **One commit per logical change**, with a message a non-programmer can read.
- Run `.\run-tests.ps1` before every commit. Do not commit with a failing test.
- Rebuild with `.\build.ps1` when `src\` changes, and commit `dist\` in the same commit so
  the built file always matches the source.
- Bump `APP_VERSION` in `src\core.js` and add a `docs\CHANGELOG.md` entry for anything a user
  would notice. Tag releases `vX.Y.Z`.
- Afterwards, push to `origin` (the owner's private GitHub repository) so every machine sees
  the change, and tell the owner what changed in plain words. Never push anywhere else, and
  never make the repository public.
- On a new machine, clone `origin` and open the session in the cloned folder. Real exports
  and team files are not in the repository and must not be copied to a machine that is not
  NFM's.
- If Git is not available on a machine, take a dated zip of this folder first and say so.

## Working here

Nothing needs installing. PowerShell and Edge do everything.

```powershell
.\run-tests.ps1            # all tests, headless Edge; exit code 0 on success
.\run-tests.ps1 -Failures  # only failures
.\build.ps1                # src\ -> dist\Partnership Review.html and dist\tests.html
.\tools\make-demo.ps1      # dist\Partnership Review - DEMO.html, made-up data, saves nothing
```

- No Node, npm or Python. Tests are a browser page (`tests\tests.html`, runner in
  `tests\runner.js`), not a Node test suite.
- Git may not be on PATH. On the first build laptop it is portable Git at
  `C:\NFM\tools\git\cmd\git.exe`.
- Headless Edge cannot drive the folder picker or the print dialog, and does not complete
  IndexedDB calls. Tests use a pretend folder and browser (`tests\store.test.js`). Anything
  needing a real window goes in the hand-check list in `docs\TESTING.md`.
- Source style follows the original V16 file: plain scripts, global functions, `var`.
  Match it.

## Where things are

| Need | Look in |
|---|---|
| How it fits together, and why not a database or an installer | `docs\ARCHITECTURE.md` |
| What is stored where; what never is | `docs\DATA.md` |
| How a new export is matched to a saved team | `docs\RECONCILIATION.md` |
| Which Encompass columns are required or optional | `docs\ENCOMPASS-EXPORT.md` |
| Getting work back after a failure | `docs\RECOVERY.md` |
| What is tested; hand checks and their results | `docs\TESTING.md` |
| Handing the tool to other loan officers | `docs\ROLLOUT.md` |
| What changed in each version | `docs\CHANGELOG.md` |

Source files, in load order: `core.js` (reading an export, statistics; lifted from V16),
`workspace.js` (team file), `profile.js` (a person's details), `view.js`, `reconcile.js`,
`edits.js`, `store.js` (the only code that touches the folder and the browser), `report.js`
(the report as an HTML string), `ui.js` (screens, wiring, autosave).
