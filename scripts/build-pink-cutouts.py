"""Original-pixel cutout animation. No displacement fields, image synthesis or mesh warps.
Coordinates use a 640px page. Layers only translate/rotate; blinks use discrete eyelid poses.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import fitz,numpy as np,cv2,math,json,hashlib
import argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('pdf',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
S=1.5; N=960; FRAMES=60; OUT=args.output; OUT.mkdir(parents=True,exist_ok=True)
QA=OUT/'qa'; QA.mkdir(exist_ok=True)
DOC=fitz.open(args.pdf)
def mask_poly(points):
 m=Image.new('L',(N,N));ImageDraw.Draw(m).polygon([(round(x*S),round(y*S)) for x,y in points],fill=255);return m
def rect(box):
 x,y,r,b=box;return [(x,y),(r,y),(r,b),(x,b)]
def smooth(t):return .5-.5*math.cos(t)
class Scene:
 def __init__(self,p):
  self.p=p;pix=DOC[p-1].get_pixmap(matrix=fitz.Matrix(N/1080,N/1080),alpha=False)
  self.src=Image.frombytes('RGB',(N,N),pix.samples);self.base=self.src.copy();self.layers=[]
  self.bg=tuple(np.median(np.asarray(self.src)[0:30,0:30],axis=(0,1)).astype('uint8'))
 def cut(self,name,poly,flat=False,feather=0):
  m=mask_poly(poly);a=np.array(m)
  if flat:
   delta=np.max(np.abs(np.array(self.src).astype(float)-np.array(self.bg)),axis=2)
   a=np.minimum(a,np.clip((delta-3)/9*255,0,255).astype('uint8'))
   m=Image.fromarray(a)
  if feather:m=m.filter(ImageFilter.GaussianBlur(feather*S))
  sprite=self.src.convert('RGBA');sprite.putalpha(m)
  if flat:
   # Restore the exact flat page behind the moving cutout; no re-drawing of artwork.
   self.base.paste(Image.new('RGB',(N,N),self.bg),mask=Image.fromarray(cv2.dilate(a,np.ones((3,3),np.uint8))))
  else:
   # Reconstruct only newly exposed pixels; surrounding pixels remain original.
   remove=cv2.dilate((a>4).astype('uint8')*255,np.ones((3,3),np.uint8))
   repaired=cv2.inpaint(np.asarray(self.base),remove,4,cv2.INPAINT_TELEA)
   self.base=Image.fromarray(repaired)
  self.layers.append((name,sprite));return sprite
 def draw(self,img,sprite,dx=0,dy=0,angle=0,pivot=(320,320),opacity=1):
  if angle:sprite=sprite.rotate(angle,resample=Image.Resampling.BICUBIC,center=(pivot[0]*S,pivot[1]*S))
  if opacity!=1:
   sprite=sprite.copy();sprite.putalpha(sprite.getchannel('A').point(lambda a:round(a*opacity)))
  img.alpha_composite(sprite,(round(dx*S),round(dy*S)))
 def save(self,animate):
  frames=[];union=np.zeros((N,N),dtype=bool);src=np.asarray(self.src).astype(int)
  for i in range(FRAMES):
   t=i/FRAMES*2*math.pi;f=animate(t).convert('RGB');a=np.array(f);union|=np.max(abs(a.astype(int)-src),axis=2)>2;frames.append(f)
  yy,xx=np.where(union);pad=5;box=(max(0,int(xx.min())-pad),max(0,int(yy.min())-pad),min(N,int(xx.max())+pad+1),min(N,int(yy.max())+pad+1))
  # A fixed alpha mask across the entire loop avoids flickering edges.
  mask=Image.fromarray(cv2.dilate(union.astype('uint8')*255,np.ones((7,7),np.uint8))).filter(ImageFilter.GaussianBlur(.5))
  out=[]
  for f in frames:
   f=f.convert('RGBA');f.putalpha(mask);out.append(f.crop(box))
  path=OUT/f'pink-page-{self.p:02}.webp';out[0].save(path,save_all=True,append_images=out[1:],lossless=True,duration=50,loop=0,method=4)
  if path.stat().st_size>2097152:
   out[0].save(path,save_all=True,append_images=out[1:],quality=97,alpha_quality=100,duration=50,loop=0,method=4)
  if path.stat().st_size>2097152:
   out[0].save(path,save_all=True,append_images=out[1:],quality=93,alpha_quality=100,duration=50,loop=0,method=4)
  assert path.stat().st_size<=2097152, (self.p,path.stat().st_size)
  x,y,r,b=box;w=r-x;h=b-y;z=max(w,h)
  entry=dict(id=f'pink-page-{self.p:02}',name=path.name,page=self.p,x=(x-(z-w)/2)/N,y=(y-(z-h)/2)/N,size=z/N,sha256=hashlib.sha256(path.read_bytes()).hexdigest())
  # Store full composited QA frames, including the unanimated surroundings.
  for i in [0,15,30,45]:frames[i].resize((640,640),Image.Resampling.LANCZOS).save(QA/f'p{self.p:02}-{i}.png')
  Image.merge('RGB',[mask]*3).resize((640,640)).save(QA/f'mask{self.p:02}.png')
  print(self.p,path.stat().st_size,box,flush=True);return entry
manifest=[]
# 9: the airborne mouse between the top text lines (not either animal on the dog/horse).
s=Scene(9);mouse=s.cut('airborne mouse',rect((365,89,405,131)),True)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,mouse,dy=2.5*math.sin(t));return f
manifest.append(s.save(run))
# 8: brightness changes confined to the yellow glass of the actual bulb, no movement.
s=Scene(8);a=np.array(s.src).astype(float);yy,xx=np.mgrid[:N,:N];x=xx/S;y=yy/S
bulb=(x>147)&(x<208)&(y>181)&(y<257)&(a[:,:,0]>185)&(a[:,:,1]>145)&(a[:,:,2]<195)
weight=np.array(Image.fromarray((bulb*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.1)))/255
def run(t):
 strength=.45*math.sin(t);target=np.array([255,248,174]) if strength>=0 else np.array([211,153,39]);mix=abs(strength)*weight[...,None]
 return Image.fromarray(np.clip(a*(1-mix)+target*mix,0,255).astype('uint8')).convert('RGBA')
manifest.append(s.save(run))
# 6: isolated head nod, separate original Z glyphs drift and fade sequentially.
s=Scene(6);head=s.cut('head',[(354,249),(370,238),(400,237),(421,251),(434,279),(431,327),(418,343),(395,343),(377,340),(355,334),(334,334),(341,312),(342,275)],False,1)
zs=[]
for box in [(439,292,469,322),(449,257,477,295),(474,234,518,274),(481,188,535,231),(505,139,560,202),(549,92,618,172)]:zs.append(s.cut('Z',rect(box),True))
def run(t):
 f=s.base.convert('RGBA');s.draw(f,head,angle=.8*math.sin(t),dy=1.2*math.sin(t),pivot=(391,338))
 for j,z in enumerate(zs):s.draw(f,z,dy=-2*math.sin(t-j*.5),opacity=.3+.7*smooth(t-j*.5))
 return f
manifest.append(s.save(run))
# 7: three balanced groups move independently as solid cutouts.
s=Scene(7)
girl=s.cut('girl',[(141,9),(172,9),(183,48),(180,83),(224,121),(230,137),(207,136),(197,134),(199,151),(226,168),(230,182),(215,185),(190,166),(182,178),(178,157),(147,150),(126,155),(120,145),(129,103),(132,87),(128,73)],True)
upper=s.cut('globe bicycle boat',[(121,143),(145,149),(168,156),(184,167),(187,201),(178,214),(203,213),(243,237),(241,254),(216,247),(208,267),(253,276),(255,292),(224,303),(176,298),(144,281),(130,254),(124,248),(116,285),(100,307),(73,312),(52,300),(44,278),(47,257),(61,241),(71,235),(60,225),(61,214),(91,205),(106,192),(113,174)],True)
bowl=s.cut('bowl and books',[(164,293),(188,302),(211,303),(218,320),(211,340),(201,349),(205,354),(116,374),(108,353),(104,337),(145,326),(152,305),(161,293)],True)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,bowl,angle=.65*math.sin(t),pivot=(159,353));s.draw(f,upper,angle=1.0*math.sin(t+.4),pivot=(179,303));s.draw(f,girl,angle=1.3*math.sin(t+.8),pivot=(163,147));return f
manifest.append(s.save(run))
# 12: girl rocks about planted foot; flamingo closes its eye using a small eyelid pose.
s=Scene(12);girl=s.cut('girl',[(102,311),(133,309),(151,335),(152,378),(155,393),(196,437),(196,448),(179,451),(147,425),(148,490),(134,527),(127,546),(123,565),(106,567),(104,544),(93,536),(72,538),(60,528),(63,513),(96,511),(101,496),(75,493),(90,425),(41,451),(25,454),(15,446),(23,437),(38,434),(86,393),(96,381),(74,379),(75,351),(86,327)],False)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,girl,angle=.8*math.sin(t),pivot=(115,551));d=ImageDraw.Draw(f)
 if 2.6<t<2.9:
  d.ellipse((371*S,360*S,381*S,371*S),fill=(226,135,155));d.arc((372*S,360*S,380*S,367*S),0,180,fill=(114,65,88),width=2)
 return f
manifest.append(s.save(run))
# 13: pig head nods around neck, eye blink is a separate pose, original curled tail wags.
s=Scene(13);head=s.cut('pig head',[(351,508),(366,499),(364,449),(376,451),(405,466),(435,451),(456,438),(465,452),(462,482),(470,500),(459,528),(448,554),(420,569),(388,555),(351,533)],False,1.5)
tail=s.cut('tail',[(556,449),(568,448),(575,461),(574,482),(568,497),(561,502),(553,494),(560,483),(559,474),(557,466)],True)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,tail,angle=5*math.sin(t+.5),pivot=(561,496));h=head.copy();d=ImageDraw.Draw(h)
 if 2.6<t<2.9:
  d.ellipse((416*S,491*S,429*S,503*S),fill=(230,133,159));d.arc((418*S,492*S,427*S,499*S),0,180,fill=(97,48,65),width=2)
 s.draw(f,h,angle=1.0*math.sin(t),dy=1.1*math.sin(t),pivot=(452,528));return f
manifest.append(s.save(run))
# 14: hanging board pivots beneath the fixed bracket.
s=Scene(14);sign=s.cut('hanging sign',[(486,195),(550,181),(556,188),(575,252),(503,273),(495,266)],True)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,sign,angle=2.0*math.sin(t),pivot=(520,190));return f
manifest.append(s.save(run))
# 15: turtle head looks down to lettuce, jaw opens separately.
s=Scene(15);head=s.cut('turtle head',[(359,446),(368,440),(383,440),(395,447),(394,460),(382,466),(368,463),(360,458)],False,.5)
def run(t):
 f=s.base.convert('RGBA');look=-3.2*math.sin(t);h=head.copy()
 # Small closed/open mouth poses, drawn only inside the original head.
 if 1.0<t<2.6:
  d=ImageDraw.Draw(h);d.line([(363*S,455*S),(373*S,457*S)],fill=(49,81,31),width=2)
 s.draw(f,h,angle=look,dy=1.1*math.sin(t),pivot=(390,452));return f
manifest.append(s.save(run))
# 18: each forearm/hand is a rigid layer pivoting at its elbow, opening then clapping.
s=Scene(18);left=s.cut('left forearm hand',[(378,391),(387,377),(402,363),(408,350),(418,348),(422,353),(418,375),(401,401),(391,411),(381,407)],False,1)
right=s.cut('right forearm hand',[(423,348),(431,348),(437,364),(450,382),(465,399),(462,411),(451,415),(439,400),(425,375)],False,1)
# Restore the small area of dress hidden by the touching palms using original dress texture.
patch=s.src.crop((round(401*S),round(420*S),round(439*S),round(465*S)))
patchmask=mask_poly([(407,351),(430,351),(437,385),(403,385)]).crop((round(401*S),round(347*S),round(439*S),round(392*S)))
s.base.paste(patch,(round(401*S),round(347*S)),patchmask)
def run(t):
 f=s.base.convert('RGBA');open_angle=5.0*smooth(2*t)
 s.draw(f,left,angle=open_angle,pivot=(389,400));s.draw(f,right,angle=-open_angle,pivot=(454,402));return f
manifest.append(s.save(run))
# 19: distinct original tail cutouts move on different phases; figures remain still.
s=Scene(19);tails=[]
tails.append((s.cut('yellow tail',[(167,205),(184,205),(192,218),(192,236),(182,247),(166,248),(163,239),(173,239),(181,232),(181,225),(170,225)],False,.5),(173,208),3.0,0))
tails.append((s.cut('green tail',[(286,303),(296,304),(303,313),(299,326),(287,328),(280,322),(279,313)],False,.5),(287,305),4.0,1.7))
tails.append((s.cut('blue tail',[(489,372),(499,373),(503,395),(503,412),(495,425),(484,427),(474,421),(473,410),(479,402),(488,402),(494,407),(491,417),(484,417),(485,412),(483,409),(480,413),(483,420),(491,420),(496,413),(495,398)],False,.5),(493,376),3.0,3.8))
def run(t):
 f=s.base.convert('RGBA')
 for tail,pivot,angle,phase in tails:s.draw(f,tail,angle=angle*math.sin(t+phase),pivot=pivot)
 return f
manifest.append(s.save(run))
# 22: original coloured title pulses gently in opacity; no letter distortion.
s=Scene(22);title=s.cut('rainbow title',[(154,112),(171,103),(206,79),(252,72),(260,52),(286,53),(312,64),(341,53),(352,67),(381,72),(390,83),(407,81),(428,97),(447,111),(463,120),(458,143),(447,145),(418,127),(394,116),(370,100),(349,97),(325,93),(298,93),(276,94),(256,94),(241,111),(211,122),(177,147),(160,147)],True)
def run(t):
 f=s.base.convert('RGBA');s.draw(f,title,opacity=.78+.22*smooth(t));return f
manifest.append(s.save(run))
manifest.sort(key=lambda x:x['page']);(OUT/'placement.json').write_text(json.dumps(manifest,indent=2))
