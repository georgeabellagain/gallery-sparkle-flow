import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LEAD_FIELDS, leadProblem, type LeadAnswers, type LeadForm } from "@/lib/portfolia/lead-form";
import { submitLead } from "@/lib/portfolia/leads.functions";

const remembered = (code: string) => {
  try { return localStorage.getItem(`pf-lead:${code}`) === "sent" || sessionStorage.getItem(`pf-lead:${code}`) === "skipped"; } catch { return false; }
};

/**
 * A portfolio's lead form: once the reader reaches its page, it covers the reader until they leave their details
 * (or skip, when the creator allows it). Someone who has already sent their details is never asked again on this
 * device. `preview` shows it in the editor without sending anything.
 */
export function LeadGate({ form, code, page, preview = false, onClose }: { form: LeadForm; code: string; page: number; preview?: boolean; onClose?: () => void }) {
  const [done, setDone] = useState(() => !preview && remembered(code));
  const [answers, setAnswers] = useState<LeadAnswers>({ email: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { if (!preview) setDone(remembered(code)); }, [code, preview]);
  if (done || !form.enabled || (!preview && page < form.page)) return null;
  const close = (how: "sent" | "skipped") => {
    if (!preview) {
      try { (how === "sent" ? localStorage : sessionStorage).setItem(`pf-lead:${code}`, how); } catch { /* asked again next time */ }
    }
    setDone(true);
    onClose?.();
  };
  const send = async () => {
    const problem = leadProblem(form, answers);
    if (problem) return setError(problem);
    if (preview) return close("sent");
    setError(""); setSending(true);
    try {
      const result = await submitLead({ data: { code, page, answers } });
      if (result.ok) close("sent");
      else setError(result.message);
    } catch {
      setError("Your details couldn't be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };
  const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-900";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="pf-lead-title" className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md">
      <form className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 text-slate-900 shadow-2xl" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <h2 id="pf-lead-title" className="text-xl font-semibold tracking-tight">{form.title}</h2>
        {form.message && <p className="text-sm leading-relaxed text-slate-600">{form.message}</p>}
        {LEAD_FIELDS.filter((f) => f.id === "name" && form.fields.name).map((f) => (
          <label key={f.id} className="block text-xs font-medium text-slate-600">{f.label}{form.fields[f.id] === "optional" && <span className="font-normal text-slate-400"> (optional)</span>}
            <input className={input} autoComplete="name" maxLength={f.max} value={answers.name ?? ""} onChange={(e) => setAnswers({ ...answers, name: e.target.value })} required={form.fields.name === "required"} />
          </label>
        ))}
        <label className="block text-xs font-medium text-slate-600">Email
          <input className={input} type="email" autoComplete="email" inputMode="email" maxLength={254} value={answers.email} onChange={(e) => setAnswers({ ...answers, email: e.target.value })} required />
        </label>
        {LEAD_FIELDS.filter((f) => f.id !== "name" && form.fields[f.id]).map((f) => (
          <label key={f.id} className="block text-xs font-medium text-slate-600">{f.label}{form.fields[f.id] === "optional" && <span className="font-normal text-slate-400"> (optional)</span>}
            {f.id === "message"
              ? <textarea className={input} rows={3} maxLength={f.max} value={answers.message ?? ""} onChange={(e) => setAnswers({ ...answers, message: e.target.value })} required={form.fields.message === "required"} />
              : <input className={input} type={f.id === "phone" ? "tel" : "text"} autoComplete={f.id === "phone" ? "tel" : "organization"} maxLength={f.max} value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} required={form.fields[f.id] === "required"} />}
          </label>
        ))}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={sending} className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
          {sending ? "Sending…" : form.button || "Continue reading"}
        </button>
        {form.skippable && <button type="button" onClick={() => close("skipped")} className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:underline">Not now</button>}
        {form.privacy && <p className="text-center text-[11px] leading-relaxed text-slate-400">{form.privacy}</p>}
        {preview && <p className="text-center text-[11px] text-slate-400">Preview: nothing is sent.</p>}
      </form>
    </div>,
    document.body,
  );
}
