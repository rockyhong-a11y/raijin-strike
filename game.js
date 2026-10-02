import { W,H,BOSS_AT,clamp,freshRun,step,bomb,rank } from './engine.js';
import { Sound } from './audio.js';

const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
const audio=new Sound(),images={},keys=new Set(),pointers=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let state=null,ready=false,paused=false,activePointer=null,input={},last=0,accumulator=0,previewTime=0,uiAt=0,finished=false,loaded=0;
let best=0;
try{best=Math.max(0,Number(localStorage.getItem('raijin-best'))||0);audio.enabled=localStorage.getItem('raijin-sound')!=='off';}catch{}
$('best').textContent=String(best).padStart(7,'0');
function syncSound(){ $('sound').setAttribute('aria-pressed',String(audio.enabled));$('sound').setAttribute('aria-label',audio.enabled?'사운드 끄기':'사운드 켜기');$('sound-label').textContent=audio.enabled?'SOUND ON':'SOUND OFF'; }
syncSound();

const assets=['coast','player','fighter','heavy','tank','boss'];
$('launch').disabled=true;$('mobile-launch').disabled=true;
Promise.all(assets.map(name=>new Promise(resolve=>{
  const img=new Image();img.src=`./assets/${name}.png`;
  const complete=()=>{$('loading-bar').style.width=`${++loaded/assets.length*100}%`;resolve();};
  img.onload=()=>{images[name]=img;complete();};img.onerror=()=>{console.warn(`Asset unavailable: ${name}`);complete();};
}))).then(()=>{ready=true;$('loading-bar').style.width='100%';$('loading').classList.add('done');$('launch').disabled=false;$('mobile-launch').disabled=false;});

