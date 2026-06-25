/* ============================================================
   MC 魂斗罗 — 我的世界版魂斗罗 (Run & Gun)
   单文件 Canvas 横版跑射 / 8方向瞄准 / 多武器 / MC Boss
   纯前端, 零依赖 | 帧率无关固定步长 | 高DPI无毛刺 | 移动端可玩
   ============================================================ */
'use strict';

const CV = document.getElementById('cv');
const X = CV.getContext('2d', { alpha:false });
const VW = 960, VH = 540;          // 逻辑视口
const TILE = 40;
let RS = 1;                        // 渲染缩放(物理像素/逻辑像素)
X.imageSmoothingEnabled = false;
function resetT(){ X.setTransform(RS,0,0,RS,0,0); }

/* ---------------- 工具 ---------------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const sign=v=>v<0?-1:v>0?1:0;
const lerp=(a,b,t)=>a+(b-a)*t;
function aabb(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function dist(a,b){ return Math.hypot((a.x+a.w/2)-(b.x+b.w/2),(a.y+a.h/2)-(b.y+b.h/2)); }

/* ---------------- 输入 ---------------- */
const keys={}, press={};
const PREVENT=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ']);
addEventListener('keydown',e=>{ if(PREVENT.has(e.key))e.preventDefault();
  if(!keys[e.code])press[e.code]=true; keys[e.code]=true; });
addEventListener('keyup',e=>{ keys[e.code]=false; });

const pointer={x:0,y:0,down:false,justDown:false};
function toCanvas(cx,cy){ const r=CV.getBoundingClientRect();
  return {x:(cx-r.left)*(VW/(r.width||1)), y:(cy-r.top)*(VH/(r.height||1))}; }
function pointerMove(cx,cy){ const p=toCanvas(cx,cy); pointer.x=p.x; pointer.y=p.y; }
CV.addEventListener('mousemove',e=>pointerMove(e.clientX,e.clientY));
CV.addEventListener('mousedown',e=>{ pointerMove(e.clientX,e.clientY);
  pointer.down=true; pointer.justDown=true; keys['Fire']=true; press['Fire']=true; });
addEventListener('mouseup',()=>{ pointer.down=false; keys['Fire']=false; });

// 移动端: 全局触摸追踪(按坐标命中按钮, 支持多指/滑动/中断)
const TOUCH_BTNS=[
  {id:'bL',code:'ArrowLeft'},{id:'bR',code:'ArrowRight'},
  {id:'bU',code:'ArrowUp'},{id:'bD',code:'ArrowDown'},
  {id:'bJ',code:'Space'},{id:'bF',code:'Fire'},{id:'bP',code:'KeyP'},
];
let touchHeld={};
function btnCodeAt(x,y){ for(const b of TOUCH_BTNS){ const el=document.getElementById(b.id);
  if(!el)continue; const r=el.getBoundingClientRect();
  if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return b.code; } return null; }
function syncTouches(list){
  const now={}; let canvasTouch=null;
  for(const t of list){ const c=btnCodeAt(t.clientX,t.clientY);
    if(c)now[c]=true; else canvasTouch=t; }
  for(const c in now){ if(!touchHeld[c])press[c]=true; keys[c]=true; }
  for(const c in touchHeld){ if(!now[c])keys[c]=false; }
  touchHeld=now; return canvasTouch;
}
function onTouch(e){ audio();
  const ct=syncTouches(e.touches);
  if(ct){ pointerMove(ct.clientX,ct.clientY); if(e.type==='touchstart'){ pointer.down=true; pointer.justDown=true; } }
  if((e.type==='touchend'||e.type==='touchcancel')&&e.touches.length===0)pointer.down=false;
  if(e.type==='touchstart'&&(G.state==='title'||G.state==='gameover'||G.state==='clear'))press.Enter=true;
  e.preventDefault();
}
['touchstart','touchmove','touchend','touchcancel'].forEach(ev=>document.addEventListener(ev,onTouch,{passive:false}));
for(const b of TOUCH_BTNS){ const el=document.getElementById(b.id); if(!el)continue;
  el.addEventListener('mousedown',e=>{e.preventDefault();press[b.code]=true;keys[b.code]=true;});
  el.addEventListener('mouseup',e=>{e.preventDefault();keys[b.code]=false;});
  el.addEventListener('mouseleave',()=>{keys[b.code]=false;}); }
addEventListener('mousedown',()=>{ audio();
  if(G.state==='title'||G.state==='gameover'||G.state==='clear')press.Enter=true; });

function down(...c){ return c.some(k=>keys[k]); }
function tapped(...c){ return c.some(k=>press[k]); }
function clearPress(){ for(const k in press)press[k]=false; pointer.justDown=false; }
function hit(r){ return pointer.x>=r.x&&pointer.x<=r.x+r.w&&pointer.y>=r.y&&pointer.y<=r.y+r.h; }

/* ---------------- 手柄 (Gamepad API, P1) ---------------- */
let gpHeld={}, gpConnected=false;
addEventListener('gamepadconnected',()=>{gpConnected=true;});
function pollGamepad(){
  if(!navigator.getGamepads)return; let gp=null;
  const pads=navigator.getGamepads(); for(const p of pads)if(p){gp=p;break;}
  const now={};
  if(gp){ gpConnected=true; const ax=gp.axes||[], bt=gp.buttons||[];
    const bd=i=>bt[i]&&bt[i].pressed;
    if((ax[0]||0)<-0.4||bd(14))now['ArrowLeft']=1;
    if((ax[0]||0)>0.4||bd(15))now['ArrowRight']=1;
    if((ax[1]||0)<-0.4||bd(12))now['ArrowUp']=1;
    if((ax[1]||0)>0.4||bd(13))now['ArrowDown']=1;
    if(bd(0))now['Space']=1;                          // A 跳
    if(bd(2)||bd(7)||bd(5))now['Fire']=1;             // X / RT / RB 射击
    if(bd(9))now['KeyP']=1;                            // Start 暂停
    const confirm=bd(0)||bd(9);
    if(confirm && (G.state==='title'||G.state==='gameover'||G.state==='clear'))now['Enter']=1;
  }
  for(const c in now){ if(!gpHeld[c])press[c]=true; keys[c]=true; }
  for(const c in gpHeld){ if(!now[c])keys[c]=false; }
  gpHeld=now;
}

/* ---------------- 存档 & 设置 (版本化) ---------------- */
const STORE='mc-contra.v2';
const SET_DEF={volume:0.7,muted:false,shake:true,difficulty:1,colorblind:false,reduceMotion:false};
const SETTINGS=Object.assign({},SET_DEF);
const SAVE={ver:2,best:0};
// 难度: 0简单 1普通 2困难 — 影响敌人血/伤害/弹速/射频与玩家受伤
const DIFFS=[
  {name:'简单', ehp:0.7, edmg:1, efire:1.35, espd:0.85, pdmgMul:1, life:4},
  {name:'普通', ehp:1.0, edmg:1, efire:1.0,  espd:1.0,  pdmgMul:1, life:3},
  {name:'困难', ehp:1.4, edmg:2, efire:0.7,  espd:1.18, pdmgMul:1, life:3},
];
function DIFF(){ return DIFFS[clamp(SETTINGS.difficulty|0,0,2)]; }
function loadSave(){ try{ const r=localStorage.getItem(STORE);
  if(r){ const d=JSON.parse(r); if(typeof d.best==='number')SAVE.best=d.best|0;
    if(d.settings)Object.assign(SETTINGS,SET_DEF,d.settings); }
  else { const old=localStorage.getItem('mc-contra.v1');   // 迁移旧档
    if(old){ const o=JSON.parse(old); if(typeof o.best==='number')SAVE.best=o.best|0; if(o.settings)Object.assign(SETTINGS,SET_DEF,o.settings); } }
  }catch(e){}
  SETTINGS.volume=clamp(+SETTINGS.volume||0,0,1); SETTINGS.difficulty=clamp(SETTINGS.difficulty|0,0,2); }
function persist(){ try{ localStorage.setItem(STORE,JSON.stringify({ver:2,best:SAVE.best,settings:SETTINGS})); }catch(e){} }
function recordScore(s){ if(s>SAVE.best){ SAVE.best=s; persist(); } }
function effVol(){ return SETTINGS.muted?0:SETTINGS.volume; }
function motionOK(){ return !SETTINGS.reduceMotion; }

/* ---------------- 音频 (程序生成 SFX + 音乐) ---------------- */
const AC=window.AudioContext||window.webkitAudioContext;
let actx=null,master=null,musicGain=null,sfxGain=null;
function audio(){ if(!AC)return null;
  try{ if(!actx){ actx=new AC();
      master=actx.createGain(); master.gain.value=effVol(); master.connect(actx.destination);
      sfxGain=actx.createGain(); sfxGain.gain.value=1; sfxGain.connect(master);
      musicGain=actx.createGain(); musicGain.gain.value=0.5; musicGain.connect(master); }
    if(actx.state==='suspended')actx.resume(); }catch(e){ return null; } return actx; }
function applyVolume(){ if(master)master.gain.value=effVol(); }
// 声像: 世界 x 相对镜头中心 -> [-1,1]
function panFor(worldX){ if(worldX==null)return 0; return clamp(((worldX+G.cam.x)/VW-0.5)*1.6,-0.9,0.9); }
function panNode(a,pan){ if(!pan||!a.createStereoPanner)return null; const p=a.createStereoPanner(); p.pan.value=pan; return p; }
function blip(freq,dur,type='square',vol=0.18,slide=0,bus,pan){
  try{ const a=audio(); if(!a)return; const o=a.createOscillator(),g=a.createGain();
    o.type=type; o.frequency.value=freq;
    if(slide)o.frequency.linearRampToValueAtTime(Math.max(1,freq+slide),a.currentTime+dur);
    g.gain.value=vol; g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+dur);
    const pn=panNode(a,pan); o.connect(g); if(pn){ g.connect(pn); pn.connect(bus||sfxGain||a.destination); } else g.connect(bus||sfxGain||a.destination);
    o.start(); o.stop(a.currentTime+dur);
  }catch(e){} }
