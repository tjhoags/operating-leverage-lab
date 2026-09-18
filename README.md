# Operating Leverage Lab

A browser-only calculator for one question about an automation: **what changes in cash, and what changes in capacity?** It compares one process at the same accepted-output standard before and after a proposed change, and reports three things separately: cash that actually moves, human hours that come free, and, only if you choose to model it, a future spend you might not have to make. It never adds them together.

Everything runs in the browser. There is no backend, no account, no analytics, no remote font or API call. Scenarios live in your browser's local storage and in files you download.

**[Open the live calculator](https://tjhoags.github.io/operating-leverage-lab/)** · [Version 1.0 release](https://github.com/tjhoags/operating-leverage-lab/releases/tag/v1.0.0)

The verified scope is listed under [What was verified](#what-was-verified). The static app is published through GitHub Pages after automated checks.

## Run it

Requires Node 22.12+, 24.x, or 26+. Node 22 is used in CI; Node 24 is also verified. Odd-numbered Node releases are not supported by the test tooling.

```bash
npm ci            # install locked dependencies
npm run dev       # local development server
npm run build     # typecheck, then production build into dist/
npm run preview   # serve the production build locally
```

Checks:

```bash
npm test                  # unit tests: fixtures, validation, serialization, storage, formatting
npm run test:e2e          # Playwright browser checks against the production build (desktop and phone)
npm run typecheck
node scripts/scan-private.mjs   # scan tracked files and dist/ for secrets or private material
```

`npm run test:e2e` needs Chromium for Playwright. In CI it is installed with `npx playwright install --with-deps chromium`.

## What it does

- **Three fictional worked examples**: fixed payroll, flexible contractor, and the same contractor case on a 25 / 50 / 100 percent adoption ramp. Each card's figures are recomputed from its inputs by the model. They are synthetic assumptions, not customer results.
- **Editable assumptions** with units, contextual help and specific, recoverable validation. Blank is missing, not zero. Invalid inputs keep the last valid results on screen, marked as stale, until fixed.
- **Three separate results**: current cash (per month at full adoption, setup at month 0, year-one cumulative, payback), capacity (hours changed, hours that remove cash, hours retained as capacity) and an optional future spending plan (a conditional comparison, off by default).
- **Cumulative cash curve** from month 0 through the horizon, with monthly net bars, a payback marker, keyboard-focusable months and the full month-by-month table underneath.
- **Cost per accepted completion** before and after, with the cost boundary stated and setup disclosed separately.
- **Calculation detail**: every figure with the arithmetic that produced it.
- **Persistence**: valid edits are saved in browser local storage after every change and restored on reload, with a truthful status line. A control removes the saved copy.
- **Versioned JSON export and import.** Import is transactional: the whole file is validated (format, version, types, ranges and cross-field rules) before anything replaces the current scenario. Imported text is rendered as text.

Not included, deliberately: a saved-scenario library, shareable URLs (scenario data never enters the address bar), print tooling, capacity valuation in money, hiring probabilities, discounting or taxes.

## Model

All money is in one display currency; all periods are calendar months; month 0 is when setup cash is paid. Full precision is kept internally and only the display is rounded. The deterministic model lives in `src/model/` and has no dependency on the interface.

Inputs (per month unless stated):

| Input | Meaning |
| --- | --- |
| Accepted completions | Work completed and accepted. The denominator for cost per completion. |
| Human minutes per task, baseline and after | Including review, exceptions and rework. |
| Attempts per accepted completion | Billable runs per accepted result, including failures and retries. At least 1. |
| Current labour cash expense | The in-scope cash you pay today. The baseline, and the ceiling on any reduction. |
| Cash rate per changed hour | Cash you genuinely stop paying per freed hour, or start paying per added hour. |
| Cash-sensitive share of changed hours | The fraction of changed hours that changes the bill (0 to 100 percent). |
| Fixed incremental cash cost | Charged in full from month 1, regardless of adoption. |
| Variable cash cost per attempt | Charged on every attempt, scaled by adoption. |
| One-time setup cash | Incremental cash at month 0. Not salaried time. |
| Adoption by month | Percent of the workload on the new process for the early months; later months repeat the last value. |
| Horizon | 12 to 60 whole months. Year-one figures always cover months 1 to 12. |
| Retained salaried time | Build and maintenance hours on unchanged salaries. Recorded in hours, never priced, never in payback. |
| Future spending plan | Optional: start month, hours needed, monthly budget, divisible or not. |

Formulas:

```
hours changed(m)        = accepted × (baseline minutes − after minutes) ÷ 60 × adoption(m)
cash-changing hours(m)  = hours changed(m) × cash-sensitive share, or 0 when the cash rate is 0
cash removed(m)         = cash-changing hours(m) × cash rate          (negative = added labour cost)
retained capacity(m)    = hours changed(m) − cash-changing hours(m)   when hours changed > 0, else 0
variable cost(m)        = accepted × attempts per completion × price per attempt × adoption(m)
fixed cost(m)           = fixed incremental cash cost                 (from month 1, not prorated)
net cash(m)             = cash removed(m) − variable cost(m) − fixed cost(m)
cumulative(m)           = −setup + Σ net cash(1..m)

cost per accepted completion, before = labour cash ÷ accepted
cost per accepted completion, after  = (labour cash − cash removed + variable + fixed) ÷ accepted
setup per completion (disclosed separately) = setup ÷ horizon ÷ accepted

plan hours covered(m)   = 0 before the start month; otherwise min(hours needed, retained capacity(m))
avoided expense(m)      = budget × coverage(m)        if divisible
                        = budget if fully covered, else 0   if indivisible
```

Conventions:

- **Payback** is the first month whose cumulative cash is not negative. The fractional figure assumes uniform cash flow within that month. A negative month never suppresses a later valid recovery.
- **Zero setup** means there is no initial investment to recover; ongoing profitability is reported separately, and no payback month is claimed.
- **No payback** is reported explicitly with its reason (zero net, negative net, or not within the horizon). Never a zero, NaN or infinity.
- **Zero accepted completions** makes cost per completion undefined, not zero.
- **Cash reduction cannot exceed the labour cash it removes.** Such inputs are rejected with a specific message, not clipped.
- **Additional human work** (after minutes greater than baseline) is a cost when the hours are cash-sensitive; it is never clipped away.
- **Retained payroll stays in the cost boundary.** If you entered fixed payroll as the labour cash expense, it remains in the before and after cost per completion. Retained salaried build time is a resource note, not another cash charge.
- **The future plan uses only retained capacity**, month by month, from its start month. Hours that already reduced cash are never reused. A contractor case with every freed hour monetised has no capacity for a plan.
- **Future-plan availability assumes the retained hours can be reassigned.** The separate build and maintenance commitment is not deducted automatically; allow for it when setting the future plan. A plan must require positive hours.
- **Capacity is reported in hours.** No money value is assigned to retained hours.

## Independent fixtures

`tests/acceptance/economic-fixtures.json` holds eight independently calculated economic cases plus boundary requirements. `tests/unit/fixtures.test.ts` maps each case onto the scenario schema and asserts the expected outputs at the fixture's stated tolerances, including every monthly row of the adoption ramp, the month-by-month plan allocation, the sensitivity grid and the boundary conditions. The expected values in the fixture file are not edited to fit the implementation.

Mapping notes: contractor cases set the labour cash expense to billed hours times rate, with a cash-sensitive share of 100 percent (or 25 percent for the partial billing case). Fixed payroll cases use a zero share and zero rate. The ramp case converts a monthly variable cost at full adoption into a per-attempt price. The accepted-completions case exercises the unit-cost helpers directly, since it supplies no human hours. The percentage-of-assets boundary is plain arithmetic and not a product feature.

## What was verified

Run in this repository on the production build:

- 81 unit tests (Vitest): all eight fixture cases and boundaries, draft parsing and validation, untrusted-object validation, file serialization and rejection, storage adapter behaviour, verified save/delete failures, malformed numeric inputs, precision round-trips, zero-rate capacity, positive future-plan requirements, and display formatting.
- 14 browser scenarios × 2 projects (Playwright, Chromium desktop and Pixel 7 emulation): first screen, preset switching, editing and reset, invalid input recovery, the labour-cash bound, added-work cost, zero completions, the future plan (allocation after start month, contractor case with no spare capacity), reload persistence and removal of the saved copy, non-persistence of invalid drafts, real file download and re-import, rejection of invalid and malformed files with the scenario left untouched, imported text rendered as text, the calculation and month tables, arrow-key tab navigation, focusable chart months, Tab order and error association, and zero horizontal overflow.
- Typecheck, production build, and the private-material scan over tracked files and `dist/`.
- The live GitHub Pages page and its phone layout; direct browser checks of the three scenarios, edit/reload persistence, malformed number rejection, zero-rate capacity, positive plan-hour validation, and downloaded scenario re-import.

Not verified: Firefox, Safari and WebKit; screen-reader behaviour beyond ARIA attributes and roles; browsers with local storage disabled beyond the code path that reports it unavailable.

## Privacy

- No network requests after the page loads. System fonts only.
- Scenario data is stored in this browser's local storage under `operating-leverage-lab.scenario.v1` and in files you download. Nothing is sent anywhere.
- Scenario data never enters the URL.
- The repository contains only synthetic fixtures and fictional examples. `scripts/scan-private.mjs` runs in CI as a safety net; it is not a guarantee, so review staged files before release.

## Deployment

`.github/workflows/ci.yml` runs typecheck, unit tests, build, browser checks and the private-material scan on every push and pull request.

`.github/workflows/pages.yml` builds and publishes `dist/` to GitHub Pages on pushes to `main`. The build uses a relative base path, so it works from the repository subpath (`https://<owner>.github.io/operating-leverage-lab/`). Publishing requires enabling GitHub Pages for the repository with "GitHub Actions" as the source; the workflow does not change repository settings and uses only the free service.

## Project layout

```
src/model/      deterministic model, validation, presets, serialization, formatting (no DOM)
src/app/        app state, persistence adapter, layout hook
src/ui/         Preact components
tests/unit/     Vitest unit tests, including the fixture mapping
tests/e2e/      Playwright browser checks
tests/acceptance/economic-fixtures.json   independent expected results
scripts/        private-material scan
```

Stack: Preact, Vite, TypeScript, Vitest, Playwright. Dependencies are locked in `package-lock.json`.

## License

MIT. See `LICENSE`.
