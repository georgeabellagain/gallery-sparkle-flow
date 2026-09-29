# Move portfolios online

## What will change
- Portfolios, profile details, PDFs, photos, banners and CVs are saved to your account online, not only in one browser.
- Anyone, on any device, can open a published link (`portfolia.site/p/code` or `portfolia.site/name`) and see the portfolio.
- Visitors can start on the homepage by uploading a PDF without an account. They need to sign in (email or Google) to save and publish it.
- Personalised names (`/name`) and custom domains are checked across all accounts, so the same name or domain can't be taken twice. The "demo" taken-name list is removed.
- Visit and download counts are recorded online, so the dashboard shows real numbers from all visitors.
- Anything already saved in this browser is offered as a one-click "Move to my account" after sign-in, so nothing is lost.
- Published portfolios can appear in search results when the owner turns on search indexing, and they're added to the sitemap.
- Browser-only warnings ("only works in this browser") are removed from the dashboard, create flow, pricing and legal pages.

## What stays the same
- Plan rules: Free is 1 portfolio up to 10 MB; Personal is up to 10 portfolios up to 50 MB each, with CV, personalised link and domains.
- The viewer, dashboard layout, cropping tools and payments.
- Custom domains are still saved but not yet live-routed. That needs a separate hosting step later, and this will be stated clearly.

## Verification
- Sign up, upload, publish, then open the link in a private window and on a phone-sized screen.
- Check that a second account can't claim the same name or domain.
- Check the plan size limits, deleting a portfolio, moving browser data to an account, and signing out.

## Technical details
- Tables: `portfolios` (owner, code unique, username unique, status, profile, style, flags, file references), `portfolio_domains` (name unique), `portfolio_events` (visit/download). Also GRANTs, RLS limiting owners to their own rows, and public read of published rows through a server function using the publishable client.
- Private storage bucket with per-user folders. Published files are served through short-lived signed URLs from a server function. The upload size is limited by plan (checked in a server function and by the storage policy).
- The username/domain check calls the database. Reserved names stay in code.
- `store.ts` becomes a React Query–backed API layer with the same function names, so existing components change as little as possible. `useAccount` stays the source of the plan.
- Public routes `/p/$slug`, `/$username` and `/u/$username` load through server loaders for real SSR and head metadata. The sitemap includes published portfolios that have indexing turned on.
- AGENTS.md is updated: storage is the database and storage bucket, and localStorage is kept only for the draft started before sign-in.
