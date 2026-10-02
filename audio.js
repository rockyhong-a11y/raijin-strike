export class Sound {
  constructor() { this.enabled=true; this.ctx=null; this.timer=null; this.beat=0; this.boss=false; this.lastShot=0; }
  async start() {
    if(!this.enabled)return;
    try {
      if(!this.ctx){
        this.ctx=new (window.AudioContext||window.webkitAudioContext)();
        this.master=this.ctx.createGain();this.master.gain.value=.23;this.master.connect(this.ctx.destination);
        const n=this.ctx.sampleRate*.3;this.noise=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
        const data=this.noise.getChannelData(0);for(let i=0;i<n;i++)data[i]=Math.random()*2-1;
      }
      await this.ctx.resume();this.next=this.ctx.currentTime+.06;
      clearInterval(this.timer);this.timer=setInterval(()=>this.music(),60);
    } catch { this.enabled=false; }
  }
  pause() { clearInterval(this.timer);this.timer=null;if(this.ctx)this.ctx.suspend().catch(()=>{}); }
  toggle() { this.enabled=!this.enabled;if(!this.enabled)this.pause();return this.enabled; }
  tone(freq,time,duration=.12,type='sine',volume=.15,end=freq) {
    if(!this.ctx||!this.enabled||this.ctx.state!=='running')return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);
    g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.001,time+duration);
    o.connect(g);g.connect(this.master);o.start(time);o.stop(time+duration+.02);
  }
  hiss(time,volume=.1,length=.08,cutoff=5000) {
    if(!this.ctx||!this.enabled)return;
    const n=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();n.buffer=this.noise;
    f.type='highpass';f.frequency.value=cutoff;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.001,time+length);
    n.connect(f);f.connect(g);g.connect(this.master);n.start(time);n.stop(time+length);
  }
  music() {
    if(!this.ctx||!this.enabled)return;
    const now=this.ctx.currentTime;
    if(this.next<now)this.next=now+.02;
    const root=this.boss?55:65.406;const notes=[0,0,7,0,3,0,10,7,0,12,7,3,10,7,3,7];
    const lead=[12,19,22,19,15,19,22,24,12,19,22,26,24,22,19,15];
    while(this.next<now+.18){
      const i=this.beat%16,t=this.next;
      if(i%4===0)this.tone(135,t,.18,'sine',.48,35);
      if(i%4===2){this.hiss(t,.20,.15,900);this.tone(180,t,.1,'triangle',.13,55);}
      this.hiss(t,.05,i%2?.05:.035,6200);
      this.tone(root*2**(notes[i]/12),t,.16,'triangle',.25);
      if(i%2===0||this.boss)this.tone(root*2**(lead[i]/12),t,.10,'square',.033);
      this.beat++;this.next+=60/142/4;
    }
  }
  event(type,size=1) {
    if(!this.ctx||!this.enabled||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime;
    if(type==='shot'&&t-this.lastShot>.1){this.tone(1200,t,.055,'triangle',.035,360);this.lastShot=t;}
    if(type==='explosion'){this.hiss(t,.15*size,.16,150);this.tone(72*size,t,.20,'sine',.18,22);}
    if(type==='pickup'){for(let i=0;i<4;i++)this.tone(440*2**(i/3),t+i*.06,.12,'triangle',.20);}
    if(type==='bomb'){this.hiss(t,.5,.3,100);this.tone(140,t,.8,'sawtooth',.18,20);}
    if(type==='damage'){this.tone(220,t,.4,'sawtooth',.2,35);}
    if(type==='boss'){this.boss=true;for(let i=0;i<3;i++)this.tone(110,t+i*.3,.2,'square',.13,100);}
    if(type==='clear'){this.boss=false;for(let i=0;i<6;i++)this.tone(261.6*2**([0,4,7,12,16,19][i]/12),t+i*.13,.4,'triangle',.17);}
    if(type==='over'){this.boss=false;this.tone(220,t,.7,'triangle',.15,55);}
  }
}
