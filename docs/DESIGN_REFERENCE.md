# Operating Leverage Lab - visual reference

Use this document for appearance and interaction hierarchy. `IMPLEMENTATION_BRIEF.md` governs scope and financial behavior; `tests/acceptance/economic-fixtures.json` supplies independent expected results. The visual export was a desktop mockup, not a tested application. Its calculation script, runtime and vendor files are deliberately excluded from this repository.

## Visual direction

An editorial financial worksheet: warm paper, clear typography, precise numbers, generous spacing and restrained color. Make the first screen useful immediately, with a fictional scenario populated and its cash and capacity consequences visible. Avoid dashboard clutter, decorative gauges and unsupported claims.

Suggested tokens:

| Role | Value |
| --- | --- |
| Page | `#FAF8F3` |
| Main text | `#191813` |
| Secondary text | `#4B473D` |
| Muted text | `#6E6857` |
| Surface | `#FFFFFF` |
| Quiet surface | `#F2EEE5` |
| Border | `#E2DCCE` |
| Secondary border | `#CFC6B2` |
| Positive / interactive teal | `#0F6F6C` |
| Cost / caution copper | `#A4562B` |
| Dark caution text | `#7A3E1D` |
| Positive tint | `#E9F1EE` |
| Caution tint | `#F7F1E9` |

Use a restrained serif for headings, a readable sans serif for labels and prose, and tabular numerals for all financial comparisons. System stacks are sufficient: Georgia for headings, the platform sans serif for prose, and the platform monospace for numeric emphasis. Self-hosted fonts are optional only with verified redistribution licenses and retained license files. No remote font or other external resource requests.

Desktop heading approximately 56px with a 1.06 line height; section headings 21-24px; body 14-16px with a 1.5-1.65 line height; important result figures 36-44px. Reduce typography responsively. Small uppercase labels with modest tracking can distinguish sections, but essential explanations must remain readable. Use 2-4px corner radii, fine borders, minimal shadows and 44px minimum interactive targets. Color supplements words and signs, never replaces them.

## Page structure

1. **Header.** A small geometric stepped-line mark, the product name, then the headline: "What changes in cash. What changes in capacity." Briefly explain the separate current-cash, capacity and optional future-plan comparisons. A compact note identifies results as assumptions, not measured customer savings.
2. **Fictional examples.** Three equal cards on desktop: fixed payroll, flexible contractors and contractor adoption ramp. Each has a short explanation and its calculated result. A thin colored top edge and pressed state show selection. Values should come from the actual model, not duplicate hardcoded result labels. Editing marks the scenario custom.
3. **Assumptions and results.** A roughly 360-440px assumption column next to a flexible result column, with approximately 32-40px between them at wide widths. Group inputs into workload, labor cash, new costs, adoption, and optional future spending. Show labels, units and short contextual help. Expand advanced inputs when useful, without hiding assumptions essential to understanding a result.
4. **Result cards.** Current cash impact, physical hours changed and optional future spending remain separate. Cash cards show full-adoption and relevant ramp results with clear period labels. Capacity must distinguish total hours freed, hours removing current cash expense, and retained capacity available for another use. Never add the three ledgers into a headline savings total.
5. **Cash curve.** A simple cumulative line from setup at month zero through the modeled horizon, a visible zero line, and monthly net bars or an equivalent clear representation. Explain setup timing. Provide the underlying accessible monthly table so information does not depend on a chart or hover.
6. **Unit cost and details.** Before/after cost per accepted completion, an explicit included-cost boundary, expandable arithmetic and monthly schedules. Keep setup separate from recurring cost. Optional resource notes can identify unchanged-salary commitments without presenting them as incremental cash.
7. **Scenario actions.** Working export, import and reset controls with clear success or validation messages. Reload preserves valid edits. Explain local browser storage and explicit file downloads in plain language.

Use a centered, fluid container with approximately 48-64px wide-screen gutters; stack cards and columns as space narrows, with roughly 16-24px phone gutters. The original fixed 1440px canvas is not a responsive implementation. Avoid horizontal page overflow. Give tables a deliberate small-screen treatment and keep inputs and results usable by keyboard and assistive technology.

## Corrections that supersede the mockup

- **Future capacity is not total time saved.** The mockup incorrectly used all freed hours for a hiring plan even when those hours had already reduced contractor invoices. Use retained capacity after current cash-removing hours, month by month after adoption. Allocate nothing before the plan starts. Show covered and remaining hours. The brief defines divisible and indivisible spending; the mockup's full-coverage-only rule is insufficient. A contractor case with all freed hours monetized has zero capacity available for an additional plan.
- **Labor expense must reconcile.** Reject a proposed cash reduction exceeding the in-scope labor expense it removes; the mockup omitted this bound and could produce negative ongoing labor expense. Preserve additional variable labor costs when the proposed process takes longer. Validate nonnegative baseline expense and plan costs, and an integer plan start month.
- **Payback needs the defined zero-setup state.** Do not copy the mockup's "month 1" answer when there was no initial investment. Use the brief's "No initial investment to recover" wording and report ongoing profitability separately. Individual negative months do not invalidate a later cumulative recovery.
- **Attempts are not completions.** Per-attempt charges include failures and retries. A ratio of 1.25 means 1.25 attempts per accepted result; it does not prove that exactly one in four tasks needs a second run. Use precise help text. The fixture mapping specifies when costs already include attempts and must not be added again.
- **Retained payroll remains in the cost boundary when entered.** The mockup's statement that unit cost excludes "any salaried time you retained" is misleading. Existing in-scope payroll remains in the entered baseline and after expense. Additional allocation of unchanged salaried build time is not another cash charge.
- **Import is transactional.** The mockup applied syntactically valid but economically invalid JSON directly to state. Validate the whole candidate schema, version, types, ranges and relationships before replacing the last valid scenario. Invalid import must leave it untouched. Render imported text as text.
- **Persistence and downloads are real implementation work.** The exported source contains no local persistence and its file download control is disabled. Implement and test the required reload, export and import journeys. Do not claim they work because they were pictured. Clipboard success must await the actual operation.
- **Remove placeholders and scope additions.** Do not ship disabled "specified" buttons or a footer promising unbuilt functions. Shareable URL state, a saved scenario library and print tooling are not required by this reference. Scenario information must not enter URL parameters. Use only implemented controls and accurate capability descriptions.
- **Keep claims conditional.** Replace claims that freed time "is real" with modeled or estimated language. Preserve fictional-example labels. The export is evidence of design intent, not evidence of savings, validation or customer demand.

The original desktop composition supplies style and hierarchy only. Implement the brief and independent fixtures in maintainable components, and verify the resulting interface in a real browser.
