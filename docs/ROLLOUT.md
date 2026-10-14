# Loan officers - ask me for help or read below

From version 18 the tool carries nobody's name. It is NFM-branded, and each loan officer adds
their own name, NMLS number and photo the first time they open it.

## What to send

Two files. Neither contains borrower data or anyone's personal details.

| File | From | Why |
|---|---|---|
| `Partnership Review.html` | `dist\` | The tool. |
| `probe.html` | `tools\` | A one-minute check that their Edge can save into a folder. |

Optional: `Partnership Review - DEMO.html` from `dist\`. It opens on a made-up team with two
weeks of history and saves nothing, so it is safe to click around in or to show in a meeting.

Send them through a channel NFM uses for internal files: Teams, NFM email, or a shared
OneDrive or SharePoint folder. A shared folder is best, because an update is then one file
replaced in one place.

## What each loan officer does (about five minutes)

1. Open `probe.html` in Edge. Click the button, pick any empty folder, allow it. It should
   say `WORKS`.
2. Open `Partnership Review.html`.
3. Click **Set up my details**: name, NMLS number, photo.
4. Click **Choose a folder** and pick where their teams will live. It must be somewhere NFM
   approves for borrower data - locally on your machine.
5. Drop an Encompass export on the page.

The full guide is the "Using it" section of the [README](../README.md).

Each person needs an Encompass pipeline view with the right columns. Send them
[ENCOMPASS-EXPORT.md](ENCOMPASS-EXPORT.md), or build one view and share it. The tool's
controls panel lists whatever their export is missing.

## What is the same for everyone, and what is theirs

| Same for everyone | Each person's own |
|---|---|
| NFM logo, colours and layout | Name, title, NMLS number, photo |
| "NFM Lending" in the title and footer | Footer name ("the Smith Team") if they sign as a team |
| The stages, groups and statistics | Their teams, notes and corrections |
| The standard background photos | Their own background photo, if they choose one |

**The standard background is a skyline photo of one city**, the one V16 was built with. A
loan officer in another market can replace it under **My details**, or it can be swapped for
everyone by changing `HERO_BG` in `src\assets.js` and rebuilding - connect with me for more details

The stage names (`Started`, `Ready for Pack Out`, `Processing`, `Approval`, `Resubmittal`,
`CTC`, `Rec'd by Closer`, `Funding`) are the ones in the exports this was built from. If
another branch uses different milestone names, their files land under *Status to confirm*
until `STAGES` in `src\core.js` is extended.

## Setting someone up from a file

A person's details are one file, `My details.partnership-profile.json`. On the Teams page,
**Open a copy** (or dropping the file on the page) loads it. That is how to:

- move someone to a new PC without retyping (their teams folder already contains the file);
- set someone up in advance: fill in **My details** yourself, click **Save a copy of my
  details**, and send them the file.

The first user's details from V16 were saved this way, outside this folder, so nothing had to
be re-entered.

## Updating everyone

1. Change the source, run `run-tests.ps1`, run `build.ps1`.
2. Replace `Partnership Review.html` wherever people get it from.
3. Each person replaces their copy, or just opens the shared one.

Their teams and details are separate files and are untouched. The version is at the foot of
the Teams page, so "which version are you on?" has a quick answer. Edge keeps one store for
all pages opened from disk, so a new copy finds the same teams folder wherever it is saved.

## When someone reports a problem

| Ask | Why |
|---|---|
| What does the foot of the Teams page say? | The version. |
| What does the top bar say next to the team name? | The save state. Hovering it gives the reason. |
| What does `probe.html` report? | Whether their Edge allows folder saving and browser storage. |

[RECOVERY.md](RECOVERY.md) covers getting work back. Do not ask for a team file to be sent
for debugging unless it goes by an approved route: it holds borrower data.

## Limits to mention

- One person edits a team. It is not a shared, multi-user system.
- Nothing is written back to Encompass.
- Edge or Chrome is needed to save into a folder.
- Each person's data is only as backed up as the folder they chose.
