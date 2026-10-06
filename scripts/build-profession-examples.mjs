import fs from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from 'pdf-lib';
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
// Development-only generator. No runtime image or PDF generation service.
const dir = new URL('../public/examples/', import.meta.url);
const C = (hex) => rgb(...hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255));
const paper=C('F4F1E9'), ink=C('26352F'), muted=C('718076'), accent=C('A6523D');
const photoSource = process.argv[2];
if (photoSource) {
 const image=await loadImage(photoSource), canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);
 await fs.writeFile(new URL('quiet-coast.jpg',dir),canvas.toBuffer('image/jpeg',85));
}
async function make(kind) {
 const doc=await PDFDocument.create();
 const regular=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold), serif=await doc.embedFont(StandardFonts.TimesRoman);
 const title={architecture:'A place to pause', 'graphic-design':'Fieldnotes',photography:'Quiet coast'}[kind];
 doc.setTitle(`${title} — Portfolia demonstration`);doc.setAuthor('Portfolia');doc.setSubject(kind==='photography'?'Fictional demonstration portfolio with AI-generated imagery':'Original fictional demonstration portfolio');
 let p;
 const text=(t,x,y,size=12,font=regular,color=ink)=>p.drawText(t,{x,y,size,font,color});
 const rect=(x,y,width,height,color=ink)=>p.drawRectangle({x,y,width,height,color});
 const line=(a,b,color=ink,width=1)=>p.drawLine({start:{x:a[0],y:a[1]},end:{x:b[0],y:b[1]},color,thickness:width});
 const page=(n,heading)=>{p=doc.addPage([600,760]);rect(0,0,600,760,paper);text('PORTFOLIA / DEMONSTRATION',42,720,9,bold,muted);line([42,705],[558,705],muted,.5);text(String(n).padStart(2,'0'),535,28,9,regular,muted);text(heading,42,28,9,regular,muted);return p;};
 const para=(lines,x,y,size=13)=>lines.forEach((s,i)=>text(s,x,y-i*21,size));
 if(kind==='architecture') {
 const iso=(x,y,z)=>[300+x*1.05-y*.65,220+x*.38+y*.6+z];
 const edge=(a,b,c=ink,w=1)=>line(iso(...a),iso(...b),c,w);
 page(1,'ARCHITECTURE / CONCEPT STUDY');text('A place',42,625,62,serif);text('to pause.',42,562,62,serif);text('A small reading pavilion in a fictional garden.',44,520,13);
 for(let y=0;y<=150;y+=15)edge([-135,y,0],[110,y,0],muted,.4);
 for(let x=-100;x<=100;x+=40){edge([x,10,0],[x,10,140]);edge([x,130,0],[x,130,140]);}
 for(const z of [0,140]){edge([-100,10,z],[100,10,z]);edge([100,10,z],[100,130,z]);edge([100,130,z],[-100,130,z]);edge([-100,130,z],[-100,10,z]);}
 edge([-120,0,150],[120,0,150],accent,2);edge([120,0,150],[120,145,150],accent,2);edge([120,145,150],[-120,145,150],accent,2);edge([-120,145,150],[-120,0,150],accent,2);
 text('Original illustrative drawings. Not a built project.',42,76,10,regular,muted);
 page(2,'01 / BRIEF');text('Space for a slower day.',42,633,36,serif);para(['A sheltered place to read, meet and look out.','The concept uses a simple structural rhythm','and two open edges to connect with the garden.'],42,570);text('DESIGN QUESTIONS',42,440,10,bold,accent);para(['01  Where does a visitor arrive?','02  How does daylight cross the room?','03  Which views should remain uninterrupted?'],42,402);rect(42,120,516,140,C('DFE4D8'));text('A portfolio can show the question',66,208,22,serif);text('as clearly as the finished drawing.',66,176,22,serif);
 page(3,'02 / PLAN');text('An open edge.',42,633,38,serif);text('Schematic plan / illustrative, not for construction',42,594,11,regular,muted);
 for(let x=100;x<=500;x+=80){rect(x,200,5,290,ink);}line([100,200],[505,200],ink,3);line([100,490],[505,490],ink,3);rect(135,235,38,210,C('C8CEBC'));rect(225,310,170,55,C('C8CEBC'));text('READING TABLE',237,330,10);text('GARDEN',245,535,11,bold,accent);line([300,510],[300,575],accent);para(['A quiet service edge supports a generous shared room.','An uninterrupted opening faces the garden.'],42,120,12);
 page(4,'03 / SECTION');text('Light, held lightly.',42,633,38,serif);text('Schematic section / illustrative, not for construction',42,594,11,regular,muted);
 rect(68,230,464,8,ink);rect(95,238,6,220,ink);rect(495,238,6,220,ink);rect(72,455,452,12,accent);rect(200,298,155,7,ink);rect(213,238,5,60,ink);rect(337,238,5,60,ink);
 for(let x=135;x<460;x+=85)line([x,448],[x+60,335],C('B2B995'),1);
 para(['A deep canopy softens the threshold.','A clear span keeps the interior adaptable.'],42,137,13);
 page(5,'04 / MATERIAL STUDY');text('A restrained palette.',42,633,38,serif);
 [C('B8A588'),C('CFD2C6'),C('A6523D')].forEach((c,i)=>{rect(42+i*178,333,158,190,c);text(['TIMBER','MINERAL','METAL'][i],42+i*178,310,10,bold);});para(['Material notes are presented alongside the drawings','to connect a visual idea with its intended atmosphere.'],42,236);
 page(6,'05 / REFLECTION');text('Make the thinking visible.',42,633,36,serif);para(['A concise project story brings together the brief,','a plan, a section and a material direction.','In your own portfolio, identify your role and credit','collaborators wherever work was produced as a team.'],42,552);text('ABOUT THIS EXAMPLE',42,342,10,bold,accent);para(['Created by Portfolia to demonstrate its PDF reader.','This is a fictional, schematic design study.','It is not a customer portfolio or technical guidance.'],42,305,12);
 } else if(kind==='graphic-design') {
 const orange=C('B95035'), dark=C('233C31');
 const mark=(x,y,r,c)=>{for(let i=0;i<4;i++)p.drawCircle({x:x+(i%2)*r,y:y+Math.floor(i/2)*r,size:r*.43,color:c});};
 page(1,'GRAPHIC DESIGN / FICTIONAL IDENTITY');rect(42,180,516,320,dark);mark(360,260,86,paper);text('Fieldnotes',42,611,67,serif);text('An identity for a fictional independent journal.',44,563,13);text('Identity / Typography / Editorial',42,113,13);text('Original demonstration work by Portfolia.',42,77,10,regular,muted);
 page(2,'01 / DIRECTION');text('Observe. Collect. Share.',42,630,40,serif);para(['Fieldnotes is a fictional journal about everyday','places and the people who notice them.','The identity pairs a four-part collecting mark','with generous typography and a warm palette.'],42,558);text('THREE DESIGN PRINCIPLES',42,384,10,bold,orange);para(['01  A recognisable mark at small sizes.','02  Clear hierarchy for long-form reading.','03  Enough space for photography to breathe.'],42,341);
 page(3,'02 / IDENTITY');text('A system of four.',42,633,42,serif);mark(175,300,140,dark);mark(425,323,45,orange);text('PRIMARY MARK',42,177,10,bold);para(['A modular shape brings four observations together.','The smaller variation keeps the same proportions.'],42,141,12);
 page(4,'03 / TYPOGRAPHY');text('Letters with room.',42,633,42,serif);text('Aa Bb Cc',42,510,69,serif);text('0123456789',44,443,36,regular);line([42,393],[558,393],muted,.5);text('THE SMALL THINGS',42,342,10,bold,orange);text('A walk becomes a story.',42,294,29,serif);para(['A clear heading, a short introduction, a little space.','Hierarchy makes a page inviting before it is read.'],42,242,12);
 page(5,'04 / APPLICATION');rect(42,150,246,490,dark);text('Fieldnotes',61,576,37,serif,paper);mark(109,276,66,paper);text('ISSUE 01 / NEARBY',61,178,9,bold,paper);rect(309,305,249,335,orange);text('Look',330,564,48,serif,paper);text('closer.',330,511,48,serif,paper);text('AN EVERYDAY JOURNAL',330,330,9,bold,paper);text('Editorial cover and campaign study',310,246,11);
 page(6,'05 / THE PROJECT STORY');text('Show more than a mark.',42,633,38,serif);para(['An identity portfolio benefits from showing the brief,','the visual system and its use at different scales.','Explain the decisions that connect these stages.'],42,556);text('ABOUT THIS EXAMPLE',42,365,10,bold,orange);para(['Created by Portfolia for demonstration purposes.','Fieldnotes is a fictional brief, not a client project.','All layouts and geometric artwork are original.'],42,322,12);
 } else {
 const img=await doc.embedJpg(await fs.readFile(new URL('quiet-coast.jpg',dir)));
 const photo=(panel,x,y,w,h)=>{p.pushOperators(pushGraphicsState(),rectangle(x,y,w,h),clip(),endPath());const scale=Math.max(w/(img.width/3),h/img.height);p.drawImage(img,{x:x-panel*img.width/3*scale,y:y+(h-img.height*scale)/2,width:img.width*scale,height:img.height*scale});p.pushOperators(popGraphicsState());};
 page(1,'PHOTOGRAPHY / AI-ILLUSTRATED DEMONSTRATION');text('Quiet coast',42,632,61,serif);text('A study in distance, surface and light.',44,584,13);photo(0,42,135,516,400);text('AI-generated imagery. Not a photographer’s commissioned work.',42,78,10,regular,muted);
 page(2,'01 / THE EDIT');text('Three ways of looking.',42,632,38,serif);para(['A wide view establishes a place.','A close detail changes the pace.','A foreground gives depth to the closing frame.'],42,561);for(let i=0;i<3;i++)photo(i,42+i*178,190,158,250);text('DISTANCE',42,162,9,bold);text('SURFACE',220,162,9,bold);text('LIGHT',398,162,9,bold);
 for(let i=0;i<3;i++){page(i+3,`${String(i+2).padStart(2,'0')} / ${['DISTANCE','SURFACE','LIGHT'][i]}`);photo(i,42,124,516,548);text(['A line between sea and sky.','Texture changes the scale.','Light gives the sequence its ending.'][i],42,83,14,serif);}
 page(6,'05 / SEQUENCING');text('Let the edit breathe.',42,633,42,serif);para(['A photography portfolio can be short and deliberate.','Choose images that work together, vary the scale','and leave enough space to make the sequence clear.'],42,552);text('ABOUT THESE IMAGES',42,360,10,bold,accent);para(['This fictional demonstration uses AI-generated coastal','imagery created for Portfolia. It is not a real shoot,','customer portfolio or claim of photographic authorship.'],42,316,12);
 }
 await fs.writeFile(new URL(`${kind}.pdf`,dir),await doc.save());
}
for(const kind of ['architecture','graphic-design','photography'])await make(kind);
globalThis.DOMMatrix=DOMMatrix;globalThis.ImageData=ImageData;globalThis.Path2D=Path2D;
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
for(const kind of ['architecture','graphic-design','photography']){
 const doc=await pdfjs.getDocument({data:new Uint8Array(await fs.readFile(new URL(`${kind}.pdf`,dir))),standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname}).promise;
 const page=await doc.getPage(1),viewport=page.getViewport({scale:1.2}),canvas=createCanvas(viewport.width,viewport.height);
 await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 await fs.writeFile(new URL(`${kind}-cover.webp`,dir),canvas.toBuffer('image/webp',82));
 const social=createCanvas(1200,630),ctx=social.getContext('2d');ctx.fillStyle='#e9e8df';ctx.fillRect(0,0,1200,630);ctx.fillStyle='#26352f';ctx.font='26px sans-serif';ctx.fillText('PORTFOLIA',64,100);ctx.font='48px serif';const label={'architecture':['Architecture','portfolios.'],'graphic-design':['Graphic design','portfolios.'],photography:['Photography','portfolios.']}[kind];label.forEach((t,i)=>ctx.fillText(t,64,250+i*60));ctx.font='22px sans-serif';ctx.fillText('Your PDF. One beautiful link.',64,425);ctx.font='17px sans-serif';ctx.fillText('Explore a clearly labelled demonstration.',64,472);ctx.drawImage(canvas,750,54,412,522);await fs.writeFile(new URL(`${kind}-social.jpg`,dir),social.toBuffer('image/jpeg',85));
 await doc.destroy();
}
