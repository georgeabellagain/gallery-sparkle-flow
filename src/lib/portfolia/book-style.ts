import { readableTurnCurve, type TurnCurve } from "./turn-curve";
export const BOOK_STYLES = [
  {id:"flipbook",label:"Flipbook",description:"Loose sheets with no visible binding.",overhang:0,board:0,stack:0,spine:0,colour:"#ffffff"},
  {id:"softcover",label:"Soft cover",description:"A flexible card cover, fine page edges and a slim spine.",overhang:.006,board:.003,stack:.012,spine:.009,colour:"#c6b59b"},
  {id:"hardback",label:"Hardback",description:"Rigid boards in your cover's colours that open like a real book.",overhang:.014,board:.014,stack:.020,spine:.022,colour:"#293b49"},
] as const;
export type BookStyle = typeof BOOK_STYLES[number]["id"];
export function readableBookStyle(value:unknown):BookStyle {return value === "softcover" || value === "hardback" ? value : "flipbook";}
export function bookStyleProfile(value:unknown){return BOOK_STYLES.find(style=>style.id===readableBookStyle(value))!;}
/** Rigid and card covers open more flatly; interior paper retains the creator's curve. */
export function bindingTurnCurve(style:unknown,curve:unknown,from:readonly unknown[],to:readonly unknown[]):TurnCurve {
  const closed=(faces:readonly unknown[])=>faces.filter(Boolean).length===1;
  return readableBookStyle(style)!=="flipbook" && (closed(from)||closed(to)) ? "firm" : readableTurnCurve(curve);
}
