(function(){
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
let W=0,H=0,dpr=1;
function size(){dpr=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
size();addEventListener('resize',size);
const TW=64,TH=32,HU=10,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ROLEC={idle:[236,236,240],wood:[214,120,48],stone:[120,142,184],food:[92,182,96],farm:[232,200,70],build:[220,72,72],study:[150,110,220],raid:[200,40,40]};
const ROLEN={idle:'Slapper av',wood:'Tømmerhugger',stone:'Steinhugger',food:'Sanker',farm:'Bonde',build:'Bygger',study:'Forsker',raid:'Kriger'};
const RESN={wood:'tre',stone:'stein',food:'mat'};
let S,GW,GH,h,curT=null,TM={},allV=[],selected=null,speed=1,scale=1,paused=false,auto=true,fx=[],tnow=0,savedAt=0,light=1;
const cam={x:0,y:0,z:.8};
const iso=(x,y,hh)=>[(x-y)*TW/2,(x+y)*TH/2-hh*HU];
function quad(a,b,c,d,f){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();ctx.fillStyle=f;ctx.fill()}
function tri(a,b,c,f){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.fillStyle=f;ctx.fill()}
const rgb=(c,f=1,a=1)=>`rgba(${Math.min(255,c[0]*f)|0},${Math.min(255,c[1]*f)|0},${Math.min(255,c[2]*f)|0},${a})`;
function block(x0,y0,x1,y1,h0,h1,c,fl=.78,fr=.6,ft=1){const A=iso(x0,y0,h1),B=iso(x1,y0,h1),C=iso(x1,y1,h1),D=iso(x0,y1,h1),C0=iso(x1,y1,h0),D0=iso(x0,y1,h0),B0=iso(x1,y0,h0);quad(D,C,C0,D0,rgb(c,fl));quad(C,B,B0,C0,rgb(c,fr));quad(A,B,C,D,rgb(c,ft))}
const bk=(x,y,i,h0,h1,c,fl,fr,ft)=>block(x+i,y+i,x+1-i,y+1-i,h0,h1,c,fl,fr,ft);
function face(side,x0,y0,x1,y1,u0,u1,h0,h1,fill){let a,b,c,d;if(side==='L'){const px=u=>x0+u*(x1-x0);a=iso(px(u0),y1,h1);b=iso(px(u1),y1,h1);c=iso(px(u1),y1,h0);d=iso(px(u0),y1,h0)}else{const py=u=>y1-u*(y1-y0);a=iso(x1,py(u0),h1);b=iso(x1,py(u1),h1);c=iso(x1,py(u1),h0);d=iso(x1,py(u0),h0)}quad(a,b,c,d,fill)}
function roof(x,y,h0,inset,apex,c){const x0=x+inset,y0=y+inset,x1=x+1-inset,y1=y+1-inset;const A=iso(x0,y0,h0),B=iso(x1,y0,h0),C=iso(x1,y1,h0),D=iso(x0,y1,h0),P=iso((x0+x1)/2,(y0+y1)/2,h0+apex);tri(D,C,P,rgb(c,.85));tri(C,B,P,rgb(c,.66));tri(B,A,P,rgb(c,.95));tri(A,D,P,rgb(c,.75))}
const TOP={grass:[104,178,76],sand:[228,206,142],stone:[132,137,148],dirt:[158,124,86],water:[58,126,206],bridge:[170,126,76]};
const SOIL=[121,87,57];let lights=[];
function drawTile(x,y,g,t){
 const e=h.elev(g),a=iso(x,y,e),R=[a[0]+TW/2,a[1]+TH/2],B=[a[0],a[1]+TH],L=[a[0]-TW/2,a[1]+TH/2];
 const k=g.k;let base=g.d&&k==='grass'?TOP.dirt:TOP[k];let vr=.94+g.r*.1;
 if(k==='water'||k==='bridge'){vr=.95+.07*Math.sin(t*1.5+x*.8+y*.6)}
 if(k==='bridge'){quad(L,B,R,[a[0],a[1]],rgb(TOP.water,.95+.07*Math.sin(t*1.5+x*.8+y*.6)))}
 const gs=h.G(x,y+1),gE=h.G(x+1,y);
 const eS=gs?h.elev(gs):e-5,eE=gE?h.elev(gE):e-5;
 const sideC=k==='grass'&&!g.d?SOIL:k==='water'?[40,92,160]:k==='bridge'?[110,76,48]:base;
 for(const [en,p,q,f] of [[eS,L,B,.82],[eE,B,R,.62]]){const hh=(e-en)*HU;if(hh<=0)continue;const lip=k==='grass'&&!g.d?Math.min(hh,3.5):0;
  if(lip)quad(p,q,[q[0],q[1]+lip],[p[0],p[1]+lip],rgb(TOP.grass,f*.95));
  quad([p[0],p[1]+lip],[q[0],q[1]+lip],[q[0],q[1]+hh],[p[0],p[1]+hh],rgb(sideC,f))}
 quad(a,R,B,L,rgb(base,vr));
 if(k==='bridge'){ctx.strokeStyle='rgba(60,38,20,.55)';ctx.lineWidth=1;for(let i=1;i<4;i++){const u=i/4,p=iso(x+u,y,e),q=iso(x+u,y+1,e);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke()}}
 if(k==='grass'&&!g.d&&g.r>.82){ctx.fillStyle=rgb([70,150,60],1);const c=iso(x+.3+g.r*.2,y+.5,e);ctx.fillRect(c[0]-1,c[1]-3,2,3)}
}
function drawTree(x,y,g,o){const e=g.h,s=clamp((S.time-(o.born||-9999))/40,.35,1),sway=Math.sin(tnow*1.3+x*1.7+y)*.015;bk(x,y,.4,e,e+1.0*s,[112,78,48],.8,.6,1);const lv=[[64,150,70],[52,128,60]];bk(x,y,.1-sway,e+1*s,e+2.1*s,lv[o.v>.5?0:1],.82,.64,1.05);bk(x,y,.24+sway,e+2.1*s,e+2.9*s,lv[o.v>.5?1:0],.85,.66,1.1)}
function drawRock(x,y,g){const e=g.h;bk(x,y,.2,e,e+.7,[150,154,164],.8,.62,1);bk(x,y,.34,e+.7,e+1.1,[168,172,182],.8,.62,1.05)}
function drawBush(x,y,g,o){const e=g.h;bk(x,y,.24,e,e+.7,[62,138,64],.8,.62,1);if(o.berries){ctx.fillStyle='#e5484d';for(const [u,w] of [[.35,.4],[.6,.55],[.45,.7]]){const c=iso(x+u,y+w,e+.75);ctx.fillRect(c[0]-1.5,c[1]-1.5,3,3)}}}
function drawFire(x,y,g){const e=g.h;bk(x,y,.3,e,e+.35,[120,124,134],.8,.62,1);const c=iso(x+.5,y+.5,e+.4);for(let i=0;i<3;i++){const fl=Math.sin(tnow*13+i*2)*.5+.5,hh=7+fl*7-i*2;ctx.fillStyle=i===0?'#ff6a2a':i===1?'#ffb347':'#fff2b0';ctx.beginPath();ctx.moveTo(c[0]-5+i*1.5,c[1]);ctx.lineTo(c[0],c[1]-hh);ctx.lineTo(c[0]+5-i*1.5,c[1]);ctx.closePath();ctx.fill()}lights.push([c[0],c[1]-4,120,[255,160,70],.9])}
const eraOf=t=>t?h.eraOf(t.nInv||0,Object.keys(t.tech.done).length):0;
function drawBuilding(b,x,y,g){
 const e=g.h,age=clamp((S.time-(b.t0||0))/1.2,0,1),night=1-light;
 switch(b.type){
 case 'house':{const E=eraOf(TM[b.tribe]),id=b.id|0,fl=Math.min(4,1+Math.min(E,2)+(id%3===0?1:0)),hh=(1.6+.9*fl)*age,P=[[222,196,150],[214,170,140],[200,204,190],[226,216,184],[190,176,200]],wc=E>=2&&id%2?[196,192,186]:P[id%P.length],tc=TM[b.tribe]?TM[b.tribe].color:[190,76,60],rc=tc.map((c,i)=>Math.max(30,Math.min(245,c+((id*(i+3))%41)-20)));bk(x,y,.1,e,e+hh,wc,.84,.66,1.04);for(let f=0;f<fl;f++)face('L',x+.1,y+.1,x+.9,y+.9,.3,.62,e+.7+f*.9,e+1.3+f*.9,night>.4?'#ffd27a':rgb([70,90,120],1));face('R',x+.1,y+.1,x+.9,y+.9,.33,.67,e,e+1.3,rgb([108,70,44],1));if(id%4===1)bk(x,y,.62-.0,e+hh,e+hh+.9,[120,100,90],.3,.3,1);roof(x,y,e+hh,0,(1.2+(id%3)*.4)*age,rc);if(night>.4)lights.push([...iso(x+.4,y+.9,e+1.3),70+fl*8,[255,200,110],.8]);break}
 case 'park':{bk(x,y,0,e,e+.1,[96,170,90],.9,.75,1);for(const [u,w] of [[.2,.2],[.7,.3],[.4,.75]]){bk(x+u-.1,y+w-.1,.3,e+.1,e+.7,[110,78,50],.5,.4,1);bk(x+u-.12,y+w-.12,.25,e+.7,e+1.6,[56,140,70],.8,.62,1)}const c=iso(x+.5,y+.5,e+.15);ctx.fillStyle='#5aa8ee';ctx.beginPath();ctx.ellipse(c[0],c[1],5,2.6,0,0,6.3);ctx.fill();break}
 case 'monument':{const hh=6*age;bk(x,y,.1,e,e+.5,[190,190,198],.9,.72,1);bk(x,y,.3,e+.5,e+hh,[212,210,205],.84,.66,1.02);bk(x,y,.4,e+hh,e+hh+.7,[236,200,90],.9,.7,1.04);if(night>.4)lights.push([...iso(x+.5,y+.5,e+hh),70,[255,226,140],.7]);break}
 case 'lighthouse':{const hh=7*age;bk(x,y,.18,e,e+hh*.5,[240,240,244],.84,.66,1);bk(x,y,.2,e+hh*.5,e+hh*.75,[214,70,66],.84,.66,1);bk(x,y,.22,e+hh*.75,e+hh,[240,240,244],.84,.66,1);bk(x,y,.12,e+hh,e+hh+.8,[250,226,120],.9,.75,1);roof(x,y,e+hh+.8,.1,1*age,[170,50,50]);lights.push([...iso(x+.5,y+.5,e+hh+.4),130+night*60,[255,238,170],.9]);break}
 case 'market':{const hh=1.4*age;bk(x,y,.05,e,e+.5,[150,110,70],.84,.66,1);for(let i=0;i<4;i++)bk(x+(i%2)*.55,y+(i>>1)*.55,.06,e+.5,e+hh+.5,[232,232,232],.5,.4,1);bk(x,y,0,e+hh+.5,e+hh+.8,TM[b.tribe]?TM[b.tribe].color:[200,70,60],.9,.7,1.05);if(night>.4)lights.push([...iso(x+.5,y+.5,e+1.5),80,[255,210,130],.7]);break}
 case 'temple':{const hh=3.2*age;bk(x,y,.05,e,e+.35,[220,220,226],.9,.72,1);bk(x,y,.18,e+.35,e+hh,[236,234,226],.84,.66,1.04);roof(x,y,e+hh,.1,1.8*age,[232,205,120]);if(night>.4)lights.push([...iso(x+.5,y+.5,e+2),90,[255,230,160],.8]);break}
 case 'castle':{const hh=5.5*age;bk(x,y,.12,e,e+hh,[170,172,180],.84,.66,1);for(const [u,w] of [[0,0],[.68,0],[0,.68],[.68,.68]])bk(x+u,y+w,.02,e,e+hh+1.6*age,[150,152,162],.3,.3,1.05);bk(x,y,.3,e+hh,e+hh+1.2*age,[186,188,198],.4,.4,1);roof(x,y,e+hh+1.2*age,.3,1.2*age,[150,60,60]);if(night>.4)lights.push([...iso(x+.5,y+.9,e+3),110,[255,210,120],.8]);break}
 case 'store':{const hh=2*age;bk(x,y,.06,e,e+hh,[176,128,76],.84,.66,1);bk(x,y,0,e+hh,e+hh+.35,[110,76,50],.8,.62,1);face('R',x+.06,y+.06,x+.94,y+.94,.25,.75,e,e+1.3,rgb([86,60,40],1));bk(x,y,.38,e,e+.55,[200,160,100],.8,.62,1);break}
 case 'well':{bk(x,y,.22,e,e+.9,[150,154,164],.8,.62,1);const c=iso(x+.5,y+.5,e+.9);ctx.fillStyle='#2a6fb8';ctx.beginPath();ctx.ellipse(c[0],c[1],8,4,0,0,6.3);ctx.fill();bk(x,y,.2,e+.9,e+2.2,[112,78,48],.8,.62,1);roof(x,y,e+2.2,.08,.8,[130,90,56]);break}
 case 'tower':{const hh=5*age;bk(x,y,.16,e,e+hh,[146,150,160],.82,.64,1);bk(x,y,.08,e+hh,e+hh+.6,[160,164,174],.8,.62,1.05);face('L',x+.16,y+.16,x+.84,y+.84,.4,.6,e+hh*.55,e+hh*.8,'#20262f');const tp=iso(x+.5,y+.5,e+hh+.6),fw=Math.sin(tnow*4)*3;ctx.fillStyle='#5a3b22';ctx.fillRect(tp[0]-1,tp[1]-16,2,16);tri([tp[0]+1,tp[1]-16],[tp[0]+11+fw,tp[1]-12],[tp[0]+1,tp[1]-8],'#d94f4f');if(night>.3)lights.push([tp[0],tp[1]-4,90,[255,190,100],.9]);break}
 case 'plaza':{bk(x,y,0,e,e+.12,[196,198,206],.85,.7,1);bk(x,y,.3,e+.12,e+.6,[160,164,176],.8,.62,1);const c=iso(x+.5,y+.5,e+.6);ctx.fillStyle='#5aa8ee';ctx.beginPath();ctx.ellipse(c[0],c[1],8,4,0,0,6.3);ctx.fill();for(let i=0;i<4;i++){const ph=(tnow*1.6+i*.25)%1;ctx.fillStyle='rgba(200,235,255,'+(1-ph)+')';ctx.fillRect(c[0]-1+Math.sin(i*2)*ph*5,c[1]-ph*10+ph*ph*8,2,2)}break}
 case 'library':{const hh=2.6*age;bk(x,y,.08,e,e+hh,[200,190,214],.84,.66,1.02);face('L',x+.08,y+.08,x+.92,y+.92,.2,.8,e+.7,e+1.9,rgb([60,50,100],1));face('R',x+.08,y+.08,x+.92,y+.92,.3,.7,e,e+1.2,rgb([90,64,120],1));roof(x,y,e+hh,0,1.1*age,[98,84,170]);if(night>.3)lights.push([...iso(x+.5,y+.9,e+1.4),80,[190,170,255],.8]);break}
 case 'mill':{bk(x,y,.2,e,e+2.6,[214,200,170],.84,.66,1);roof(x,y,e+2.6,.14,.9,[140,100,70]);const c=iso(x+.5,y+.95,e+2.2),a=tnow*1.2;ctx.strokeStyle='#e8dcc0';ctx.lineWidth=2.4;for(let i=0;i<4;i++){const an=a+i*Math.PI/2;ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(c[0]+Math.cos(an)*17,c[1]+Math.sin(an)*17);ctx.stroke()}ctx.fillStyle='#5a3b22';ctx.beginPath();ctx.arc(c[0],c[1],2.5,0,6.3);ctx.fill();break}
 case 'farm':{bk(x,y,0,e,e+.12,[116,82,52],.8,.62,1);const gr=b.growth,col=gr>=1?[232,196,70]:[90+gr*120,170-gr*10,70-gr*10];for(let r=0;r<3;r++)for(let k=0;k<3;k++){const u=.2+r*.3,w=.2+k*.3,c=iso(x+u,y+w,e+.12),hh=2+gr*7;ctx.fillStyle=rgb(col,.9);ctx.fillRect(c[0]-1.5,c[1]-hh,3,hh);ctx.fillStyle=rgb(col,1.15);ctx.fillRect(c[0]-1.5,c[1]-hh-1,3,2)}break}
 case 'tent':{roof(x,y,e,.1,2.2,[222,214,196]);if(light<.4)lights.push([...iso(x+.5,y+.9,e+.5),60,[255,190,100],.6]);break}
 default:{const bt=TM[b.tribe],sh=((bt&&bt.defs[b.type])||{}).shape;if(sh){const hh=sh.height*age,c=sh.color;bk(x,y,.1,e,e+hh,c,.84,.66,1.02);face('L',x+.1,y+.1,x+.9,y+.9,.3,.65,e+hh*.4,e+hh*.7,night>.4?'#ffd27a':rgb([40,50,70],1));if(sh.roof==='pointed')roof(x,y,e+hh,0,1.4*age,[Math.min(255,c[0]*.7+50),c[1]*.5,c[2]*.5]);else if(sh.roof==='flat')bk(x,y,.02,e+hh,e+hh+.3,[c[0]*.7,c[1]*.7,c[2]*.7],.8,.62,1);else if(sh.roof==='dome'){const p=iso(x+.5,y+.5,e+hh+.2);ctx.fillStyle=rgb(c,.9);ctx.beginPath();ctx.ellipse(p[0],p[1],14,9,0,Math.PI,0);ctx.fill()}if(night>.4)lights.push([...iso(x+.5,y+.9,e+hh*.5),70,[255,210,120],.7])}}
 }}
function drawSite(s,x,y,g){
 const e=g.h,P=s.prog,ix=s.x,iy=s.y,sz=s.size,hh=(s.what==='tower'?5:s.what==='farm'?.2:2.2)*P;
 if(s.what==='landfill'||s.what==='bridge'){if(x===ix&&y===iy){ctx.save();ctx.globalAlpha=.7;block(ix+.05,iy+.05,ix+.95,iy+.95,.2,.2+P*.8,s.what==='bridge'?[170,126,76]:[228,206,142]);ctx.restore()}return}
 if(!(x===ix&&y===iy))return;
 ctx.save();ctx.globalAlpha=.55;
 if(s.what==='farm')block(ix,iy,ix+sz,iy+sz,e,e+.12,[116,82,52]);else block(ix+.1,iy+.1,ix+sz-.1,iy+sz-.1,e,e+Math.max(.15,hh),[226,206,170],.84,.66,1);
 ctx.globalAlpha=1;const hp=s.what==='tower'?5:2.4;
 for(const [u,w] of [[.05,.05],[sz-.05,.05],[sz-.05,sz-.05],[.05,sz-.05]]){const a=iso(ix+u,iy+w,e),b=iso(ix+u,iy+w,e+hp);ctx.strokeStyle='#7a5231';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}
 const c=iso(ix+sz/2,iy+sz/2,e+hp+.5);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(c[0]-14,c[1]-3,28,5);ctx.fillStyle='#ffb347';ctx.fillRect(c[0]-13,c[1]-2,26*P,3);ctx.restore()}
function drawV(v,t){
 if(v.hidden)return;
 const p=iso(v.x,v.y,v.z),bobY=v.state==='walk'?Math.abs(Math.sin(v.bob))*1.6:v.state==='work'?Math.sin(v.bob)*1.2:0;
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(p[0],p[1]+1,5,2.4,0,0,6.3);ctx.fill();
 if(selected===v){ctx.strokeStyle='#ffb347';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p[0],p[1]+1,9,4.5,0,0,6.3);ctx.stroke()}
 const rc=ROLEC[v.role]||ROLEC.idle;
 if(v.sleeping){ctx.fillStyle=rgb(rc,.9);ctx.fillRect(p[0]-6,p[1]-4,12,4);ctx.fillStyle=rgb(v.skin);ctx.fillRect(p[0]+4,p[1]-6,5,5);ctx.fillStyle='#bcd';ctx.font='bold 10px sans-serif';ctx.fillText('z',p[0]+8,p[1]-12-Math.sin(t*2)*2);return}
 const lg=v.state==='walk'?Math.sin(v.bob)*1.8:0;
 ctx.fillStyle='#3b3a4a';ctx.fillRect(p[0]-3,p[1]-5-bobY*.3+lg*.3,2.4,5-lg*.3);ctx.fillRect(p[0]+.6,p[1]-5-bobY*.3-lg*.3,2.4,5+lg*.3);
 const by=p[1]-12-bobY;
 ctx.fillStyle=rgb(rc);ctx.fillRect(p[0]-3.5,by,7,7);ctx.fillStyle=rgb(rc,.78);ctx.fillRect(p[0]-3.5,by+5,7,2);
 const arm=v.state==='work'?Math.sin(v.bob)*3:v.state==='walk'?Math.sin(v.bob+3)*2:0;
 ctx.fillStyle=rgb(v.skin);ctx.fillRect(p[0]-5,by+1+arm*.2,1.8,5);ctx.fillRect(p[0]+3.2,by+1-arm*.2,1.8,5);
 ctx.fillRect(p[0]-3,by-6,6,6);ctx.fillStyle=rgb(v.hair);ctx.fillRect(p[0]-3.4,by-7,6.8,3);if(v._t){ctx.fillStyle=rgb(v._t.color);ctx.fillRect(p[0]-3.4,by-4,6.8,1.5)}ctx.fillRect(p[0]-(v.face>0?3.4:-1.6),by-5,1.8,3);
 ctx.fillStyle='#222';ctx.fillRect(p[0]+(v.face>0?0.5:-2),by-3.5,1.3,1.3);
 if(v.state==='work'){ctx.strokeStyle='#8a6a40';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p[0]+v.face*4,by+4);ctx.lineTo(p[0]+v.face*(8+arm),by-2-Math.abs(arm));ctx.stroke()}
 if(v.raid){ctx.strokeStyle='#ff4a4a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p[0]+v.face*4,by+5);ctx.lineTo(p[0]+v.face*10,by-6);ctx.stroke()}
 if(v.carry){const cc=v.carry.t==='wood'?[184,126,64]:v.carry.t==='stone'?[150,156,170]:[229,72,77];ctx.fillStyle=rgb(cc);ctx.fillRect(p[0]-3,by-12,6,5);ctx.fillStyle=rgb(cc,1.2);ctx.fillRect(p[0]-3,by-12,6,1.5)}
}
const rnd=Math.random,stars=Array.from({length:90},()=>[rnd(),rnd(),rnd()]),clouds=Array.from({length:7},()=>[rnd(),.1+rnd()*.45,.6+rnd()*1.1,6+rnd()*10]);
function drawSky(t){
 const m=light,top=[0,1,2].map(i=>[10,14,40][i]+([112,182,240][i]-[10,14,40][i])*m),bot=[0,1,2].map(i=>[28,32,72][i]+([214,238,255][i]-[28,32,72][i])*m),ph=h.phase();
 const dusk=Math.max(0,1-Math.abs(m-.5)*2.2)*(ph>.4?1:.3);
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,rgb(top));g.addColorStop(1,rgb([bot[0]+(255-bot[0])*dusk*.6,bot[1]+(150-bot[1])*dusk*.5,bot[2]+(100-bot[2])*dusk*.4]));
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(m<.7){ctx.fillStyle='#fff';for(const s of stars){const tw=.6+.4*Math.sin(t*1.5+s[2]*9);ctx.globalAlpha=(1-m)*tw;ctx.fillRect(s[0]*W,s[1]*H*.8,s[2]*2+.6,s[2]*2+.6)}ctx.globalAlpha=1}
 ctx.fillStyle='rgba(255,255,255,'+(.7*m)+')';for(const c of clouds){const x=((c[0]*W+t*c[3])%(W+300))-150,y=c[1]*H;ctx.beginPath();ctx.ellipse(x,y,c[2]*60,c[2]*14,0,0,6.3);ctx.ellipse(x+c[2]*30,y-8,c[2]*38,c[2]*13,0,0,6.3);ctx.fill()}
 const sx=W*(.1+.8*clamp(ph/.7,0,1)),sy=H*.28-Math.sin(clamp(ph/.7,0,1)*Math.PI)*H*.18;
 if(m>.15){ctx.fillStyle='rgba(255,236,160,'+m+')';ctx.beginPath();ctx.arc(sx,sy,18,0,6.3);ctx.fill()}
 else{const q=clamp((ph-.65)/.35,0,1),mx=W*(.1+.8*q),my=H*.26-Math.sin(q*Math.PI)*H*.16;ctx.fillStyle='rgba(235,240,255,'+(1-m)+')';ctx.beginPath();ctx.arc(mx,my,14,0,6.3);ctx.fill()}
}
function center(){let sx=0,sy=0,n=0;for(const t of S.tribes){if(!t.alive)continue;for(const id of t.blds){const b=h.T(id);if(b){sx+=b.x;sy+=b.y;n++}}}if(!n)return[GW/2,GH/2];return[sx/n+.5,sy/n+.5]}
function frame(clock){
 const t=clock/1000;tnow=t;light=h.light();
 if(auto&&!selected){const [cx,cy]=center(),c=iso(cx,cy,1);cam.x+=(c[0]-cam.x)*.03;cam.y+=(c[1]-cam.y)*.03}
 if(selected){const c=iso(selected.x,selected.y,selected.z);cam.x+=(c[0]-cam.x)*.06;cam.y+=(c[1]-cam.y)*.06}
 ctx.setTransform(dpr,0,0,dpr,0,0);drawSky(t);
 ctx.save();ctx.translate(W/2-cam.x*cam.z,H/2+H*.04-cam.y*cam.z);ctx.scale(cam.z,cam.z);
 lights=[];
 TM={};allV=[];for(const t of S.tribes){TM[t.id]=t;for(const v of t.vill){v._t=t;allV.push(v)}}
 const bucket=new Map();for(const v of allV){const [x,y]=h.tile(v);const k=y*GW+x;(bucket.get(k)||bucket.set(k,[]).get(k)).push(v)}
 const vx0=-(W/2)/cam.z+cam.x-90,vx1=(W/2)/cam.z+cam.x+90,vy0=-(H/2)/cam.z+cam.y-120,vy1=(H/2)/cam.z+cam.y+120;
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
  const g=S.grid[y*GW+x],a=iso(x,y,h.elev(g));
  if(a[0]<vx0||a[0]>vx1||a[1]<vy0||a[1]>vy1+100)continue;
  if(g.k==='water'&&!isNearLand(x,y))continue;
  drawTile(x,y,g,t);
  const o=g.o?S.objs[g.o]:null;
  if(o){switch(o.type){case 'tree':drawTree(x,y,g,o);break;case 'rock':drawRock(x,y,g);break;case 'bush':drawBush(x,y,g,o);break;case 'fire':drawFire(x,y,g);break;case 'site':drawSite(o,x,y,g);break;default:if(o.x===x&&o.y===y||o.size===1)drawBuilding(o,x,y,g);else drawBuilding(o,x,y,g)}}
  const vs=bucket.get(y*GW+x);if(vs)for(const v of vs)drawV(v,t)}
 for(const p of fx){if(p.k==='p'){const c=iso(p.x,p.y,p.h);ctx.fillStyle=rgb(p.c,1,Math.min(1,p.life*1.4));ctx.fillRect(c[0]-1.5,c[1]-1.5,3,3)}}
 ctx.font='bold 12px "IBM Plex Mono",monospace';ctx.textAlign='center';
 for(const f of fx){if(f.k==='f'){const c=iso(f.x,f.y,f.h);ctx.fillStyle=f.c;ctx.globalAlpha=Math.min(1,f.life);ctx.fillText(f.t,c[0],c[1]);ctx.globalAlpha=1}else if(f.k==='s'){const c=iso(f.x,f.y,f.h);ctx.fillStyle='rgba(255,230,120,'+Math.min(1,f.life)+')';ctx.font='bold 18px sans-serif';ctx.fillText('✦',c[0],c[1]);ctx.font='bold 12px "IBM Plex Mono",monospace'}}
 drawShow();
 const ln=lights.filter(Boolean);ctx.restore();
 const nd=1-light;
 ctx.save();
 if(nd>0.01){ctx.fillStyle='rgba(8,14,46,'+(nd*.55)+')';ctx.fillRect(0,0,W,H)}
 ctx.translate(W/2-cam.x*cam.z,H/2+H*.04-cam.y*cam.z);ctx.scale(cam.z,cam.z);ctx.globalCompositeOperation='lighter';
 for(const [x,y,r,c,i] of ln){if(nd<=0.01&&r<100)continue;const rr=nd>.01?r:r*.6,al=nd>.01?.55*i*nd+.15*i*(1-nd):.18;const gr=ctx.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,rgb(c,1,al));gr.addColorStop(1,rgb(c,1,0));ctx.fillStyle=gr;ctx.fillRect(x-rr,y-rr,rr*2,rr*2)}
 ctx.restore();
}
function isNearLand(x,y){for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++){const g=h.G(x+i,y+j);if(g&&g.k!=='water')return true}return false}