function noise(dur,vol=0.3,lp=900,pan){
  try{ const a=audio(); if(!a)return; const n=a.createBufferSource();
    const buf=a.createBuffer(1,a.sampleRate*dur,a.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    n.buffer=buf; const g=a.createGain(); g.gain.value=vol;
    const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp;
    const pn=panNode(a,pan); n.connect(f); f.connect(g); if(pn){ g.connect(pn); pn.connect(sfxGain||a.destination); } else g.connect(sfxGain||a.destination); n.start();
  }catch(e){} }
const SFX={
  shoot: (pan)=>blip(880,0.05,'square',0.07,-300,null,pan),
  shoot2:(pan)=>blip(1200,0.04,'square',0.05,-500,null,pan),
  shootSpread:(pan)=>{blip(640,0.06,'square',0.07,-260,null,pan);noise(0.05,0.06,2200,pan);},
  laser: (pan)=>{blip(1500,0.13,'sawtooth',0.08,-1000,null,pan);blip(2600,0.06,'square',0.04,-1400,null,pan);},
  flame: (pan)=>noise(0.13,0.11,1400,pan),
  jump:  (pan)=>blip(420,0.12,'square',0.12,260,null,pan),
  hit:   (pan)=>{blip(220,0.06,'square',0.09,-150,null,pan);noise(0.04,0.06,2600,pan);},
  thunk: (pan)=>blip(140,0.1,'sawtooth',0.1,-60,null,pan),
  hurt:  ()=>{blip(160,0.18,'sawtooth',0.2,-90);noise(0.12,0.13);},
  explode:(pan)=>{noise(0.42,0.4,700,pan);blip(80,0.42,'sawtooth',0.22,-50,null,pan);blip(160,0.2,'square',0.1,-120,null,pan);},
  power: ()=>{blip(700,0.08,'square',0.16);setTimeout(()=>blip(1050,0.1,'square',0.16),70);setTimeout(()=>blip(1400,0.12,'square',0.16),150);},
  boss:  ()=>{blip(110,0.5,'sawtooth',0.22,40);setTimeout(()=>blip(80,0.6,'sawtooth',0.2,-30),120);},
  die:   ()=>{[400,300,220,150].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'sawtooth',0.18),i*140));},
  win:   ()=>{[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>blip(f,0.16,'square',0.18),i*110));},
  ui:    ()=>blip(660,0.05,'square',0.08),
};
// 简易音乐: 固定步长驱动的 16 步音序(贝斯 + 琶音), 与帧率无关
const MUSIC={ on:false, step:0, frame:0, bpmFrames:9, intense:false };
const BASS=[0,0,7,0, 5,0,7,0, 3,0,10,0, 5,0,7,0];
const ARP =[12,16,19,24, 19,16,12,16, 15,19,22,15, 19,15,12,7];
function noteHz(semi){ return 110*Math.pow(2,semi/12); }
function musicTick(){
  if(!MUSIC.on||SETTINGS.muted||!actx)return;
  MUSIC.frame++; const period=MUSIC.intense?7:MUSIC.bpmFrames;
  if(MUSIC.frame<period)return; MUSIC.frame=0;
  const s=MUSIC.step%16;
  const b=BASS[s]; if(b!==undefined&&(s%2===0))blip(noteHz(b)/2,0.16,'triangle',0.16,0,musicGain);
  if(MUSIC.intense||s%2===0){ const ar=ARP[s]; if(ar!==undefined)blip(noteHz(ar+ (MUSIC.intense?12:0)),0.09,'square',0.05,0,musicGain); }
  if(s%8===0)noise(0.04,0.06,3000); // hat
  MUSIC.step++;
}
function startMusic(intense){ MUSIC.on=true; MUSIC.intense=!!intense; MUSIC.step=0; MUSIC.frame=0; }
function stopMusic(){ MUSIC.on=false; }

/* ============================================================
   关卡数据
   图例: ' '空气 '#'草 'd'土 's'石 'b'基岩 '='木台 'n'下界岩 'e'末地石
        'L'岩浆 '^'尖刺(致命)  '@'出生  'X'Boss触发
        敌人: z僵尸 k骷髅 c苦力怕 t炮台 v烈焰人(飞)
        道具: S喷射 M机枪 R激光 W烈焰 H回血
   ============================================================ */
const SOLID=new Set(['#','d','s','b','=','n','e']);
const DEADLY=new Set(['L','^']);
const LEVELS=[
{ name:'第一关 · 丛林前线', boss:'fortress', sky:['#7cc6ff','#bfe9c9'], biome:'jungle', rows:[
"                                                                                                              ",
"          S                          k                            M                        k                   ",
"                  ====                        ====                         ====                                ",
"      z      t              z   z                      c        z              t          z      z             ",
"   @       #####       ^^         ====      #####            ^^^^        =====        #####            H        ",
"#########  #####  ###############  ##   ##############   ###########  ###########  ##############   ###########X",
"ddddddddd  ddddd  ddddddddddddddd  dd   dddddddddddddd   ddddddddddd  ddddddddddd  dddddddddddddd   dddddddddddd",
"sssssssss  sssss  sssssssss LL ss  ss   ssss LLLL ssss   sssssssssss  sssssssssss  sssss LLLL ssss  ssssssssssss",
"bbbbbbbbb  bbbbb  bbbbbbbbbbbbbbb  bb   bbbbbbbbbbbbbb   bbbbbbbbbbb  bbbbbbbbbbb  bbbbbbbbbbbbbb   bbbbbbbbbbbbb",
]},
{ name:'第二关 · 下界基地', boss:'wither', sky:['#3a0d0d','#7a1f12'], biome:'nether', rows:[
"                                                                                                              ",
"      M                  k        k            R                      c        k                               ",
"            ====                ===                  ====                   ===            ====                ",
"   c    t        v          z          v       t          z      v             t      z          v            ",
"  @    nnnn     ^^^     nnnn      nnn       nnnnn      ^^^^     nnnnn      nnn       nnnnnn     ^^^^      nnnnn  ",
"nnnnnn nnnn nnnnnnnn nnnnnnnn nnnnnnn nnnnnnnnnnn nnnnnnnnn nnnnnnnnn nnnnnnn nnnnnnnnnnnn nnnnnnnnn nnnnnnnnnnX",
"LLLLLL nnnn LLLLLLLL LLLLLLLL LLLLLLL LLLLLLLLLLL LLLLLLLLL LLLLLLLLL LLLLLLL LLLLLLLLLLLL LLLLLLLLL LLLLLLLLLL",
"bbbbbb bbbb bbbbbbbb bbbbbbbb bbbbbbb bbbbbbbbbbb bbbbbbbbb bbbbbbbbb bbbbbbb bbbbbbbbbbbb bbbbbbbbb bbbbbbbbbbb",
]},
{ name:'终关 · 末地核心', boss:'dragon', sky:['#0a0010','#241038'], biome:'end', rows:[
"                                                                                                              ",
"        R              k   k                 W                  k   k                  M                        ",
"   ====        ===              ====                ===              ====                  ===                 ",
"        v          v       v            v      v          v    v            v       v           v             ",
"  @   eeee     eeee     eeeeee     eeee      eeee     eeeeee     eeee      eeee     eeeeee     eeee      eeeee  ",
"  eeeeeeee     eeee     eeeeee     eeee      eeee     eeeeee     eeee      eeee     eeeeee     eeee      eeeeeeX",
"  bbbbbbbb              eeeeee                eeee                eeee               eeeeee              bbbbbbb",
"  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
]},
];

function buildLevel(def){
  const W=Math.max(...def.rows.map(r=>r.length));
  const rows=def.rows.map(r=>r.padEnd(W,' '));
  const H=rows.length, map=rows.map(r=>r.split(''));
  const lvl={def,W,H,map,pxW:W*TILE,pxH:H*TILE,spawns:[],powerups:[],bossTrigger:null,start:{x:80,y:80}};
  const POW={S:'spread',M:'machine',R:'laser',W:'flame',H:'health'};
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
    const ch=map[r][c],px=c*TILE,py=r*TILE;
    if(ch==='@'){ lvl.start={x:px,y:py-4}; map[r][c]=' '; }
    else if('zkctv'.includes(ch)){ const m={z:'zombie',k:'skeleton',c:'creeper',t:'turret',v:'blaze'};
      lvl.spawns.push({type:m[ch],x:px,y:py}); map[r][c]=' '; }
    else if(POW[ch]){ lvl.powerups.push({kind:POW[ch],x:px+6,y:py+4,w:28,h:30,t:0,got:false}); map[r][c]=' '; }
    else if(ch==='X'){ lvl.bossTrigger={col:c,row:r,px,py}; map[r][c]='b'; }
  }
  return lvl;
}

/* ---------------- 全局状态 ---------------- */
const G={ state:'title', levelIndex:0, lvl:null, cam:{x:0,y:0}, camLead:0,
  shake:0, trauma:0, kickX:0, kickY:0, flash:0, flashColor:'#fff', hitstop:0,
  t:0, score:0, combo:0, comboT:0, fade:0,
  bossLock:false, bossLockX:0, message:'', msgT:0, paused:false, overlay:null, menuIndex:0 };
let player, enemies, bullets, ebullets, powerups, particles, floaters, boss;
// 加震动(trauma 平方曲线, 比线性更有冲击力); reduceMotion 时不抖
function addShake(v){ if(motionOK())G.trauma=clamp(G.trauma+v,0,1); }
function addKick(ax,ay,p){ if(!motionOK())return; G.kickX-=ax*p; G.kickY-=ay*p; }
function addFlash(n,c){ if(!motionOK()){ G.flash=Math.min(G.flash,2); return;} G.flash=Math.max(G.flash,n); G.flashColor=c||'#fff'; }

/* ============================================================
   武器
   ============================================================ */
const WEAPONS={
  normal: {cd:12, spd:11, dmg:1, name:'弓箭', letter:'•', color:'#ffe8b0'},
  spread: {cd:13, spd:9.5, dmg:1, count:5, ang:0.46, name:'喷射枪', letter:'S', color:'#7ad0ff'},
  machine:{cd:5,  spd:12, dmg:1, name:'机关枪', letter:'M', color:'#ffe066'},
  laser:  {cd:20, spd:17, dmg:3, pierce:true, name:'激光', letter:'L', color:'#ff6bd0', w:26,h:6},
  flame:  {cd:8,  spd:6.5, dmg:2, grav:0.04, name:'烈焰弹', letter:'F', color:'#ff8a3d', flame:true, w:14,h:14},
};
const WEAPON_FROM_KIND={spread:'spread',machine:'machine',laser:'laser',flame:'flame'};

/* ============================================================
   玩家
   ============================================================ */
function makePlayer(x,y){
  return {x,y,w:24,h:38, vx:0,vy:0, dir:1, onGround:false, prone:false,
    hp:4, maxHp:4, lives:3, iframe:90, dead:false, deadT:0,
    weapon:'normal', fireCD:0, jumps:0, coyote:0, jumpBuf:0,
    aimX:1, aimY:0, walkAnim:0, muzzle:0, win:false };
}
function solidAt(c,r){ const m=G.lvl.map;
  if(r<0||r>=G.lvl.H||c<0||c>=G.lvl.W)return c<0; return SOLID.has(m[r][c]); }
function deadlyAt(c,r){ const m=G.lvl.map;
  if(r<0||r>=G.lvl.H||c<0||c>=G.lvl.W)return false; return DEADLY.has(m[r][c]); }
function moveEntity(e){
  e.x+=e.vx; let c1=Math.floor(e.x/TILE),c2=Math.floor((e.x+e.w-1)/TILE);
  let r1=Math.floor(e.y/TILE),r2=Math.floor((e.y+e.h-1)/TILE);
  if(e.vx>0){ for(let r=r1;r<=r2;r++)if(solidAt(c2,r)){e.x=c2*TILE-e.w;e.vx=0;e.hitWall=true;break;} }
  else if(e.vx<0){ for(let r=r1;r<=r2;r++)if(solidAt(c1,r)){e.x=(c1+1)*TILE;e.vx=0;e.hitWall=true;break;} }
  e.onGround=false; e.y+=e.vy;
  c1=Math.floor(e.x/TILE); c2=Math.floor((e.x+e.w-1)/TILE);
  r1=Math.floor(e.y/TILE); r2=Math.floor((e.y+e.h-1)/TILE);
  if(e.vy>0){ for(let c=c1;c<=c2;c++)if(solidAt(c,r2)){e.y=r2*TILE-e.h;e.vy=0;e.onGround=true;break;} }
  else if(e.vy<0){ for(let c=c1;c<=c2;c++)if(solidAt(c,r1)){e.y=(r1+1)*TILE;e.vy=0;break;} }
}
function groundYAt(worldX){ const c=clamp(Math.floor(worldX/TILE),0,G.lvl.W-1);
  for(let r=0;r<G.lvl.H;r++)if(SOLID.has(G.lvl.map[r][c]))return r*TILE; return (G.lvl.H-1)*TILE; }
