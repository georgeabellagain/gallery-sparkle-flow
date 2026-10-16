/** Small deterministic edge irregularity; paired faces share one physical sheet.
 * UVs stay unchanged and the spine stays anchored. No extra geometry is needed. */
export function paperEdge(d:number,v:number,seed:number,crumpled=false) {
  if(!crumpled)return {d,v};
  const phase=Math.max(0,Math.floor((seed-1)/2))*1.731;
  const outer=Math.pow(d,7), rim=Math.pow(2*v-1,9);
  return {
    d:d+.002*d*(v-.5)+outer*(.003*Math.sin(v*17+phase)+.0012*Math.sin(v*39-phase)),
    v:v+.0028*d*d*rim*Math.sin(d*13+phase+.4),
  };
}
