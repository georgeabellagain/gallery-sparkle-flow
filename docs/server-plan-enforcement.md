# Server-verified Personal entitlements

Public portfolio JSON is not a source of billing truth. Public CV delivery and
banner signing use the latest webhook-managed live subscription for the owner,
with a recognised Personal price. Active/trialing subscriptions qualify; the
existing past-due payment retry grace is retained. Cancelled subscriptions qualify
only until current_period_end. Database lookup failures fail closed.

CV downloads always use the no-store public file endpoint, which rechecks billing
and password/expiry access on each request. Public responses replace the stored
plan with the verified plan and omit unpaid CV/banner references. Signing and file
serving share one asset allowlist. Previously issued signed URLs can remain valid
until their original expiry (up to one hour); new CV links are not signed URLs.

Apply supabase/migrations/20261016153000_server_plan_enforcement.sql before
publishing the application. Storage restrictive INSERT/UPDATE policies enforce
10 MiB Free / 50 MiB Personal from server-computed metadata.size, regardless of
client plan, file extension, MIME or user_metadata. A trigger also checks Storage
internal service-role finalisation. The bucket retains its absolute 50 MiB cap.
Preflight probes with no size remain possible; actual finalisation with measured
bytes is checked. Existing stored files are neither deleted nor hidden by a plan
change; new writes and replacements must meet the current allowance.

Validation: tests/entitlements.test.ts and tests/access.test.ts cover forged plans,
subscription lifecycle, lookup failure, key aliases and file delivery. Execute
tests/server-plan-enforcement.sql against the migrated database in one session;
all fixtures roll back. It checks Free and Personal boundaries, replacement,
wrong-owner writes, internal finalisation, sandbox isolation and paid-through
cancellation.
