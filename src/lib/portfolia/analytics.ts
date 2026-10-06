import type { Analytics, Doc } from './store';
export function portfolioAnalytics(doc: Doc, code: string): Analytics {
  return doc.portfolio?.code === code ? doc.analytics : doc.others.find(o=>o.portfolio.code===code)?.analytics ?? {visits:[],downloads:[]};
}
export function totalAnalytics(doc: Doc): Analytics {
  const entries = [...(doc.portfolio ? [{portfolio:doc.portfolio,analytics:doc.analytics}] : []),...doc.others];
  const seen=new Set<string>();const total:Analytics={visits:[],downloads:[]};
  for(const entry of entries){if(seen.has(entry.portfolio.code))continue;seen.add(entry.portfolio.code);total.visits = total.visits.concat(entry.analytics.visits);total.downloads = total.downloads.concat(entry.analytics.downloads);}
  return total;
}
export interface AnalyticsEvent { portfolio_code:string; kind:string; visitor:string|null; created_at:string }
/** Supabase caps result sets; read all stable, ordered batches rather than claiming a capped total. */
export async function allAnalyticsEvents(fetchPage:(from:number,to:number)=>PromiseLike<{data:AnalyticsEvent[]|null;error:unknown}>):Promise<AnalyticsEvent[]> {
  const events:AnalyticsEvent[]=[];
  for(let offset=0;;offset+=1000){const {data,error}=await fetchPage(offset,offset+999);if(error)throw new Error('Could not load visit statistics. Please refresh to try again.');events.push(...(data??[]));if(!data||data.length<1000)return events;}
}
