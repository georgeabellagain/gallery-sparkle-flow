# Heyzine feature review — 6 October 2026

Sources reviewed: [Heyzine features and plans](https://heyzine.com/) and [Heyzine FAQ](https://heyzine.com/faq). This compares advertised capabilities with the current Portfolia implementation; it is not a hands-on test of Heyzine. Availability varies by plan. No price comparison or claim of exclusive features is made.

| Capability advertised by Heyzine | Portfolia today | Practical priority |
| --- | --- | --- |
| Links inside flipbooks | External PDF links work in Scroll/Page by page, not the 3D book | High: retain useful links in the headline reader |
| Video, audio, images and GIF overlays | PDF page rendering; no multimedia overlay editor | Image panels first if pursuing the scrapbook direction |
| Per-page, link and media statistics | Portfolio sessions, estimated unique browsers and download clicks | Medium: meaningful section visits before detailed tracking |
| Public digital bookshelves | Private owner dashboard with separate public portfolio links | Useful for magazine issues or several collections |
| Offline flipbook and HTML download | Original PDF download only | Later; packaging and ongoing compatibility add work |
| Team members | Individual owner accounts | Later unless institutional demand appears |
| Lead forms and web iframes | Profile/contact links and externally embedding the reader | Later; forms bring handling and moderation obligations |
| Right-to-left and additional page effects | Scroll, Page by page, Simple/Studio book | Add RTL only when requested; more effects are lower priority |
| Custom DNS domains and embed-domain restrictions | Personalised Portfolia paths; domain UI remains a prototype | Separate hosting/security work, not a quick setting |
| API and analytics integrations | No public conversion API or third-party analytics integration | Low priority for the current direct-user product |

Existing overlap includes PDF hosting, custom backgrounds, QR sharing, website embeds, stable public links, cover previews and password access. These are not all missing from Portfolia.

## Suggested sequence

1. Complete outstanding real-device and account verification, including the corrected statistics scope.
2. Add coloured top-edge project tabs as an optional, small scrapbook feature tied to named project ranges.
3. Address clickable links in the flipbook, with accessible hit targets and compatible turning/zoom behaviour.
4. Prototype optional per-page image fold-outs before building a general multimedia editor. Uploaded images must inherit portfolio access controls, and original PDF downloads should remain clearly distinguished from interactive additions.
5. Consider a curated public issue/collection shelf when magazine or multi-portfolio users need one.

The current statistics change separates account totals from individual uploaded portfolios. It does **not** implement tracking of named sections, dwell time or article reads. No historical section-level data can be reconstructed from existing session events.