// ---- show: raketter, skip, fly, røyk og fyrverkeri over særegne bygg
let show=[],lmT=0,LM=[];const LS={};
function scanLM(){const out=[];for(const t of S.tribes){if(!t.alive)continue;for(const id of t.blds){const o=S.objs[id];if(!o)continue;const d=t.defs&&t.defs[o.type];out.push({n:d?d.n:o.type,x:o.x,y:o.y,id:o.id})}}if(window.__fakeLM)for(const f of window.__fakeLM)out.push(f);LM=out}
const gH=(x,y)=>{const g=h.G(Math.floor(x),Math.floor(y));return g?g.h:0};
const isW=(x,y)=>{const g=h.G(Math.floor(x),Math.floor(y));return !!g&&g.k==='water'&&!g.o};
function stepShow(dt){
 lmT-=dt;if(lmT<=0){lmT=2;scanLM()}
 const night=light<.5;
 for(const l of LM){const st=LS[l.id]||(LS[l.id]={a:Math.random()*5,ships:0});st.a-=dt;const e=gH(l.x,l.y);
  if(/^(Fabrikk|Smie|Keramikkovn|Brenneovn|Glasshytte)/.test(l.n)){st.b=(st.b||0)-dt;if(st.b<=0){st.b=.55;show.push({k:'sm',x:l.x+.5,y:l.y+.5,h:e+(l.n==='Fabrikk'?5:3),life:3.4,vx:.2,vy:-.12,vz:.8})}}
  else if(l.n==='castle'||l.n==='Slott'){if(night&&st.a<=0){st.a=3+Math.random()*5;const cx=l.x+.5+(Math.random()-.5)*4,cy=l.y+.5+(Math.random()-.5)*4,ch=e+10+Math.random()*5,col=[[255,90,90],[255,210,90],[120,200,255],[190,130,255],[120,255,160]][Math.floor(Math.random()*5)];for(let k=0;k<34;k++){const a=Math.random()*6.28,s=1.2+Math.random()*1.4,pz=(Math.random()-.5)*2.4;fx.push({k:'p',x:cx,y:cy,h:ch,vx:Math.cos(a)*s*.7,vy:Math.sin(a)*s*.7,vz:pz+1,life:1.3,c:col})}}}
  else if(l.n==='Romhavn'){if(st.a<=0){st.a=30+Math.random()*30;show.push({k:'rk',x:l.x+.5,y:l.y+.5,h:e+4,v:0,life:11,ex:0})}}
  else if(l.n==='Flyplass'){if(st.a<=0){st.a=22+Math.random()*25;show.push({k:'pl',x:l.x,y:l.y,h:e+.5,t:0,life:9,dx:Math.random()<.5?1:-1,dy:Math.random()<.5?1:-1})}}
  else if(l.n==='Havn'||l.n==='Skipsverft'){if(st.a<=0&&st.ships<2){st.a=6;for(let t=0;t<30;t++){const x=l.x+Math.floor((Math.random()-.5)*12),y=l.y+Math.floor((Math.random()-.5)*12);if(isW(x,y)){show.push({k:'sh',x:x+.5,y:y+.5,d:Math.floor(Math.random()*4),life:60,own:l.id});st.ships++;break}}}}
 }
 let ships={};
 for(const p of show){p.life-=dt;
  if(p.k==='sm'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.h+=p.vz*dt}
  else if(p.k==='rk'){p.v+=(p.life<10.2?4.5:0)*dt;p.h+=p.v*dt;p.ex-=dt;if(p.life<10.8&&p.ex<=0){p.ex=.05;show.push({k:'sm',x:p.x,y:p.y,h:p.h-.6,life:1.6,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,vz:-.3,fire:1})}}
  else if(p.k==='pl'){p.t+=dt;p.x+=p.dx*dt*5;p.y+=p.dy*dt*5;p.h+=dt*1.6}
  else if(p.k==='sh'){const D=[[1,0],[0,1],[-1,0],[0,-1]][p.d],nx=p.x+D[0]*dt*.9,ny=p.y+D[1]*dt*.9;if(isW(nx,ny)&&isW(nx+D[0]*.6,ny+D[1]*.6)){p.x=nx;p.y=ny}else{const o=[0,1,2,3].filter(d=>{const E=[[1,0],[0,1],[-1,0],[0,-1]][d];return isW(p.x+E[0]*1.2,p.y+E[1]*1.2)});if(o.length)p.d=o[Math.floor(Math.random()*o.length)];else p.life=0}}}
 for(const p of show)if(p.k==='sh'&&p.life<=0&&LS[p.own])LS[p.own].ships=Math.max(0,LS[p.own].ships-1);
 show=show.filter(p=>p.life>0);if(show.length>80)show.splice(0,show.length-80)}
