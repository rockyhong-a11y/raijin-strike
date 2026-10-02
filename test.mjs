import assert from 'node:assert/strict';
import { freshRun, step, bomb, W, H, BOSS_AT } from './engine.js';

const run = freshRun();
step(run,1/60,{x:1e9,y:-1e9});
assert.ok(run.player.x>=25&&run.player.x<=W-25&&run.player.y>=76&&run.player.y<=H-42);
const oldTime=run.time;step(run,NaN);step(run,Infinity);assert.equal(run.time,oldTime);
run.bullets.push({x:20,y:20,vx:0,vy:0,r:4});
assert.equal(bomb(run),true);assert.equal(run.bombs,1);assert.equal(run.bullets.length,0);
assert.equal(bomb(run),false,'Bomb input cannot consume multiple stocks during one pulse');
run.bombPulse=0;assert.equal(bomb(run),true);run.bombPulse=0;assert.equal(bomb(run),false);

const collision=freshRun();collision.player.invincible=0;
collision.bullets.push({x:collision.player.x,y:collision.player.y,vx:0,vy:0,r:4,grazed:false});
step(collision,1/60);assert.equal(collision.lives,2);assert.equal(collision.deaths,1);
step(collision,1/60);assert.equal(collision.lives,2,'Respawn shield prevents chained damage');

const pickups=freshRun();pickups.power=4;
pickups.pickups.push({x:pickups.player.x,y:pickups.player.y,baseX:pickups.player.x,age:0,kind:'power',r:18});
step(pickups,1/60);assert.equal(pickups.power,4);assert.equal(pickups.pickups.length,0);

const a=freshRun(9),b=freshRun(9);
for(let i=0;i<900;i++){step(a,1/60,{dx:Math.sin(i/60)});step(b,1/60,{dx:Math.sin(i/60)});}
assert.deepEqual(a,b,'Identical inputs and seed reproduce a flight');

// Complete the actual authored timeline and boss encounter, without collision noise.
const full=freshRun();full.player.invincible=999;full.power=4;full.weapon='laser';
let maxBullets=0,maxEnemies=0;
for(let i=0;i<60*160&&full.mode==='playing';i++){
  const target=full.boss&&!full.boss.dead?full.boss:full.enemies.find(e=>e.kind==='carrier')||full.enemies[0];
  step(full,1/60,{x:target?.x??W/2,y:H-120});maxBullets=Math.max(maxBullets,full.bullets.length);maxEnemies=Math.max(maxEnemies,full.enemies.length);
}
assert.equal(full.bossSpawned,true);assert.ok(full.time>BOSS_AT);assert.equal(full.mode,'clear');assert.equal(full.boss.hp,0);
assert.ok(full.score>0);assert.ok(maxBullets<=421);assert.ok(maxEnemies<50);
console.log(`PASS · collision, input bounds, bomb stocks, upgrades, determinism, complete stage. Clear at ${full.time.toFixed(1)}s; peak ${maxBullets} bullets / ${maxEnemies} enemies.`);