function fit(){
  const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();
  const width=Math.round(r.width*dpr),height=Math.round(r.height*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
}
new ResizeObserver(fit).observe($('game-wrap'));fit();

function saveBest(){
  if(state.score>best){best=state.score;try{localStorage.setItem('raijin-best',String(best));}catch{}}
}

function start(){
  if(!ready)return;
  if(state?.mode==='playing'){setPause(!paused);return;}
  state=freshRun();paused=false;finished=false;input={};pointers.clear();activePointer=null;keys.clear();accumulator=0;
  document.body.classList.add('playing');$('overlay').hidden=true;$('pause').hidden=false;
  $('launch').firstElementChild.textContent='일시 정지';$('announcer').textContent='출격. 화면을 드래그해 이동하세요. 자동으로 발사됩니다.';
  audio.boss=false;audio.beat=0;audio.start();updateUI();canvas.focus({preventScroll:true});
}

function setPause(value){
  if(state?.mode!=='playing')return;
  paused=value;keys.clear();pointers.clear();activePointer=null;input={};accumulator=0;updateUI();
  $('overlay').hidden=!value;$('pause').setAttribute('aria-label',value?'계속하기':'일시 정지');
  $('launch').firstElementChild.textContent=value?'계속하기':'일시 정지';
  if(value){
    $('overlay-kicker').textContent='FLIGHT ON HOLD';$('overlay-title').textContent='PAUSED';$('overlay-copy').textContent='잠시 숨을 고르세요. 전장은 기다립니다.';
    $('result-stats').hidden=true;$('resume').firstElementChild.textContent='계속하기';audio.pause();$('resume').focus({preventScroll:true});
  }else{audio.start();canvas.focus({preventScroll:true});}
}

function home(){
  if(state)saveBest();state=null;paused=false;finished=false;keys.clear();input={};pointers.clear();activePointer=null;
  document.body.classList.remove('playing');$('overlay').hidden=true;$('pause').hidden=true;$('boss-hud').hidden=true;$('stage-chip').hidden=false;
  $('launch').firstElementChild.textContent='출격하기';audio.boss=false;audio.pause();$('score').textContent='0000000';$('best').textContent=String(best).padStart(7,'0');
  $('lives').textContent='▲ ▲ ▲';$('bombs').textContent='B × 02';$('weapon').textContent='VULCAN / LV. 01';$('progress').style.width='0%';
  (matchMedia('(max-width:700px)').matches?$('mobile-launch'):$('launch')).focus({preventScroll:true});
}

function finish(){
  if(finished)return;finished=true;saveBest();keys.clear();input={};pointers.clear();activePointer=null;
  const clear=state.mode==='clear';$('overlay').hidden=false;$('pause').hidden=true;
  $('overlay-kicker').textContent=clear?'OPERATION COMPLETE':'SIGNAL LOST';$('overlay-title').textContent=clear?'MISSION\nCLEAR':'GAME OVER';
  $('overlay-title').style.whiteSpace='pre-line';$('overlay-copy').textContent=clear?'마지막 방어선이 무너졌습니다. 하늘은 당신의 것입니다.':'기체 신호가 끊겼습니다. 다시 전장으로 돌아가세요.';
  $('result-stats').hidden=false;$('result-stats').innerHTML=`<div>FINAL SCORE<strong>${String(state.score).padStart(7,'0')}</strong></div><div>FLIGHT RANK<strong class="rank">${clear?rank(state):'—'}</strong></div><div>TARGETS DOWN<strong>${state.kills}</strong></div><div>CLOSE CALLS<strong>${state.grazes}</strong></div>`;
  $('resume').firstElementChild.textContent='다시 출격';$('launch').firstElementChild.textContent='다시 출격';
  $('announcer').textContent=`${clear?'작전 성공':'게임 오버'}. 최종 점수 ${state.score}점.`;$('resume').focus({preventScroll:true});
  setTimeout(()=>{if(finished)audio.pause();},1800);
}

$('launch').addEventListener('click',start);$('mobile-launch').addEventListener('click',start);
$('pause').addEventListener('click',()=>setPause(!paused));$('quit').addEventListener('click',home);
$('resume').addEventListener('click',()=>state?.mode==='playing'?setPause(false):start());
$('sound').addEventListener('click',()=>{audio.toggle();try{localStorage.setItem('raijin-sound',audio.enabled?'on':'off');}catch{}syncSound();if(audio.enabled&&state?.mode==='playing'&&!paused)audio.start();});

function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();if(!state){start();return;}if(paused||state.mode!=='playing')return;
  canvas.setPointerCapture(e.pointerId);const at=point(e);pointers.set(e.pointerId,at);
  if(pointers.size>1){if(bomb(state))audio.event('bomb');return;}
  activePointer=e.pointerId;input={x:state.player.x,y:state.player.y};
});
canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;const at=point(e);pointers.set(e.pointerId,at);
  if(e.pointerId===activePointer&&state?.mode==='playing'&&!paused){
    input.x=clamp((input.x??state.player.x)+(at.x-old.x)*1.15,25,W-25);
    input.y=clamp((input.y??state.player.y)+(at.y-old.y)*1.15,76,H-42);
  }
});
function release(e){pointers.delete(e.pointerId);if(e.pointerId===activePointer){activePointer=null;input={};}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{
  const codes=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','Escape','KeyP'];
  if(state?.mode==='playing'&&codes.includes(e.code)){
    e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)setPause(!paused);return;}
    if(paused)return;keys.add(e.code);if(e.code==='Space'&&!e.repeat){if(bomb(state))audio.event('bomb');}input={};
  }
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{if(state?.mode==='playing'&&!paused)setPause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state?.mode==='playing'&&!paused)setPause(true);last=0;});

