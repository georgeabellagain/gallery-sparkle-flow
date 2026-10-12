import React from 'react';
import {createRoot} from 'react-dom/client';
import {FeatureAnimation, type FeatureId} from '../src/components/pf/FeatureAnimation';
import '../src/styles.css';
const feature=new URLSearchParams(location.search).get('feature') as FeatureId;
const ready=(value:boolean)=>{document.documentElement.dataset.ready=String(value);};
const error=()=>{document.documentElement.dataset.error='true';};
function Capture(){const [playing,setPlaying]=React.useState(false); (window as any).startCapture=()=>setPlaying(true); return <div style={{position:'relative',width:'100vw',height:'100vh',background:'#10162e'}}><FeatureAnimation url="/capture/featured.pdf" feature={feature} playing={playing} live onReady={ready} onError={error}/></div>; }
createRoot(document.getElementById('root')!).render(<Capture/>);
