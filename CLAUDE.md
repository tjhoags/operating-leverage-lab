# Implementation guidance

Build a useful, understandable workflow economics tool. Select the simplest architecture that delivers the intended experience reliably. The starter does not select a framework or claim a functioning product.

## Calculation and product quality

- Keep deterministic calculations separate from presentation. Make currency, units, time periods, accepted output volume and cost boundaries explicit.
- Distinguish cash expense removed, human time freed and potential future hiring avoided. Do not count the same benefit twice or equate retained salary capacity with cash savings.
- Include relevant residual review effort, failed attempts, recurring costs, setup costs and adoption timing. Use accepted completions as the denominator when reporting cost per completed task.
- Handle zero, negative and undefined results honestly. State payback conventions and show no payback when the assumptions do not recover the initial cost.
- Label synthetic examples and modeled assumptions. Do not describe hypothetical results as observed savings, revenue or proven demand.
- Make the main journey usable on desktop and mobile, with clear labels, keyboard access and recoverable validation errors. Preserve valid user input when an operation fails.
- Test consequential calculations independently and verify the actual browser journey, persistence and any import/export behavior that is implemented. Report the specific verified scope rather than implying universal correctness.

## Privacy and implementation boundaries

- Public source, examples, tests and screenshots must contain no personal records, private transcripts, customer data, credentials, internal paths or account identifiers.
- Use fictional examples and minimal synthetic fixtures. Private working evidence stays outside this repository. Review staged files as well as ignored files before a release; an ignore pattern is not a security guarantee.
- Never embed API keys or privileged service credentials in a client bundle. Add a dependency or network integration only when needed by the selected workflow, document what data leaves the browser and keep secrets server-side or in local environment configuration.
- Preserve other contributors' edits. Check the current working tree and ownership before changing shared files. Do not overwrite concurrent work or modify unrelated projects.
- Carry authorized implementation and ordinary repairs through to a usable result. Publication, spending, external actions and permission changes must remain within the active task's actual authorization.

Update the README with genuine setup instructions, capabilities, calculation conventions and limitations once they exist. Do not add completion claims or placeholder integrations to make the starter appear further along.
