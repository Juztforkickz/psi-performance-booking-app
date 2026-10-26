# AGENTS

## Project initialization
- Quote all prices, costs, estimates and revenue in Australian dollars (AUD) only. Convert and date any foreign-currency source before quoting; do not present foreign-currency pricing as AUD.
- This file defines the persistent instructions for this repository.
- Continue from the current verified checkpoint; do not restart or recreate the project.
- Preserve existing approved work unless you explicitly request changes.
- Keep deployment boundaries and safety constraints intact unless explicitly changed.

## Writing punctuation
- Avoid hyphens and dash punctuation in user visible writing, drafts, headings and marketing copy. Rewrite with commas, full stops or natural wording wherever possible.
- Use a hyphen or dash only when it is required for correct spelling, an existing proper name, a file or URL, a code identifier, or unambiguous technical syntax.

## Email platform preference
- Use Microsoft 365 and Outlook for email access, drafting, sending and account setup.
- Do not use Gmail for PSI email work unless Matt explicitly overrides this rule for a specific task.

## Protected owner account
- The owner account `matt@psiperformance.com.au` must retain permanent complimentary Performance+ access.
- Always exclude this account from beta cleanup, TestFlight tester removal, customer transition emails, subscription expiry and Performance+ lockouts.
- Do not revoke, expire, downgrade or otherwise change this protection unless Matt explicitly authorizes that exact owner-account change.

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

## Standing rule, release approved app changes to both phone platforms

Matt confirmed on 26 October 2026: "can't we just make it auto when i make a change as a rule we update both ? via ota".

- A clear instruction to implement, apply or fix a customer app change includes completing its compatible live OTA release to both Apple and Android. Matt does not need to issue separate commands to commit, push, update Apple, update Android or continue the already authorised rollout.
- Honour explicit preview only, review only, plan only, do not publish and other release holds. Do not publish unfinished work or treat a discussion as an implementation instruction.
- Complete relevant validation, create and push a checkpoint, publish the same approved source checkpoint to both existing live channels and verify both customer update feeds. Use Apple's `app-store-release` channel and Android's existing public `android-play-internal` channel with their verified installed runtimes. Preserve live backend configuration, customer information, features, owner protections and existing release safeguards.
- This is a standing task completion rule. The existing authenticated direct EAS OTA route is sufficient. A new GitHub publishing credential is not required to follow the rule. Choose one publishing route per checkpoint, retain its receipts and avoid a duplicate publication through another workflow.
- Keep platform approval controls and personal authentication requirements intact. Existing task authority covers routine supported release steps, but does not authorise bypassing a gate, creating new persistent credentials, adding fees, publishing unrelated work or broader financial or data operations.
- Check native compatibility before publishing. A change requiring a store build must be reported and handled through the appropriate store release authority. Do not force it through OTA or silently change installed runtime identities.
- Mark the rollout complete only after both platform publications and delivered files are verified. Record partial failures, investigate and safely retry within the authorised scope. Server verification does not establish that every customer's phone installed the update.
- Documentation, policy and other changes that do not affect the customer app do not require a new phone OTA release. The normal checkpoint and push rule still applies.

## Workshop vehicle workspace contract

- Keep one canonical desktop vehicle workspace per verified project, customer and vehicle ID. Registration, year, make and model are consistency checks, never substitutes for ownership IDs.
- Manual job creation, background booking sync and downloaded manifests must check and reuse the same vehicle folder. Keep the six category folders directly inside it. Do not add a visible `Jobs` layer or dated/reference subfolders unless Matt explicitly requests them.
- Consolidate verified same-vehicle folders and exact duplicate files with recoverable backups. Preserve all distinct content, each existing file's job ID, date and receipt in internal metadata, and every database job. Never merge different customer or vehicle IDs using names or registration alone.
- New unassigned files use the latest eligible workshop visit, not a future booking or an invoice-only job when an eligible workshop visit exists. Never reassign an existing file just because the active visit changes. Block uploads while a consolidation is incomplete.
- Back up and hash-verify legacy moves, never overwrite destinations, and retain reversible recovery journals. Windows-locked sources remain usable, are flagged for review, and reuse existing verified backups on retry.
- Test repeated sync, manual creation, manifest import, customer/vehicle separation, ambiguous identities, receipts and per-job photo attribution. Verify the installed running version and public updater hashes before reporting completion.
- Do not claim missing photos were recovered without locating and verifying the files. Use fictional customer details in public test fixtures and documentation.
- Automatically sync all six report categories in both directions within existing verified vehicle folders. Download only authorized published/active records, never drafts or another identity's files. Keep cloud download receipts before making files visible so downloads cannot become new uploads after interruption. Never overwrite or propagate deletions to workshop originals. Keep workshop-only waiting and parts-only sales boundaries unchanged.
