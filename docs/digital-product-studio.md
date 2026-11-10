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