function drawShow(){
 for(const p of show){
  if(p.k==='sm'){const c=iso(p.x,p.y,p.h),a=Math.min(.55,p.life/3.4*.55);if(p.fire){ctx.fillStyle='rgba(255,'+(150+p.life*40|0)+',60,'+Math.min(1,p.life)+')';ctx.beginPath();ctx.arc(c[0],c[1],3,0,6.3);ctx.fill()}else{ctx.fillStyle='rgba(210,210,216,'+a+')';ctx.beginPath();ctx.arc(c[0],c[1],4+(3.4-p.life)*3,0,6.3);ctx.fill()}}
  else if(p.k==='rk'){const c=iso(p.x,p.y,p.h);ctx.fillStyle='#f2f2f4';ctx.fillRect(c[0]-3,c[1]-16,6,16);ctx.fillStyle='#d94a4a';ctx.beginPath();ctx.moveTo(c[0]-3,c[1]-16);ctx.lineTo(c[0],c[1]-23);ctx.lineTo(c[0]+3,c[1]-16);ctx.fill();ctx.fillRect(c[0]-6,c[1]-4,3,6);ctx.fillRect(c[0]+3,c[1]-4,3,6);if(p.v>0){ctx.fillStyle='#ffb347';ctx.beginPath();ctx.moveTo(c[0]-3,c[1]);ctx.lineTo(c[0],c[1]+10+Math.random()*6);ctx.lineTo(c[0]+3,c[1]);ctx.fill()}}
  else if(p.k==='pl'){const c=iso(p.x,p.y,p.h),s=iso(p.x,p.y,gH(p.x,p.y));ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(s[0],s[1],8,3,0,0,6.3);ctx.fill();ctx.fillStyle='#f4f6fa';ctx.beginPath();ctx.ellipse(c[0],c[1],9,2.6,0,0,6.3);ctx.fill();ctx.fillRect(c[0]-2,c[1]-6,4,12);ctx.fillStyle='#d94a4a';ctx.fillRect(c[0]+6,c[1]-5,2,5)}
  else if(p.k==='sh'){const c=iso(p.x,p.y,.15);ctx.fillStyle='#5a3a24';ctx.beginPath();ctx.moveTo(c[0]-9,c[1]-2);ctx.lineTo(c[0]+9,c[1]-2);ctx.lineTo(c[0]+5,c[1]+3);ctx.lineTo(c[0]-5,c[1]+3);ctx.fill();ctx.fillStyle='#f4f1e6';ctx.beginPath();ctx.moveTo(c[0],c[1]-3);ctx.lineTo(c[0],c[1]-17);ctx.lineTo(c[0]+8,c[1]-4);ctx.fill();ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(c[0]-12,c[1]+3,24,1.5)}}}
