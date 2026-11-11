# Design standard for public pages

Follow these on every marketing page. They came from the November 2026 review against Flipsnack, Heyzine, Issuu, Gumroad, Payhip and Squarespace (plan 2).

- **Type.** Section headings: `display-title text-3xl sm:text-4xl`. Page `h1`: `display-title text-4xl sm:text-5xl` (home may use `xl:text-6xl`). Card headings: `text-base font-medium`. Body: `text-[15px] leading-relaxed text-muted-foreground`. Eyebrows: `label-xs`. No other heading sizes on marketing pages.
- **Width.** Text sections `shell max-w-4xl`; sections with media `shell max-w-6xl`. Body text never wider than about 70 characters (`max-w-2xl`).
- **Spacing.** Sections `py-16 sm:py-24`, separated by `rule-t` or an alternating `bg-muted/30` band, never both.
- **Cards.** `rounded-2xl border border-border bg-card p-6`. `rounded-3xl` only for large media frames.
- **Buttons.** One primary action per screen: the black `<Button>` default. Green (`bg-leaf`) is for small accents and ticks only.
- **Media frames.** Pictures and clips sit in a `rounded-3xl bg-[#e9e8df]` frame with `shadow-soft`, matching the book backdrop.
- **Every section answers one question** and has at most one heading, one short paragraph, and one visual or one list. A section with neither a visual nor an action is merged or cut.
- **Motion.** Clips are muted, loop, `playsInline`, have a `poster`, use `preload="none"` and start only when on screen. With `prefers-reduced-motion`, show the poster only.
- **Headers.** Public pages use `MarketingHeader` (Examples, Products, For authors, Pricing, Sign in, Upload a PDF). Signed-in app pages use `AppHeader` (email, Account, Sign out). Buyer pages show the logo only.
- **No fake proof.** No invented numbers, names, logos or ratings.
- **Pictures** come from Portfolia's own output (Photo shoot, capture tool, real screenshots), never stock or generated images.
