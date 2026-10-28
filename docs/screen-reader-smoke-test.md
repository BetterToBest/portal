# Screen-reader smoke test with ChromeVox (draft v0.1)

Status: **draft checklist, not yet run by anyone.** This is a quick first pass for gate G7 of the [Phase 3 test plan](phase-3-test-plan.md) (#7, #11). It is not a user study and does not replace testing by people who use a screen reader every day; a pass here does not meet G7. CIP is a research proposal, not a live voting system, and every page below runs on test data or illustrative models.

Nothing here collects or monetizes user behavior data. The test needs no account and no personal details. Do not paste anything personal into the pages or into a report.

## Set up

1. Use Chrome or a Chromebook. Install ChromeVox from the Chrome Web Store, or use the one built into ChromeOS. Check the source and version yourself before installing and write them in your report.
2. Press **Ctrl+Alt+Z** to turn ChromeVox on. Press it again to turn it off.
3. Open the pages from a local copy (`python3 -m http.server` in the repository folder, then `http://localhost:8000/`) or from the project's published site. Use the same address for every page.
4. Test each page twice: once in light mode and once in dark mode (set it in the browser or operating system).
5. Use the keyboard alone. ChromeVox's own commands use its modifier key; look them up in its built-in help, which is the source of truth. They are not listed here.

## What to check on every page

Answer yes, no or unclear for each, and note where you were when it went wrong.

- [ ] The page title is read when the page loads and tells you which page it is.
- [ ] There is one top-level heading, and the other headings let you jump between sections in a sensible order.
- [ ] The words "research proposal" or "not live" (or "test data" or "illustrative") are heard early, before any result or button.
- [ ] Every button, field and link has a name that makes sense without seeing it. Nothing is read as just "button" or "edit text".
- [ ] You can reach every control with Tab and Shift+Tab, in an order that matches the page, and you are never stuck.
- [ ] After you activate a control, the result or status change is read aloud without you having to hunt for it.
- [ ] Nothing important is only a colour, a shape or a position.
- [ ] Text is read in full, with no stray symbols, "graphic" or file names read out.

## Page by page

### Landing page: `index.html`

- [ ] The "Skip to content" link is the first stop and moves you to the main content.
- [ ] The network picture is announced as a group, with its description ("Network of 36 nodes ...").
- [ ] Each node can be reached and selected by keyboard, and its state ("compromised" or not) is heard.
- [ ] "Compromise 5 at random" and "Reset" are announced, and the status line reports the change.
- [ ] The building-block tabs ("CIP building blocks") and the connected-systems tabs (CCO, PTF, PTH, SZH): the tab list is announced, the selected tab is announced as selected, and the panel text changes when you choose another.
- [ ] The "Cast yes" and "Cast no" buttons and "Verify my receipt" are reachable, and the result of each is read aloud.
- [ ] The "Paper details" disclosure says whether it is open or closed.
- [ ] The link to the proposal flow page is found by link list or headings.

### Mild-majority, intense-minority simulator: `simulator/index.html`

- [ ] Every slider and field has a name and a value read aloud, and the value is heard again when it changes.
- [ ] The "One person, one vote" and "Quadratic voting" results are read after a change, in a sensible order.
- [ ] The words "illustrative model, not a prediction" are heard.

### Ranked-choice simulator: `simulator/ranked/index.html`

- [ ] The ballot choices are labelled, and you can change them by keyboard.
- [ ] The four example buttons say what they load.
- [ ] After "Count the ballots", the result is announced, and "Round by round" can be read as a table or list in order.
- [ ] A tie is announced as a tie, with the names of the tied candidates.

### Liquid-delegation simulator: `simulator/liquid/index.html`

- [ ] The preset buttons say what they set, and the new values are heard.
- [ ] The result areas under "One trial" and "Across many trials" are read after "Run one trial" and "Run 300 trials", not before.
- [ ] The heaviest delegates are read in a clear order, and a loop or lost vote is explained in words.

### Ledger fork and halt-power simulator: `simulator/fork/index.html`

- [ ] The four presets say what they set.
- [ ] After "Run the model", the result is read aloud, including which outcome happened (for example a scoped hold, a full pause or a blocked halt).
- [ ] The words "illustrative model, not a prediction" and the note that thresholds are placeholders are heard near the result.

### Log viewer: `prototype/viewer/index.html`

- [ ] The warning that this is a research prototype on test data is heard before the buttons.
- [ ] The five example buttons are in a labelled group, and each name tells you what it loads.
- [ ] The file choosers have names and a description (file size limit).
- [ ] After an example loads or "Check this log" is pressed, the status is read aloud ("ok" or what failed), and "What failed" is easy to find.
- [ ] The proposals list can be read in order, with the signature count and comment-period state for each.
- [ ] The advisory notice is read with the result, not only at the top of the page.

### Proposal flow page: `prototype/try/index.html`

Go through the flow in order with the keyboard alone.

- [ ] "Read this first" and the advisory notice are heard before any control.
- [ ] Step 1, start a test log: the control is named, and the result is announced.
- [ ] Step 2, test clock: "Forward 30 seconds", "Forward 1 minute" and "Forward 5 minutes" each announce the new time.
- [ ] Step 3, register the five test identities: each button says whose key it registers, and the log count is announced.
- [ ] Step 4, file a proposal: the field has a name, and any error message is announced.
- [ ] Step 5, sign: "Sign the current text" and "Sign the earlier text" are distinguishable, and the outcome (accepted or refused, and why) is read aloud.
- [ ] Step 5, comment and amend: the comment is accepted only inside the comment period; the amendment clears the signatures and this is announced in words.
- [ ] Step 6, checkpoint and download: the buttons say what they download, and "Where things stand" and "The log so far" can be read in order.
- [ ] The downloaded log opens in the log viewer and the viewer announces a pass.
- [ ] The advisory notice is read beside every result, as [advisory-notice.md](advisory-notice.md) asks.

## Writing it up

For each page, report the browser and version, the operating system, the ChromeVox version and its source, light or dark, and the items that failed or were unclear. Say what you heard, not what you think the cause is. Post it in [Discussions](https://github.com/BetterToBest/portal/discussions) or on #7 or #11. Do not include personal details.

The project would log each finding and fix it, or say why not, in the open. Nothing here has been run yet, so the table in the [test plan](phase-3-test-plan.md) still says that screen-reader testing has not happened.

## What this does not cover

- Other screen readers (NVDA, JAWS, VoiceOver, TalkBack, Orca). Each behaves differently, and people who use them daily will find problems a first pass does not.
- Switch access, voice control, magnification and a small screen.
- Whether the wording is clear to someone who does not know the project.

Docs are CC BY 4.0, like the rest of [docs/](.).
