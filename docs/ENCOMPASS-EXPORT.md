# Setting up the Encompass export

The tool reads the `.xlsx` that Encompass produces from a pipeline view (Export to Excel).
It uses whatever columns are in the view, so the view decides how much the report can do.

Save one pipeline view for this purpose, for example "Partnership Review", and export from
it every time. A consistent view is what keeps week-to-week matching reliable.

Column names below are exactly as they appear in the two real exports the tool was built
against. Encompass field names can differ between installations; if a column is named
differently on your screen, the controls panel will show it as missing.

## Required

The import stops, with a message, if one of these is absent.

| Column | Used for |
|---|---|
| Borrower Name | The buyer |
| Buyers Agent Contact Name | Grouping by agent |
| Current Milestone (or Last Finished Milestone) | The stage |
| One of: PreQualified Client, PreQualified Client DateTime, Milestone Date - Pre-Qualification | Whether and when the buyer was pre-approved |

## Strongly recommended

| Column | Why |
|---|---|
| **Loan Number** | Lets the tool follow a file between exports without relying on the name. Neither real export had it. Add it first. |
| Date File Started | The referral date, and half of the fallback identifier. |
| PreQualified Client | The clearest pre-approval marker. Without it the timestamp is used. |
| Total Loan Amount | Closed volume. |
| Last Finished Milestone Date | Day counts when a stage has no date of its own. |

## Used when present

| Column | Drives |
|---|---|
| Milestone Date - Ready for Pack Out, - Processing, - CTC, - Funding; Milestone Date/Time - Approval, - CTC, - Funding | Days in stage, and "typically N days to get here" |
| Est Closing Date | *Closing in the next 30 days* |
| # Days to Lock Expiration, Lock & Request Status | Lock warnings on the private watch list |
| Appraisal Date Ordered, Appraisal Recieved Date | Appraisal warnings on the private watch list |
| Milestone Comments - (any stage), Comments, Loan Comments, Conversation Log, Processor Notes Field | A suggested note under each buyer. Never printed unless the loan officer clicks **Put on report**. |
| Loan Type | Stored; not shown yet |

Everything else in the export is ignored and not stored.

## Which loans to include

- **Include closed loans.** A team's closed count and volume come from them. If a closed
  loan drops out of a later export the tool keeps counting it, but it has to have been
  seen once.
- **Include withdrawn and denied loans if you can.** Neither real export contained one. If
  the view filters them out, fall-out only shows up as buyers going missing, and the loan officer has to
  say why by hand.
- **Filter to the team's agents**, or export everything and let the tool group by agent.
  Do not change the filter from week to week: a buyer the filter drops looks the same as a
  buyer who fell out.

## Notes on format

- The tool reads the sheet named `Data` if there is one, otherwise the first sheet.
- Blank cells arrive as a single space. The tool treats them as blank.
- If a header appears twice, the first column with that name is used.
- The export's date is taken from the file's modified time. Export and drop it the same day,
  or correct the date in the controls.

## A full pipeline export, for "our averages"

To show a team how it compares, the tool needs a baseline with a source. In the controls,
**Work them out from a full pipeline export** takes an export of the loan officer's whole pipeline (all
agents, same columns) and computes the two averages from it, with the period and the number
of buyers printed beside them. Nothing prints until that is done or the numbers, source and
period are typed in by hand.
