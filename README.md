# Throughline

**Documentation, billing and home-exercise adherence for outpatient physical
therapy clinics.**

[Live demo](https://chloe4ai.github.io/throughline/) ·
[Product definition](docs/PRD.md) ·
[Architecture](docs/ARCHITECTURE.md) ·
[AI layer](docs/AI_LAYER.md)

---

An outpatient PT(Physical Therapy) clinic cannot set its own prices — Medicare administers the
fee schedule and commercial plans price off it. So the only levers left are
billing the visits it already performed correctly, keeping patients through the
plan of care, and getting therapists out of the building on time. Throughline
is built around the first of those, because it is the one where the money is
measurable.

## The idea that the whole thing hangs on

**The claim is derived from the note. It is never typed alongside it.**

A therapist records what they did and for how long. Units, modifiers and
dollars are computed from that. Most systems let the note and the claim be
entered separately and then reconcile them, which guarantees the two can
disagree — and when they do, the note is what an auditor reads and the claim is
what was paid.

## What is actually built

### A real billing engine (`packages/billing`)

Not a lookup table. The rules that make PT billing hard, implemented and tested
at the boundaries where they break:

- **Units of service under two incompatible rules.** Medicare's 8-minute rule
  pools every timed minute in the day and converts once; the AMA rule of eights
  converts each code on its own minutes. Twenty minutes of therapeutic exercise
  plus twenty of manual therapy is **three units to Medicare and two to a
  commercial plan on the AMA rule** — the same visit, a unit apart, decided by
  a property of the payer.
- **MPPR**, against the practice-expense component only, sparing the single
  highest-valued unit — including when the other units belong to that same
  code.
- **CQ/CO assistant modifiers** at the 10% de minimis standard, which is a
  strict *greater than*: exactly 10% does not trigger the 15% reduction.
- **Contract math** — percentage of fee schedule, then deductible, then copay
  *or* coinsurance, never both.

The order those are applied in is load-bearing; `docs/ARCHITECTURE.md` explains
why, and the tests enforce it.

### Documentation with the compliance checks attached (`packages/documentation`)

Structured SOAP notes, claim lines derived from documented minutes, and the
checks that decide whether a claim should leave the building: unsigned note,
expired plan of care, progress note due at the tenth visit, authorization
running out. Blockers stop a claim; warnings a biller can override.

### Adherence scoring that says what to do (`packages/adherence`)

A rolling window rather than a lifetime average, capped per exercise so doing
the easy one twice cannot paper over skipping the hard one, and a pain trend
that downgrades a patient who is doing the program and hurting more. Each
patient gets one sentence a therapist can act on, not a dashboard tile.

### An API and a UI

A small HTTP layer over SQLite (`apps/api`, node's built-in driver — no native
dependencies), and a React UI (`apps/web`) whose "what is this visit worth"
screen imports the *same* engine the server runs, so it cannot drift.

## Run it

```bash
npm install
npm test           # 52 tests across the rule engines
npm run api        # http://localhost:8787 — seeds a demo clinic on first run
npm run web        # http://localhost:5173
```

The UI falls back to a captured snapshot when no API is running, which is what
makes the GitHub Pages build a working demo rather than a screenshot.

## What this is not

A prototype, openly. The fee-schedule values are illustrative rather than a
licensed CMS file; there is no clearinghouse submission, no eligibility check
and no scheduling. `docs/PRD.md` lists what is missing, why each piece was left
out, and what would have to be true — validated against one clinic's real
remittance data — before any of it gets built.

## License

MIT