// ---- fx from sim events
function drainEv(){
 const ev=S.ev;if(!ev)return;
 for(const e of ev){
  if(e.type==='puff')for(let k=0;k<(e.n||6);k++)fx.push({k:'p',x:e.x+(Math.random()-.5),y:e.y+(Math.random()-.5),h:e.h,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,vz:1+Math.random(),life:1,c:[230,230,230]});
  else if(e.type==='burst')for(let k=0;k<4;k++)fx.push({k:'p',x:e.x,y:e.y,h:e.h,vx:(Math.random()-.5)*1.2,vy:(Math.random()-.5)*1.2,vz:1.5+Math.random(),life:.7,c:e.c==='tree'?[100,170,70]:e.c==='rock'?[170,175,185]:[230,70,90]});
  else if(e.type==='float')fx.push({k:'f',x:e.x,y:e.y,h:e.h,t:e.t,c:e.c==='wood'?'#e0a060':e.c==='stone'?'#c4ccdd':'#ff8a8a',life:1.4,vz:1.2});
  else if(e.type==='spark')fx.push({k:'s',x:e.x,y:e.y,h:e.h,life:3,vz:.6});
 }
 ev.length=0;
}
function stepFx(dt){for(const p of fx){p.life-=dt;if(p.k==='p'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.h+=p.vz*dt;p.vz-=2.5*dt}else p.h+=(p.vz||1)*dt}fx=fx.filter(p=>p.life>0);if(fx.length>400)fx.splice(0,fx.length-400)}
// ---- ui
const $=id=>document.getElementById(id);
let shown=0;
function renderLog(){const el=$('log');const items=S.log.slice(-3);const key=items.length?items[items.length-1].t+items[items.length-1].text:'';if(renderLog.k===key)return;renderLog.k=key;el.replaceChildren(...items.map(l=>{const d=document.createElement('div');d.textContent=l.text;return d}))}
let panelOpen=(function(){try{const s=localStorage.getItem('smaaby.panel');if(s!==null)return s==='1'}catch(e){}return innerWidth>=700})();
const REL={war:'⚔ krig',trade:'⇄ handel',peace:''};
function hud(){
 if(!curT||!curT.alive){curT=S.tribes.filter(t=>t.alive).sort((a,b)=>b.vill.length-a.vill.length)[0]||S.tribes[0]}
 const p=h.phase(),lab=p<.12?'morgen':p<.55?'dag':p<.7?'kveld':p<.92?'natt':'daggry';
 $('clock').textContent='Dag '+(Math.floor(S.time/Sim.DAYLEN)+1)+' · '+lab+' · '+speed+'×'+(note?' · '+note:'');
 const te=document.createElement('div'),host=$('tech');
 h.withT(curT,()=>{
 const r=S.res;$('rw').textContent=Math.floor(r.wood);$('rs').textContent=Math.floor(r.stone);$('rf').textContent=Math.floor(r.food);$('rp').textContent=S.vill.length+'/'+h.cap();$('rb').textContent=S.blds.length;$('ri').textContent=S.islands;
 const pt=$('pt');pt.textContent='';const dot=document.createElement('i');dot.className='dot';dot.style.background='rgb('+curT.color.join(',')+')';pt.appendChild(dot);pt.appendChild(document.createTextNode(curT.name));
 const cur=S.tech.cur,done=Object.keys(S.tech.done).concat(Object.keys(S.inv));const TI=h.techInfo;
 const b=document.createElement('b');b.textContent=cur?'Forsker på: '+TI(cur).n:'Alt er oppfunnet';te.appendChild(b);
 if(cur){const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=Math.min(100,100*S.tech.prog/TI(cur).cost)+'%';bar.appendChild(i);te.appendChild(bar);const d=document.createElement('small');d.textContent=TI(cur).d+(TI(cur).src?' · '+TI(cur).src:'');te.appendChild(d)}
 const l=document.createElement('div');l.style.marginTop='6px';const sm=document.createElement('small');sm.textContent=h.trait2label(curT)+' · '+(S.goal?'Mål: '+S.goal+' · ':'')+'Funnet ('+done.length+'): '+(done.slice(-6).map(k=>TI(k).n).join(', ')||'ingenting ennå');l.appendChild(sm);te.appendChild(l);
 });
 const pl=document.createElement('div');pl.style.marginTop='8px';
 for(const t of S.tribes){if(!t.alive)continue;const row=document.createElement('button');row.type='button';row.style.cssText='display:flex;gap:6px;align-items:center;width:100%;text-align:left;margin-top:3px;padding:4px 7px;min-height:26px;font-size:11px';row.setAttribute('aria-pressed',t===curT);
  const d=document.createElement('i');d.className='dot';d.style.background='rgb('+t.color.join(',')+')';row.appendChild(d);
  const rels=S.tribes.filter(o=>o.alive&&o!==t&&h.relOf(t.id,o.id)!=='peace').map(o=>(REL[h.relOf(t.id,o.id)])+' '+o.name).join(', ');
  row.appendChild(document.createTextNode(t.name+' · '+t.vill.length+' · '+h.trait2label(t)+(rels?' · '+rels:'')));row.onclick=()=>{curT=t;hud()};pl.appendChild(row)}
 te.appendChild(pl);
 const keep=S.tribes.length&&curT&&h.withT(curT,()=>S.tech.cur)?2:1;
 if(!panelOpen)while(te.children.length>keep)te.lastChild.remove();
 const tg=document.createElement('button');tg.type='button';tg.textContent=panelOpen?'▴':'▾';tg.setAttribute('aria-label','Vis eller skjul panelet');tg.style.cssText='position:absolute;top:6px;right:6px;min-height:26px;padding:2px 9px';tg.onclick=()=>{panelOpen=!panelOpen;try{localStorage.setItem('smaaby.panel',panelOpen?'1':'0')}catch(e){}hud()};te.appendChild(tg);
 const sig=te.textContent+'|'+panelOpen+'|'+curT.id;
 if(host._sig===sig){const a=host.querySelector('.bar i'),b2=te.querySelector('.bar i');if(a&&b2)a.style.width=b2.style.width}
 else{host._sig=sig;host.replaceChildren(...te.childNodes)}
 const c=$('card');if(selected&&!selected.dead){c.hidden=false;const v=selected;c.replaceChildren();const s=document.createElement('strong');s.textContent=v.name+(v._t?' · '+v._t.name:'');c.appendChild(s);
  const l1=document.createElement('div');l1.textContent=(v.sleeping?'Sover':ROLEN[v.role]||'')+' · '+v.trait;c.appendChild(l1);
  const l2=document.createElement('div');const sp=document.createElement('span');sp.textContent=v.carry?'Bærer '+v.carry.n+' '+RESN[v.carry.t]:(v.state==='walk'?'På vei':v.state==='work'?'Jobber':'Venter');l2.appendChild(sp);c.appendChild(l2);
  const l3=document.createElement('div');const s3=document.createElement('span');s3.textContent='Tre '+h.lvl(v,'wood')+' · Stein '+h.lvl(v,'stone')+' · Mat '+h.lvl(v,'food')+' · Bygg '+h.lvl(v,'build')+' · Forskning '+h.lvl(v,'study')+' · Hjerne: '+Object.entries(v.w).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>({build:'bygg',study:'forsk',tree:'tre',rock:'stein',bush:'sanke',farm:'åker'})[e[0]]+' '+e[1].toFixed(1)).join(', ');l3.appendChild(s3);c.appendChild(l3);const th=v._t&&v._t.thoughts[v.name];const l4=document.createElement('div');l4.style.marginTop='4px';l4.textContent='«'+(th?th.text:thoughtOf(v))+'»';c.appendChild(l4)}else c.hidden=true;
 renderLog();
}
function thoughtOf(v){if(v.raid)return 'For folket mitt!';const r=v._t?v._t.res:S.res;if(v.sleeping)return 'Zzz...';if(r.food<20)return 'Vi må skaffe mer mat.';if(r.stone<5)return 'Vi trenger stein.';if(r.wood<10)return 'Det blir lite tre igjen.';const top=Object.entries(v.w).sort((a,b)=>b[1]-a[1])[0][0];return ({build:'Jeg elsker å bygge.',study:'Jeg vil forstå mer.',tree:'Skogen kaller på meg.',rock:'Stein er min greie.',bush:'Jeg liker å sanke.',farm:'Åkeren trenger meg.'})[top]}
const tokGet=()=>{try{return localStorage.getItem('smaaby.token')||''}catch(e){return ''}};
const tokSet=x=>{try{x?localStorage.setItem('smaaby.token',x):localStorage.removeItem('smaaby.token')}catch(e){}};
let note='';
async function pushScale(n){
 const tok=tokGet();if(!tok){note='bare lokalt (ingen token)';return}
 const m=location.hostname.match(/^([^.]+)\.github\.io$/),repo=location.pathname.split('/')[1];if(!m||!repo){note='bare lokalt';return}
 const url='https://api.github.com/repos/'+m[1]+'/'+repo+'/contents/speed.json',H={Authorization:'Bearer '+tok,Accept:'application/vnd.github+json'};
 try{note='lagrer...';let sha;const g=await fetch(url,{headers:H});if(g.ok)sha=(await g.json()).sha;
  const p=await fetch(url,{method:'PUT',headers:H,body:JSON.stringify({message:'speed '+n+'x',content:btoa(JSON.stringify({scale:n})),sha,branch:'main'})});
  note=p.ok?'serveren går nå '+n+'× (fra neste tick)':'feilet ('+p.status+') – sjekk token';if(p.ok)scale=n}catch(e){note='feilet – ingen kontakt'}}
