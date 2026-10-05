# The advisory notice: what every screen and result must say (draft v0.1)

Status: **draft for review.** This is the design for gate G10 of the [Phase 3 test plan](phase-3-test-plan.md): "it is clear what the result means." It is a set of wording rules and a template, not software, not a user study and not legal advice. CIP is a research proposal, not a live voting system, and every design here is a suggestion for reviewers to challenge. Every number is a placeholder. Nothing is decided until reviewers agree, and no dates are promised. It names no community and no real person; names and figures in square brackets are blanks to be filled for a real run.

Nothing here collects or monetizes user behavior data. A notice that needs to record who read it, or how long they looked at it, is out of bounds (see rule 10).

## Why this needs rules

A vote result gets read as more than it is. Four mistakes are easy to make, and a screen can invite each one:

- **"It decided something."** "Advisory" is a word many people skim. If the result is shown like a verdict, people will read it as one.
- **"This is what the group thinks."** The people who took part chose to, and the people who could not take part are invisible in the count. A result describes the first group only.
- **"The numbers are the whole story."** A percentage with no count hides how few people took part. A lopsided result in a small group can also point at individuals ([pilot-design.md](pilot-design.md)).
- **"It is secure, so it is right."** Words like "verified" and "secure" suggest that more was checked than was. Most gates in the test plan are not met, and a screen must not speak as if they were.

The notice exists to stop these four readings. It must still be read by someone in a hurry, with a screen reader, on a small phone, in a screenshot passed on by a stranger.

## What G10 asks for

The test plan says: every screen and every result says that the vote is advisory, what it does not show, and where the rules are written. So the notice has three parts, always together:

1. **What this is:** a test, advisory, binding no one.
2. **What it does not show:** who it describes and who it leaves out, and what it says nothing about.
3. **Where the rules are written:** an address and a version, and a plain statement that the rules are proposals that have not all been checked.

## Rules for the notice

1. **One notice, everywhere.** The same wording appears on the consent screen, the ballot, anything shown after a ballot is cast, the result page, any exported or shared copy of a result (text, image, data file), and the published report. It is never replaced by a shorter or friendlier version on one screen.
2. **Part of the result, not beside it.** On any screen or export that shows a result, the notice sits inside the same block as the numbers, so cropping the numbers crops the notice with them. An exported image or text carries the notice in its own text and the address of the full result.
3. **Before the numbers, and again after.** In reading order the notice comes first, so a screen reader reaches it before any count. It is repeated, in the short form, at the end of the result block.
4. **Never hidden, never optional.** It is plain text, not an image. It is not collapsed, not shown only on hover or focus, not carried by color, an icon or size alone, and not dismissible. There is no "do not show again": that would need a record per person, which is behavior data.
5. **As prominent as the result.** The notice is at least the same text size as the numbers it sits with, with enough contrast in light and dark, and survives zoom, high contrast and reduced motion (gate G7).
6. **Plain words.** Short sentences, everyday words, and no unexplained terms such as ledger, hash, checkpoint, quorum or zero-knowledge. A placeholder target: a reading level of about grade 8 or lower by a standard formula, as a screen only. The real test is whether people who did not write it understand it (see "What would count as meeting G10").
7. **Counts first, with the total.** A result gives how many took part and how many chose each option, in words. A percentage is never shown alone, and never to more precision than the count supports. Wording like "the community voted", "the people decided" or "won" is not used. A tie is reported as tied, and a split as split, following [ranked-choice.md](ranked-choice.md) for advisory votes. Below the minimum turnout set in the pilot design, no vote result is shown, only the process report.
8. **No claim beyond a met gate.** A screen may say something about privacy, security, checking, access or fairness only if the matching gate is met, only for what was actually checked, and with the commit and date. The table below shows how to word each claim, and what is not allowed until its gate is met.
9. **No borrowed authority.** The notice and the screens carry no seal, logo, flag or wording that makes the vote look official, endorsed or binding. A host group may add its own name and a line of its own; it may not shorten or remove any part of the notice.
10. **Nothing recorded about reading it.** The software does not log whether, when or for how long a person saw the notice. A confirmation box on a screen is held in the page only and goes nowhere. Any record a host keeps for consent is the one allowed by the pilot design, kept apart from keys and ballots.
11. **One versioned text.** The notice wording lives in this repository as a single versioned text, and a run shows its version. A run fills in the blanks and nothing else. Changing the wording mid-run is a stop and a restart with fresh consent, as in the pilot design.
12. **Same meaning in every language.** Each translation is read by someone who reads that language and did not write it. If a translation has not been reviewed, the screen says so, in that language.

## How to word a claim

