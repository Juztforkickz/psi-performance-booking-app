# PSI Performance Booking Application — Agent Instructions

These instructions apply to all future coding and maintenance work in this repository.

## Usage-efficiency rules

Before every substantial task, state the **lowest suitable model/reasoning setting** and briefly explain why it is sufficient.

Use the following default ladder:

- **Spark** — small, targeted work such as one-file edits, copy changes, narrow UI fixes, simple inspections, straightforward tests, and other low-complexity tasks.
- **GPT-5.6 Sol · Medium** — normal application development, multi-file feature work, routine debugging, refactors with clear scope, and standard architectural changes.
- **GPT-5.6 Sol · High** — use only when the task is materially complex, ambiguous, cross-cutting, security-sensitive, or requires deeper reasoning than Medium is likely to handle efficiently.
- **Extra High / Max** — reserve for exceptional problems only: unusually difficult debugging, high-risk architecture, major migrations, severe production incidents, or problems that have already resisted lower settings.

Always prefer the lowest setting likely to complete the task correctly. Do not escalate pre-emptively.

After a complex task that required High or Extra High / Max, explicitly tell the user when it is safe to reduce the setting again for subsequent work.

## Project preservation

- Continue from the current verified branch/checkpoint; do not restart or recreate the project.
- Preserve existing approved work unless the user explicitly requests a change.
- Do not undo, replace, or broadly rewrite working code to solve a narrow issue.
- Prefer the smallest safe change that satisfies the request.
- Inspect relevant existing files before editing them.
- Preserve existing branches, checkpoints, restore points, safety boundaries, and deployment configuration unless explicitly instructed otherwise.
- Do not deploy, merge to `main`, or alter external/live services unless the user explicitly authorises it.

## Task completion

For substantial work, finish by reporting:

- model/reasoning setting used or recommended;
- files changed;
- validation/tests run;
- resulting checkpoint/commit when applicable;
- whether deployment or external services were touched.