const ctl=$('ctl');
const mk=(t,fn,tog,id)=>{const b=document.createElement('button');b.type='button';b.textContent=t;if(id)b.dataset.id=id;if(tog)b.setAttribute('aria-pressed',false);b.onclick=()=>fn(b);ctl.appendChild(b);return b};
[1,4,16,32,64].forEach(s=>mk(s+'×',b=>{speed=s;ctl.querySelectorAll('[data-id^=sp]').forEach(x=>x.setAttribute('aria-pressed',x===b));pushScale(s)},true,'sp'+s));
function markSpeed(){ctl.querySelectorAll('[data-id^=sp]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.id==='sp'+speed))}
mk('Pause',b=>{paused=!paused;b.textContent=paused?'Spill':'Pause';b.setAttribute('aria-pressed',paused)},true);
const ab=mk('Auto-kamera',b=>{auto=!auto;b.setAttribute('aria-pressed',auto)},true);ab.setAttribute('aria-pressed',true);
let logOn=(function(){try{return localStorage.getItem('smaaby.log')!=='0'}catch(e){return true}})();$('log').hidden=!logOn;const lb=mk('Logg',b=>{logOn=!logOn;$('log').hidden=!logOn;b.setAttribute('aria-pressed',logOn);try{localStorage.setItem('smaaby.log',logOn?'1':'0')}catch(e){}},true);lb.setAttribute('aria-pressed',logOn);
mk('Token',()=>{const t=prompt('Lim inn GitHub-token (fine-grained, kun repoet Smaaby, Contents: Read and write). Tom = fjern.',tokGet());if(t!==null)tokSet(t.trim())});mk('+',()=>cam.z=clamp(cam.z*1.2,.3,2.4));mk('−',()=>cam.z=clamp(cam.z/1.2,.3,2.4));
const ptrs=new Map();let drag=false,pd=0,sx0=0,sy0=0;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);drag=false;sx0=e.clientX;sy0=e.clientY;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pd=Math.hypot(a[0]-b[0],a[1]-b[1])}});
cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const p=ptrs.get(e.pointerId);
 if(ptrs.size===2){ptrs.set(e.pointerId,[e.clientX,e.clientY]);const [a,b]=[...ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pd)cam.z=clamp(cam.z*d/pd,.3,2.4);pd=d;drag=true;return}
 const dx=e.clientX-p[0],dy=e.clientY-p[1];if(Math.hypot(e.clientX-sx0,e.clientY-sy0)>6){drag=true;auto=false;selected=null;ab.setAttribute('aria-pressed',false)}
 if(drag){cam.x-=dx/cam.z;cam.y-=dy/cam.z}ptrs.set(e.pointerId,[e.clientX,e.clientY])});
