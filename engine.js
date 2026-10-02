export const W = 480, H = 800, BOSS_AT = 86;
export const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const TAU = Math.PI * 2;
const enemies = {
  fighter: { hp: 30, r: 19, speed: 124, score: 120, size: 57 },
  scout: { hp: 22, r: 16, speed: 172, score: 90, size: 47 },
  heavy: { hp: 360, r: 40, speed: 37, score: 900, size: 126 },
  tank: { hp: 100, r: 21, speed: 36, score: 280, size: 57 },
  carrier: { hp: 120, r: 27, speed: 65, score: 350, size: 82 }
};

const timeline = [];
for (let t=2; t<81; t+=3.8) timeline.push({ t, kind: t%11<4 ? 'scout' : 'fighter', count: t<18 ? 3 : 5, side: Math.floor(t/4)%2 });
for (const t of [12,20,29,39,49,60,70,78]) timeline.push({ t, kind: 'tank', count: 2 });
for (const t of [23,45,66]) timeline.push({ t, kind: 'heavy', count: 1 });
for (const t of [9,27,48,72]) timeline.push({ t, kind: 'carrier', count: 1 });
timeline.sort((a,b)=>a.t-b.t);

function random(s) { s.seed = (s.seed * 1664525 + 1013904223) >>> 0; return s.seed / 4294967296; }
function event(s, type, data={}) { s.events.push({type,...data}); }
function particle(s,x,y,color,size=4,speed=150,life=.7) {
  const angle=random(s)*TAU, force=(.3+random(s)*.7)*speed;
  s.particles.push({x,y,vx:Math.cos(angle)*force,vy:Math.sin(angle)*force,color,size,life,maxLife:life});
}
function explosion(s,x,y,size=1) {
  for(let i=0;i<20*size;i++) particle(s,x,y,i%3 ? '#ffb15a' : '#fcf1c4',(2+random(s)*7)*size,170*size,.4+random(s)*.6);
  s.rings.push({x,y,r:8,max:70*size,life:.4,total:.4,color:'#ffca80'});
  s.shake=Math.max(s.shake,3*size); event(s,'explosion',{size});
}

export function freshRun(seed=731) {
  return { mode:'playing', time:0, seed, nextId:1, wave:0, score:0, kills:0, grazes:0, combo:0, comboTimer:0,
    lives:3, bombs:2, power:1, weapon:'spread', weaponCycle:0, shotAt:0, missileAt:0,
    player:{x:W/2,y:H-130,bank:0,invincible:2.4}, enemies:[], shots:[], bullets:[], missiles:[], pickups:[], particles:[], rings:[], events:[],
    boss:null, bossSpawned:false, clearAt:0, shake:0, bombFlash:0, bombPulse:0, scroll:0, warning:0,
    notice:'COASTAL ASSAULT', noticeTime:3.4, shotsFired:0, shotsHit:0, deaths:0 };
}

function spawn(s, wave) {
  for(let i=0;i<wave.count;i++) {
    const d=enemies[wave.kind]; let x,y;
    if(wave.kind==='tank') { x=i===0?76:W-78; y=-60-i*90; }
    else if(wave.kind==='heavy'||wave.kind==='carrier') { x=wave.kind==='heavy' ? (s.time<30?W/2:s.time<55?120:360) : 90+random(s)*300; y=-100; }
    else { x=wave.side?W-65-i*67:65+i*67; y=-45-i*52; }
    s.enemies.push({id:s.nextId++,kind:wave.kind,x,y,baseX:x,age:0,hp:d.hp,maxHp:d.hp,r:d.r,size:d.size,speed:d.speed,
      phase:random(s)*TAU,fireAt:.9+i*.25,hit:0,score:d.score,ground:wave.kind==='tank'});
  }
}

function addBullet(s,x,y,angle,speed=140,r=4,color='amber') {
  if(s.bullets.length>420)return;
  s.bullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r,color,grazed:false});
}
function aimed(s,e,count=1,spread=.15,speed=155) {
  const angle=Math.atan2(s.player.y-e.y,s.player.x-e.x);
  for(let i=0;i<count;i++)addBullet(s,e.x,e.y+12,angle+(i-(count-1)/2)*spread,speed,4.3);
}