function touchingDeadly(e){ const c1=Math.floor((e.x+4)/TILE),c2=Math.floor((e.x+e.w-4)/TILE);
  const r1=Math.floor((e.y+4)/TILE),r2=Math.floor((e.y+e.h-2)/TILE);
  for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)if(deadlyAt(c,r))return true; return false; }

function updatePlayer(){
  const p=player;
  if(p.iframe>0)p.iframe--;
  if(p.fireCD>0)p.fireCD--;
  if(p.muzzle>0)p.muzzle--;

  if(p.dead){ p.deadT--; p.vy+=0.6; moveEntity(p);
    if(p.deadT<=0)respawnOrGameOver(); return; }
  if(p.win){ p.vy+=0.6; moveEntity(p); return; }

  const L=down('ArrowLeft','KeyA'), R=down('ArrowRight','KeyD');
  const U=down('ArrowUp','KeyW'), D=down('ArrowDown','KeyS');
  let h=(R?1:0)-(L?1:0);
  if(h!==0)p.dir=h;
  p.prone = p.onGround && D && !U;

  // 8方向瞄准
  let ax,ay;
  if(p.prone){ ax=p.dir; ay=0; }
  else if(U && h!==0){ ax=h; ay=-1; }
  else if(U){ ax=0; ay=-1; }
  else if(D && !p.onGround && h!==0){ ax=h; ay=1; }
  else if(D && !p.onGround){ ax=0; ay=1; }
  else { ax=p.dir; ay=0; }
  const am=Math.hypot(ax,ay)||1; p.aimX=ax/am; p.aimY=ay/am;

  // 移动(卧倒时不走)
  const accel=0.7, maxSpd=4.2, fric=0.78;
  if(!p.prone && h){ p.vx+=h*accel; } else p.vx*=fric;
  p.vx=clamp(p.vx,-maxSpd,maxSpd);
  if(p.prone)p.vx*=0.6;

  // 跳跃(coyote + buffer)
  const jt=tapped('Space');
  if(jt)p.jumpBuf=7; if(p.jumpBuf>0)p.jumpBuf--; if(p.coyote>0)p.coyote--;
  if(p.jumpBuf>0 && (p.onGround||p.coyote>0) && !p.prone){ p.vy=-12; p.jumps=1; p.jumpBuf=0; p.coyote=0; SFX.jump(); }
  else if(jt && !p.onGround && p.coyote<=0 && p.jumps>=1 && p.jumps<2){ p.vy=-10.5; p.jumps=2; SFX.jump(); burst(p.x+p.w/2,p.y+p.h,'#fff',6,3); }
  if(down('Space') && p.vy<0)p.vy-=0.3;
  p.vy+=0.7; if(p.vy>16)p.vy=16;

  p.walkAnim+=Math.abs(p.vx)*0.25;
  moveEntity(p);
  if(p.onGround){ p.jumps=0; p.coyote=7; }
  if(G.bossLock && boss && !boss.dead)
    p.x=clamp(p.x, boss.arena.left+2, boss.arena.right-p.w-2);

  // 开火(按住连发)
  if(down('Fire','KeyJ') && p.fireCD<=0)fireWeapon();

  if(touchingDeadly(p))hurtPlayer(99);
  if(p.y>G.lvl.pxH+80)hurtPlayer(99);

  // 拾取道具
  for(const u of powerups){ if(!u.got && aabb(p,u)){ u.got=true; pickup(u.kind); } }

  // Boss 触发
  if(!G.bossLock && G.lvl.bossTrigger){ const tx=G.lvl.bossTrigger.px;
    if(p.x+p.w>tx-VW*0.5){ G.bossLock=true; G.bossLockX=clamp(tx-VW+TILE*2,0,G.lvl.pxW-VW); spawnBoss(G.lvl.def.boss); } }

  // 过关传送门
  for(const f of floaters){ if(f.kind==='portal'&&aabb(p,f))nextLevel(); }
}
function fireWeapon(){
  const p=player, w=WEAPONS[p.weapon]; p.fireCD=w.cd; p.muzzle=7;
  const mx=p.x+p.w/2 + p.aimX*16, my=p.y+(p.prone?p.h-10:14) + p.aimY*14;
  const base=Math.atan2(p.aimY,p.aimX), pan=panFor(mx);
  const mk=(ang,sp)=>{ bullets.push({x:mx-3,y:my-3,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,
    w:w.w||8,h:w.h||8,dmg:w.dmg,pierce:w.pierce,grav:w.grav||0,flame:w.flame,
    color:w.color,kind:p.weapon,life:w.flame?40:80,rot:ang,trail:w.trail}); };
  let recoil=0.9, kick=3, shk=0.07;
  if(p.weapon==='spread'){ const n=w.count; for(let i=0;i<n;i++)mk(base+(i-(n-1)/2)*(w.ang/(n-1))*2, w.spd*rand(0.95,1.05)); SFX.shootSpread(pan); recoil=1.6;kick=5;shk=0.13; }
  else if(p.weapon==='machine'){ mk(base+rand(-0.05,0.05), w.spd); SFX.shoot(pan); recoil=0.45;kick=2;shk=0.05; }
  else if(p.weapon==='laser'){ mk(base, w.spd); SFX.laser(pan); recoil=1.8;kick=6;shk=0.15; }
  else if(p.weapon==='flame'){ mk(base+rand(-0.12,0.12), w.spd); SFX.flame(pan); recoil=0.4;kick=2;shk=0.05; }
  else { mk(base, w.spd); SFX.shoot(pan); recoil=1.0;kick=3;shk=0.07; }
  // 后坐力 + 相机踢 + 枪口闪光粒子 + 弹壳
  if(!p.prone) p.vx -= p.aimX*recoil*0.5;
  addKick(p.aimX,p.aimY,kick); addShake(shk);
  for(let i=0;i<3;i++)particles.push({x:mx,y:my,vx:Math.cos(base)*rand(2,5)+rand(-1,1),vy:Math.sin(base)*rand(2,5)+rand(-1,1),life:rand(5,11),max:11,color:i?'#ffd24a':'#fff',size:rand(2,4)});
  if(p.weapon==='normal'||p.weapon==='machine')particles.push({x:p.x+p.w/2,y:my,vx:-p.dir*rand(1,2.4),vy:-rand(1,3),life:rand(16,24),max:24,color:'#caa84a',size:2});
}
function pickup(kind){
  SFX.power(); addFlash(6,'#9fe8ff'); addShake(0.12);
  floaters.push({kind:'text',x:player.x,y:player.y-10,vy:-0.7,life:50,
    text: kind==='health'?'+❤':WEAPONS[WEAPON_FROM_KIND[kind]].name, color:'#fff', big:true});
  burst(player.x+player.w/2,player.y+player.h/2,'#bdf',14,4);
  if(kind==='health'){ player.hp=Math.min(player.maxHp,player.hp+1); }
  else { player.weapon=WEAPON_FROM_KIND[kind]; }
}
function hurtPlayer(dmg){
  const p=player; if(p.iframe>0||p.dead||p.win)return;
  const d = dmg>=10?dmg:dmg*DIFF().edmg;
  p.hp-=d; SFX.hurt(); addShake(0.5); addFlash(9,'#ff3b3b'); G.hitstop=Math.max(G.hitstop,4);
  burst(p.x+p.w/2,p.y+p.h/2,'#ff5555',14,5);
  if(p.hp<=0){ killPlayer(); } else { p.iframe=64; p.vy=-6; p.vx=-p.dir*4; }
}
function killPlayer(){ const p=player; if(p.dead)return;
  p.dead=true; p.deadT=70; p.weapon='normal'; SFX.die(); addShake(0.8); addFlash(12,'#fff'); G.hitstop=Math.max(G.hitstop,6);
  burst(p.x+p.w/2,p.y+p.h/2,'#5fd0ff',28,6); burst(p.x+p.w/2,p.y+p.h/2,'#fff',14,5); recordScore(G.score); }
function respawnOrGameOver(){ const p=player; p.lives--;
  if(p.lives<0){ recordScore(G.score); G.state='gameover'; stopMusic(); return; }
  // 复活于当前镜头左侧安全地面
  const rx=clamp(-G.cam.x+120, 0, G.lvl.pxW-40);
  const gy=groundYAt(rx+20)-p.h-2;
  p.x=rx; p.y=gy; p.vx=0; p.vy=0; p.dead=false; p.hp=p.maxHp; p.iframe=100;
  // 清近身敌弹
  ebullets=ebullets.filter(b=>Math.abs(b.x-p.x)>VW*0.5);
}

/* ============================================================
   子弹
   ============================================================ */
function updateBullets(){
  for(const b of bullets){
    if(b.grav)b.vy+=b.grav;
    b.x+=b.vx; b.y+=b.vy; b.life--;
    let hitWall = solidAt(Math.floor((b.x+b.w/2)/TILE),Math.floor((b.y+b.h/2)/TILE));
    if(b.flame)b.w=b.h=(b.w+0.6);
    // 命中敌人
    for(const e of enemies){ if(e.dead)continue;
      if(aabb(b,e)){ damageEnemy(e,b.dmg,sign(b.vx)); sparks(b.x,b.y,b.color,b.vx,b.vy);
        if(!b.pierce){ b.life=0; } break; } }
    if(b.life>0 && boss && !boss.dead && boss.state!=='intro' && bossHittable(b)){
      bossHurt(b.dmg); sparks(b.x,b.y,'#fff',b.vx,b.vy); if(!b.pierce)b.life=0; }
    if(hitWall && !b.flame){ sparks(b.x,b.y,b.color,b.vx,b.vy); b.life=0; }
    if(hitWall && b.flame)b.life=Math.min(b.life,6);
  }
  bullets=bullets.filter(b=>b.life>0);
  // 敌弹
  for(const b of ebullets){ if(b.grav)b.vy+=b.grav; b.x+=b.vx; b.y+=b.vy; b.life--;
    if(player.iframe<=0 && !player.dead && aabb(b,player)){ hurtPlayer(1); b.life=0; }
    if(b.solid && solidAt(Math.floor((b.x+b.w/2)/TILE),Math.floor((b.y+b.h/2)/TILE)))b.life=0;
  }
  ebullets=ebullets.filter(b=>b.life>0);
}
function efire(x,y,ang,sp,opt){ ebullets.push(Object.assign({x:x-5,y:y-5,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,
  w:10,h:10,life:200,kind:'eb',color:'#ff6a3d',grav:0,solid:true},opt||{})); }

/* ============================================================
   敌人
   ============================================================ */
function spawnEnemy(s){
  const d=DIFF();
  const b={x:s.x,y:s.y,vx:0,vy:0,dir:-1,onGround:false,dead:false,hp:2,type:s.type,
    t:rand(0,99),anim:0,hitWall:false,flash:0,knock:0,shoot:rand(40,90)};
  if(s.type==='zombie'){ b.w=26;b.h=36;b.speed=1.0;b.hp=3; }
  if(s.type==='skeleton'){ b.w=24;b.h=36;b.speed=0;b.hp=2; }
  if(s.type==='creeper'){ b.w=26;b.h=34;b.speed=1.6;b.hp=2;b.fuse=0;b.armed=false; }
  if(s.type==='turret'){ b.w=34;b.h=34;b.speed=0;b.hp=4;b.y=s.y+4; }
  if(s.type==='blaze'){ b.w=28;b.h=32;b.speed=1.2;b.hp=3;b.fly=true;b.baseY=s.y; }
  b.hp=Math.max(1,Math.round(b.hp*d.ehp)); b.speed*=d.espd; b.maxHp=b.hp;
  enemies.push(b);
}
function damageEnemy(e,dmg,kdir){ e.hp-=dmg; e.flash=8; SFX.hit(panFor(e.x+e.w/2));
  if(kdir&&e.type!=='turret'){ e.knock=kdir*3; }
  if(e.hp<=0){ e.dead=true; killEnemy(e); }
  else { G.hitstop=Math.max(G.hitstop,2); } }
