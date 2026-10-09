import { foldoutKeys } from "./foldouts";
import { allAnalyticsEvents } from "./analytics";
import { migrateDraftFiles } from "./sync-files";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getBlob, setCloudUser, uploadToCloud } from "./assets";
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
const pendingDeletes = new Set<string>();
let pushing: Promise<void> | null = null;
let pushAgain = false;
/** Mark a portfolio for removal from the account on the next sync. */
export function markPortfolioDeleted(code: string) {
  pendingDeletes.add(code);
}

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
  if (pushing) { pushAgain = true; return pushing; }
  pushing = pushOnce();
  try { await pushing; }
  finally {
    pushing = null;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  }
}

async function pushOnce() {
  const uid = userId;
  if (!uid) return;
  const list = allPortfolios(getDoc());
  const codes = new Set(list.map((p) => p.code));
  try {
    for (const p of list) {
      if (userId !== uid) return;
      if (!p.synced) await migrateDraftFiles(fileKeys(p), getBlob, (key, blob) => uploadToCloud(key, blob, uid));
      if (userId !== uid) return;
      const savedPortfolio = { ...p, synced: true };
      const json = JSON.stringify(savedPortfolio);
      if (pushed.get(p.code) === json) continue;
      const { error } = await supabase.from("portfolios").upsert({
        code: p.code,
        owner_id: uid,
        username: p.username ?? null,
        status: p.status,
        search_indexing: Boolean(p.searchIndexing),
        data: savedPortfolio as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        const taken = error.code === "23505";
        throw new Error(taken ? "That personalised address is already used by someone else. Choose another name." : "Couldn’t save to your account.");
      }
      const { error: domainDeleteError } = await supabase.from("portfolio_domains").delete().eq("portfolio_code", p.code);
      if (domainDeleteError) throw new Error("Couldn’t save your domains. Please try again.");
      const domains = p.domains ?? [];
      if (domains.length) {
        const { error: dErr } = await supabase.from("portfolio_domains").insert(domains.map((d) => ({ name: d.name, owner_id: uid, portfolio_code: p.code, kind: d.kind })));
        if (dErr) throw new Error(dErr.code === "23505" ? "One of your domains is already connected to another account." : "Couldn’t save your domains.");
      }
      if (userId !== uid) return;
      pushed.set(p.code, json);
      if (!p.synced) {
        // Only update this flag after the files and metadata have reached the
        // account. Preserve edits made while the request was in flight.
        const current = structuredClone(getDoc());
        const saved = allPortfolios(current).find(item => item.code === p.code);
        if (saved) { saved.synced = true; replaceDoc(current); }
      }
    }
    // Only portfolios the owner explicitly deleted are removed online; a missing local copy never deletes.
    for (const code of [...pendingDeletes]) {
      if (codes.has(code)) { pendingDeletes.delete(code); continue; }
      const { error } = await supabase.from("portfolios").delete().eq("code", code);
      if (error) throw new Error("Couldn’t remove that portfolio from your account. Please try again.");
      pushed.delete(code); pendingDeletes.delete(code);
    }
    if (userId === uid) setStatus("saved");
  } catch (e) {
    if (userId === uid) setStatus("error", e instanceof Error ? e.message : "Couldn’t save to your account.");
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
  if (userId !== uid) return;
  const cloud = new Map((data ?? []).map((r) => [r.code, r.data as unknown as Portfolio]));
  pushed = new Map([...cloud].map(([c, p]) => [c, JSON.stringify(p)]));

  const local = getDoc();
  // Browser-only portfolios (never synced) are moved into the account.
  const toMove = allPortfolios(local).filter((p) => !cloud.has(p.code) && !p.synced);
  const list: Portfolio[] = [...toMove, ...cloud.values()];
  let analytics: Map<string, Analytics>;
  try { analytics = await loadAnalytics(list.map((p) => p.code)); }
  catch (error) { setStatus("error", error instanceof Error ? error.message : "Couldn’t load visit statistics. Please refresh."); return; }
  if (userId !== uid) return;
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
  setCommitHook(() => {
    if (!userId) return;
    schedulePush();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || (!id && userId)) {
      userId = null;
      setCloudUser(null);
      pushed = new Map();
      pendingDeletes.clear();
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

