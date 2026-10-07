import { foldoutKeys } from "./foldouts";
import { allAnalyticsEvents } from "./analytics";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getLocalBlob, setCloudUser, uploadToCloud } from "./assets";
import { allPortfolios, getDoc, replaceDoc, resetAll, setCommitHook, type Analytics, type Doc, type Portfolio } from "./store";

/**
 * Keeps the browser copy of portfolios in step with the signed-in account.
 * Pull on sign-in, push every change (debounced), clear the browser copy on sign-out.
 */

type Status = "idle" | "saving" | "saved" | "error";
let status: Status = "idle";
let statusMsg = "";
const statusListeners = new Set<() => void>();
function setStatus(s: Status, msg = "") {
  status = s;
  statusMsg = msg;
  statusListeners.forEach((l) => l());
}
export function useSyncStatus() {
  const s = useSyncExternalStore(
    (l) => (statusListeners.add(l), () => statusListeners.delete(l)),
    () => status,
    () => "idle" as Status,
  );
  return { status: s, message: statusMsg };
}

let userId: string | null = null;
let started = false;
/** JSON of each portfolio as last stored in the cloud, by code. */
let pushed = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function fileKeys(p: Portfolio): string[] {
  return [p.pdf?.blobKey, p.pdf?.coverKey, p.profile.photoKey, p.profile.cv?.blobKey, p.style?.bannerKey, p.viewer?.backgroundKey, ...foldoutKeys(p.pdf)].filter(Boolean) as string[];
}

function schedulePush() {
  if (!userId) return;
  if (timer) clearTimeout(timer);
  setStatus("saving");
  timer = setTimeout(() => void push(), 600);
}

export function retrySync() {
  schedulePush();
}

async function push() {
  const uid = userId;
  if (!uid) return;
  const list = allPortfolios(getDoc());
  const codes = new Set(list.map((p) => p.code));
  try {
    for (const p of list) {
      const json = JSON.stringify(p);
      if (pushed.get(p.code) === json) continue;
      const { error } = await supabase.from("portfolios").upsert({
        code: p.code,
        owner_id: uid,
        username: p.username ?? null,
        status: p.status,
        search_indexing: Boolean(p.searchIndexing),
        data: p as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        const taken = error.code === "23505";
        throw new Error(taken ? "That personalised address is already used by someone else. Choose another name." : "Couldn’t save to your account.");
      }
      await supabase.from("portfolio_domains").delete().eq("portfolio_code", p.code);
      const domains = p.domains ?? [];
      if (domains.length) {
        const { error: dErr } = await supabase.from("portfolio_domains").insert(domains.map((d) => ({ name: d.name, owner_id: uid, portfolio_code: p.code, kind: d.kind })));
        if (dErr) throw new Error(dErr.code === "23505" ? "One of your domains is already connected to another account." : "Couldn’t save your domains.");
      }
      pushed.set(p.code, json);
    }
    for (const code of [...pushed.keys()]) {
      if (codes.has(code)) continue;
      const { error } = await supabase.from("portfolios").delete().eq("code", code);
      if (!error) pushed.delete(code);
    }
    setStatus("saved");
  } catch (e) {
    setStatus("error", e instanceof Error ? e.message : "Couldn’t save to your account.");
  }
}

async function loadAnalytics(codes: string[]): Promise<Map<string, Analytics>> {
  const out = new Map<string, Analytics>(codes.map((c) => [c, { visits: [], downloads: [] }]));
  if (!codes.length) return out;
  const asOf = new Date().toISOString();
  const data = await allAnalyticsEvents((from, to) => supabase.from("portfolio_events").select("portfolio_code, kind, visitor, created_at").in("portfolio_code", codes).lte("created_at", asOf).order("created_at").order("id").range(from, to));
  for (const e of data ?? []) {
    const a = out.get(e.portfolio_code);
    const t = Date.parse(e.created_at);
    if (!a) continue;
    if (e.kind === "visit") a.visits.push({ t, v: e.visitor ?? "unknown" });
    else a.downloads.push(t);
  }
  return out;
}

/** Load the account's portfolios, moving any browser-only drafts into the account. */
async function pull(uid: string) {
  setStatus("saving");
  const { data, error } = await supabase.from("portfolios").select("code, data").eq("owner_id", uid);
  if (error) return setStatus("error", "Couldn’t load your portfolios. Please refresh to try again.");
  const cloud = new Map((data ?? []).map((r) => [r.code, r.data as unknown as Portfolio]));
  pushed = new Map([...cloud].map(([c, p]) => [c, JSON.stringify(p)]));

  const local = getDoc();
  // Browser-only portfolios (never synced) are moved into the account.
  const toMove = allPortfolios(local).filter((p) => !cloud.has(p.code) && !p.synced);
  for (const p of toMove) {
    for (const key of fileKeys(p)) {
      const blob = await getLocalBlob(key);
      if (blob) await uploadToCloud(key, blob).catch(() => {});
    }
  }
  const list: Portfolio[] = [...toMove.map((p) => ({ ...p, synced: true })), ...cloud.values()];
  let analytics: Map<string, Analytics>;
  try { analytics = await loadAnalytics(list.map((p) => p.code)); }
  catch (error) { setStatus("error", error instanceof Error ? error.message : "Couldn’t load visit statistics. Please refresh."); return; }
  const activeCode = local.portfolio && list.some((p) => p.code === local.portfolio!.code) ? local.portfolio.code : list[0]?.code;
  const active = list.find((p) => p.code === activeCode) ?? null;
  const next: Doc = {
    ...local,
    account: { signedIn: true },
    portfolio: active,
    analytics: active ? analytics.get(active.code)! : { visits: [], downloads: [] },
    others: list.filter((p) => p !== active).map((p) => ({ portfolio: p, analytics: analytics.get(p.code)! })),
  };
  replaceDoc(next);
  if (toMove.length) void push();
  else setStatus("saved");
}

export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  setCommitHook((d) => {
    if (!userId) return;
    // Mark new portfolios as belonging to the account.
    if (allPortfolios(d).some((p) => !p.synced)) {
      for (const p of allPortfolios(d)) p.synced = true;
    }
    schedulePush();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || (!id && userId)) {
      userId = null;
      setCloudUser(null);
      pushed = new Map();
      resetAll(); // the browser copy belongs to the account; nothing is lost online
      setStatus("idle");
      return;
    }
    if (id && id !== userId) {
      userId = id;
      setCloudUser(id);
      void pull(id);
    }
  });
}