function killEnemy(e){ G.combo++; G.comboT=120;
  const pts=({zombie:30,skeleton:40,creeper:35,turret:60,blaze:55}[e.type]||30)+G.combo*2;
  G.score+=pts; const pan=panFor(e.x+e.w/2);
  burst(e.x+e.w/2,e.y+e.h/2,'#7ac74f',14,5); burst(e.x+e.w/2,e.y+e.h/2,'#fff',6,4);
  SFX.thunk(pan); addShake(0.12); G.hitstop=Math.max(G.hitstop,3);
  floaters.push({kind:'text',x:e.x,y:e.y-6,vy:-0.7,life:36,text:'+'+pts,color:'#bfe'});
  if(e.type==='creeper')creeperBoom(e);
  if(Math.random()<0.12)powerups.push({kind:'health',x:e.x,y:e.y,w:28,h:30,t:0,got:false});
}
function creeperBoom(e){ const pan=panFor(e.x+e.w/2); SFX.explode(pan); addShake(0.55); addFlash(8,'#ffb060'); G.hitstop=Math.max(G.hitstop,3);
  burst(e.x+e.w/2,e.y+e.h/2,'#7ac74f',28,6); burst(e.x+e.w/2,e.y+e.h/2,'#444',16,5); burst(e.x+e.w/2,e.y+e.h/2,'#ffd24a',10,7);
  if(player.iframe<=0 && Math.hypot((e.x+e.w/2)-(player.x+player.w/2),(e.y+e.h/2)-(player.y+player.h/2))<70)hurtPlayer(1); }
function updateEnemy(e){
  e.t++; e.anim+=Math.abs(e.vx)*0.2; if(e.flash>0)e.flash--;
  if(e.knock){ e.x+=e.knock; e.knock*=0.8; if(Math.abs(e.knock)<0.3)e.knock=0; }
  const ef=DIFF().efire, pan=panFor(e.x+e.w/2);
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
  const ex=e.x+e.w/2, ey=e.y+e.h/2, ddx=pcx-ex;

  if(e.type==='blaze'){ // 飞行 + 三连火球
    e.y=e.baseY + Math.sin(e.t*0.05)*40;
    e.x += (Math.abs(ddx)>200? sign(ddx)*e.speed : Math.sin(e.t*0.02)*0.6);
    if(Math.abs(ddx)<460 && !player.dead){ e.shoot--; if(e.shoot<=0){ e.shoot=110*ef;
      for(let i=-1;i<=1;i++){ const a=Math.atan2(pcy-ey,pcx-ex)+i*0.18; efire(ex,ey,a,4.2,{color:'#ffd24a',grav:0}); } SFX.shoot2(pan); } }
    return;
  }
  e.vy+=0.6; if(e.vy>14)e.vy=14;
  if(e.type==='zombie'){
    if(Math.abs(ddx)<320 && !player.dead)e.dir=sign(ddx)||e.dir;
    e.vx=e.dir*e.speed; e.hitWall=false; moveEntity(e);
    if(e.hitWall)e.dir*=-1; else if(e.onGround){ const fc=Math.floor((e.x+(e.dir>0?e.w+2:-2))/TILE),fr=Math.floor((e.y+e.h+2)/TILE); if(!solidAt(fc,fr))e.dir*=-1; }
  } else if(e.type==='creeper'){
    if(Math.abs(ddx)<260 && Math.abs(pcy-ey)<90 && !player.dead){ e.dir=sign(ddx)||e.dir; e.vx=e.dir*e.speed; if(Math.abs(ddx)<42)e.armed=true; }
    else e.vx=e.dir*e.speed*0.5;
    e.hitWall=false; moveEntity(e); if(e.hitWall)e.dir*=-1;
    if(e.armed){ e.fuse++; if(e.fuse>45){ e.dead=true; creeperBoom(e); } }
  } else if(e.type==='skeleton'){
    e.vx=0; moveEntity(e);
    if(Math.abs(ddx)<460 && !player.dead){ e.dir=sign(ddx)||e.dir; e.shoot--; if(e.shoot<=0){ e.shoot=rand(70,110)*ef;
      const a=Math.atan2(pcy-ey,pcx-ex); efire(ex,ey-4,a,5,{color:'#dcdcdc',grav:0.02,w:14,h:6}); SFX.shoot(pan); } }
  } else if(e.type==='turret'){
    moveEntity(e);
    if(Math.abs(ddx)<520 && !player.dead){ e.shoot--; if(e.shoot<=0){ e.shoot=64*ef;
      const a=Math.atan2(pcy-ey,pcx-ex); for(let k=-1;k<=1;k++)efire(ex,ey,a+k*0.14,4.6,{color:'#ff7a3d'}); SFX.shoot2(pan); } }
  }
  // 接触伤害
  if(!e.dead && player.iframe<=0 && !player.dead && aabb(player,e))hurtPlayer(1);
}

/* ============================================================
   Boss
   ============================================================ */
function spawnBoss(type){
  const ax=G.bossLockX, arena={left:ax,right:ax+VW};
  const b={type,t:0,x:ax+VW*0.62,y:120,w:120,h:120,vx:0,vy:0,hp:0,maxHp:0,
    atkT:90,iframe:0,dead:false,defeated:false,flash:0,state:'intro',stateT:0,arena};
  if(type==='fortress'){ b.maxHp=40; b.w=150; b.h=200; b.y=VH-260; b.x=arena.right-200; }
  if(type==='wither'){ b.maxHp=46; b.w=120; b.h=100; b.y=120; }
  if(type==='dragon'){ b.maxHp=54; b.w=160; b.h=96; b.y=120; }
  b.maxHp=Math.round(b.maxHp*lerp(1,DIFF().ehp,0.6)); b.hp=b.maxHp;
  boss=b; SFX.boss(); addShake(0.7); addFlash(8,'#fff'); G.message=bossName(type); G.msgT=150; startMusic(true);
}
function bossName(t){ return {fortress:'🏰 下界要塞核心 — Fortress Core',
  wither:'☠ 凋灵 — The Wither', dragon:'🐉 末影龙 — Ender Dragon'}[t]; }
function bossHittable(b){ return aabb(b,boss); }
function bossHurt(dmg){ if(boss.iframe>0||boss.dead)return;
  boss.hp-=dmg; boss.iframe=6; boss.flash=8; SFX.hit(panFor(boss.x+boss.w/2)); addShake(0.1);
  if(boss.hp<=0)defeatBoss(); }
function defeatBoss(){ boss.hp=0; boss.dead=true; boss.defeated=true; SFX.win(); addShake(1); addFlash(16,'#fff'); G.hitstop=Math.max(G.hitstop,8);
  ebullets=[]; for(const e of enemies)e.dead=true; stopMusic();
  for(let i=0;i<6;i++)setTimeout(()=>{ if(boss)burst(boss.x+rand(0,boss.w),boss.y+rand(0,boss.h),'#ffe680',18,6); },i*120);
  const px=clamp(boss.x+boss.w/2-30,boss.arena.left+10,boss.arena.right-70), py=groundYAt(px+30)-96;
  setTimeout(()=>{ G.message='Boss 被击败! 走向传送门 →'; G.msgT=220;
    floaters.push({kind:'portal',x:px,y:py,w:60,h:96,t:0}); },700);
}
function updateBoss(){
  const b=boss; b.t++; if(b.iframe>0)b.iframe--; if(b.flash>0)b.flash--;
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
  if(b.defeated){ b.y+=0.6; return; }
  if(b.state==='intro'){ b.stateT++; if(b.stateT>60)b.state='fight'; return; }
  if(b.type==='fortress'){ // 固定要塞: 双炮口扫射 + 召唤 + 阶段火墙
    b.atkT--; const gy=b.y+40, topX=b.x+20, botX=b.x+20, topY=b.y+30, botY=b.y+b.h-40;
    if(b.atkT<=0){ b.atkT=b.hp<b.maxHp*0.4?26:40;
      const a1=Math.atan2(pcy-topY,pcx-topX), a2=Math.atan2(pcy-botY,pcx-botX);
      for(let k=-1;k<=1;k++){ efire(topX,topY,a1+k*0.12,5,{color:'#ff7a3d'}); efire(botX,botY,a2+k*0.12,5,{color:'#ff7a3d'}); }
      SFX.shoot2();
      if(b.t%200<6 && enemies.length<6){ enemies.push(makeAdd(b.x-10,b.y+b.h-60)); }
    }
  } else if(b.type==='wither'){ // 飞行三头骷髅弹 + 俯冲
    const ty=110+Math.sin(b.t*0.04)*40; b.vy+=(ty-b.y)*0.02; b.vy*=0.9;
    const tx=clamp(pcx-b.w/2,b.arena.left+30,b.arena.right-b.w-30); b.vx+=(tx-b.x)*0.012; b.vx*=0.9;
    b.x+=b.vx; b.y+=b.vy; b.atkT--;
    if(b.atkT<=0){ b.atkT=b.hp<b.maxHp*0.4?38:60;
      const heads=[[0,20],[-30,34],[30,34]];
      for(const [ox,oy] of heads){ const sx=b.x+b.w/2+ox, sy=b.y+oy, a=Math.atan2(pcy-sy,pcx-sx)+rand(-0.1,0.1);
        efire(sx,sy,a,4.4,{color:b.hp<b.maxHp*0.4?'#7fd4ff':'#3a3a3a',w:16,h:16}); } SFX.shoot2(); }
  } else if(b.type==='dragon'){ // 横飞俯冲 + 龙息扇形
    if(b.diveT>0){ b.diveT--; b.x+=b.vx; b.y+=b.vy; if(b.diveT===0)b.vy=-6; }
    else { const ty=110+Math.sin(b.t*0.05)*50; b.y+=(ty-b.y)*0.04;
      if(b.dx===undefined||(b.x<b.arena.left+30&&b.dx<0)||(b.x>b.arena.right-b.w-30&&b.dx>0))b.dx=(b.x<b.arena.left+VW/2?2.6:-2.6);
      b.x+=b.dx; b.atkT--;
      if(b.atkT<=0){ b.atkT=90;
        if(Math.random()<0.5){ b.diveT=40; b.vx=sign(pcx-(b.x+b.w/2))*4.2; b.vy=5; }
        else { const a0=Math.atan2(pcy-(b.y+b.h),pcx-(b.x+b.w/2));
          for(let i=-2;i<=2;i++)efire(b.x+b.w/2,b.y+b.h,a0+i*0.16,3.6,{color:'#c46bff',grav:0.02,w:18,h:18}); SFX.shoot2(); } }
    }
    b.x=clamp(b.x,b.arena.left,b.arena.right-b.w);
  }
  if(player.iframe<=0 && !player.dead && aabb(player,b))hurtPlayer(1);
}
function makeAdd(x,y){ return {x,y,vx:0,vy:0,dir:-1,onGround:false,dead:false,hp:2,type:'zombie',
  t:0,anim:0,hitWall:false,flash:0,speed:1.4,shoot:0,w:26,h:36}; }

