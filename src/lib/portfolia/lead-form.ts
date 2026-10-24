/**
 * A lead capture form (Personal): when readers reach a chosen page, a short form asks for their details before they
 * read on. Email is always asked for; the creator chooses the other fields, the words, and whether readers may skip
 * it. Pure data and checks, shared by the editor, the reader and the server.
 */
export const LEAD_FIELDS = [
  { id: "name", label: "Name", max: 120 },
  { id: "phone", label: "Phone", max: 40 },
  { id: "company", label: "Company", max: 120 },
  { id: "message", label: "Message", max: 2000 },
] as const;
export type LeadFieldId = (typeof LEAD_FIELDS)[number]["id"];
export interface LeadForm {
  enabled: boolean;
  /** The page the form appears at; pages before it are free to read. */
  page: number;
  title: string;
  message?: string;
  button?: string;
  /** Extra fields shown, and which of them must be filled in. Email is always shown and required. */
  fields: Partial<Record<LeadFieldId, "optional" | "required">>;
  /** Readers may close the form and read on without leaving details. */
  skippable: boolean;
  /** A line under the form, such as a privacy note. */
  privacy?: string;
}
export const LEAD_LIMITS = { title: 80, message: 300, button: 30, privacy: 300 };
export const defaultLeadForm = (pages: number): LeadForm => ({
  enabled: true,
  page: Math.min(Math.max(2, 3), Math.max(1, pages)),
  title: "Keep reading",
  message: "Leave your email to see the rest, and we'll be in touch.",
  button: "Continue reading",
  fields: { name: "optional" },
  skippable: false,
});
export function readableLeadForm(value: unknown, pages: number): LeadForm | null {
  if (!value || typeof value !== "object") return null;
  const f = value as LeadForm;
  const text = (v: unknown, max: number) => v === undefined || (typeof v === "string" && v.length <= max);
  if (typeof f.enabled !== "boolean" || typeof f.skippable !== "boolean") return null;
  if (!Number.isInteger(f.page) || f.page < 1 || f.page > Math.max(1, pages)) return null;
  if (typeof f.title !== "string" || f.title.length > LEAD_LIMITS.title || !text(f.message, LEAD_LIMITS.message) || !text(f.button, LEAD_LIMITS.button) || !text(f.privacy, LEAD_LIMITS.privacy)) return null;
  if (!f.fields || typeof f.fields !== "object" || Object.entries(f.fields).some(([k, v]) => !LEAD_FIELDS.some((x) => x.id === k) || (v !== "optional" && v !== "required"))) return null;
  return f;
}
export type LeadAnswers = { email: string } & Partial<Record<LeadFieldId, string>>;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
/** What's wrong with a reader's answers, or null when they can be sent. */
export function leadProblem(form: Pick<LeadForm, "fields">, answers: LeadAnswers): string | null {
  if (!EMAIL.test(answers.email?.trim() ?? "") || answers.email.length > 254) return "Enter your email address.";
  for (const f of LEAD_FIELDS) {
    const value = answers[f.id]?.trim() ?? "";
    if (form.fields[f.id] === "required" && !value) return `Enter your ${f.label.toLowerCase()}.`;
    if (value.length > f.max) return `Keep your ${f.label.toLowerCase()} shorter.`;
  }
  return null;
}
/** Leads as a CSV file (spreadsheet-safe: a cell can't start a formula). */
export function leadsCsv(leads: Array<{ created_at: string; name: string | null; email: string; phone: string | null; company: string | null; message: string | null; page: number | null; country: string | null }>): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) => [l.created_at, l.name, l.email, l.phone, l.company, l.message, l.page, l.country].map(cell).join(","));
  return ["Date,Name,Email,Phone,Company,Message,Page,Country", ...rows].join("\r\n");
}