cv.addEventListener('pointerup',e=>{ptrs.delete(e.pointerId);if(!drag&&ptrs.size===0){const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;let best=null,bd=28;
 for(const v of allV){if(v.hidden)continue;const p=iso(v.x,v.y,v.z),sx=(p[0]-cam.x)*cam.z+W/2,sy=(p[1]-cam.y)*cam.z+H/2+H*.04-8*cam.z;const d=Math.hypot(sx-mx,sy-my);if(d<bd){bd=d;best=v}}selected=best;if(best&&best._t)curT=best._t}});
cv.addEventListener('pointercancel',e=>ptrs.delete(e.pointerId));
cv.addEventListener('wheel',e=>{e.preventDefault();cam.z=clamp(cam.z*(e.deltaY<0?1.1:.9),.3,2.4)},{passive:false});
// ---- boot
const STATE_URL=(function(){const m=location.hostname.match(/^([^.]+)\.github\.io$/),p=location.pathname.split('/')[1];return m&&p?'https://raw.githubusercontent.com/'+m[1]+'/'+p+'/state/state.json':'state.json'})();
let last=performance.now(),hudT=0;
function loop(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;
 if(!paused){let rem=dt*speed;try{const t0=performance.now();while(rem>0&&performance.now()-t0<9){const s=Math.min(rem>.6?.5:.1,rem);Sim.step(s);rem-=s}}catch(e){console.error(e)}drainEv();stepFx(dt)}try{stepShow(dt)}catch(e){console.error(e)}
 frame(now);hudT-=dt;if(hudT<=0){hudT=.2;hud()}
 requestAnimationFrame(loop)}
