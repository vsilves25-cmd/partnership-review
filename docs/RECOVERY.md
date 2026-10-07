# Getting work back

Every team exists in up to four places. Work down this list.

| Copy | Where | How fresh |
|---|---|---|
| The team file | `<teams folder>\<Team>.partnership.json` | Every change |
| The browser copy | Inside Edge, for this page | Every change |
| The previous version | `<teams folder>\<Team>.partnership.json.bak` | As the file was when the tool last opened it |
| Your own copies | Wherever **Save a copy** files were put; OneDrive version history if the folder is synced | When made |

## "I typed a note and it is gone"

Open the team again. On opening, the tool compares the file with the copy inside Edge and
uses whichever is newer. If the newer one was the browser's, it says "Recovered changes that
had not reached the file" and writes them to the file.

## The top bar says "Saved in this browser only"

The file could not be written. Hover the message for the reason: usually the folder is
unavailable, the disk is full, or Edge's permission lapsed. The work is safe inside Edge.
Fix the cause, then make any change; the tool writes the file on the next save. If in doubt,
**Save a copy** from the controls.

## The top bar says "NOT SAVED"

Neither the file nor the browser could be written. Do not close the tab. Open the controls
and click **Save a copy**. That puts the team in your Downloads folder. Then check free disk
space and reload.

## The red bar: "This team's file was changed somewhere else"

The file on disk is not the one this window last saved. That happens with two windows open
on the same team, a OneDrive sync, or a file restored from backup.

| Button | Result |
|---|---|
| Keep mine | This window's version replaces the file. The replaced file is kept as `.bak`. |
| Open the other version | This window's unsaved changes are dropped and the file is loaded. |
| Keep both | This window's version becomes a separate team, "(my copy)". The file is untouched. |

## A team card says the file is damaged

The file could not be read. Click **Open the copy kept in this browser** on the card. The
tool opens that copy, writes it back to the file, and keeps the damaged file as `.bak`.

If there is no browser copy (a new PC, cleared Edge data):

1. On the Teams page click **Open a copy**.
2. Pick `<Team>.partnership.json.bak` from the teams folder (choose *All files* if it is not listed).
3. It opens as a team of its own, saved under a new file name. The damaged file is left alone.

## Going back to an earlier version

- **Undo** covers the current session, up to 40 steps.
- The `.bak` file is the team as it was when the tool last opened it. To go back to it: on
  the Teams page click **Open a copy**, pick the `.bak` file, and confirm **Replace it**.
- If the teams folder is in OneDrive, right-click the team file and use Version history.
- The change log inside the team file (`"log"`) records every correction and note with the
  previous value. It can be read in Notepad.

## Moving to a new PC

1. On the old PC, copy the whole teams folder. Move it by an NFM-approved route; it holds
   borrower data.
2. On the new PC, open the tool, click **Choose a folder**, and pick the copied folder.

For a single team, **Save a copy** on the old PC and **Open a copy** on the new one do the
same job.

## Updating the tool

Replace `Partnership Review.html` with the new one. Team files are separate and are not
touched. If a newer version changes the team file format, it upgrades each team when it is
opened, and the `.bak` holds the file as it was before.

A team file saved by a newer version will not open in an older copy of the tool; it says so
and changes nothing.

## Edge keeps asking for the folder

Edge may ask for permission again each time it is restarted. Click **Open my teams folder**.
If Edge offers "Allow on every visit", choose it.

## Starting clean

**Delete this team** in the controls removes the team's file, its `.bak` and its browser
copy. To remove everything the tool stored inside Edge, clear site data for the page in
Edge's settings. Team files in the folder are not affected by that.
