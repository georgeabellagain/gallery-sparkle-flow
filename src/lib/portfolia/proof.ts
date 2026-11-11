/**
 * Proof shown on the home page (plan 2, S6). The owner fills this in; nothing here may be invented (plan 0 rule 11).
 * Figures come from the database on a stated date; quotes need the person's written permission.
 * While every list is empty, ProofStrip shows only the "How we look after your work" row.
 */
export type ProofFigure = { value: string; label: string; asOf: string };
export type ProofQuote = { text: string; name: string; role?: string; permission: string };

export const PROOF_FIGURES: ProofFigure[] = [];
export const PROOF_QUOTES: ProofQuote[] = [];
/** "Featured: Scarlett Bushell's lookbook", with the permission line already used for the home example. */
export const PROOF_FEATURED: { title: string; credit: string; href: string } | null = { title: "Featured: Scarlett Bushell’s lookbook", credit: "Property of Scarlett Bushell 2026", href: "/p/adu2v" };

/**
 * Always true, checked against the code and the privacy notice (src/routes/privacy.tsx) in November 2026:
 * drafts stay in the browser or private storage until published; password and expiry are Personal features (plans.ts);
 * Paddle is the Merchant of Record; the operator is George Bell in London.
 */
export const CARE_POINTS = [
  { title: "Private until you publish", body: "Drafts stay in your browser or your account’s private storage. Only a published link can be opened by others." },
  { title: "Passwords and expiry", body: "Personal adds a password and an end date to any portfolio link." },
  { title: "Payments by Paddle", body: "Paddle, our Merchant of Record, handles card details. Portfolia never sees them." },
  { title: "Run in the UK", body: "Made and run in London by George Bell. Questions go to a person at hello@portfolia.site." },
] as const;
