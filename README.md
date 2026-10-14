# Partnership Review

A single HTML file that turns an Encompass export into a co-branded review for a realtor
team, and remembers each team between meetings. For any NFM Lending loan officer.

Version 18.0.0.

**The file to use is `dist\Partnership Review.html`.** Nothing else in this folder is needed
to run it. It works with no internet connection and installs nothing.

## Using it

### First time

1. Double-click `Partnership Review.html`. It opens in Edge.
2. Click **Set up my details**. Enter your name and NMLS number and choose a photo. They go
   on every report you make. You do this once.
3. Click **Choose a folder** and pick (or make) a folder for your teams, for example
   `Documents\Partnership Reviews`. Edge asks once whether the page may edit files there.
   Say yes.
4. Drop an Encompass export on the page. The tool makes a team from it and shows the report.

From then on each realtor team is one file in that folder, named after the team. Your own
details are a small file beside them, `My details.partnership-profile.json`.

### Every week

1. Open the tool and click the team.
2. Drop this week's export anywhere on the page. A box shows what will change. Click
   **Add this export**.
3. Everything you typed before is still attached to the right buyers. A **Since we last met**
   section shows what moved.

### Saving

There is no Save button. Every change saves itself within about a second, and the top bar
says so: **Saved 10:42 AM**.

| The top bar says | What it means |
|---|---|
| Saved 10:42 AM | Written to the team's file in your folder. |
| Saved in this browser 10:42 AM | No folder is chosen. The work is kept inside Edge. |
| Saved in this browser only | The file could not be written (hover for why). Nothing is lost; it retries on the next change. |
| File changed elsewhere | The team's file was changed outside this window. Pick one of the three buttons in the red bar. |
| NOT SAVED | Nothing could be written anywhere. Use **Save a copy** in the controls at once. |

If you type a note and close the tab the same second, the note is still there next time.

### What you can change

- **Your side of the report:** click your name, title or NMLS number at the top to change
  them, and drop a photo on your circle. Drag the photo to reframe it, scroll to zoom.
  **My details** (Teams page, or the controls) also sets the footer name and lets you use
  your own background photo.
- **The partner's side:** click the team lead's name and role, and drop their photo and logo.
- Click any **name, agent, stage or pre-approval date** to correct it. Encompass is never changed.
- Type a **note** on the line under a buyer. It prints on the report.
- Hover a buyer to get a **private note** line (yellow). It never prints and never shows in
  presenter view.
- A grey line **From Encompass, not on the report** is the newest Encompass comment. It stays
  off the report unless you click **Put on report**.
- The **dots** at the end of a row leave that buyer off the report. They still count in the totals.
- The **arrow** at the end of a corrected row puts it back to what Encompass says.
- **Undo** (or Ctrl+Z) steps back through your changes to a team.

### Before and during a meeting

- **Presenter view** hides every control and everything private. Press Esc to leave it.
- **Save as PDF** always prints the clean view, whatever is on screen.
- **Mark as presented** records what is on the report today. Next time, *Since we last met*
  is measured from that moment.

A bar at the top reminds you while your name or NMLS number is missing from the report.

### For you only

At the foot of the page a yellow panel lists things only you should see: rate locks about to
expire, closing dates that have passed, missing appraisals, and buyers who were in an earlier
export but are not in the newest one. For each missing buyer, say what happened. Until you
do, they stay on the report and in the totals.

### Controls

The faint **controls** link at the very bottom opens: show closed buyers, the closed-rate
basis, a single-agent version of the report, the data date, the "our averages" comparison,
what your Encompass export is missing, history, your details, where the team is saved,
**Save a copy** and **Delete this team**.

The "our average" comparison is off until it has two numbers, a source and a period. The
simplest way to fill it in is **Work them out from a full pipeline export**.

More: [docs/ENCOMPASS-EXPORT.md](docs/ENCOMPASS-EXPORT.md) for how to set up the export,
[docs/RECOVERY.md](docs/RECOVERY.md) if something goes wrong.

## loan officers

See [docs/ROLLOUT.md](docs/ROLLOUT.md): what to send, what each person does, how to update
everyone.

## For whoever maintains it

This PC needs nothing installed. Everything runs with PowerShell and Edge.

```powershell
.\run-tests.ps1            # 135 tests, in Edge, no window
.\build.ps1                # writes dist\Partnership Review.html and dist\tests.html
.\tools\make-demo.ps1      # writes dist\Partnership Review - DEMO.html (made-up data)
```

The folder is a Git repository. Every change is a commit; nothing is overwritten without a
record. The rules for making a change are in [CLAUDE.md](CLAUDE.md), and where the project
stands is in [docs/STATUS.md](docs/STATUS.md).

To change the tool: edit files in `src\`, run the tests, run the build, and hand out the new
`dist\Partnership Review.html`. Each person replaces their copy. Their teams and their
details are separate files and are not touched by an update.

| Folder | What is in it |
|---|---|
| `src\` | The source, one concern per file. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). |
| `tests\` | The test page and its made-up data. |
| `tools\` | `probe.html` (what can this PC's Edge save?), the demo builder. |
| `dist\` | Build output. The tool, the self-contained test page, the demo. |
| `docs\` | The documents listed below. |

| Document | Answers |
|---|---|
| [docs/ROLLOUT.md](docs/ROLLOUT.md) | Giving the tool to other loan officers. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it is put together and why. |
| [docs/DATA.md](docs/DATA.md) | What is stored, where, and what never is. |
| [docs/RECONCILIATION.md](docs/RECONCILIATION.md) | How a new export is matched to what is saved. |
| [docs/ENCOMPASS-EXPORT.md](docs/ENCOMPASS-EXPORT.md) | Which columns the export needs. |
| [docs/RECOVERY.md](docs/RECOVERY.md) | Getting work back after a problem. |
| [docs/TESTING.md](docs/TESTING.md) | What is tested, and the checks still to do by hand. |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What changed, version by version. |

**Never put an Encompass export, a `.partnership.json` or a `.partnership-profile.json` file
in this folder.** The first two hold borrower data; the third holds a person's details. The
`.gitignore` blocks them in case this folder becomes a repository.
