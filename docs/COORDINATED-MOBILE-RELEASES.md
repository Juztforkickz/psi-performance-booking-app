# Coordinated PSI phone releases

## Current standing release rule

On 26 October Matt requested that every approved customer app change include updating both Apple and Android through OTA, without separate push or platform commands. This rule is saved in `AGENTS.md`. After relevant validation and a checkpoint push, the assistant must publish the same approved source to both existing compatible phone channels and verify both feeds as part of completing the task. Explicit previews and release holds remain unpublished. Native changes still require the appropriate store release process.

The existing authenticated direct EAS publishing route can fulfil this rule. No new GitHub credential is needed for assistant managed publication. Use one publication route per checkpoint and retain its receipts. Do not subsequently approve a duplicate release of that checkpoint through a second route. The separate GitHub publishing credential remains unapproved and has not been created. The prepared GitHub pipeline is therefore not yet an operating background publisher.

## Optional shared GitHub publisher

The prepared GitHub workflow `coordinated-mobile-release.yml` replaces the separate Apple EAS workflow definition. Once explicitly activated, it prepares Apple and Android from the same main branch commit, retains one owner approval for both, and publishes to the existing customer channels. Web continues through the existing Pages workflow from main.

The previous Apple workflow could not start because the account's free EAS workflow minutes were exhausted. Its verified provider error says the allowance resets on 1 November 2026 at 00:00 UTC. GitHub Actions is the official alternate EAS Update publisher and does not consume those EAS workflow minutes. This change does not subscribe to a plan, add billing or create store builds.

## Release process

1. A relevant main branch push or manual dispatch prepares both production Hermes exports from that exact source SHA. Changes to source, imagery, configuration, dependencies, release tooling and tests trigger validation.
2. TypeScript, lint, review isolation, release tests and Android updater tests must pass. Native compatibility checks run before export. No publishing credential is provided to this job.
3. The two exports and a SHA256 inventory are saved together as an immutable GitHub run artifact. Both must be ready before the publish job can start.
4. The protected `psi-mobile-production` environment requires Matt's GitHub approval. Its main branch restriction and owner reviewer preserve the existing release approval boundary. The Expo credential belongs only to this environment.
5. The publisher verifies the source commit is still main, rechecks native compatibility and artifact hashes, and verifies both destination channel mappings before publishing either platform. It uses the prepared exports, not a new build of moving source.
6. It publishes and verifies each platform through the actual customer update endpoint. Every bundle and asset must match the prepared bytes. Only two verified platform results produce a complete receipt.

Apple uses `app-store-release`, runtime `1.0.0-app-store-release-1`. Android uses `android-play-internal`, runtime `1.0.0-android-play-internal-1`. Despite the historical Android channel name, it is the existing public Google Play channel. Do not move customers to a different channel or runtime as part of this setup.

## Failure and retry

Expo does not provide an atomic transaction spanning these two platform channels. A network or provider failure can leave one updated first. The workflow records an incomplete result and never reports both complete in that state. It serialises releases without cancelling a publication halfway through.

Each source SHA and platform has a deterministic publication marker. A rerun checks provider history first, reuses an existing matching publication and verifies its bytes instead of publishing it again. A timed out publication is read back before any retry. If its outcome cannot be verified, the run stops. Inspect the saved receipt and provider state before rerunning. A changed main branch requires validation and approval of the newer commit.

Native dependencies, Expo native configuration, config plugins, native project files, embedded icons, splash assets and notification sounds are pinned in `mobile/release-native-baselines.json`. A native change blocks both OTA publications. A reviewed compatible store build and explicit baseline update are required, rather than silently sending incompatible JavaScript to installed apps.

## Security and boundaries

The publisher uses an Expo robot credential restricted to the PSI organisation's Developer role where the account supports it. No personal password, customer session, Supabase service key, Apple signing key or Google payment credential belongs in GitHub. The protected Expo environment secret must be configured and tested before this setup can be called operational. Do not copy a local Expo login session into CI.

No database migration, customer deletion, points adjustment, subscription transition, Wallet activation, automatic store submission or fee is part of this workflow. Existing owner permanent Performance+ and lifetime double Rewards are preserved.

Phone downloads still depend on connectivity, compatible installed runtimes and native update safety rules. The Android updater avoids restarting an active booking or payment. Store icons and native changes still require store processing. Feed verification proves available bytes, not successful installation on every customer's phone.

## Monitoring

The existing heartbeat now checks both the submitted Google Play 1.0.3 (9) and icon review, and Google Wallet case 05714410, once daily at 9 am Australia/Melbourne. Do not recreate completed releases or send duplicate support requests. Record Play approval separately from customer phone confirmation. Wallet stays disabled until Google publishing approval, Matt's explicit enablement authority and real Android save validation are satisfied.

## Current activation status

Cloud preparation passed for checkpoint `1c25d3e` on 26 October 2026. The protected environment is configured. Publishing credential approval and the first verified coordinated publication remain outstanding. Later main branch changes make that earlier prepared checkpoint stale for the publisher's source check. If activation is requested later, validate the current intended source and preserve all existing approval and credential requirements. This optional activation hold does not prevent following the standing rule using the existing direct OTA route.
