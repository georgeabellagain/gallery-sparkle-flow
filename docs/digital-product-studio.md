# Digital Product Studio

Products are independent from portfolios. Create a product at `/products`, upload the customer PDF, generate a preview from selected pages, save and publish. Public previews are new rasterised PDFs: unselected pages, attachments and original PDF objects are not copied. Products support appearance controls, a private customer edition, optional download, marketing photos and short listing videos.

SEO landing pages: `/digital-product-studio`, `/etsy-digital-product-preview`, `/digital-zine-publishing`.

## Seller delivery

After publishing, create a customer link in Customers. Copy it or download its delivery PDF immediately; raw tokens are not retained. For Etsy, attach that PDF to the digital listing through Etsy's seller tools. Other shops can deliver the link or PDF with their normal digital-file fulfilment. Buyers redeem the link to view the full edition. There is no automated purchase verification or Etsy OAuth integration in this release; a commercial Etsy app and seller authorisation are required for that integration.

A shared listing link grants access to anyone who possesses it. Sellers may create separate labelled links and optional expiries. Revocation applies to every holder of that link. Disabling download hides/blocks the download action, but is not DRM and cannot prevent recipients from copying content they can view.

## Security and operations

Migration `20261110120000_digital_product_studio.sql` was applied on 10 November 2026. It is repeat-safe. `product-files` is private; product and access-link tables deny direct client access. Server owner operations require authentication and the existing MFA middleware. Database triggers enforce product counts and upload sizes using subscriptions. Free includes one product and 30 MB per PDF; paid includes ten products and 100 MB per PDF.

Tokens contain 256 random bits and are stored as hashes. Redemption is rate limited and issues a 12-hour Secure, HttpOnly, SameSite=Lax cookie. File requests, including ranges, recheck expiry and revocation. Signed upstream storage URLs remain on the server. Full editions and customer routes use no-store/no-referrer controls. No advertising events are sent from product/customer routes.

Preview generation is browser-side; owners are responsible for which content they deliberately publish. The public endpoint can access only the stored preview path. Replacement uploads use fresh paths; older files are retained until product/account deletion. Deletion removes all files in the product folder and cascades access links.

## Verification

395 automated tests, TypeScript and production build passed. Live database checks verified private storage, direct-read denial, free product caps and oversized upload rejection in a rolled-back transaction. Browser checks used mocked owner/server calls and real PDF rendering: editor appearance, Simple/Studio and selected-page preview creation. These are not a complete live checkout/customer-delivery test. Before public rollout, test a seller and customer in separate browsers, including expiry/revocation, save/discard and a real Etsy test listing. Listing video export requires browser MP4 support; inspect the resulting clip before upload.

## Plan 1 features (November 2026)

Each arrives with its own migration; apply them in order. The code works before each is applied (the feature is hidden, skipped or shows "Available after the next update").

1. `20261111120000_product_covers.sql` — **Cover thumbnails.** A WebP of public page 1 (at most 300 KB), made in the owner's browser with each preview, shown on the products page and served at `/api/public/product-cover/<id>` for published products only.
2. `20261111120100_product_slugs.sql` — **Readable address, QR code, embed.** `portfolia.site/product/<slug>` (Personal and Business). Customer links keep the id form. The QR code is for the preview link only. `/embed/product/<slug-or-id>` shows only preview pages, even in a browser holding a customer session.
3. `20261111120200_product_stats.sql` — **Statistics.** Daily counts of preview views (once per browser session), Buy clicks, customer opens and downloads. No IPs, cookies, ids or referrers. Bots are ignored.
4. `20261111120300_product_link_stamps.sql` — **Buyer name on downloads.** A customer link may carry "Licensed to <name>", printed small on every page of the downloaded PDF: by the server up to 20 MB, in the buyer's browser above that. A deterrent, not copy protection.
5. `20261111120400_product_extras.sql` — **Extra files.** Up to five ZIP, EPUB, PNG, JPG, MP3 or TXT files for customers only, always served as attachments with `nosniff` and a sandbox policy. Together they may use twice the plan's PDF allowance.
6. `20261111120500_product_orders.sql` — **Automatic delivery** (Business). Gumroad Ping, Shopify webhooks (`orders/paid`, `refunds/create`, HMAC-checked on the raw body) or any JSON sender post to `/api/public/product-delivery/<id>/<source>`. Each order gets its own link, emailed once ("<title> via Portfolia"); repeats change nothing; refunds switch the link off. At most 60 a minute and 500 a day per product. The delivery key is shown once and stored as a hash; the Shopify secret never returns to the browser. Etsy is not supported: it has no simple order webhook.