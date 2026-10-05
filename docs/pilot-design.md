# Designing a small advisory pilot: consent, data, access, results and stopping (draft v0.1)

Status: **draft for review.** This is the design for gate G9 of the [Phase 3 test plan](phase-3-test-plan.md): "the community agrees to what is being tested." It is a written proposal, not software, not an ethics review and not legal advice. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) or a suggestion for reviewers to challenge. Every number is a placeholder. Nothing is decided until reviewers agree. **It names no community, no community has been approached, and no dates are promised.**

Nothing here collects or monetizes user behavior data. The data section below applies the [data-collection policy](data-collection.md) to a pilot and, where a pilot would strain it, says so.

## What a pilot would and would not be

A pilot would be a small, advisory vote run with a group that has chosen to take part, on a question the group picks, using software that has met the gates in the test plan. "Advisory" means the result binds no one: it is a statement of what the people who took part said, nothing more.

It would not be:

- A test of the people in the group. They are partners in checking whether the process is safe, understandable and verifiable. Their opinions are not the experiment.
- A claim that CIP works, or would work at national scale.
- A way to settle a question the group is already fighting over. The first question should be low-stakes (open question 1).
- A reason to skip any gate. The pilot is the last step, not a shortcut around the others.

The one-page brief for a community group (#14) comes **after** this design has been reviewed, and it may say only what this design says, in plain language.

## What must be true before anyone is asked

G9 says the design is written first. In order:

1. This design is reviewed in public by people other than its author, and the changes are logged.
2. Gates G1 to G8 and G10 of the test plan are met on the exact commit the pilot would run, or a gate is met by a documented limitation that reviewers have accepted (test plan, open question 4).
3. Only then is a group approached, and the group sees this document, the test plan and the results of the checks, including the ones that failed.

Today none of this has happened. Ballots that cannot be linked to a person are Phase 4 ([phase-3-plan.md](phase-3-plan.md)), and the identity layer (§4.2.3) is not built. A pilot with a vote in it cannot run before both exist.

## Who is involved

| Role | What they do | What they must not be able to do |
|---|---|---|
| Participant | Takes part, or does not, as one person | Be pressed to take part, or be identified by how they voted |
| Host group | Chooses to take part, picks the question, names someone responsible on its side | Learn how any one participant voted |
| Node operator | Runs the software that holds the log | Edit the record unseen, or learn how anyone voted |
| Project | Wrote the software and this design | Hold a private key, hold a list of participants, or change the rules during a run |
| Independent observer | A person named in advance who is neither the host nor the project, and can call a pause | Choose the question or see anyone's ballot |

Open: who operates the node (the host, an independent party, or the project), and who counts as independent, given a pseudonymous project with few contributors (open questions 2 and 6).

## Consent

Two separate agreements are needed, and neither stands in for the other.

**The group agrees.** The host group decides to take part under its own written rules, records that decision, and names one or more people responsible on its side. The group may leave at any time and give no reason.

**Each person agrees.** Nobody takes part because the group did.

- Consent is asked in plain language, before anything is created for the person, and says: what the software is and that it is a test; that the vote is advisory; what data exists and for how long (the table below); that a cast ballot cannot be taken back, and why (see below); how to stop, and what stopping does; and who the project is, as far as it is willing to say (open question 2).
- Declining costs nothing. No benefit of belonging to the group depends on taking part, and no reward depends on taking part or on how someone votes.
- A person may withdraw at any time before casting a ballot. After a ballot is cast, unlinkable ballots mean nobody, including the person, can pick it out and remove it. That limit is stated up front, not discovered later. This is a real tension with a person's wish to withdraw, and reviewers should challenge it.
- Who may take part is set by the host's own eligibility rule, not by the project. The project does not decide who counts. Adults only is a starting proposal, applied through the host's own rule and without collecting anyone's age.
- The consent screen is the same for everyone and is never varied between people to see what changes their answer (data-collection.md: ballot presentation follows one published rule).
- Where consent is recorded is open. The record must not sit next to a ballot or a key in a way that links the two (open question 3).

## Data: what exists, who holds it, and for how long

The log is built so entries cannot be edited or removed after the fact. That is its purpose. It follows that **nothing personal may ever go into it**, because a request to delete could not be honored there. Anything that might need deleting lives somewhere else.

| Data | Who holds it | How long (placeholder) | Tier ([data-collection.md](data-collection.md)) |
|---|---|---|---|
| Public log: proposal text, signed entries, ballot counts, checkpoints | Public, copies kept by watchers ([checkpoints.md](checkpoints.md)) | Kept as the record of the run. Contains no names and no contact details | Public by design (tier 2) |
| Public keys of participants | In the log | Same as the log. A key must not be derived from, or labeled with, a name | Public by design |
| Private keys | Only the person | Until the person deletes them. Never sent, never backed up by the project ([key-handling.md](key-handling.md), rule 1) | Not collected |
| Sealed ballots | Per the Phase 4 design, not yet written | Until counted and checked, then per that design | Not collected in readable form |
| Eligibility check (who may take part) | The host, not the project | Deleted after the vote closes plus a short check period (placeholder: 30 days). Never joined to a ballot or a key | Outside the project's data |
| Consent records | The host, kept apart from keys and ballots | Same as the eligibility check | Outside the project's data |
| Node counters: request counts, error counts, speed | The node operator | Short (placeholder: 30 days), no identifiers, IP addresses only in the short-lived memory that rate limiting needs | Tier 2 |
| Optional feedback survey | Whoever runs it, with consent | Raw answers deleted after the result report is published; only totals kept | Tier 3, opt-in |

Never collected, in a pilot as anywhere: per-person clickstreams, session recordings, device fingerprints, third-party analytics, any link between who a person is and how they voted, and anything used to profile people (tier 1). A pilot does not get an exception.

### The small-group problem

A pilot group is small, and small groups make anonymity thin.

- **Counts can name people.** A breakdown for fewer than 20 people can point at individuals ([data-collection.md](data-collection.md), placeholder). A pilot group may itself be near or under 20, so a pilot would publish **totals only**, no breakdown by any trait.
- **Very small or lopsided results can point at people.** A split of 12 to 1 tells the group a lot about the one. Proposal: report a vote result only if enough people took part (placeholder: 20; open question 4). Below that, the report covers the process, not the vote. Even above it, a unanimous result shows how everyone voted, and the consent text says so.
- **Everyone may know who took part.** In a small group, who voted may be obvious from outside the system. What must stay secret is how each person voted. Batching ballots before they are published is one way to blunt timing matches, and it needs cryptography review (data-collection.md, open question 4).

## Access: who can take part

This ties to gate G7 and to paper §4.6 (multiple access channels, literacy support, no mandatory participation).

- **More than one way in.** A person must be able to take part with a screen reader, a keyboard alone, a small screen, zoom, high contrast and reduced motion, on an older or borrowed device, and with no particular brand. Creating, keeping and recovering a key must be possible the same ways ([key-handling.md](key-handling.md), rule 4).
- **Language and wording.** Everything a person must read is in the host group's own languages and in plain wording, with a reading-level check before use. Placeholder: the host chooses the languages; the project does not translate unreviewed.
- **No countdowns.** The voting window is long enough that a slower person is not shut out, and no step is timed in a way that punishes taking time.
- **Help without watching.** Help comes from the host's own volunteers, in person or by the host's usual channels. The project does not offer remote screen sharing or session help, because that is behavior data by another route.
- **Assisted voting is a hazard as well as a help.** A helper of the person's own choosing may see the ballot, and may press. If assisted voting exists, the screen says so, the helper is never the person's boss, landlord or group leader, and the person can say they were not given a free choice (open question 8).
- **The rest of the group is not left out.** A person who cannot use the software can still give their view the host's usual way, and the report states that the pilot excluded people who could not take part, so the result is never read as the whole group.
- **Count who could not take part.** An optional, anonymous "I tried and could not" report is the only way to see exclusion, and it must not become tracking (open question 9).
- **Testing before anyone real.** Real assistive-technology testing (#7, #11) must happen first, with testers who are fairly treated. The project has no screen-reader tester today, so G7 stays open. Automated checks and scripted keyboard runs do not replace this.

## How a result is reported

Written before the vote, and the same whatever the result is.

**The report always says**, in this order and in plain words:

1. This was an advisory test of software, by a small group that chose to take part, and it binds no one. (The exact wording is drafted in [advisory-notice.md](advisory-notice.md).)
2. What it does not show: it is not a poll of everyone, it is not a measure of how CIP would work at scale, and it says nothing about whether the group's wider members agree.
3. The question and the ballot exactly as shown, which were the same for everyone.
4. How many were eligible (if the host will say), how many took part, and the count for each option. A tie is reported as tied, following [ranked-choice.md](ranked-choice.md) for advisory votes.
5. The exact commit of the software, the date, the check command, and the result of independent checks, so anyone can re-run them.
6. Problems found, failures, and items left open, including any pause or stop and why.
7. Who could not take part, if known.
8. Where the rules are written.

**What counts as a result.** The pilot answers questions fixed in advance about the *process*: could people finish the steps, did verification pass, where did people get stuck, did anything leak. It does not count "did they like it" as a finding, and the content of the vote is not a test result.

**Publishing rules.** The report is published whether the pilot went well or badly. The host may read it first to correct errors of fact about the group and may add a reply beside it. The host may not remove findings, and nothing is removed except what would identify a person. The project quotes the result only with the same caveats and does not use it as proof that CIP works. This ties to gate G10.

## Who can stop it

Stopping is a power that can be abused (to suppress an unwelcome result) and a safety that must work. Both are written down first.

| Who | What they can do | How it is recorded |
|---|---|---|
| Any participant | Stop taking part at any time before casting a ballot | Nothing about them is kept |
| The host group, through the people it named | Pause or end the pilot at any time, no reason needed | A signed stop entry in the log, plus a public note |
| The node operator | Take the node offline if there is a safety or integrity problem | A signed stop entry, plus a public note |
| The independent observer | Call a pause until a stated problem is fixed | A public note with the reason |
| The project | Pause or end it for any safety, integrity or data problem | A public note with the reason |

**Automatic reasons to pause** (placeholder list, each published when used): a gate that was met no longer passes on the commit in use; two verifiers disagree; a checkpoint comparison shows a conflict ([checkpoints.md](checkpoints.md)); any tier 1 data is found; a key is lost or taken in a way the design says should not happen; someone is excluded by a fault in access; or anyone reports pressure or coercion.

**Rules that cannot change in a run.** No one, the project included, changes the rules, the question or the software once voting opens. A change means a stop and a restart with fresh consent. Nobody can force the pilot to continue, extend it or restart it without the same review.

**What a pause or stop does to ballots already cast.** Open question 5. The leaning is that a stopped pilot publishes a process report and no result, unless the host and the independent observer both agree to publish what was counted.

**Stopping must not depend on one reachable person.** The project is pseudonymous. The stop route runs through people the host can reach and a node operator who can take the node offline, not through the project's author. The prototype has no stop record type yet ([SPEC.md](../prototype/SPEC.md)).

## What the prototype shows and does not show

The prototype is a test log with two verifiers, a viewer and test data. It has no ballots, no identity, no consent screen, no stop record and no result report. This design stands on its own. Writing it does not meet G9.

## What would count as meeting G9 (a proposal)

For a first advisory pilot, all of the following, each with public evidence (commit, date, who did it, the result):

1. This design reviewed in public by people other than its author, with the changes logged.
2. Every part above has a concrete answer for the actual pilot, and no placeholder is left standing without a stated reason.
3. The host group's own recorded decision to accept the design, and its named responsible people.
4. A named independent observer.
5. A rehearsal on test data with no real participants: the consent screens shown, a stop drill run (a stop is called and the log shows each step), and a result report produced from test data and checked against the list above.
6. Gates G1 to G8 and G10 met or limited as in the test plan.

The project cannot meet G9 alone. It needs a group that agrees, which is why the gate is last.

## What this document does not claim

- It names no community, promises no partner or funding, and gives no dates.
- It is not an ethics approval. Research with people may need review by an ethics board, and whether it does depends on who runs it and where (open question 7).
- It is not legal advice. The status of an advisory vote and the rules on personal data depend on the place, and neither has been checked.

## Open questions

1. Is a small, advisory, low-stakes question right for a first pilot? Who picks it, and what keeps the pilot from becoming a proxy for a fight inside the group?
2. Who is accountable on the host side, and what must a pseudonymous project tell participants about who it is, without personal details on public pages?
3. How is eligibility checked, and consent recorded, without a list that could later be joined to ballots or keys (gate G5)? Options for the eligibility side are drafted in [identity-linking.md](identity-linking.md).
4. Is 20 the right minimum for reporting a result, and what happens for a group that is smaller?
5. After a stop, are ballots already cast counted, voided, or published only as a process report?
6. Who is independent enough to be the observer, given few contributors (test plan, open question 2)?
7. Does an ethics review or local law apply, and who checks before a group is approached?
8. Should assisted voting exist at all, given the risk of pressure? If it does, what protects the person?
9. Is an anonymous "I could not take part" report compatible with no behavior data, and how is it kept from becoming tracking?
10. How are assistive-technology testers and helpers supported when the project has no money?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
