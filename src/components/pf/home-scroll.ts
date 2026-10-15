import {createContext} from "react";

/** Only the homepage reader releases downward wheel input at its fitted size. */
export const HomeScrollContext=createContext(false);
export const releaseHomeScroll=(home:boolean,fullscreen:boolean,zoom:number,deltaY:number)=>home&&!fullscreen&&deltaY>0&&zoom<=1.001;
