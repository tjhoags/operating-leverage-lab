# Operating Leverage Lab - implementation brief

Build a polished browser-only workflow economics calculator. It compares a process at the same accepted output standard before and after a proposed automation. It separates current cash impact, released human capacity, and an optional future spending plan. It is a transparent scenario model, not evidence of actual savings, demand or product uniqueness.

## Product and interface

The initial view should make the job clear in seconds: **What changes in cash. What changes in capacity.** Use a warm off-white background, near-black typography, restrained teal/copper accents, tabular numerals and a strong editorial hierarchy. Give useful financial detail through progressive disclosure, not a wall of fields. The Design segment supplies the visual reference; calculation integrity takes precedence over illustrative numbers in a mockup.

Provide fictional presets for fixed payroll, flexible contractors and a contractor adoption ramp. A person can switch a preset, edit assumptions, understand positive or negative cash consequences, inspect the monthly cash curve, expand the calculation detail, and export or import a scenario. Preserve valid edits on reload and reject invalid imports without replacing them. Make desktop, phone and keyboard journeys complete. Avoid fake testimonials, client logos, usage claims, AI-generation claims and decorative financial gauges.

## Model contract

Use one displayed currency and monthly periods. All cost/time boundaries must be clear.

- Accepted completions per month are the workload denominator. Baseline and proposed human minutes are per accepted completion, including relevant review, exceptions and rework. Attempts per accepted completion account for variable charges incurred on failures and retries; an attempt is not a completed result.
- Current monthly labor cash expense is an explicit input. A cash-removable share of changed human hours and corresponding hourly cash rate determine labor expense changes. Fixed payroll is unchanged unless an explicit cash-changing mechanism is entered. Cash-removable hours cannot exceed positive freed hours, and a modeled cash reduction cannot exceed the labor expense it removes. Additional variable labor work must increase cost rather than be clamped away.
- Freed hours = accepted completions * (baseline human minutes - proposed human minutes) / 60, scaled by adoption for a constant accepted workload. Preserve negative values as added work.
- Cash labor reduction = changed cash-removable hours * cash rate. Hours that actually remove cash expense are not also retained capacity. Hours not monetized remain useful capacity, without automatically assigning a dollar value.
- Incremental fixed subscription and cash maintenance start immediately. Incremental variable charges scale with attempted automated workload. The steady state and ramp projections must use the same cost boundary and formulas.
- Internal build or maintenance time covered by unchanged salaries is a resource commitment, not an incremental cash outflow. Keep any such note separate. Setup cash at month zero includes only an actual incremental cash assumption. Do not use salary as a floor for the economic value of an hour.
- Monthly net cash benefit = existing cash expense removed - incremental ongoing cash costs. Cumulative cash starts at minus setup cash and sums each actual monthly modeled cash benefit. Whole-month payback is the first nonnegative cumulative month. Label optional fractional interpolation explicitly. For zero or negative returns, report no payback within the selected horizon; never return NaN or Infinity or claim a profitable result because setup is zero.
- Cost per accepted task = included ongoing cash cost / accepted completions. The after cost must reconcile to the cash ledger. Setup is separate. Zero accepted completions makes unit cost undefined, not zero. Show the included boundary rather than imply complete enterprise cost accounting.
- An optional future spending plan has an explicit monthly budget, required hours and start month. Allocate only retained freed hours to it. Show hours covered and remaining capacity. State whether the assumed expense is divisible or requires full coverage; do not invent a hiring probability or infer a headcount reduction. Keep current-baseline cash results separate from the conditional future-plan comparison. Unknown future spending is not zero and is not realized savings.
- Use full precision internally; round display only. Label all presets synthetic and all model results conditional on their inputs. Do not claim what all competitors do or that this is the first such model.

## Independent examples

`tests/acceptance/economic-fixtures.json` contains independently calculated inputs and expected outputs. Map those economic cases into the application's schema rather than changing expected results to match an implementation. Some fixtures exercise a calculation helper or a clearly labelled comparison rather than requiring a separate UI feature. Implement meaningful test assertions, not a fixture file that is never executed.

The fixed payroll preset frees 100 hours but increases monthly cash expense by 500 and has year-one net cash impact of -7,200 including setup. The contractor preset saves 3,500 net cash per month, has 7,000 setup and pays back in month two. The 25%/50%/100% adoption ramp pays back in month four, not month two. These are different economic situations, not optimistic and pessimistic decorations.

## Implementation and release quality

Keep deterministic calculations separate from UI and serialization. Prefer a small static application with no backend, accounts, paid APIs or private services. Use dependable dependencies only where useful and retain a lockfile. Make validation specific and recoverable. Blank, non-finite and out-of-range inputs must not silently become valid numbers. Imported data is untrusted; validate schema/version and render user text as text. Scenario data belongs in browser storage or explicit downloads, never in analytics or URL query strings.

Include unit and meaningful boundary tests, a production build, and actual browser checks for the core journey, responsive layout, keyboard access, persistence, import/export and invalid input recovery. State which checks were run. A mocked save does not prove real browser persistence. Scan tracked source and release output for secrets and private material. Use only synthetic fixtures, neutral examples and properly licensed assets.

Update the README with working setup commands, formulas, limitations, privacy behavior and the actual release state. Include a suitable open-source license and minimal CI that runs the relevant checks. Prepare a static build suitable for a repository subpath on GitHub Pages. Do not enable paid services or other infrastructure. Public release is authorized after review, but an untested deployment is not a completed product.
