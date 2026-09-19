# Throughline — product definition

*Status: working prototype. Last revised 2026-09-18.*

## The problem, stated in the clinic's terms

An outpatient physical therapy clinic cannot raise its prices. Medicare Part B
sets the fee schedule and commercial plans price off it, so revenue per visit is
administered, not negotiated. That leaves a clinic exactly three levers:

1. **Bill the visits it already performed, correctly.** Units, modifiers and
   documentation requirements are where money quietly disappears — not through
   fraud, through arithmetic.
2. **Keep patients through the plan of care.** A patient who drops out at visit
   6 of 12 takes half the episode's revenue with them, and the clinic has
   already paid the acquisition cost of the referral.
3. **Spend less clinician time on documentation.** Every minute a therapist
   spends charting after hours is a minute of unpaid labor that shows up later
   as turnover.

Throughline is aimed at all three, in that order, because that is the order in
which a clinic owner can be convinced the software pays for itself.

## Who buys, who uses

- **Buyer:** clinic owner / practice manager of a 1–10 location outpatient PT
  practice. Cares about collections per visit, denial rate, and whether their
  therapists are charting at 9pm.
- **Daily users:** treating therapists (documentation), the biller (claim
  queue), and the front desk (authorization and re-certification tracking).
- **Not the buyer:** hospital-owned outpatient departments. They are on the
  health system's EMR, and that decision is not the clinic's to make.

## What the prototype does today

| Module | State | What it does |
| --- | --- | --- |
| Billing engine | Real, unit-tested | Minutes to units under both the Medicare 8-minute rule and the AMA rule of eights; MPPR on the practice-expense component; CQ/CO assistant modifiers with the 10% de minimis standard; contracted rate multipliers; deductible/coinsurance/copay split |
| Documentation | Real | Structured SOAP note; claim lines derived from documented minutes rather than typed; compliance checks for signature, plan-of-care expiry, progress-note interval, authorization burn-down |
| Adherence | Real | Rolling-window scoring per exercise, streaks, pain trend, risk classification and a single recommended action per patient |
| AI layer | Specified, not built | See `AI_LAYER.md` |
| Scheduling, eligibility checks, clearinghouse submission | Not started | See "What is deliberately missing" |

## The one design decision everything else follows from

**The claim is derived from the note, never typed alongside it.** A therapist
records what they did and for how long; units, modifiers and dollars are
computed. Most incumbents let the two be entered separately and then reconcile
them, which guarantees they can disagree — and when they disagree, the note is
what an auditor reads and the claim is what was paid.

## What is deliberately missing, and why

- **Clearinghouse submission and ERA posting.** Real, required for production,
  and mostly integration work rather than product work. It should be built
  against a live clinic's actual clearinghouse, not guessed at.
- **Scheduling.** Every clinic already has one and switching it is painful.
  Integrating beats replacing.
- **A patient mobile app.** Adherence events arrive through an interface; SMS
  check-ins are cheaper to validate than an app nobody installs.

## How this gets validated before more is built

1. Confirm the billing engine against real remittance advice from one clinic —
   feed it historical visits, compare predicted payment to what was actually
   paid, and count the disagreements. If the engine cannot reproduce what was
   already paid, nothing else matters.
2. Establish whether documentation-driven denial rates are actually a felt pain
   or a theoretical one, by asking a biller what they held last week and why.
3. Only then decide whether adherence is a differentiator or a distraction.

## Open questions

- Is the wedge billing accuracy (biller buys) or charting time (therapist
  loves, owner buys)? The current build bets on billing accuracy.
- WebPT, Jane, Prompt and Raintree already exist. The honest question is not
  "can this be better" but "is there a segment badly served by all four".
- Adherence data has no billing code attached to it. RTM (remote therapeutic
  monitoring) codes 98975–98977 may change that, and that possibility should be
  priced before adherence is built out further.