| If a screen wants to say | It may say, only when the gate is met | Not allowed until then |
|---|---|---|
| "Your vote is private" | What is true and for whom, once the sealed ballot exists and has had an outside review (Phase 4, G8). For example: "Nobody running this test can see how you voted. [Say what is and is not protected.]" | "Private", "anonymous", "secret ballot" |
| "The record is safe" | "The record is written so a change shows up. Two programs checked it and agreed on [version] on [date]." (G1, G2, G3, on the run's own commit) | "Secure", "tamper-proof", "unhackable" |
| "One person, one vote" | "Each person was given one code by [who]. [Number] codes were given. This cannot show that nobody has two." (G5, with its stated error rate) | "One person, one vote", "verified voters" |
| "Anyone can use it" | "It was tested with [list of assistive tools]. It was not tested with [list]." (G7) | "Accessible", "works for everyone" |
| "It has been reviewed" | "[Who] reviewed [what] on [version]. These findings were fixed: [list]. These remain: [list]." (G8) | "Audited", "approved", "certified" |
| "It collects nothing about you" | "The software does not collect [tier 1 list]. This was checked by [who] on [version]." (G6) | "No tracking", "completely anonymous" |

Where a gate is not met, the honest wording is the plain one: "This has not been checked." The short notice below already says that the rules have not all been checked.

## The notice

Two forms of the same notice. The **before** form is for the consent screen and the ballot, when no result exists. The **after** form is for any result. Blanks are in square brackets. The wording is a draft for reviewers to rewrite.

**Before form:**

> This is a test vote. It is advisory: it decides nothing, and no one has to act on it.
>
> It will show what the people who take part say. It will not show what everyone in [GROUP] thinks, or what the public thinks.
>
> The rules are written at [ADDRESS], version [VERSION]. They are proposals, and they have not all been checked. That page says what has been checked and what has not.

**After form:**

> This was a test vote. It was advisory: it decides nothing, and no one has to act on it.
>
> It shows what the [NUMBER] people who took part said. It does not show what everyone in [GROUP] thinks, or what the public thinks. [NUMBER] people could take part. [Who could not take part, in plain words.]
>
> The rules are written at [ADDRESS], version [VERSION]. They are proposals, and they have not all been checked. That page says what has been checked and what has not.

**The page behind the address** (the "what this vote means" page) carries, in this order: what advisory means in this run; who could take part and who could not; what the numbers are and are not; what was checked, with the commit and date for each check, and what was not; how to report a problem and who can pause or stop the run (from the pilot design); and a plain line that no institution has endorsed the vote. Its "what was checked" list is the test plan's gate table, filled in honestly for the commit in use.

## Where it goes

| Surface | Form | Notes |
|---|---|---|
| Consent screen | Before | Before anything is created for the person |
| Ballot | Before | Same for every voter; never varied (data-collection.md) |
| Screen shown after a ballot is cast | Before | Says "recorded" only when a check has passed, never "counted" before counting |
| Result page | After, first and again at the end | Inside the result block |
| Exported or shared result (text, image, data file) | After, in the export's own text | Includes the address of the full result |
| Published report | After, then the report list in the pilot design | Same wording |
| Any summary or caption the project writes about a result | After | The project follows its own rule |
| Log viewer, simulators | Their own "illustrative, test data" note | Already present; should match this style (open question 7) |

## Examples

| Bad | Why | Better |
|---|---|---|
| "The community voted 63% in favor." | Percentage alone; "the community" is not who took part | "Of the 41 people who took part, 26 chose yes and 15 chose no." |
| "Secure, verified, tamper-proof vote." | Claims beyond any met gate | "Two programs checked the record and agreed on [version]. This does not show that each person voted only once." |
| "Results are final." | Reads as binding | "This result binds no one." |
| "Advisory vote" in small gray type above the numbers | Hidden by size and color | The full before or after form, in the result's own text size |
| "Your vote is anonymous." | A privacy claim with no sealed ballot | Leave it out until the gate is met, then say what is protected and from whom |
| "Option A wins by random draw." | An advisory vote does not pick a winner by lot | "Tied: 20 and 20." |
| "Everyone agreed." (a unanimous result) | Also tells the group how each person voted | The count, and the plain line that a unanimous result shows how everyone voted |
| A notice with a "got it" button that remembers you | A per-person record | No button, or one that remembers nothing |
| A result card exported with the numbers only | The notice is lost when copied | The notice inside the exported text or image |

## What the prototype shows and does not show

The prototype has a log viewer and four simulators, each with its own "illustrative" note. It has no vote interface, no result screen, no export and no consent screen. There is nothing yet to apply this notice to. Writing it does not meet G10.

## What would count as meeting G10 (a proposal)

For a first advisory test, all of the following, each with public evidence (commit, date, who did it, the result):

1. The notice wording in the repository as one versioned text, reviewed by people other than its author, including readers who do not follow the project and people who use a screen reader.
2. Every surface in the table above carries the notice, and an automated check fails the build if a result block is produced without it.
3. A claims check: every sentence on every screen that says something about privacy, security, checking, access or fairness is matched to a met gate, or removed.
4. A comprehension check with volunteers, run as an opt-in usability panel under the data-collection policy (tier 3), with answers kept apart from names. Volunteers see a result block and answer plain questions, such as: does this decide anything? does it show what everyone in the group thinks? how many people took part? The bar is a placeholder (for example nine in ten answer all correctly) and is set before the check. Where people miss, the wording is changed and the check is repeated.
5. The accessibility checks of gate G7 run on the notice itself: screen reader order, keyboard, zoom, high contrast, small screen. This needs people the project does not have yet, the same gap as #7 and #11.
6. Each translation reviewed, or marked unreviewed on the screen.

## What this document does not claim

- It does not say any wording will prevent every misreading. People skim, screenshots are cropped, and a notice can only make the right reading easier.
- It is not a user study. No volunteers have been asked and no reading test has been run.
- It names no community, promises no partner or funding, and gives no dates.

## Open questions

1. Is a short notice plus a longer page behind it the right split, or should the notice be one text?
2. Should the notice come before the numbers, after them, or both? The draft says both, which adds length.
3. How should the comprehension check be run with no behavior data, and what pass bar is fair?
4. How much of its own wording may a host add before it crowds out the notice?
5. Are percentages ever useful alongside counts, or do they always invite the first mistake?
6. How is a result protected when someone crops it? The draft puts the notice in the exported text, but cannot stop a screenshot.
7. Should the log viewer and the simulators follow this style, so that every page in the project says the same thing in the same way?
8. Who reviews translations when the project has no translators and no money?
9. Is "decides nothing, and no one has to act on it" the right plain wording, or does it undersell a pilot whose host group does intend to read the result?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