function start(){
 S=Sim.S;h=Sim.helpers;GW=Sim.GW;GH=Sim.GH;S.ev=[];
 const c=iso(GW/2,GH/2,1);cam.x=c[0];cam.y=c[1];cam.z=clamp(W/1400,.4,.9);
 requestAnimationFrame(t=>{last=t;loop(t)})}
let started=false;
function boot(){fetch(STATE_URL+'?'+Date.now()).then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{
 if(!j.state||j.state.v<3)throw 1;if(started&&j.meta.savedAt&&j.meta.savedAt<=savedAt){setTimeout(boot,60000);return}Sim.load(j.state);savedAt=j.meta.savedAt||Date.now();
 scale=j.meta.scale||1;speed=scale;markSpeed();
 let behind=Math.min(60,Math.max(0,(Date.now()-savedAt)/1000*scale));
 const total=behind;
 (function chunk(){const t0=performance.now();try{while(behind>0&&performance.now()-t0<30){Sim.step(.5);behind-=.5}}catch(e){console.error(e);behind=0}
  $('clock').textContent='Henter inn '+Math.round(100*(1-behind/Math.max(1,total)))+' %...';
  if(behind>0)setTimeout(chunk,0);else{S=Sim.S;if(!started){started=true;start()}else{selected=null;S.ev=[]}setTimeout(boot,60000)}})();
}).catch(e=>{
 if(location.hostname==='localhost'){Sim.create(1234);Sim.advance(300);scale=1;speed=1;start();return}
 $('clock').textContent=e===1?'Venter på at serveren lager en ny verden...':'Finner ikke verdenen ennå, prøver igjen...';
 setTimeout(boot,15000)})}
boot();
})();
