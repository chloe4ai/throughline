# Architecture

## Shape

```
packages/domain          shared vocabulary; no logic
packages/billing         minutes -> units -> dollars. Pure, unit-tested.
packages/documentation   note -> claim lines; compliance rules
packages/adherence       home-program completion scoring
apps/api                 node:http + node:sqlite; composes the packages
apps/web                 Vite + React; also imports the billing engine directly
docs/                    this documentation, and the built demo GitHub Pages serves
```

## Why the rules live in packages, not in the API

The billing rules are the product. Keeping them as pure functions with no
database, no HTTP and no React means:

- They can be tested exhaustively at the boundaries where they actually break
  (22 vs 23 minutes, exactly 10% assistant time) in microseconds.
- The browser can run the same engine the server runs, which is what makes the
  "what is this visit worth" screen trustworthy — it is not a reimplementation
  that will drift.
- A future billing service, a batch re-pricer for historical claims, and a CLI
  for validating against remittance data all consume the same module.

## Data

SQLite through node's built-in driver, so there is no native compilation step
and no ORM between the schema and the reader. The schema is deliberately
ordinary SQL that a Postgres migration can start from unchanged. Money is
stored as REAL in the prototype; production would use integer cents, and that
change is confined to `fee-schedule.ts` and the repository layer.

## Dates

Clinic-local dates everywhere, never UTC (`apps/api/src/clock.js`). A visit
documented at 6pm Pacific must not be dated tomorrow because the server runs
UTC — that single bug misdates claims, breaks every "this week" count, and only
surfaces when someone reconciles a remittance months later.

## Order of operations in pricing

Two parts of this sequence are load-bearing, and one part is not:

1. Minutes to units, under the payer's unit rule.
2. Units to allowed dollars, at the contracted multiple of the fee schedule.
3. MPPR against the practice-expense component of every unit except the single
   highest-valued one.
4. CQ/CO assistant reduction across the affected lines.
5. Patient liability: deductible first, then copay *or* coinsurance, never both.

Step 1 comes first because the unit rule decides how many units exist before
any price is attached. Step 5 comes last because the deductible, copay and
coinsurance apply to the *reduced* allowed amount: splitting liability on the
gross figure overstates what the patient owes on every reduced claim.

Steps 2 to 4 are all multiplications, so swapping them does not change the
dollars. They are listed in this order because it is the order a remittance
advice explains them in, not because another order would be wrong. The test
suite checks the parts that are load-bearing: that units come from the payer's
rule and that liability is split after every reduction.

## Testing

`vitest`, running against source rather than build output so a red test is
never stale. The suite is written as claims about the rules ("does not trigger
at exactly 10% — the rule is MORE than 10%") rather than as coverage, because
the failure mode being defended against is a plausible-looking wrong number.
