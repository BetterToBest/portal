# CIP glossary (plain-language terms)

Status: **draft for review.** A short glossary for someone who has not read the paper. Each entry gives one or two sentences, using everyday words, and points to the section of the [CIP paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) where the term is explained.

CIP is a research proposal, not a live system. Where an entry describes how something would work, it says so: **would** or **is proposed to**. An entry tries not to lean on other unexplained terms.

## Terms

**ledger**
The shared, append-only record of events that the system keeps. It would be held as several independent copies at once, each checked against the others, so that changing, deleting or reordering an entry would show up. A separate process of saving fingerprints of the record over time is described in [checkpoints.md](checkpoints.md). See paper §4.2.1.

**zero-knowledge proof**
A method where one program can show that a fact is true without handing over the information behind it. In CIP it is proposed to let a vote be checked as a real vote without revealing who cast it, and to keep how people voted from being learned by others. See paper §4.3.

**liquid delegation**
A way of voting in which, instead of casting your own vote, you can hand your vote to a person you trust to vote in your place. The hand-off would be revocable and could be limited to one topic, you could always choose to vote directly instead, and no single delegate would be proposed to speak for more than a set share of the population (the paper's figure is 1%). The working rules, including how loops and the cap would be handled, are in [voting-rules.md](voting-rules.md). See paper §4.4.

**quadratic voting**
A way of spending equal credits in a shared-budget vote, in which the more you express support for one option, the more it costs you. One vote would cost one credit, two votes four, three nine, so a strong preference costs more and more. It is proposed for participatory budgeting, so that a strong preference can be expressed but at a rising cost that limits the advantage any one voice could take. See paper §4.4.

**Judicial Guard**
A proposed body with the power, in the paper, to pause the whole system when an attack is detected, so that an investigation can run, and to keep accountability working when it would otherwise be blocked. Its exact make-up and limits are not defined in the paper; a draft of proposed limits is tracked separately in [halt-power.md](halt-power.md). It is outside the scope of the current prototype. See paper §4.2.3 and §5.

## Notes

- The paper's section numbers are cited in the body of the linked documents; the paper page itself is one document, so links go to the page, not to a section anchor.
- Where a term is used inside another definition above, the link is to the entry that defines it.
- Plain words are a screen, not a guarantee: the test is whether a reader who did not write these understands them, in line with the plain-words rule in [advisory-notice.md](advisory-notice.md).
