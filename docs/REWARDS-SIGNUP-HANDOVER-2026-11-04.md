# Rewards after customer signup

An invoice can reach its retry limit while an invited customer has not completed their account. Verifying the customer later must make that held invoice eligible for normal processing again.

The correction adds an invoker trigger to the existing private verified Xero contact links. It wakes only existing unfinished Rewards jobs with the matching tenant and contact and the missing verified customer error. It requires an active customer and a verified link from the established ownership workflow. It grants no permissions, assigns no customer identity and awards no points itself.

The wake advances the queue revision, resets its bounded retry counter and records a system audit event. Existing active leases remain intact so an older worker revision cannot settle the new one. Unchanged verification replays, completed jobs, other contacts, other tenants and other error classes are untouched. Migration replay alone never resets any job.

The existing processor fetches Xero again and retains the configured standard launch boundary of 22 October 2026, paid Performance+ receipt date verification, original double activation, owner exception, refund handling and atomic duplicate protection. Invoices fully paid before the standard launch date do not gain points.

All 257 Rewards, Performance+ and Xero checks pass, including actual PostgreSQL trigger execution under the existing financial schema. No real customer login, synthetic payment or test points are used. This backend correction needs no phone OTA or native store release. Production application requires the supported Supabase migration confirmation and readback verification.
