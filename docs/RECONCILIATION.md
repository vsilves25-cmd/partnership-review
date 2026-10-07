# How a new export is matched to the saved team

Each rule below has a test of the same name in `tests\reconcile.test.js`.

## Telling one loan from another

| The export has | A buyer is identified by |
|---|---|
| A Loan Number column | The loan number |
| No Loan Number column | Borrower name + Date File Started |

Borrower name alone is not enough. In the first real export this tool was built against,
33 names covered 38 files: five buyers had two files each. Name plus start date was unique
in both real exports.

A saved buyer keeps every identifier it has ever been seen under. So:

- When Loan Number first appears, buyers found by name and start date are re-keyed to it.
- If the borrower's name is later corrected in Encompass, the loan number still finds them.
- If the Loan Number column is dropped again, name and start date still work.

## What happens on import

| Situation | What the tool does |
|---|---|
| A buyer is in both, and Encompass changed something | Encompass facts are updated. Notes, corrections and hidden flags are untouched. The change is logged. |
| the loan officer corrected a field and Encompass now agrees | The correction is retired quietly. |
| the loan officer corrected a field and Encompass now says something else | the loan officer's value stays in force. A line under the buyer shows Encompass's value with **Use Encompass** and **Keep mine**. |
| A buyer is not in the new export | Kept, marked "not in latest export", listed under *For you only* until the loan officer says why. |
| A closed loan is not in the new export | Stays closed and stays in the closed count and volume. |
| A buyer is new | Added, and listed under *Since we last met*. |
| A missing buyer reappears | Marked present again; the reason is cleared; notes are still there. |
| The same file is dropped twice | Recognised by a hash of the file. Nothing is added. |
| An export older than the current one | Kept as history. The current report does not change. Buyers only in the old export are added as missing. |
| Two rows in one file share an identifier | Matched in file order, with a warning recommending Loan Number. |
| A new row and a missing buyer started the same day with similar names | Offered as "possibly the same buyer". Linked only if the loan officer ticks it. |
| None of the export's agents are on this team | A warning that it may be the wrong file, before anything is added. |
| A required column is missing | The import stops with a message naming the column. Nothing changes. |
| Anything fails part-way | The saved team is exactly as it was. `apply()` works on a copy and only the finished copy replaces the team. |
| the loan officer took a buyer off the team and a later export lists them | They stay off. |

## Why a buyer went missing

The loan officer chooses one, and it changes how the buyer is counted.

| Choice | Effect |
|---|---|
| Not sure yet | Keeps its last known stage. Counted. On the private watch list. |
| Still active, the export left it out | Keeps its last known stage. Counted. Off the watch list. |
| Withdrawn / Denied / Went elsewhere | Shown under *No longer active*. Still counted as a referral. |
| Not this team's buyer | Removed from the report and every total. Can be put back. |

A buyer missing from the latest export is left out of the partner-facing "Worth talking
about" sentences, because the day counts behind them cannot be trusted.

## Since we last met

Measured from the last meeting marked as presented. If none has been marked, from the
previous export.

Each buyer appears in one list, the first that applies: closed, no longer active, went under
contract, reached pre-approval, moved to another stage. New buyers are listed separately.
Buyers left off the report are left out of these lists.

## The data date

Day counts are measured to the export's own date (the file's modified time), not to today.
A bar at the top warns when the export is more than a week old. The date can be corrected in
the controls.