function updateUI(){
  if(!state)return;
  $('score').textContent=String(state.score).padStart(7,'0');$('best').textContent=String(Math.max(best,state.score)).padStart(7,'0');
  $('lives').textContent='▲ '.repeat(Math.max(0,state.lives)).trim()||'—';$('lives').setAttribute('aria-label',`잔여 기체 ${state.lives}대`);
  $('bombs').textContent=`B × ${String(state.bombs).padStart(2,'0')}`;$('weapon').textContent=`${state.weapon==='laser'?'LASER':'VULCAN'} / LV. ${String(state.power).padStart(2,'0')}`;
  $('progress').style.width=`${Math.min(100,state.time/BOSS_AT*100)}%`;
  const boss=state.boss&&!state.boss.dead;$('boss-hud').hidden=!boss;$('stage-chip').hidden=!!boss;
  if(boss){$('boss-hp').style.width=`${state.boss.hp/state.boss.maxHp*100}%`;$('boss-phase').textContent=`PHASE 0${state.boss.phase}`;}
  if(new URLSearchParams(location.search).has('debug'))canvas.dataset.flight=JSON.stringify({mode:state.mode,paused,time:state.time,score:state.score,lives:state.lives,bombs:state.bombs,power:state.power,x:state.player.x,y:state.player.y});
}

function sprite(name,x,y,width,rotation=0,hit=0,shadow=true){
  const img=images[name];ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  if(img){
    if(shadow){ctx.save();ctx.globalAlpha=.30;ctx.filter='brightness(0) blur(2px)';ctx.drawImage(img,-width/2+14,-width/2+18,width,width);ctx.restore();}
    ctx.drawImage(img,-width/2,-width/2,width,width);
    if(hit>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.7;ctx.drawImage(img,-width/2,-width/2,width,width);}
  }else{ctx.fillStyle=name==='player'?'#d3483c':'#82917a';ctx.beginPath();ctx.moveTo(0,-width*.35);ctx.lineTo(width*.36,width*.22);ctx.lineTo(0,width*.08);ctx.lineTo(-width*.36,width*.22);ctx.closePath();ctx.fill();}
  ctx.restore();
}

function terrain(time,attract=false){
  const img=images.coast;
  ctx.fillStyle='#2c4039';ctx.fillRect(0,0,W,H);
  if(img){
    const height=W*img.height/img.width,scroll=attract?time*11:time*38;
    const offset=scroll%height;
    // Adjacent mirrored map copies share the same edge, avoiding a terrain seam.
    const tile=Math.floor(scroll/height);
    for(let i=-1;i<=1;i++){
      ctx.save();const y=(i-1)*height+offset;
      if((tile-i)%2===0){ctx.translate(0,y+height);ctx.scale(1,-1);ctx.drawImage(img,0,0,W,height);}
      else ctx.drawImage(img,0,y,W,height);
      ctx.restore();
    }
    ctx.fillStyle=attract?'#0c251337':'#15251825';ctx.fillRect(0,0,W,H);
  }
  // Cloud shadows move independently of the ground, giving the flight depth.
  ctx.save();ctx.globalAlpha=.15;
  for(let i=0;i<3;i++){
    const x=80+i*160+Math.sin(time*.07+i)*50,y=((time*19+i*340)%(H+420))-210;
    const g=ctx.createRadialGradient(x,y,0,x,y,160);g.addColorStop(0,'#06140dc0');g.addColorStop(1,'#05170b00');ctx.fillStyle=g;ctx.fillRect(x-160,y-160,320,320);
  }
  ctx.restore();
}

function engineFlame(x,y,time,size=1){
  ctx.save();ctx.translate(x,y);const length=(18+Math.sin(time*48)*5)*size;
  const g=ctx.createLinearGradient(0,0,0,length);g.addColorStop(0,'#fff4c5');g.addColorStop(.25,'#ffa953');g.addColorStop(1,'#ff691800');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-5*size,0);ctx.quadraticCurveTo(-4*size,length*.6,0,length);ctx.quadraticCurveTo(4*size,length*.6,5*size,0);ctx.fill();ctx.restore();
}