/* ---------------- 粒子 ---------------- */
function burst(x,y,color,n,spd){ for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2),s=rand(1,spd);
  particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(0,2),life:rand(18,38),max:38,color,size:rand(2,5)}); } }
// 命中迸溅: 沿入射反方向喷溅的火花
function sparks(x,y,color,vx,vy){ const a=Math.atan2(-vy,-vx);
  for(let i=0;i<6;i++){ const aa=a+rand(-0.7,0.7),s=rand(2,6);
    particles.push({x,y,vx:Math.cos(aa)*s,vy:Math.sin(aa)*s,life:rand(6,14),max:14,color:i<2?'#fff':color,size:rand(1,3)}); } }
function updateParticles(){ for(const p of particles){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.18; p.vx*=0.96; p.life--; }
  if(particles.length>600)particles.splice(0,particles.length-600);   // 上限保护
  particles=particles.filter(p=>p.life>0); }
function updateFloaters(){ for(const f of floaters){ f.t=(f.t||0)+1;
  if(f.kind==='text'){ f.y+=f.vy; f.life--; } }
  floaters=floaters.filter(f=>f.kind==='portal'||f.life>0); }

/* ---------------- 关卡切换 ---------------- */
function loadLevel(i){
  G.levelIndex=i; G.lvl=buildLevel(LEVELS[i]);
  player=resetPlayerForLevel();
  enemies=[]; bullets=[]; ebullets=[]; particles=[]; floaters=[]; boss=null;
  powerups=G.lvl.powerups.map(u=>Object.assign({},u));
  for(const s of G.lvl.spawns)spawnEnemy(s);
  G.bossLock=false; G.bossLockX=0; G.cam={x:0,y:0}; G.camLead=0; G.combo=0; G.comboT=0;
  G.trauma=0; G.kickX=0; G.kickY=0; G.shake=0; G.flash=0; G.fade=1;   // 关卡淡入
  G.paused=false; G.overlay=null; G.message=LEVELS[i].name; G.msgT=160;
  startMusic(false);
}
let carry={lives:3,score:0};
function resetPlayerForLevel(){ const p=makePlayer(G.lvl.start.x,G.lvl.start.y);
  p.lives=carry.lives; return p; }
function nextLevel(){ carry.lives=player.lives; carry.score=G.score;
  if(G.levelIndex+1<LEVELS.length){ G.state='play'; loadLevel(G.levelIndex+1); SFX.win(); }
  else { recordScore(G.score); G.state='clear'; stopMusic(); SFX.win(); } }
function startGame(){ audio(); carry={lives:DIFF().life,score:0}; G.score=0; G.state='play'; loadLevel(0); }

/* ============================================================
   绘制
   ============================================================ */
function blockColor(ch){ return {'#':'#5bbf4a','d':'#7a5230','s':'#7f7f7f','b':'#2b2b2b',
  '=':'#9c6b3f','n':'#5a2d2d','e':'#d9d2b0','L':'#ff7a18','^':'#cfe8b0'}[ch]||'#888'; }
function noiseTex(x,y,t,c){ X.fillStyle=c; for(let i=0;i<6;i++){ const px=x+((i*13+x)%t),py=y+((i*7+y)%t); X.fillRect(px%(x+t-2),py,3,3); } }
function drawBlock(ch,x,y){ const t=TILE;
  switch(ch){
    case '#': X.fillStyle='#7a5230';X.fillRect(x,y,t,t); X.fillStyle='#5bbf4a';X.fillRect(x,y,t,10);
      X.fillStyle='#69d957';for(let i=0;i<t;i+=6)X.fillRect(x+i,y-3+(i%12?0:2),3,6); noiseTex(x,y,t,'#6b4327'); break;
    case 'd': X.fillStyle='#7a5230';X.fillRect(x,y,t,t); noiseTex(x,y,t,'#684827'); break;
    case 's': X.fillStyle='#828282';X.fillRect(x,y,t,t); noiseTex(x,y,t,'#6f6f6f'); X.strokeStyle='#5f5f5f';X.strokeRect(x+.5,y+.5,t-1,t-1); break;
    case 'b': X.fillStyle='#2f2f2f';X.fillRect(x,y,t,t); noiseTex(x,y,t,'#1f1f1f'); X.fillStyle='#444';X.fillRect(x+4,y+4,10,10);X.fillRect(x+22,y+20,12,12); break;
    case '=': X.fillStyle='#9c6b3f';X.fillRect(x,y,t,t); X.fillStyle='#8a5d36';for(let i=0;i<t;i+=10)X.fillRect(x,y+i,t,2); X.strokeStyle='#6e4827';X.strokeRect(x+.5,y+.5,t-1,t-1); break;
    case 'n': X.fillStyle='#5a2d2d';X.fillRect(x,y,t,t); noiseTex(x,y,t,'#7a1f1f'); X.fillStyle='#3a1a1a';X.fillRect(x+6,y+8,6,6);X.fillRect(x+26,y+22,5,5); break;
    case 'e': X.fillStyle='#d9d2b0';X.fillRect(x,y,t,t); noiseTex(x,y,t,'#c4bd97'); X.strokeStyle='#b3aa83';X.strokeRect(x+.5,y+.5,t-1,t-1); break;
    case 'L': { const f=Math.sin(G.t*0.1+x*0.1)*3; X.fillStyle='#ff7a18';X.fillRect(x,y,t,t);
      X.fillStyle='#ffd000';X.fillRect(x,y+4+f,t,5); X.fillStyle='#ff3000';for(let i=0;i<t;i+=12)X.fillRect(x+i,y+18+Math.sin(G.t*0.15+i)*2,8,6); break; }
    case '^': { X.fillStyle='#6f6f6f';X.fillRect(x,y+t-8,t,8); X.fillStyle='#d7d7d7';
      for(let i=0;i<4;i++){ X.beginPath();X.moveTo(x+i*10,y+t-6);X.lineTo(x+i*10+5,y+6);X.lineTo(x+i*10+10,y+t-6);X.closePath();X.fill(); } break; }
  }
}
function drawSoldier(p){
  X.save(); const blink=p.iframe>0&&Math.floor(G.t/3)%2===0; if(blink)X.globalAlpha=0.4;
  const cx=p.x+p.w/2, f=p.dir;
  X.translate(cx,p.y);
  const proneOff=p.prone?14:0;
  const swing=p.onGround&&!p.prone?Math.sin(p.walkAnim)*6:3;
  if(p.prone){
    // 卧倒
    X.fillStyle='#2f7d4a'; X.fillRect(-16,p.h-12,32,12);
    X.fillStyle='#caa07a'; X.fillRect(f>0?10:-22,p.h-18,12,8); // 头
    // 枪
    X.strokeStyle='#39424f'; X.lineWidth=3; X.beginPath(); X.moveTo(0,p.h-14); X.lineTo(f*22,p.h-14); X.stroke();
  } else {
    // 腿
    X.fillStyle='#39424f'; X.fillRect(-9,22,8,14+(p.onGround?Math.max(0,swing):0)); X.fillRect(1,22,8,14+(p.onGround?Math.max(0,-swing):0));
    // 身(军绿)
    X.fillStyle='#2f7d4a'; X.fillRect(-10,6,20,18); X.fillStyle='#256340'; X.fillRect(-10,6,20,4);
    // 头(Steve肤色 + 头巾)
    X.fillStyle='#caa07a'; X.fillRect(-9,-12,18,18);
    X.fillStyle='#b33'; X.fillRect(-10,-13,20,6);
    X.fillStyle='#fff'; X.fillRect(f>0?0:-6,-4,6,4); X.fillStyle='#3a6ea5'; X.fillRect(f>0?2:-4,-4,3,4);
    // 持枪手臂(指向瞄准方向)
    const ga=Math.atan2(p.aimY,p.aimX);
    X.save(); X.translate(0,12); X.rotate(ga);
    X.fillStyle='#caa07a'; X.fillRect(0,-3,16,6);
    X.fillStyle='#39424f'; X.fillRect(12,-4,16,8);           // 枪身
    if(p.muzzle>0){ X.fillStyle='#ffe066'; X.beginPath(); X.arc(30,0,6+p.muzzle,0,7); X.fill(); }
    X.restore();
  }
  X.restore();
}
function drawEnemy(e){
  X.save(); X.translate(e.x+e.w/2,e.y); if(e.flash>0)X.globalAlpha=0.9;
  if(e.type==='zombie'){ const sw=Math.sin(e.anim)*5;
    X.fillStyle='#2f5d3a';X.fillRect(-9,22,8,14);X.fillRect(1,22,8,14);
    X.fillStyle='#2a7d8c';X.fillRect(-10,6,20,18); X.fillStyle='#3aa07a';X.fillRect(-14,8,5,16);X.fillRect(9,8,5,16);
    X.fillStyle='#4f8f5a';X.fillRect(-9,-12,18,18); X.fillStyle='#0a0a0a';X.fillRect(-6,-6,5,4);X.fillRect(2,-6,5,4);
  } else if(e.type==='creeper'){ const arm=e.armed?(Math.floor(G.t/4)%2?'#fff':'#7ac74f'):'#7ac74f';
    if(e.armed)X.scale(1+(e.fuse/45)*0.18,1+(e.fuse/45)*0.18);
    X.fillStyle=arm;X.fillRect(-11,-14,22,46); X.fillStyle='#0a0a0a';X.fillRect(-7,-8,5,5);X.fillRect(3,-8,5,5);X.fillRect(-3,-2,6,10);X.fillRect(-6,4,4,8);X.fillRect(3,4,4,8);
    X.fillStyle=arm;X.fillRect(-10,30,7,6);X.fillRect(4,30,7,6);
  } else if(e.type==='skeleton'){
    X.fillStyle='#d9d9d9';X.fillRect(-8,22,6,14);X.fillRect(3,22,6,14); X.fillStyle='#cfcfcf';X.fillRect(-9,6,18,16);
    X.fillStyle='#bdbdbd';for(let i=-7;i<8;i+=5)X.fillRect(i,8,2,12); X.fillStyle='#e6e6e6';X.fillRect(-9,-12,18,16);
    X.fillStyle='#111';X.fillRect(-6,-6,5,5);X.fillRect(2,-6,5,5);
    X.strokeStyle='#7c5a32';X.lineWidth=2;X.beginPath();X.arc(e.dir*10,8,10,-1,1);X.stroke();
  } else if(e.type==='turret'){
    X.fillStyle='#4a4a52';X.fillRect(-17,-17,34,34); X.fillStyle='#2c2c33';X.fillRect(-17,-17,34,8);
    const a=Math.atan2((player.y+player.h/2)-(e.y+e.h/2),(player.x+player.w/2)-(e.x+e.w/2));
    X.save();X.rotate(a); X.fillStyle='#23232a';X.fillRect(0,-6,26,12); X.fillStyle='#ff7a3d';X.fillRect(22,-4,5,8); X.restore();
    X.fillStyle='#ff5a3d';X.fillRect(-6,-6,12,12);
  } else if(e.type==='blaze'){ const r=Math.sin(e.t*0.3)*3;
    X.fillStyle='rgba(255,150,30,.5)';X.beginPath();X.arc(0,0,22+r,0,7);X.fill();
    X.fillStyle='#ffd24a';X.fillRect(-9,-12,18,24); X.fillStyle='#ff8a2a';for(let i=0;i<4;i++){const a=e.t*0.2+i*1.6;X.fillRect(Math.cos(a)*16-3,Math.sin(a)*16-3,6,6);}
    X.fillStyle='#fff';X.fillRect(-6,-6,4,4);X.fillRect(2,-6,4,4);
  }
  X.restore();
}
function drawBoss(){ const b=boss; X.save(); X.translate(b.x+b.w/2,b.y+b.h/2);
  if(b.flash>0&&Math.floor(G.t/2)%2)X.globalAlpha=0.5; const w=b.w,h=b.h;
  if(b.type==='fortress'){
    X.fillStyle='#3a1f1f';X.fillRect(-w/2,-h/2,w,h); noiseTexC(w,h,'#5a2d2d');
    X.fillStyle='#241313';for(let r=-h/2+10;r<h/2;r+=28)X.fillRect(-w/2,r,w,4);
    // 两炮口
    for(const oy of [-h*0.28,h*0.28]){ X.fillStyle='#23232a';X.fillRect(-w/2-14,oy-12,26,24); X.fillStyle='#ff7a3d';X.fillRect(-w/2-16,oy-4,6,8); }
    // 核心(弱点)
    const beat=0.6+Math.sin(b.t*0.2)*0.4; X.fillStyle='rgba(255,90,40,'+beat+')';X.fillRect(-18,-22,36,44);
    X.strokeStyle='#ffce6b';X.lineWidth=3;X.strokeRect(-20,-24,40,48);
  } else if(b.type==='wither'){
    X.fillStyle='#2b2b2b';X.fillRect(-w/2,-h*0.1,w,h*0.5); X.fillStyle='#1a1a1a';X.fillRect(-6,-h*0.1,12,h*0.8);
    const heads=[[-w*0.34,-h*0.3,26],[0,-h*0.42,30],[w*0.34,-h*0.3,26]];
    for(const [hx,hy,hs] of heads){ X.fillStyle='#3a3a3a';X.fillRect(hx-hs/2,hy-hs/2,hs,hs);
      X.fillStyle=b.hp<b.maxHp*0.4?'#7fd4ff':'#ff5a2a';X.fillRect(hx-hs*0.3,hy-hs*0.1,hs*0.25,hs*0.2);X.fillRect(hx+hs*0.08,hy-hs*0.1,hs*0.25,hs*0.2); }
  } else if(b.type==='dragon'){ const flap=Math.sin(b.t*0.18)*16,face=b.dx<0?-1:1; X.scale(face,1);
    X.fillStyle='#1a1030';X.beginPath();X.moveTo(-10,-6);X.lineTo(-w*0.7,-30-flap);X.lineTo(-w*0.5,10);X.closePath();X.fill();
    X.beginPath();X.moveTo(10,-6);X.lineTo(w*0.5,-20-flap*0.6);X.lineTo(w*0.4,12);X.closePath();X.fill();
    X.fillStyle='#241038';X.fillRect(-w*0.4,-12,w*0.8,30); X.fillStyle='#2e1545';X.fillRect(w*0.2,-20,w*0.3,18);X.fillRect(w*0.42,-26,26,22);
    X.fillStyle='#c46bff';X.fillRect(w*0.5,-20,7,6);X.fillRect(w*0.5,-12,7,4);
    X.fillStyle='#241038';X.beginPath();X.moveTo(-w*0.4,2);X.lineTo(-w*0.7,10);X.lineTo(-w*0.4,16);X.fill();
  }
  X.restore();
}
function noiseTexC(w,h,c){ X.fillStyle=c; for(let i=0;i<14;i++)X.fillRect(-w/2+((i*37)%w),-h/2+((i*53)%h),4,4); }

