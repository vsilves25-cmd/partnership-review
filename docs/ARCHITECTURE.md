# Architecture

## The shape of it

```
Partnership Review.html   one file: code, SheetJS, images. No data.
        |
        |  reads an export, reads and writes team files
        v
<folder the loan officer picks>\The Marlow Team.partnership.json      one per realtor team
                   \The Marlow Team.partnership.json.bak  previous version, kept automatically
```

The tool and the data are separate files. Replacing the tool with a newer build cannot
touch a team file.

There is no server, no install and no network. The page carries a Content-Security-Policy
that forbids loading or sending anything: `default-src 'none'; connect-src 'none'`.

## Why not an installed app or a database

V16 was a single HTML file opened from disk, and that is what makes it usable on a managed
NFM PC: nothing to install, nothing for IT to approve. The build laptop has no Node, Git,
Rust or Python, so a packaged desktop app could not even be built here. A team is about
40 rows and one person edits it, which a JSON file handles comfortably.

## Three layers of information

| Layer | Where | Who changes it |
|---|---|---|
| Encompass facts | `loan.src` in the team file | Only an import |
| the loan officer's work | `loan.overlay`, `loan.note`, `loan.privateNote`, `loan.hidden`, `aliases`, `team`, `settings` | Only the loan officer |
| History | `imports`, `meetings`, `log` | Appended, never rewritten |

An import replaces `src` and nothing else. That is why a re-import cannot overwrite a note.
The report is drawn from `src` with the overlay laid on top (`buildView` in `view.js`).

## Who the report is from

Nothing about any person is built into the tool. The loan officer's name, title, NMLS number,
photo, footer name and optional background photo are their *details*: one small file,
`My details.partnership-profile.json`, kept beside the team files, with a copy in the browser.
The newer of the two wins and the other is brought up to date, so a teams folder moved to a
new PC brings the details with it.

Details belong to the person, not to a team. A team file never holds them, so a team file
opened by a different loan officer shows that officer's details. They are not part of Undo.

## Source files

Loaded in this order. Each is plain script with global functions, the same style as V16.

| File | Job | Touches the page? |
|---|---|---|
| `core.js` | Reading an export, dates, agent-name merging, the statistics. Lifted from V16. | No |
| `workspace.js` | The team file: shape, checksum, upgrades between versions. | No |
| `view.js` | Team file to report rows; what changed since last time; the private watch list. | No |
| `reconcile.js` | Matching a new export to the saved team. `plan()` looks, `apply()` works on a copy. | No |
| `profile.js` | The loan officer's own details: name, title, NMLS number, photo, footer name. | No |
| `edits.js` | Every change the loan officer can make, as a function on the team file. | No |
| `store.js` | Saving and opening. The only file that talks to the folder and the browser. | Through a platform object |
| `report.js` | The report as one HTML string. Adapted from V16's `render()`. | No |
| `ui.js` | Screens, dialogs, wiring, autosave, undo. | Yes |
| `assets.js` | The baked-in images from V16. | No |
| `vendor\xlsx.full.min.js` | SheetJS 0.20.3, from cdn.sheetjs.com. | No |

Only `ui.js` and the browser half of `store.js` need a real browser. Everything else is
tested as plain functions.

## Saving

Three layers. The first two are automatic.

| Layer | Mechanism | Purpose |
|---|---|---|
| Folder | File System Access API. One file per team, written in place. | The saved copy. |
| Browser | IndexedDB, with `localStorage` as a fallback. Written on every change. | Survives a crash, a closed tab, a failed file write. |
| Copy | Download / open a `.partnership.json`. | Backup, and moving to a new PC. |

How a change is saved:

1. An edit calls `change()` in `ui.js`. It snapshots for Undo, updates the team, redraws,
   and schedules a save 0.7 seconds later.
2. A note being typed is committed 0.5 seconds after the first uncommitted keystroke, without
   a redraw, so the cursor does not move. Neither this nor the save in step 1 waits for a
   pause: steady typing reaches the file about every second.
3. `Store.save()` bumps the revision, writes the browser copy, then writes the file.
4. If the tab is closing, one synchronous `localStorage` write captures the team first
   (`Store.lastGasp`). That is the only kind of write a closing tab is guaranteed to finish.

How a team is opened: the file, the browser copy and the last-moment copy are all read, and
the one with the highest revision wins. If that is not the file, the result is flagged as
recovered and written back to the file.

**Conflicts.** After every read or write the store remembers a hash of the file's contents.
Before writing it checks the file still has those contents. If not, it refuses, keeps the
change in the browser, and the page offers: keep mine, open the other version, or keep both.

**Backups.** The first write to a team's file in each session first copies the existing file
to `<name>.bak`. A forced overwrite always does.

## Start-up

`start()` opens storage and draws the Teams page. `READY` resolves when both are done.
Anything that can run earlier (a file dropped in the first moment) waits on `READY`.

## Build

`build.ps1` reads `src\index.template.html` and replaces each `/*{{file}}*/` marker with
that file's contents. There is no bundler and no minifier. The test page is built the same
way, so it can be run from a single file too.

## What this PC's Edge allows

Checked with `tools\probe.html` on the build laptop, 7 October 2026:

| Check | Result |
|---|---|
| A page opened from disk counts as a secure context | Yes |
| Folder saving (File System Access) is available to it | Yes |
| Text stored in the browser survives closing and reopening Edge | Yes (`localStorage`) |
| IndexedDB | Yes. The chosen folder was remembered across an Edge restart and a PC restart, which only IndexedDB can do |
| Folder permission after a restart | Remembered. The teams list came up with no prompt |
| A copy of the tool opened from another location | Found the same folder and teams. Edge keeps one store for all pages opened from disk |
| Actually writing into a picked folder | Yes. Run by hand with the probe's button; it wrote, read back and removed a test file. |

Another PC may be configured differently. Run the probe once on each new user's PC.
