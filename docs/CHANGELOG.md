# Changelog

## 18.0.0 — 7 October 2026

The tool no longer belongs to one person. Any NFM loan officer can use it.

- **Nobody's name, NMLS number or photo is built in.** Version 17 carried the first user's
  on every report. Each loan officer now enters their own once, under **My details**, or types
  them straight onto the report and drops a photo on their circle.
- **Details are saved apart from teams**, as `My details.partnership-profile.json` beside the
  team files and inside the browser. A teams folder moved to a new PC brings them with it.
- **A reminder shows while the name or NMLS number is missing** from a report. With neither a
  name nor a photo, a presented or printed report leaves the officer's side off, not blank.
- **The footer reads "Prepared by <name> at NFM Lending"**, or a team name if one is given.
- **Each person can use their own background photo.** The standard one is unchanged.
- **A details file can be opened or dropped on the Teams page** to set someone up in one step.
  The first user's version-17 details were saved to such a file so nothing is re-entered.
- **"Our averages" worked out from a pipeline export** now names whoever is using the tool.
- New: [ROLLOUT.md](ROLLOUT.md), for handing the tool to other loan officers.

Team files are unchanged and open as before.

## 17.0.1 — 7 October 2026

After the first hand tests on the build laptop.

- **Steady typing saves without waiting for a pause.** A note is committed half a second
  after the first unsaved keystroke and written 0.7 seconds after that, however long the
  typing goes on. 17.0.0 waited for a pause, so a long unbroken burst was only protected by
  the save that runs when the tab closes, which a power cut skips. A power cut now costs
  about the last second of typing.
- **The demo page saves nowhere.** It kept its made-up team in Edge, and Edge shares one
  store between every page opened from disk, so the made-up team could have appeared in the
  real tool's list.
- **Deleting a team also removes its `.bak`.**
- **A `.bak` can be opened with Open a copy**, which is how a team is rolled back.
- **The version is shown at the foot of the Teams page.**

## 17.0.0 — 7 October 2026

The first version that remembers. Built from `Pipeline Report V16.html`; the report itself
looks and reads as V16 did.

### New

- **Teams are saved.** One file per realtor team, in a folder the loan officer picks once. Every change
  saves itself; there is no Save button.
- **A second copy inside the browser**, written on every change, so a crash, a closed tab or
  a failed file write loses nothing. The two are compared on opening and the newer one wins.
- **Teams page.** Lists saved teams. Dropping an export there asks which team it is for.
- **Adding the next export keeps the loan officer's work.** A preview shows what will change first.
  See [RECONCILIATION.md](RECONCILIATION.md).
- **Since we last met.** New referrals, new pre-approvals, buyers under contract, closings,
  fall-out and stage moves since the last meeting or export.
- **Mark as presented.** Records what was on the report that day.
- **Private notes.** One per buyer; never printed, never in presenter view.
- **Closing in the next 30 days**, from Est Closing Date.
- **For you only.** A private panel: expiring locks, passed closing dates, appraisal gaps,
  and buyers missing from the latest export waiting for a reason.
- **Presenter view**, and a single-agent version of the report.
- **Undo**, up to 40 steps, and per-row reset.
- **Export checklist** in the controls: which useful columns the export lacks.
- **Our averages from a full pipeline export**, with the source printed.
- **Save a copy / Open a copy**, automatic `.bak`, and a prompt before overwriting a team
  file that was changed somewhere else.

### Changed from V16

- **Encompass comments no longer go straight onto the report.** They appear under the buyer
  as a suggestion with a *Put on report* button. V16 printed the newest processor note on a
  page meant for the realtor.
- **"Our average" is off until it has a source and a period.** V16 printed "against our
  average of 48%" from two unsourced default numbers.
- **Day counts are measured to the export's date, not today.** The footer says "as of" that
  date and separately when notes were last updated. A bar warns when the export is over a
  week old.
- **SheetJS is inside the file** (0.20.3, was 0.20.2 loaded from the internet on every open).
  The tool now works offline, and a security policy on the page forbids any network use.
- **A buyer missing from a later export is kept**, and a closed loan stays in the closed
  totals. V16 had no memory, so they simply vanished.
- **Printing always uses the clean view.**
- **"Undo my changes" became Undo and "Clear all my corrections"**, since changes now persist.

### Fixed

- **A bare initial could merge two different agents.** With "Tom", "Tim" and "T" sharing a
  surname, V16 merged all three, because "T" matched both. An initial now joins a group only
  when exactly one fits.
- **Editing the team name did nothing.** The heading was editable but the edit was dropped
  on the next redraw. It is now saved.
- **The big percentage on the two metric cards was unstyled.** The stylesheet targeted
  `.metric`; the markup said `.metriccard`.
- **A listener was added to the page on every redraw** once a partner photo was set, so a
  long session slowed down. Dragging is now wired once.
- **Clicking a control straight after typing in another could miss.** The redraw replaced
  the control mid-click. Redraws now wait for the mouse button to come up, and Tab keeps
  its place.
- **Pasted text keeps no formatting**, and single quotes are escaped along with the other
  markup characters.
- **Nickname list extended** from 17 to 106 first names.

### Known limits

- One person edits a team. Two windows on the same team are detected and stopped, not merged.
- Team files are not encrypted; see [DATA.md](DATA.md).
- Folder saving needs Edge or Chrome. Other browsers keep teams inside the browser only.
- The checks that need a real window have not been run yet; see [TESTING.md](TESTING.md).
- Nothing is written back to Encompass, by design.

## Before 17

`Pipeline Report V13.html` to `V16.html`, kept unchanged in the parent folder. Versions were
tracked by file name.
