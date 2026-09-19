# AI layer — specification, not yet implemented

Nothing in this repository calls a model today. This file exists so that when
it does, the boundary is already decided.

## The rule

**The model drafts prose. It never produces a number that affects a claim.**

Minutes, units, modifiers and dollars are computed by `packages/billing` from
what the therapist recorded. A model may propose the *words* in a note, and a
human signs it. This is not caution for its own sake: a fabricated minute count
is a false claim, and the signature on the note makes the therapist personally
responsible for it.

## Three features, in the order they are worth building

### 1. Note drafting from a shorthand (highest value, lowest risk)

The therapist types `quad sets 3x10, heel slides, SLR — 22 min; patellar mobs
grade II 13 min`. The model expands that into the subjective/objective/
assessment/plan prose a payer expects, leaving the minutes exactly as entered
and flagging anything it could not map to a code.

Evaluation: does the draft survive the therapist's edit unchanged? Measure the
edit distance between draft and signed version, per therapist, over time — not
a quality rubric someone made up.

### 2. Retrieval over the billing rulebook

A biller asks "does the 8-minute rule apply to this plan" and gets an answer
with the paragraph it came from. This is straightforward retrieval over a
corpus of payer policies, LCDs and the clinic's own contracts, and the value is
entirely in the citation — an answer without a source is worse than no answer,
because it will be believed.

Design notes: chunk by rule rather than by fixed token window (a rule split
across two chunks retrieves as neither); keep an effective-date on every chunk
and filter by date of service, because a 2024 policy answer to a 2026 claim is
confidently wrong.

### 3. Denial reason clustering

Given posted remittances, group denials by the thing that actually caused them
rather than by the payer's reason code, which is too coarse to act on. This one
needs real remittance data before it can be designed, so it stays last.

## What the AI layer must never do

- Choose a CPT code without the therapist confirming it.
- Adjust documented minutes, in either direction.
- Generate the assessment section's clinical judgment from nothing — an
  assessment is the part an auditor reads to decide whether the care was
  skilled, and a plausible paragraph unsupported by the visit is exactly the
  thing that turns an audit into a repayment.