function shoot(s) {
  const p=s.player;
  if(s.weapon==='laser') {
    for(const dx of [-10,10]) s.shots.push({x:p.x+dx,y:p.y-28,vx:0,vy:-1000,r:6,damage:9+s.power*4,kind:'laser',length:80});
    if(s.power>2)for(const dx of [-24,24])s.shots.push({x:p.x+dx,y:p.y-20,vx:0,vy:-1000,r:4,damage:7,kind:'laser',length:55});
  } else {
    const count=2+s.power, spread=.065+s.power*.02;
    for(let i=0;i<count;i++) {
      const a=-Math.PI/2+(i-(count-1)/2)*spread;
      s.shots.push({x:p.x+(i-(count-1)/2)*9,y:p.y-24,vx:Math.cos(a)*690,vy:Math.sin(a)*690,r:4,damage:10,kind:'spread',length:22});
    }
  }
  s.shotsFired++; event(s,'shot');
}

function pickup(s,x,y,kind) { s.pickups.push({x,y,baseX:x,age:0,kind,r:18}); }

function kill(s,e) {
  e.dead=true; s.kills++; s.combo=Math.min(99,s.combo+1); s.comboTimer=3;
  const multiplier=1+Math.floor(s.combo/10)*.1;
  s.score+=Math.round(e.score*multiplier);
  explosion(s,e.x,e.y,e.kind==='heavy'?1.55:e.ground?.8:1);
  if(e.kind==='carrier') pickup(s,e.x,e.y,'power');
  else if(e.kind==='heavy') pickup(s,e.x,e.y,s.bombs<3?'bomb':'medal');
  else if(s.kills%9===0)pickup(s,e.x,e.y,'medal');
}

function damageEnemy(s,e,damage) {
  if(e.dead)return;
  e.hp-=damage; e.hit=.055; s.shotsHit++;
  if(e.hp<=0)kill(s,e);
}

export function bomb(s) {
  if(s.mode!=='playing'||s.bombs<=0||s.bombPulse>.1)return false;
  s.bombs--; s.bullets.length=0; s.bombFlash=.8; s.bombPulse=1.2; s.player.invincible=Math.max(s.player.invincible,2);
  s.rings.push({x:s.player.x,y:s.player.y,r:0,max:1000,life:1.2,total:1.2,color:'#abedff'});
  for(const e of s.enemies)damageEnemy(s,e,320);
  if(s.boss&&!s.boss.dead)hitBoss(s,550);
  s.shake=10; event(s,'bomb'); s.notice='THUNDER STRIKE'; s.noticeTime=1.4; return true;
}

function hitPlayer(s) {
  if(s.player.invincible>0||s.mode!=='playing')return;
  explosion(s,s.player.x,s.player.y,1.5); s.lives--; s.deaths++; s.combo=0;
  s.power=Math.max(1,s.power-1); s.bullets.length=0; s.player.invincible=3;
  s.shake=10; event(s,'damage');
  if(s.lives<=0){s.mode='over';event(s,'over');}
  else {s.notice='SHIELD REBOOT';s.noticeTime=1.4;}
}

function createBoss(s) {
  s.bossSpawned=true; s.bullets.length=0; s.enemies.length=0;
  s.boss={x:W/2,y:-175,age:0,hp:12000,maxHp:12000,r:78,phase:1,fireAt:2.4,spiralAt:5,burstAt:3.4,hit:0,dead:false};
  s.notice='IRON WING · APPROACHING';s.noticeTime=3.2;s.warning=3.2;event(s,'boss');
}

function hitBoss(s,damage) {
  const b=s.boss;if(!b||b.dead)return;
  b.hp=Math.max(0,b.hp-damage);b.hit=.045;s.shotsHit++;
  if(b.hp===0) {
    b.dead=true;s.clearAt=s.time+3.4;s.bullets.length=0;s.enemies.length=0;s.score+=7500+s.lives*1500+s.bombs*400;
    s.player.invincible=99;s.shake=15;explosion(s,b.x,b.y,3);event(s,'bossKill');
  }
}