function drawBullet(b,sx,sy){
  if(b.kind==='laser'){ X.save();X.translate(sx,sy);X.rotate(b.rot);
    X.globalAlpha=0.4;X.fillStyle=b.color;X.fillRect(-22,-b.h/2-2,30,b.h+4);X.globalAlpha=1;  // 余辉
    X.fillStyle=b.color;X.fillRect(-b.w/2,-b.h/2,b.w,b.h); X.fillStyle='#fff';X.fillRect(-b.w/2,-1,b.w,2); X.restore(); }
  else if(b.flame){ X.fillStyle='rgba(255,140,50,'+clamp(b.life/30,0,.9)+')';X.beginPath();X.arc(sx,sy,b.w/2,0,7);X.fill();
    X.fillStyle='rgba(255,220,120,.8)';X.beginPath();X.arc(sx,sy,b.w/4,0,7);X.fill(); }
  else { const sp=Math.hypot(b.vx,b.vy)||1, tl=clamp(sp*1.6,8,22);
    X.save();X.translate(sx,sy);X.rotate(b.rot);
    X.globalAlpha=0.5;X.strokeStyle=b.color;X.lineWidth=3;X.beginPath();X.moveTo(-tl,0);X.lineTo(2,0);X.stroke();X.globalAlpha=1; // 拖尾
    X.fillStyle=b.color;X.fillRect(-5,-2,12,4); X.fillStyle='#fff';X.fillRect(2,-1,5,2); X.restore(); }
}
function drawPowerup(u,sx,sy){ const bob=Math.sin(u.t*0.1)*3;
  const m={spread:['S','#7ad0ff'],machine:['M','#ffe066'],laser:['L','#ff6bd0'],flame:['F','#ff8a3d'],health:['❤','#ff5566']}[u.kind];
  X.save(); X.translate(sx+14,sy+15+bob);
  X.fillStyle='rgba(0,0,0,.35)';X.fillRect(-15,-15,30,30);
  X.fillStyle=m[1];X.fillRect(-13,-13,26,26); X.strokeStyle='#fff';X.lineWidth=2;X.strokeRect(-13,-13,26,26);
  X.fillStyle='#10202c';X.font='bold 18px monospace';X.textAlign='center';X.textBaseline='middle';X.fillText(m[0],0,1);
  X.textBaseline='alphabetic'; X.restore();
}

/* ---------------- 背景 ---------------- */
function drawBackground(){ const sky=G.lvl.def.sky, biome=G.lvl.def.biome;
  const g=X.createLinearGradient(0,0,0,VH); g.addColorStop(0,sky[0]); g.addColorStop(1,sky[1]);
  X.fillStyle=g; X.fillRect(0,0,VW,VH);
  const par=-G.cam.x*0.3;
  if(biome==='end'){ X.fillStyle='rgba(255,255,255,.6)';
    for(let i=0;i<40;i++){ const sx=((i*97-par*0.2)%VW+VW)%VW, sy=(i*53)%VH*0.7; X.fillRect(sx,sy,2,2); }
    X.fillStyle='rgba(20,10,30,.6)';for(let i=0;i<6;i++){ const px=((i*220-par)%(VW+260)+VW+260)%(VW+260)-130; X.fillRect(px,VH*0.32,40,VH*0.55); }
  } else if(biome==='nether'){ X.fillStyle='rgba(255,90,20,.10)';
    for(let i=0;i<5;i++){ const px=((i*240-par)%(VW+260)+VW+260)%(VW+260)-130; X.beginPath();X.arc(px,VH*0.8,120,0,7);X.fill(); }
  } else { X.fillStyle='rgba(255,255,255,.85)';
    for(let i=0;i<6;i++){ const px=((i*260-par)%(VW+280)+VW+280)%(VW+280)-140,py=50+(i%3)*46; cloud(px,py); }
    X.fillStyle='rgba(40,120,60,.4)';for(let i=0;i<8;i++){ const px=((i*180+G.cam.x*0.5)%(VW+200)+VW+200)%(VW+200)-100; X.beginPath();X.moveTo(px,VH);X.lineTo(px+90,VH-130);X.lineTo(px+180,VH);X.fill(); }
  }
}
function cloud(x,y){ X.fillRect(x,y,70,18);X.fillRect(x+14,y-12,44,18);X.fillRect(x+30,y-20,30,20); }

/* ---------------- HUD ---------------- */
function heart(x,y){ X.beginPath();X.moveTo(x+5,y+4);X.bezierCurveTo(x+5,y+2,x,y,x,y+5);
  X.bezierCurveTo(x,y+9,x+5,y+11,x+5,y+13);X.bezierCurveTo(x+5,y+11,x+11,y+9,x+11,y+5);X.bezierCurveTo(x+11,y,x+5,y+2,x+5,y+4);X.fill(); }
function drawHUD(){
  for(let i=0;i<player.maxHp;i++){ const hx=14+i*26,hy=14;
    X.fillStyle='#3a0000';heart(hx,hy); if(player.hp>i){ X.fillStyle='#ff4d5e';heart(hx,hy); } }
  // 命数
  X.fillStyle='#fff';X.font='bold 15px "Microsoft YaHei"';X.textAlign='left';
  X.fillText('× '+Math.max(0,player.lives), 14, 56);
  X.fillStyle='#2f7d4a';X.fillRect(40,44,12,12);X.fillStyle='#caa07a';X.fillRect(43,41,6,5);
  // 武器
  const w=WEAPONS[player.weapon];
  X.fillStyle='rgba(0,0,0,.4)';X.fillRect(VW-200,10,186,30);
  X.fillStyle=w.color;X.fillRect(VW-194,16,18,18); X.fillStyle='#10202c';X.font='bold 13px monospace';X.textAlign='center';X.fillText(w.letter,VW-185,29);
  X.fillStyle='#fff';X.font='bold 15px "Microsoft YaHei"';X.textAlign='left';X.fillText(w.name,VW-168,30);
  // 分数
  X.fillStyle='rgba(0,0,0,.4)';X.fillRect(VW-200,46,186,24);
  X.fillStyle='#bfe';X.font='14px monospace';X.fillText('分数 '+G.score,VW-194,63);
  if(SAVE.best>0){ X.fillStyle='#ffe680';X.font='11px monospace';X.textAlign='right';X.fillText('最高 '+SAVE.best,VW-16,63);X.textAlign='left'; }
  // 连击
  if(G.combo>1 && G.comboT>0){ const a=clamp(G.comboT/120,0,1);
    X.fillStyle='rgba(255,220,80,'+a+')';X.font='bold '+(20+Math.min(G.combo,20))+'px "Microsoft YaHei"';X.textAlign='center';
    X.fillText('连击 ×'+G.combo,VW/2,84); X.textAlign='left'; }
  // 关卡名(右下角小字)
  X.fillStyle='rgba(0,0,0,.35)';X.fillRect(VW-200,VH-28,186,22);
  X.fillStyle='#cfe';X.font='12px "Microsoft YaHei"';X.fillText('关卡 '+(G.levelIndex+1)+'/'+LEVELS.length,VW-194,VH-13);
}
function drawBossBar(){ if(!boss||boss.defeated)return;
  const w=560,h=20,x=(VW-w)/2,y=22;
  X.fillStyle='rgba(0,0,0,.55)';X.fillRect(x-4,y-24,w+8,h+34);
  X.fillStyle='#fff';X.font='bold 15px "Microsoft YaHei"';X.textAlign='center';X.fillText(bossName(boss.type),VW/2,y-7);
  X.fillStyle='#3a0a0a';X.fillRect(x,y,w,h);
  const hp=Math.max(0,Math.ceil(boss.hp)),ratio=clamp(boss.hp/boss.maxHp,0,1);
  const grd=X.createLinearGradient(x,0,x+w,0);
  if(ratio>0.4){grd.addColorStop(0,'#ff3b3b');grd.addColorStop(1,'#ff8a3b');}else{grd.addColorStop(0,'#ff5a2a');grd.addColorStop(1,'#ffd24a');}
  X.fillStyle=grd;X.fillRect(x,y,w*ratio,h);
  X.strokeStyle='rgba(0,0,0,.35)';X.lineWidth=1;for(let i=1;i<10;i++){const gx=x+w*(i/10);X.beginPath();X.moveTo(gx,y);X.lineTo(gx,y+h);X.stroke();}
  X.strokeStyle='#000';X.lineWidth=2;X.strokeRect(x,y,w,h);
  X.font='bold 13px monospace';X.textAlign='center';X.lineWidth=3;X.strokeStyle='rgba(0,0,0,.85)';X.strokeText(hp+' / '+boss.maxHp,VW/2,y+h-5);
  X.fillStyle='#fff';X.fillText(hp+' / '+boss.maxHp,VW/2,y+h-5); X.textAlign='left';
}

