import { readableTurnCurve, type TurnCurve } from "./turn-curve";
export const BOOK_STYLES = [
  {id:"flipbook",label:"Flipbook",description:"Floating sheets with no visible binding.",overhang:0,board:0,stack:0,spine:0,colour:"#ffffff"},
  {id:"softcover",label:"Soft cover",description:"A slim flexible cover, fine page edges and a narrow spine.",overhang:.006,board:.003,stack:.012,spine:.009,colour:"#c6b59b"},
  {id:"hardback",label:"Hardback",description:"Raised covers matching your PDF, a rounded spine and rigid cover turns.",overhang:.022,board:.018,stack:.026,spine:.029,colour:"#293b49"},
] as const;
export type BookStyle = typeof BOOK_STYLES[number]["id"];
export function readableBookStyle(value:unknown):BookStyle {return value === "softcover" || value === "hardback" ? value : "flipbook";}
export function bookStyleProfile(value:unknown){return BOOK_STYLES.find(style=>style.id===readableBookStyle(value))!;}
/** Rigid covers open more flatly; interior paper retains the creator's curve. */
export function bindingTurnCurve(style:unknown,curve:unknown,from:readonly unknown[],to:readonly unknown[]):TurnCurve {
  const closed=(faces:readonly unknown[])=>faces.filter(Boolean).length===1;
  return readableBookStyle(style)==="hardback" && (closed(from)||closed(to)) ? "firm" : readableTurnCurve(curve);
}