function preview(time){
  terrain(time,true);
  const planeY=H*.37+Math.sin(time*.7)*8;
  for(const side of [-1,1]){
    const x=W/2+side*11;const g=ctx.createLinearGradient(x,planeY+20,x,H);g.addColorStop(0,'#eaeee440');g.addColorStop(1,'#d2e9dd00');ctx.fillStyle=g;ctx.fillRect(x-1,planeY+20,2,H-planeY);
    engineFlame(W/2+side*11,planeY+32,time,1.2);
  }
  sprite('player',W/2,planeY,115,Math.sin(time*.6)*.035);
  const fly=(time*18)%700;
  for(let i=0;i<3;i++)sprite('fighter',90+i*138,120-i*55+fly*.28,57,Math.PI);
  ctx.save();ctx.strokeStyle='#e9ef7440';ctx.lineWidth=1;const size=25,cx=W/2,cy=planeY;
  for(const side of [-1,1])for(const end of [-1,1]){ctx.beginPath();ctx.moveTo(cx+side*46,cy+end*size);ctx.lineTo(cx+side*46,cy+end*43);ctx.lineTo(cx+side*30,cy+end*43);ctx.stroke();}
  ctx.restore();
}

function draw(s){
  terrain(s.time);
  ctx.save();
  if(!reducedMotion&&s.shake>0)ctx.translate(Math.sin(s.time*79)*s.shake,Math.cos(s.time*93)*s.shake*.6);
  for(const e of s.enemies)if(e.ground)sprite('tank',e.x,e.y,e.size,Math.PI,e.hit);
  for(const e of s.enemies)if(!e.ground){
    const name=e.kind==='heavy'||e.kind==='carrier'?'heavy':'fighter';
    sprite(name,e.x,e.y,e.size,Math.PI+Math.cos(e.age*1.4+e.phase)*.07,e.hit);
    if(e.kind==='carrier'){ctx.fillStyle='#e9ef74';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('P',e.x,e.y+7);}
  }
  if(s.boss){
    const b=s.boss;for(const side of [-1,1])engineFlame(b.x+side*47,b.y-66,s.time,2);
    sprite('boss',b.x,b.y,318,Math.PI,b.hit);
    if(b.phase===3&&!b.dead){ctx.save();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(b.x,b.y+16,0,b.x,b.y+16,38);g.addColorStop(0,'#ffaa44aa');g.addColorStop(1,'#ff541100');ctx.fillStyle=g;ctx.fillRect(b.x-38,b.y-22,76,76);ctx.restore();}
  }
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const shot of s.shots){
    ctx.strokeStyle=shot.kind==='laser'?'#83edff':'#ff664f';ctx.lineWidth=shot.kind==='laser'?5:7;ctx.beginPath();ctx.moveTo(shot.x,shot.y);ctx.lineTo(shot.x-shot.vx*.025,shot.y+shot.length);ctx.stroke();
    ctx.strokeStyle=shot.kind==='laser'?'#e2ffff':'#fffac9';ctx.lineWidth=2;ctx.stroke();
  }
  for(const m of s.missiles){ctx.strokeStyle='#fff0cf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(m.x-m.vx*.045,m.y-m.vy*.045);ctx.stroke();ctx.fillStyle='#ff9148';ctx.beginPath();ctx.arc(m.x-m.vx*.045,m.y-m.vy*.045,3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  for(const b of s.bullets){
    ctx.fillStyle=b.color==='coral'?'#993431':'#995921';ctx.beginPath();ctx.arc(b.x,b.y,b.r+2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=b.color==='coral'?'#ff9985':'#ffcd6c';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff4d3';ctx.beginPath();ctx.arc(b.x-1,b.y-1,b.r*.43,0,Math.PI*2);ctx.fill();
  }
  for(const item of s.pickups){
    ctx.save();ctx.translate(item.x,item.y);ctx.rotate(Math.sin(item.age*3)*.1);ctx.shadowBlur=14;ctx.shadowColor='#e9ef74';ctx.fillStyle='#202c17';ctx.strokeStyle='#e9ef74';ctx.lineWidth=2;ctx.fillRect(-15,-15,30,30);ctx.strokeRect(-15,-15,30,30);
    ctx.shadowBlur=0;ctx.fillStyle='#effc94';ctx.font='bold 17px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.kind==='power'?'P':item.kind==='bomb'?'B':'★',0,1);ctx.restore();
  }
  const p=s.player;
  if(s.mode!=='over'&&(p.invincible<=0||Math.floor(s.time*10)%2===0||p.invincible>10)){
    for(const side of [-1,1])engineFlame(p.x+side*8,p.y+29,s.time,.9);
    sprite('player',p.x,p.y,86,p.bank);
    if(p.invincible>0&&p.invincible<10){ctx.strokeStyle='#c4eddf77';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,36,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#f7ffd8';ctx.beginPath();ctx.arc(p.x,p.y,2.8,0,Math.PI*2);ctx.fill();
  }
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const particle of s.particles){ctx.globalAlpha=Math.max(0,particle.life/particle.maxLife);ctx.fillStyle=particle.color;ctx.beginPath();ctx.arc(particle.x,particle.y,particle.size*Math.max(.15,particle.life/particle.maxLife),0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  for(const ring of s.rings){ctx.globalAlpha=Math.max(0,ring.life/ring.total);ctx.strokeStyle=ring.color;ctx.lineWidth=ring.max>100?10:3;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);ctx.stroke();}
  ctx.restore();ctx.restore();
  if(s.bombFlash>0&&!reducedMotion){ctx.fillStyle=`rgba(110,219,231,${s.bombFlash*.35})`;ctx.fillRect(0,0,W,H);}
  if(s.warning>0){
    ctx.save();ctx.fillStyle='#281511ba';ctx.fillRect(0,H*.4,W,76);ctx.textAlign='center';ctx.fillStyle='#ffc278';ctx.font='bold 23px Barlow, sans-serif';ctx.fillText('WARNING · IRON WING',W/2,H*.4+32);ctx.fillStyle='#e8b689';ctx.font='8px monospace';ctx.fillText('HEAVY HOSTILE SIGNATURE DETECTED',W/2,H*.4+55);ctx.restore();
  }else if(s.noticeTime>0){
    ctx.save();ctx.globalAlpha=Math.min(1,s.noticeTime*2);ctx.textAlign='center';ctx.fillStyle='#e9ef74';ctx.font='10px monospace';ctx.shadowColor='#001000';ctx.shadowBlur=8;ctx.fillText(s.notice,W/2,H*.27);ctx.restore();
  }
  if(s.combo>=5){ctx.textAlign='right';ctx.fillStyle='#e9ef74';ctx.font='italic 22px Barlow, sans-serif';ctx.fillText(`${s.combo} CHAIN`,W-22,H-70);}
}

function frame(now){
  const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  if(!state){previewTime+=elapsed;preview(previewTime);}
  else {
    if(!paused&&state.mode==='playing'){
      accumulator+=elapsed;
      const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      const dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
      while(accumulator>=1/60){step(state,1/60,{...input,dx,dy});accumulator-=1/60;for(const e of state.events)audio.event(e.type,e.size);if(state.mode!=='playing')break;}
      if(now-uiAt>100){updateUI();uiAt=now;}if(state.mode!=='playing'){updateUI();finish();}
    }
    draw(state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only diagnostics for browser checks; no gameplay shortcuts in production.
if(new URLSearchParams(location.search).has('debug')){
  window.raijin={snapshot:()=>state?{mode:state.mode,time:state.time,score:state.score,lives:state.lives,power:state.power,bombs:state.bombs,player:{...state.player},enemies:state.enemies.length,bullets:state.bullets.length,boss:state.boss?{hp:state.boss.hp,phase:state.boss.phase}:null}:null};
}
