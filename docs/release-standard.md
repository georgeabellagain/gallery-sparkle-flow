# Portfolia release standard

Applies to every production release. A paused database is a blocked verification,
not a passed check. Record the commit, operator, date and evidence for each gate.
Never put credentials or customer information in evidence.

## Automated gate

Install with `bun install --frozen-lockfile`, then run `npm run check` (tests,
TypeScript and production build). GitHub runs the same sequence on pull requests
and main. Require the `check` and `database` statuses in branch protection before merging; adding
a workflow alone does not enable branch protection. Do not bypass a failed check. The database job tests the new migrations against
a minimal isolated PostgreSQL schema; full Supabase RLS and storage checks remain
part of the staging gate.

## Database deployment

Back up before applying migrations. Apply all pending migrations in order in a
staging environment first. This release adds `20261027160000_launch_backgrounds.sql`
and `20261027161000_atomic_subscription_events.sql`. Deploy the subscription RPC
before the application that calls it. Never roll back billing data to roll back code.
Verify that only service_role can call the subscription RPC.

Using disposable test accounts, verify:
- Free saves wood, concrete, Sorbet and Aurora; paid choices require Personal.
- 30 MB Free and 100 MB Personal limits reject oversized direct storage uploads.
- Published CV delivery follows the server subscription, not browser JSON.
- Protected and expired portfolios reject direct file and lead requests;
  an unlocked, unexpired portfolio accepts a valid lead.
- Two-step accounts cannot access account functions before the second step.

## Payment gate

Use Paddle sandbox first. Exercise created/updated/canceled events in order,
reverse order, duplicates, and concurrently. The latest timestamp must win;
when timestamps tie, cancellation wins. Deliver cancellation to an absent row.
Malformed events and database failures must return non-2xx and remain retryable.
Verify monthly/yearly switching, scheduled cancellation, paid-period access and
downgrade. Confirm live price IDs, webhook signing configuration and billing portal.
Before opening paid sales, complete an owner-controlled live checkout and verify
its resulting entitlement and cancellation. Never fabricate successful evidence.

## Account and reader gate

On a fresh account: anonymous preview, signup, verification, save, publish,
open in another browser, replacement PDF, failed-upload retry, reset password,
two-step sign-in, portfolio deletion and account deletion. Check lead email and
open notification delivery, including a failed email with the lead still saved.

On real iPhone Safari, Android Chrome and desktop: first readable page, repeated
turns, zoom, fullscreen, links, all reader modes, selected photo-shoot spread and
PNG/video export. Use a small document and an image-heavy 100 MB document. Record
cold-load and warm-load timings and device/network details. Check reduced motion,
keyboard focus and access to a non-3D reader. No missing pages, crashes or lost saves.
Target field p75 LCP <=2.5 s, INP <=200 ms and CLS <=0.1; do not substitute a desktop
unit test for mobile performance evidence. Investigate regressions before release.

## Operations gate

Configure production error collection and alerts (not just editor-preview hooks),
uptime checks for homepage and a dedicated public sample, and alerts for webhook
failures and database/storage failures. Send a deliberate test failure and record
that the owner receives it. Track storage, egress and email costs weekly initially.
Do not use production customer files in a public monitoring sample.

Confirm the provider backup schedule and retention. Restore a database backup and
representative storage objects into an isolated environment, verify a portfolio
opens and ownership/access rules survive, and record recovery duration and data
age. Database backups alone do not establish storage-object recovery. Set explicit
recovery objectives before paid launch and repeat the restore drill quarterly.

## Release record

- Commit / date / operator:
- CI run and result:
- Applied migrations and staging evidence:
- Account and payment evidence:
- Device results:
- Alert delivery and restore-drill evidence:
- Known limitations / rollback commit:
- Decision: blocked / limited beta / paid launch

As of this change, live database, billing, alert delivery, restore and device gates
remain unverified. The workflow must pass in GitHub and branch protection must be
configured before claiming the automated gate is enforced.