function updateBoss(s,dt) {
  const b=s.boss;if(!b)return;b.age+=dt;b.hit=Math.max(0,b.hit-dt);
  if(b.dead){if(Math.floor(b.age*14)!==Math.floor((b.age-dt)*14))explosion(s,b.x+(random(s)-.5)*180,b.y+(random(s)-.5)*110,.6);return;}
  b.y=Math.min(138,b.y+70*dt); if(b.y<138)return;
  b.x=W/2+Math.sin(b.age*.55)*(b.phase===3?108:85);
  const phase=b.hp>b.maxHp*.67?1:b.hp>b.maxHp*.33?2:3;
  if(phase!==b.phase){b.phase=phase;s.bullets.length=0;s.notice=phase===2?'ARMOR BREACH':'REACTOR EXPOSED';s.noticeTime=1.5;explosion(s,b.x,b.y,1);}
  b.fireAt-=dt;b.spiralAt-=dt;b.burstAt-=dt;
  if(b.fireAt<=0){
    for(const side of [-1,1])aimed(s,{x:b.x+side*85,y:b.y+12},phase===1?3:5,.16,phase===3?193:157);
    b.fireAt=phase===1?1.2:.9;
  }
  if(b.spiralAt<=0){
    const n=phase===3?20:14;
    for(let i=0;i<n;i++)addBullet(s,b.x,b.y+24,TAU*i/n+b.age*.14,phase===3?125:100,5,'coral');
    b.spiralAt=phase===1?3.3:2.4;
  }
  if(b.burstAt<=0){
    for(let i=0;i<9;i++)addBullet(s,b.x,b.y+80,Math.PI*.22+i*.07*Math.PI,125,5.5);
    b.burstAt=phase===3?2.2:4;
  }
}

