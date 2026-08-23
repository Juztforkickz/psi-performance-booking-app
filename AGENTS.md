# AGENTS

## Project initialization
- This file defines the persistent instructions for this repository.
- Continue from the current verified checkpoint; do not restart or recreate the project.
- Preserve existing approved work unless you explicitly request changes.
- Keep deployment boundaries and safety constraints intact unless explicitly changed.

## Usage-efficiency rules
- Use a small/targeted model for minor or narrowly scoped edits.
- Use **Spark** for small, repetitive, or highly targeted work.
- For normal development and routine multi-file work, use **GPT-5.6 Sol with Medium** reasoning.
- For genuinely complex design/logic work, use **GPT-5.6 Sol with High** reasoning.
- Use **Extra High/Max** only for exceptional/ high-risk or ambiguous problems.

## Before substantial tasks
- Before each substantial task, include:
  - the lowest suitable model and reasoning level,
  - a short reason it is sufficient,
  - and when it is safe to reduce the setting again.

## Model approval gate
- Before performing any task, recommend the lowest suitable model/platform and reasoning level, with a short reason.
- Stop and wait for explicit confirmation before changing files, running development commands, deploying, publishing, committing, pushing, or modifying external services.
- Proceed only after the user confirms they have switched, or explicitly says to continue using the current setting.

## Collaboration and task completion
- Prefer the smallest safe change to meet the request.
- Keep external/public services unchanged unless explicitly authorized.
- After each approved project change, run the relevant validation, create a checkpoint commit, and push it to the current working branch so its configured public preview can refresh automatically.
- Treat an automatic GitHub Pages refresh after a push as approved; do not deploy to Netlify unless explicitly requested.
- For substantial work, report changed files, validation, checkpoint commit, and deployment status.