/* ---------------- 主渲染 ---------------- */
function render(){
  // 摄像机(朝向前瞻 + 平滑)
  const targetLead=player.dir*120;
  G.camLead=lerp(G.camLead,targetLead,0.05);
  let tx=player.x+player.w/2 - VW/2 + G.camLead;
  let ty=player.y+player.h/2 - VH/2 - 30;
  const maxX=G.lvl.pxW-VW, maxY=G.lvl.pxH-VH;
  if(G.bossLock)tx=G.bossLockX;
  G.cam.x=-clamp(tx,0,Math.max(0,maxX)); G.cam.y=-clamp(ty,0,Math.max(0,maxY));
  // trauma 平方曲线震动 + 开火相机踢
  let shx=0,shy=0;
  if(SETTINGS.shake){ const m=G.trauma*G.trauma*16; shx=rand(-m,m)+G.kickX; shy=rand(-m,m)+G.kickY; }

  resetT();
  drawBackground();
  X.save(); X.translate(G.cam.x+shx,G.cam.y+shy);
  const c0=Math.max(0,Math.floor(-G.cam.x/TILE)-1),c1=Math.min(G.lvl.W-1,c0+Math.ceil(VW/TILE)+2);
  const r0=Math.max(0,Math.floor(-G.cam.y/TILE)-1),r1=Math.min(G.lvl.H-1,r0+Math.ceil(VH/TILE)+2);
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){ const ch=G.lvl.map[r][c]; if(ch!==' ')drawBlock(ch,c*TILE,r*TILE); }
  X.restore();

  const ox=G.cam.x+shx, oy=G.cam.y+shy;
  for(const u of powerups)if(!u.got)drawPowerup(u,u.x+ox,u.y+oy);
  X.save();X.translate(ox,oy); for(const e of enemies)if(!e.dead)drawEnemy(e); X.restore();
  if(boss){ X.save();X.translate(ox,oy);drawBoss();X.restore(); }
  X.save();X.translate(ox,oy);drawSoldier(player);X.restore();
  for(const b of bullets)drawBullet(b,b.x+b.w/2+ox,b.y+b.h/2+oy);
  for(const b of ebullets){ const bx=b.x+b.w/2+ox,by=b.y+b.h/2+oy, col=SETTINGS.colorblind?'#ff2bd6':b.color;
    X.strokeStyle='rgba(0,0,0,.6)';X.lineWidth=2;X.beginPath();X.arc(bx,by,b.w/2+1,0,7);X.stroke();   // 描边增可读性
    X.fillStyle=col;X.beginPath();X.arc(bx,by,b.w/2,0,7);X.fill();
    X.fillStyle='#fff';X.beginPath();X.arc(bx,by,b.w/4,0,7);X.fill(); }
  for(const p of particles){ X.globalAlpha=clamp(p.life/p.max,0,1);X.fillStyle=p.color;X.fillRect(p.x+ox,p.y+oy,p.size,p.size); } X.globalAlpha=1;
  // 传送门 + 飘字
  for(const f of floaters){ if(f.kind==='portal'){ const x=f.x+ox,y=f.y+oy;
      for(let i=0;i<6;i++){ const a=f.t*0.05+i; X.fillStyle='rgba(160,60,220,'+(0.3+0.2*Math.sin(a))+')';X.fillRect(x+Math.sin(a)*6,y+i*16,f.w,16); }
      X.strokeStyle='#c46bff';X.lineWidth=3;X.strokeRect(x-2,y-2,f.w+4,f.h+4);
      X.fillStyle='#fff';X.font='12px "Microsoft YaHei"';X.textAlign='center';X.fillText('传送门',x+f.w/2,y-8);X.textAlign='left';
    } else if(f.kind==='text'){ X.globalAlpha=clamp(f.life/36,0,1);X.fillStyle=f.color;X.font='bold '+(f.big?18:14)+'px "Microsoft YaHei"';X.textAlign='center';X.fillText(f.text,f.x+ox,f.y+oy);X.textAlign='left';X.globalAlpha=1; }
  }
  // 暗角(氛围)
  if(motionOK())drawVignette();
  if(boss)drawBossBar();
  drawHUD();
  // 全屏闪光
  if(G.flash>0){ X.globalAlpha=clamp(G.flash/16,0,0.55);X.fillStyle=G.flashColor;X.fillRect(0,0,VW,VH);X.globalAlpha=1; }
  // 关卡淡入
  if(G.fade>0){ X.globalAlpha=clamp(G.fade,0,1);X.fillStyle='#06080c';X.fillRect(0,0,VW,VH);X.globalAlpha=1; }
  // 消息横幅
  if(G.msgT>0){ const a=clamp(G.msgT/30,0,1); X.globalAlpha=a; X.fillStyle='rgba(0,0,0,.55)';X.fillRect(0,VH/2-34,VW,68);
    X.fillStyle='#ffe680';X.font='bold 28px "Microsoft YaHei"';X.textAlign='center';X.fillText(G.message,VW/2,VH/2+8);X.textAlign='left'; X.globalAlpha=1; }
}
let _vig=null;
function drawVignette(){
  if(!_vig||_vig.w!==VW){ _vig=X.createRadialGradient(VW/2,VH/2,VH*0.45,VW/2,VH/2,VH*0.95);
    _vig.addColorStop(0,'rgba(0,0,0,0)'); _vig.addColorStop(1,'rgba(0,0,0,0.42)'); _vig.w=VW; }
  X.fillStyle=_vig; X.fillRect(0,0,VW,VH);
}

/* ---------------- 标题/结束 ---------------- */
function drawTitle(){ resetT();
  const g=X.createLinearGradient(0,0,0,VH);g.addColorStop(0,'#1a2a40');g.addColorStop(1,'#3a1010');X.fillStyle=g;X.fillRect(0,0,VW,VH);
  for(let i=0;i<16;i++){ const x=(i*71+G.t*0.7)%(VW+60)-30,y=70+(i%5)*92+Math.sin(G.t*0.02+i)*18;
    const cols=['#5bbf4a','#7a5230','#7f7f7f','#2f7d4a','#ff7a3d'];X.fillStyle=cols[i%5];X.globalAlpha=.45;X.fillRect(x,y,30,30);X.globalAlpha=1; }
  X.textAlign='center';
  X.fillStyle='#0a0a0a';X.font='bold 70px "Microsoft YaHei"';X.fillText('MC 魂斗罗',VW/2+4,176);
  X.fillStyle='#ffcf3a';X.fillText('MC 魂斗罗',VW/2,172);
  X.fillStyle='#eaf6ff';X.font='20px "Microsoft YaHei"';X.fillText('—— 我的世界版魂斗罗 · 跑射闯关 ——',VW/2,214);
  X.fillStyle='#cfe';X.font='15px "Microsoft YaHei"';
  X.fillText('← → 移动   空格 跳跃   ↑↓ 瞄准/卧倒   J/鼠标 射击(按住连发)',VW/2,288);
  X.fillText('武器: S 喷射 · M 机枪 · L 激光 · F 烈焰 · ❤ 回血',VW/2,316);
  X.fillStyle='#9fd0ff';X.font='13px "Microsoft YaHei"';X.fillText('P / Esc 暂停设置',VW/2,344);
  X.fillStyle='#ffe680';X.font='bold 17px "Microsoft YaHei"';X.fillText('◀ 难度：'+DIFFS[SETTINGS.difficulty].name+' ▶   ( ← → 切换 )',VW/2,382);
  if(SAVE.best>0){ X.fillStyle='#cfe';X.font='14px "Microsoft YaHei"';X.fillText('🏆 最高分 '+SAVE.best,VW/2,408); }
  if(Math.floor(G.t/30)%2){ X.fillStyle='#fff';X.font='bold 24px "Microsoft YaHei"';X.fillText('按 Enter 或 点击屏幕 开始',VW/2,452); }
  X.textAlign='left';
}
function drawEnd(win){ resetT();
  X.fillStyle=win?'rgba(10,40,20,.92)':'rgba(40,10,10,.92)';X.fillRect(0,0,VW,VH);X.textAlign='center';
  X.fillStyle=win?'#7CFC9A':'#ff6b6b';X.font='bold 54px "Microsoft YaHei"';
  X.fillText(win?'🏆 通关！要塞已清剿！':'💀 任务失败…',VW/2,VH/2-40);
  X.fillStyle='#fff';X.font='22px "Microsoft YaHei"';X.fillText('得分：'+G.score,VW/2,VH/2+8);
  const rec=G.score>0&&G.score>=SAVE.best; X.fillStyle=rec?'#ffe680':'#cfe';X.font='16px "Microsoft YaHei"';
  X.fillText(rec?('🎉 新纪录！历史最高 '+SAVE.best):('历史最高 '+SAVE.best),VW/2,VH/2+40);
  X.fillStyle='#cfe';X.font='16px "Microsoft YaHei"';X.fillText(win?'按 Enter / 点击 回到标题':'按 Enter / 点击 重新开始本关',VW/2,VH/2+76);
  X.textAlign='left';
}

/* ============================================================
   暂停菜单
   ============================================================ */
const MENU=[{id:'resume',label:'继续游戏'},{id:'volume',label:'音量'},{id:'mute',label:'音效'},
  {id:'difficulty',label:'难度'},{id:'shake',label:'画面震动'},{id:'colorblind',label:'色盲友好'},
  {id:'reduceMotion',label:'减弱动效'},{id:'restart',label:'重新开始本关'},{id:'title',label:'返回标题'}];
function menuGeom(){ const pw=460,rh=40,ph=78+MENU.length*rh+28,px=(VW-pw)/2,py=(VH-ph)/2;
  return {px,py,pw,ph,rows:MENU.map((m,i)=>({m,i,x:px+26,y:py+72+i*rh,w:pw-52,h:rh-6}))}; }