export function step(s,dt,input={}) {
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,1/30);s.events.length=0;
  if(s.mode!=='playing')return;
  s.time+=dt;s.scroll+=38*dt;s.shake=Math.max(0,s.shake-22*dt);
  s.bombFlash=Math.max(0,s.bombFlash-dt);s.bombPulse=Math.max(0,s.bombPulse-dt);s.warning=Math.max(0,s.warning-dt);s.noticeTime=Math.max(0,s.noticeTime-dt);
  s.comboTimer=Math.max(0,s.comboTimer-dt);if(s.comboTimer===0)s.combo=0;
  const p=s.player,oldX=p.x;
  if(Number.isFinite(input.x)&&Number.isFinite(input.y)) {
    const dx=input.x-p.x,dy=input.y-p.y,dist=Math.hypot(dx,dy),max=1100*dt;
    p.x+=dx*(dist>max?max/dist:1);p.y+=dy*(dist>max?max/dist:1);
  }
  p.x+=clamp(input.dx||0,-1,1)*310*dt;p.y+=clamp(input.dy||0,-1,1)*310*dt;
  p.x=clamp(p.x,25,W-25);p.y=clamp(p.y,76,H-42);p.bank+=(clamp((p.x-oldX)*.026,-.26,.26)-p.bank)*.22;p.invincible=Math.max(0,p.invincible-dt);
  if(input.bomb)bomb(s);
  if(s.clearAt){
    if(s.time>=s.clearAt){s.mode='clear';event(s,'clear');}
  } else {
    while(s.wave<timeline.length&&s.time>=timeline[s.wave].t)spawn(s,timeline[s.wave++]);
    if(!s.bossSpawned&&s.time>=BOSS_AT)createBoss(s);
    s.shotAt-=dt;if(s.shotAt<=0){shoot(s);s.shotAt+=s.weapon==='laser'?.075:.115;}
    s.missileAt-=dt;if(s.missileAt<=0&&s.power>=2){
      for(const side of [-1,1])s.missiles.push({x:p.x+side*26,y:p.y,vx:side*130,vy:-170,age:0,target:null,r:6,damage:38});s.missileAt=1.05;
    }
  }
  for(const e of s.enemies) {
    e.age+=dt;e.y+=e.speed*dt;e.hit=Math.max(0,e.hit-dt);
    if(!e.ground)e.x=clamp(e.baseX+Math.sin(e.age*(e.kind==='scout'?2.2:1.4)+e.phase)*(e.kind==='heavy'?22:30),24,W-24);
    if(e.kind==='heavy'&&e.y>175)e.speed=11;
    e.fireAt-=dt;
    if(e.y>24&&e.y<H-80&&e.fireAt<=0){
      if(e.kind==='heavy')aimed(s,e,5,.14,145);
      else if(e.ground)aimed(s,e,2,.09,145);
      else if(e.kind!=='carrier'&&s.time>5&&e.y<p.y-30)aimed(s,e,1,0,138);
      e.fireAt=e.kind==='heavy'?1.25:e.ground?2.1:2.5;
    }
    if(!e.ground&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+9)hitPlayer(s);
  }
  updateBoss(s,dt);
  for(const shot of s.shots) {
    shot.oldY=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
    for(const e of s.enemies) {
      if(e.dead)continue;
      if(Math.abs(shot.x-e.x)<e.r+shot.r&&e.y>=shot.y-e.r&&e.y<=shot.oldY+e.r){damageEnemy(s,e,shot.damage);shot.dead=true;break;}
    }
    const b=s.boss;
    if(!shot.dead&&b&&!b.dead&&b.y>40&&Math.abs(shot.x-b.x)<115&&Math.abs(shot.y-b.y)<85){hitBoss(s,shot.damage);shot.dead=true;}
  }
  for(const m of s.missiles) {
    m.age+=dt;
    let target=s.enemies.find(e=>e.id===m.target&&!e.dead);
    if(!target){target=s.boss&&!s.boss.dead?s.boss:s.enemies.find(e=>!e.dead&&e.y<m.y);m.target=target?.id;}
    if(target){const angle=Math.atan2(target.y-m.y,target.x-m.x);m.vx+=(Math.cos(angle)*400-m.vx)*.065;m.vy+=(Math.sin(angle)*400-m.vy)*.065;}
    else m.vy-=500*dt;
    m.x+=m.vx*dt;m.y+=m.vy*dt;
    if(target&&Math.hypot(target.x-m.x,target.y-m.y)<(target.r||65)){if(target===s.boss)hitBoss(s,m.damage);else damageEnemy(s,target,m.damage);m.dead=true;particle(s,m.x,m.y,'#ffd28b',8,80,.25);}
  }
  for(const b of s.bullets) {
    b.x+=b.vx*dt;b.y+=b.vy*dt;const dist=Math.hypot(b.x-p.x,b.y-p.y);
    if(p.invincible<=0&&dist<b.r+6){b.dead=true;hitPlayer(s);}
    else if(!b.grazed&&p.invincible<=0&&dist<23+b.r){b.grazed=true;s.grazes++;s.score+=25;particle(s,p.x,p.y,'#e9ef74',3,70,.35);event(s,'graze');}
  }
  for(const item of s.pickups) {
    item.age+=dt;item.y+=49*dt;item.x=item.baseX+Math.sin(item.age*2.5)*17;
    if(Math.hypot(item.x-p.x,item.y-p.y)<35){
      item.dead=true;
      if(item.kind==='power'){s.power=Math.min(4,s.power+1);s.weaponCycle++;s.weapon=s.weaponCycle%2===0?'laser':'spread';s.notice=s.weapon==='laser'?'BLUE LASER · UPGRADED':'RED VULCAN · UPGRADED';s.noticeTime=1.5;}
      if(item.kind==='bomb'){s.bombs=Math.min(3,s.bombs+1);s.notice='THUNDER STOCK +1';s.noticeTime=1.2;}
      s.score+=item.kind==='medal'?500:200;event(s,'pickup');
      for(let i=0;i<12;i++)particle(s,item.x,item.y,'#e9ef74',4,110,.45);
    }
  }
  for(const particle of s.particles){particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vx*=.975;particle.vy*=.975;particle.life-=dt;}
  for(const ring of s.rings){ring.life-=dt;ring.r=ring.max*(1-ring.life/ring.total);}
  s.shots=s.shots.filter(e=>!e.dead&&e.y>-100);s.bullets=s.bullets.filter(e=>!e.dead&&e.y<H+40&&e.y>-100&&e.x>-40&&e.x<W+40);
  s.enemies=s.enemies.filter(e=>!e.dead&&e.y<H+100);s.missiles=s.missiles.filter(e=>!e.dead&&e.age<5&&e.y>-60);
  s.pickups=s.pickups.filter(e=>!e.dead&&e.y<H+35);s.particles=s.particles.filter(e=>e.life>0);s.rings=s.rings.filter(e=>e.life>0);
}

export function rank(s) { return s.deaths===0&&s.score>24000?'S':s.deaths<=1&&s.score>16000?'A':s.score>10000?'B':'C'; }