function pauseGame(){ if(G.paused)return; G.paused=true; G.overlay='pause'; G.menuIndex=0; SFX.ui(); }
function resumeGame(){ G.paused=false; G.overlay=null; }
function menuActivate(id){ SFX.ui();
  if(id==='resume')resumeGame();
  else if(id==='mute'){ SETTINGS.muted=!SETTINGS.muted; applyVolume(); persist(); }
  else if(id==='shake'){ SETTINGS.shake=!SETTINGS.shake; persist(); }
  else if(id==='colorblind'){ SETTINGS.colorblind=!SETTINGS.colorblind; persist(); }
  else if(id==='reduceMotion'){ SETTINGS.reduceMotion=!SETTINGS.reduceMotion; persist(); }
  else if(id==='difficulty'){ SETTINGS.difficulty=(SETTINGS.difficulty+1)%3; persist(); }
  else if(id==='restart'){ resumeGame(); loadLevel(G.levelIndex); }
  else if(id==='title'){ resumeGame(); stopMusic(); G.state='title'; }
}
function adjVol(d){ SETTINGS.volume=clamp(Math.round((SETTINGS.volume+d)*100)/100,0,1); if(SETTINGS.volume>0)SETTINGS.muted=false; applyVolume(); persist(); }
function updateMenu(){ const g=menuGeom();
  for(const r of g.rows)if(hit(r))G.menuIndex=r.i;
  if(tapped('ArrowUp','KeyW'))G.menuIndex=(G.menuIndex+MENU.length-1)%MENU.length;
  if(tapped('ArrowDown','KeyS'))G.menuIndex=(G.menuIndex+1)%MENU.length;
  const cur=MENU[G.menuIndex];
  if(cur.id==='volume'){ if(tapped('ArrowLeft','KeyA'))adjVol(-0.1); if(tapped('ArrowRight','KeyD'))adjVol(0.1); }
  else if(cur.id==='difficulty'){ if(tapped('ArrowLeft','KeyA')){SETTINGS.difficulty=(SETTINGS.difficulty+2)%3;persist();SFX.ui();} if(tapped('ArrowRight','KeyD')){SETTINGS.difficulty=(SETTINGS.difficulty+1)%3;persist();SFX.ui();} }
  if(tapped('Enter','NumpadEnter','Space'))menuActivate(cur.id);
  if(pointer.justDown){ const row=g.rows.find(r=>hit(r));
    if(row){ if(row.m.id==='volume'){ const bx=row.x+row.w*0.34,bw=row.w*0.5;
        if(pointer.x>=bx&&pointer.x<=bx+bw){ SETTINGS.volume=clamp(Math.round((pointer.x-bx)/bw*10)/10,0,1);SETTINGS.muted=false;applyVolume();persist(); } }
      else menuActivate(row.m.id); } }
  if(tapped('Escape','KeyP'))resumeGame();
}
function roundRect(x,y,w,h,r){ X.beginPath();X.moveTo(x+r,y);X.arcTo(x+w,y,x+w,y+h,r);X.arcTo(x+w,y+h,x,y+h,r);X.arcTo(x,y+h,x,y,r);X.arcTo(x,y,x+w,y,r);X.closePath(); }
function drawPauseOverlay(){ resetT(); X.fillStyle='rgba(0,0,0,.6)';X.fillRect(0,0,VW,VH);
  const g=menuGeom(); X.fillStyle='rgba(20,28,38,.96)';roundRect(g.px,g.py,g.pw,g.ph,14);X.fill();
  X.strokeStyle='#2f8fd0';X.lineWidth=2;roundRect(g.px,g.py,g.pw,g.ph,14);X.stroke();
  X.textAlign='center';X.fillStyle='#fff';X.font='bold 30px "Microsoft YaHei"';X.fillText('⏸ 暂停',VW/2,g.py+50);
  for(const r of g.rows){ const sel=r.i===G.menuIndex;
    X.fillStyle=sel?'rgba(47,143,208,.30)':'rgba(255,255,255,.05)';roundRect(r.x,r.y,r.w,r.h,8);X.fill();
    if(sel){X.strokeStyle='#5fd0ff';X.lineWidth=2;roundRect(r.x,r.y,r.w,r.h,8);X.stroke();}
    X.fillStyle=sel?'#fff':'#cfe';X.font='16px "Microsoft YaHei"';X.textAlign='left';X.fillText(r.m.label,r.x+16,r.y+25);X.textAlign='right';
    if(r.m.id==='volume'){ const bx=r.x+r.w*0.34,bw=r.w*0.5,by=r.y+r.h/2-4;
      X.fillStyle='#10202c';roundRect(bx,by,bw,8,4);X.fill(); X.fillStyle='#3df58a';roundRect(bx,by,bw*SETTINGS.volume,8,4);X.fill();
      X.fillStyle='#fff';X.font='13px monospace';X.fillText(SETTINGS.muted?'静音':(Math.round(SETTINGS.volume*100)+'%'),r.x+r.w-6,r.y+25); }
    else if(r.m.id==='mute'){ X.fillStyle=SETTINGS.muted?'#ff6b6b':'#3df58a';X.fillText(SETTINGS.muted?'关闭':'开启',r.x+r.w-16,r.y+24); }
    else if(r.m.id==='shake'){ X.fillStyle=SETTINGS.shake?'#3df58a':'#ff6b6b';X.fillText(SETTINGS.shake?'开启':'关闭',r.x+r.w-16,r.y+24); }
    else if(r.m.id==='colorblind'){ X.fillStyle=SETTINGS.colorblind?'#3df58a':'#7f9bb3';X.fillText(SETTINGS.colorblind?'开启':'关闭',r.x+r.w-16,r.y+24); }
    else if(r.m.id==='reduceMotion'){ X.fillStyle=SETTINGS.reduceMotion?'#3df58a':'#7f9bb3';X.fillText(SETTINGS.reduceMotion?'开启':'关闭',r.x+r.w-16,r.y+24); }
    else if(r.m.id==='difficulty'){ X.fillStyle='#ffe680';X.fillText('◀ '+DIFFS[SETTINGS.difficulty].name+' ▶',r.x+r.w-16,r.y+24); }
    X.textAlign='left';
  }
  X.fillStyle='#7f9bb3';X.font='12px "Microsoft YaHei"';X.textAlign='center';X.fillText('↑↓ 选择 · ←→ 调节 · Enter 确认 · Esc/P 继续',VW/2,g.py+g.ph-16);X.textAlign='left';
}

/* ============================================================
   主循环 (固定步长)
   ============================================================ */
const STEP_MS=1000/60; let acc=0,lastT=0,errLogged=false;
function stepPlay(){ G.t++;
  if(tapped('KeyP','Escape')){ pauseGame(); return; }
  if(tapped('KeyM')){ SETTINGS.muted=!SETTINGS.muted; applyVolume(); persist(); }
  if(G.hitstop>0){ G.hitstop--; return; }  // 顿帧(冻结逻辑数帧, 强化打击感)
  musicTick();
  updatePlayer();
  for(const e of enemies)if(!e.dead)updateEnemy(e);
  enemies=enemies.filter(e=>!e.dead);
  if(boss)updateBoss();
  updateBullets(); updateParticles(); updateFloaters();
  // 衰减各类反馈
  if(G.trauma>0){G.trauma=Math.max(0,G.trauma-0.04);}
  G.kickX*=0.78; G.kickY*=0.78; if(Math.abs(G.kickX)<0.1)G.kickX=0; if(Math.abs(G.kickY)<0.1)G.kickY=0;
  G.shake=G.trauma*G.trauma*16;
  if(G.flash>0)G.flash--;
  if(G.fade>0)G.fade=Math.max(0,G.fade-0.04);
  if(G.comboT>0){G.comboT--; if(G.comboT<=0)G.combo=0;}
  if(G.msgT>0)G.msgT--;
}
function uiTick(){ G.t++;
  if(G.state==='title'){
    if(tapped('ArrowLeft','KeyA')){ SETTINGS.difficulty=(SETTINGS.difficulty+2)%3; persist(); SFX.ui(); }
    if(tapped('ArrowRight','KeyD')){ SETTINGS.difficulty=(SETTINGS.difficulty+1)%3; persist(); SFX.ui(); }
    if(tapped('Enter','NumpadEnter'))startGame();
  }
  else if(G.state==='play'&&G.paused)updateMenu();
  else if(G.state==='gameover'){ if(tapped('Enter','NumpadEnter')){ carry={lives:DIFF().life,score:0}; G.score=0; G.state='play'; loadLevel(G.levelIndex); } }
  else if(G.state==='clear'){ if(tapped('Enter','NumpadEnter'))G.state='title'; }
}
function draw(){
  if(G.state==='title')drawTitle();
  else if(G.state==='play'){ render(); if(G.paused)drawPauseOverlay(); }
  else if(G.state==='gameover'){ render(); drawEnd(false); }
  else if(G.state==='clear')drawEnd(true);
}
function frame(now){
  try{
    if(!lastT)lastT=now; const dt=now-lastT; lastT=now;
    pollGamepad();
    if(G.state==='play'&&!G.paused){ acc+=dt; if(acc>250)acc=250;
      let steps=0,cleared=false;
      while(acc>=STEP_MS){ stepPlay(); acc-=STEP_MS; if(!cleared){clearPress();cleared=true;} if(++steps>=5){acc=0;break;} }
    } else { acc=0; uiTick(); clearPress(); }
    draw();
  }catch(err){ if(!errLogged){ console.error('[MC魂斗罗] 运行时错误:',err); errLogged=true; drawCrash(err); } }
  requestAnimationFrame(frame);
}
function drawCrash(err){ try{ resetT(); X.fillStyle='rgba(20,0,0,.88)';X.fillRect(0,0,VW,VH);
  X.fillStyle='#ff8a8a';X.font='bold 26px "Microsoft YaHei"';X.textAlign='center';X.fillText('游戏遇到错误，已暂停渲染',VW/2,VH/2-10);
  X.fillStyle='#cfe';X.font='14px monospace';X.fillText(String(err&&err.message||err).slice(0,80),VW/2,VH/2+24);
  X.fillStyle='#9fb4c7';X.font='13px "Microsoft YaHei"';X.fillText('请刷新页面重试（已记录到控制台）',VW/2,VH/2+54);X.textAlign='left'; }catch(e){} }

/* 自适应缩放 + 高DPI */
function fit(){ const s=Math.min(window.innerWidth/VW,window.innerHeight/VH),dpr=window.devicePixelRatio||1;
  const cssW=VW*s,cssH=VH*s,newRS=clamp(Math.ceil(s*dpr),1,6);
  CV.style.width=cssW+'px';CV.style.height=cssH+'px';
  const bw=Math.round(VW*newRS),bh=Math.round(VH*newRS);
  if(CV.width!==bw||CV.height!==bh||RS!==newRS){ RS=newRS;CV.width=bw;CV.height=bh;X.imageSmoothingEnabled=false;resetT(); }
}
addEventListener('resize',fit); fit();
function autoPause(){ if(G.state==='play'&&!G.paused&&player&&!player.dead&&!player.win)pauseGame(); }
addEventListener('blur',autoPause);
document.addEventListener('visibilitychange',()=>{ if(document.hidden)autoPause(); });
CV.addEventListener('contextlost',e=>{e.preventDefault();},false);
CV.addEventListener('contextrestored',()=>{X.imageSmoothingEnabled=false;},false);

/* 启动 */
loadSave();
requestAnimationFrame(frame);

/* QA 调试钩子 (?debug) */
if(typeof location!=='undefined'&&/(?:^|[?&])debug\b/.test(location.search)){
  window.__c={ get G(){return G;}, get player(){return player;}, get boss(){return boss;}, get enemies(){return enemies;},
    start(l=1){ startGame(); G.levelIndex=clamp(l-1,0,LEVELS.length-1); loadLevel(G.levelIndex); },
    warpToBoss(){ if(G.state!=='play')this.start(G.levelIndex+1); if(G.lvl.bossTrigger)player.x=G.lvl.bossTrigger.px-VW*0.5; },
    give(w){ player.weapon=w; },
    nuke(){ if(boss && !boss.dead){ boss.iframe=0; boss.state='fight'; bossHurt(boss.hp); } } };
  console.log('[MC魂斗罗] 调试: __c.warpToBoss() / __c.give("spread")');
}
