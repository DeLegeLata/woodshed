
<script>
/* ============================================================
   WOODSHED — audio engine
   Lookahead scheduler + metronome + drum kit + backing band.
   Isolated on purpose: swapping this module out is what a
   native port would need, and nothing else.
   ============================================================ */

const Audio2 = (function(){
  let ctx = null, master = null, noiseBuf = null;
  let busClick, busDrum, busBass, busChord;

  function ensure(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const mk = v => { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; };
    busClick = mk(0.5); busDrum = mk(0.85); busBass = mk(0.55); busChord = mk(0.24);
    const len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2 - 1;
    return ctx;
  }
  function resume(){ ensure(); if(ctx.state === "suspended") return ctx.resume(); return Promise.resolve(); }
  function now(){ return ensure().currentTime; }

  function noise(t, dur, hp, lp, gain, bus){
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.loop = true; s.playbackRate.value = 0.8 + Math.random()*0.4;
    let node = s;
    if(hp){ const f = ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=hp; node.connect(f); node=f; }
    if(lp){ const f = ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=lp; node.connect(f); node=f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    node.connect(g); g.connect(bus||busDrum);
    s.start(t); s.stop(t+dur+0.02);
  }
  function tone(t, f0, f1, dur, gain, type, bus){
    const o = ctx.createOscillator(); o.type = type||"sine";
    o.frequency.setValueAtTime(f0, t);
    if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1,1), t+dur*0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    o.connect(g); g.connect(bus||busDrum);
    o.start(t); o.stop(t+dur+0.02);
  }

  /* ---------- the kit (synthesised — see notes in SPEC) ---------- */
  const kit = {
    kick(t,v){ v=v||1; tone(t,132,46,0.30,0.95*v,"sine"); noise(t,0.02,null,220,0.35*v); },
    snare(t,v){ v=v||1; noise(t,0.16,1200,7200,0.42*v); tone(t,196,152,0.10,0.30*v,"triangle"); },
    ghost(t,v){ v=v||1; noise(t,0.05,1400,6000,0.10*v); },
    hat(t,v){ v=v||1; noise(t,0.038,7800,null,0.20*v); },
    hatOpen(t,v){ v=v||1; noise(t,0.26,6800,null,0.17*v); },
    ride(t,v){ v=v||1; noise(t,0.42,7000,null,0.085*v); tone(t,3180,3100,0.30,0.045*v,"square"); },
    rim(t,v){ v=v||1; noise(t,0.03,2400,9000,0.28*v); tone(t,860,700,0.04,0.18*v,"square"); },
    crash(t,v){ v=v||1; noise(t,1.5,3400,null,0.22*v); }
  };

  /* ---------- click ---------- */
  function click(t, accent){
    // deliberately high-frequency so the mic low-pass removes it before pitch detection
    tone(t, accent?3200:2300, accent?3100:2250, 0.035, accent?0.55:0.34, "square", busClick);
    noise(t, 0.012, 4000, null, accent?0.16:0.09, busClick);
  }

  /* ---------- bass + chord voices ---------- */
  function bassNote(t, midi, dur, v){
    v = v || 1;
    const f = midiToFreq(midi);
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass";
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(320, t+Math.min(dur,0.5));
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.62*v, t+0.012);
    g.gain.exponentialRampToValueAtTime(0.20*v, t+dur*0.55);
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(busBass);
    o.start(t); o2.start(t); o.stop(t+dur+0.03); o2.stop(t+dur+0.03);
  }
  function chordStab(t, midis, dur, v){
    v = v || 1;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=2400; lp.Q.value=0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.5*v, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.18*v, t+Math.min(dur*0.5,0.5));
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    lp.connect(g); g.connect(busChord);
    midis.forEach((m,i) => {
      [0,-6].forEach(det => {
        const o = ctx.createOscillator();
        o.type = i===0 ? "triangle" : "sawtooth";
        o.frequency.value = midiToFreq(m);
        o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = (i===0?0.5:0.34)/midis.length*2;
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t+dur+0.05);
      });
    });
  }
  /* voice a chord in a comfortable register, close to the previous voicing */
  let lastVoicing = null;
  function voiceChord(ch){
    const notes = ch.intervals.map(i => 60 + ((ch.pc + i) % 24));
    let v = ch.intervals.slice(0,4).map(i => {
      let m = 48 + ch.pc + i;
      while(m < 55) m += 12;
      while(m > 74) m -= 12;
      return m;
    });
    v = v.sort((a,b)=>a-b);
    lastVoicing = v;
    return v;
  }
  function bassMidi(pc, low){ let m = 28 + pc; while(m < (low||36)) m += 12; while(m > 50) m -= 12; return m; }

  /* ---------- grooves ---------- */
  /* events: {b: beat within bar (0-based, may be fractional), i: instrument, v: velocity} */
  const GROOVES = {
    rock: { name:"Straight rock", swing:0, beats:4, comp:"push", ev:[
      {b:0,i:"kick"},{b:0,i:"hat"},{b:0.5,i:"hat",v:0.6},
      {b:1,i:"snare"},{b:1,i:"hat",v:0.7},{b:1.5,i:"hat",v:0.6},
      {b:2,i:"kick"},{b:2.5,i:"kick",v:0.8},{b:2,i:"hat"},{b:2.5,i:"hat",v:0.6},
      {b:3,i:"snare"},{b:3,i:"hat",v:0.7},{b:3.5,i:"hat",v:0.6}
    ]},
    shuffle: { name:"Blues shuffle", swing:1, beats:4, comp:"shuffle", ev:[
      {b:0,i:"kick"},{b:0,i:"hat"},{b:0.667,i:"hat",v:0.55},
      {b:1,i:"snare"},{b:1,i:"hat",v:0.7},{b:1.667,i:"hat",v:0.55},
      {b:2,i:"kick"},{b:2,i:"hat"},{b:2.667,i:"hat",v:0.55},
      {b:3,i:"snare"},{b:3,i:"hat",v:0.7},{b:3.667,i:"hat",v:0.55}
    ]},
    funk: { name:"Funk 16ths", swing:0, beats:4, comp:"stab", ev:[
      {b:0,i:"kick"},{b:0,i:"hat"},{b:0.25,i:"hat",v:0.45},{b:0.5,i:"hat",v:0.65},{b:0.75,i:"hat",v:0.45},
      {b:1,i:"snare"},{b:1,i:"hat",v:0.7},{b:1.25,i:"hat",v:0.45},{b:1.5,i:"hat",v:0.6},{b:1.75,i:"ghost"},
      {b:1.75,i:"hat",v:0.45},{b:2.25,i:"kick"},{b:2,i:"hat"},{b:2.25,i:"hat",v:0.45},{b:2.5,i:"kick",v:0.85},
      {b:2.5,i:"hat",v:0.6},{b:2.75,i:"hat",v:0.45},
      {b:3,i:"snare"},{b:3,i:"hat",v:0.7},{b:3.25,i:"ghost",v:0.7},{b:3.25,i:"hat",v:0.45},
      {b:3.5,i:"hat",v:0.6},{b:3.75,i:"hat",v:0.45}
    ]},
    swing: { name:"Jazz swing", swing:1, beats:4, comp:"jazz", ev:[
      {b:0,i:"ride"},{b:1,i:"ride",v:0.8},{b:1.667,i:"ride",v:0.6},
      {b:2,i:"ride",v:0.9},{b:3,i:"ride",v:0.8},{b:3.667,i:"ride",v:0.6},
      {b:1,i:"hat",v:0.5},{b:3,i:"hat",v:0.5},
      {b:0,i:"bassdrumfeather",v:0.25}
    ]},
    ballad: { name:"Slow 6/8", swing:0, beats:3, comp:"push", ev:[
      {b:0,i:"kick"},{b:0,i:"hat"},{b:0.5,i:"hat",v:0.5},
      {b:1,i:"hat",v:0.7},{b:1.5,i:"hat",v:0.5},
      {b:2,i:"snare"},{b:2,i:"hat",v:0.7},{b:2.5,i:"hat",v:0.5}
    ]},
    none: { name:"Click only", swing:0, beats:4, comp:"none", ev:[] }
  };
  const GROOVE_IDS = ["rock","shuffle","funk","swing","ballad"];

  /* ---------- transport ---------- */
  const T = {
    playing:false, bpm:100, beatsPerBar:4, groove:"rock", swing:0,
    mode:"click",           // click | drums | band | off
    accent:true, countIn:true,
    chart:[], chartBarLen:1,
    beat:0, nextTime:0, timer:null, countInLeft:0,
    ramp:null,              // {every, step, target}
    onBeat:null, onBar:null,
    _guide:null
  };

  const LOOKAHEAD = 0.12, TICK = 25;

  function spb(){ return 60 / T.bpm; }

  function scheduleBeat(absBeat, t){
    const bar = Math.floor(absBeat / T.beatsPerBar);
    const beatInBar = absBeat % T.beatsPerBar;
    const isDownbeat = beatInBar === 0;
    const counting = T.countInLeft > 0;

    if(counting){
      click(t, isDownbeat);
      if(T.onBeat) T.onBeat(t, beatInBar, isDownbeat, true, absBeat);
      return;
    }

    if(T.mode === "click" || T.mode === "drums" || T.mode === "band"){
      if(T.mode === "click") click(t, T.accent && isDownbeat);
      else if(T.accent && isDownbeat && T.mode !== "band") click(t, true);
    }

    if(T.mode === "drums" || T.mode === "band"){
      const g = GROOVES[T.groove] || GROOVES.rock;
      g.ev.forEach(e => {
        const eb = Math.floor(e.b);
        if(eb !== beatInBar) return;
        let frac = e.b - eb;
        if(g.swing && Math.abs(frac - 0.5) < 0.01) frac = 0.665;
        const et = t + frac * spb();
        const v = e.v == null ? 1 : e.v;
        if(e.i === "bassdrumfeather"){ kit.kick(et, 0.22); return; }
        if(kit[e.i]) kit[e.i](et, v);
      });
      if(isDownbeat && bar % 8 === 0 && bar > 0) kit.crash(t, 0.7);
    }

    if(T.mode === "band" && T.chart.length){
      const g = GROOVES[T.groove] || GROOVES.rock;
      const idx = bar % T.chart.length;
      const ch = T.chart[idx];
      if(ch){
        // tell the UI what's about to sound, timestamped so it can land on the downbeat
        if(isDownbeat && T.onChord) T.onChord(ch, T.chart[(idx+1) % T.chart.length], idx, T.chart.length, t);
        const v = voiceChord(ch);
        const rootB = bassMidi(ch.pc);
        const fifth = rootB + 7;
        const third = rootB + (ch.intervals.indexOf(3) !== -1 ? 3 : 4);
        const sev   = rootB + (ch.intervals.indexOf(10) !== -1 ? 10 : 11);
        if(g.comp === "jazz"){
          // walking bass, one note per beat
          const walk = [rootB, third, fifth, sev];
          bassNote(t, walk[beatInBar % 4], spb()*0.9, 0.9);
          if(beatInBar === 1 || beatInBar === 3) chordStab(t + spb()*0.665, v, spb()*0.5, 0.85);
        } else if(g.comp === "shuffle"){
          bassNote(t, beatInBar%2===0 ? rootB : fifth, spb()*0.85, 1);
          if(isDownbeat) chordStab(t, v, spb()*1.6, 0.8);
        } else if(g.comp === "stab"){
          if(beatInBar===0) bassNote(t, rootB, spb()*0.4, 1);
          if(beatInBar===0) bassNote(t+spb()*0.75, rootB, spb()*0.22, 0.8);
          if(beatInBar===2) bassNote(t+spb()*0.5, fifth, spb()*0.4, 0.9);
          if(beatInBar===1||beatInBar===3) chordStab(t+spb()*0.5, v, spb()*0.28, 0.9);
        } else {
          bassNote(t, isDownbeat ? rootB : (beatInBar===2 ? fifth : rootB), spb()*0.9, 1);
          if(isDownbeat) chordStab(t, v, spb()*2.2, 0.85);
        }
      }
    }

    if(T.onBeat) T.onBeat(t, beatInBar, isDownbeat, false, absBeat);
    if(isDownbeat && T.onBar) T.onBar(t, bar);
  }

  function loop(){
    while(T.nextTime < ctx.currentTime + LOOKAHEAD){
      scheduleBeat(T.beat, T.nextTime);
      T.nextTime += spb();
      T.beat++;
      if(T.countInLeft > 0){
        T.countInLeft--;
        if(T.countInLeft === 0) T.beat = 0;
      } else if(T.ramp && T.beat > 0 && T.beat % (T.ramp.every * T.beatsPerBar) === 0){
        const nb = Math.min(T.ramp.target, T.bpm + T.ramp.step);
        if(nb !== T.bpm){ T.bpm = nb; if(T.onRamp) T.onRamp(nb); }
      }
    }
  }

  function start(){
    return resume().then(() => {
      if(T.playing) return;
      T.playing = true;
      T.beat = 0;
      T.countInLeft = T.countIn ? T.beatsPerBar : 0;
      T.nextTime = ctx.currentTime + 0.08;
      T.timer = setInterval(loop, TICK);
      loop();
    });
  }
  function stop(){
    T.playing = false;
    if(T.timer){ clearInterval(T.timer); T.timer = null; }
  }
  function toggle(){ return T.playing ? (stop(), Promise.resolve(false)) : start().then(()=>true); }

  /* play a scale shape as audio, for "Hear it" */
  function auditionShape(shape, bpm){
    return resume().then(() => {
      const t0 = ctx.currentTime + 0.1, dt = 60/(bpm||120)/2;
      shape.notes.forEach((n,i) => {
        pluck(t0 + i*dt, n.midi, dt*0.95);
      });
      return shape.notes.length * dt;
    });
  }
  function pluck(t, midi, dur){
    const f = midiToFreq(midi);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f*2.005;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.4, t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.16;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t+dur+0.03); o2.stop(t+dur+0.03);
  }
  function drone(pc, on){
    // sustained root so a mode actually sounds like that mode
    if(!on){ if(T._drone){ try{ T._drone.stop(); }catch(e){} T._drone = null; } return; }
    resume().then(() => {
      if(T._drone) return;
      const t = ctx.currentTime;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.10, t+0.6); g.connect(master);
      const oscs = [];
      [0,12,19].forEach((iv,i) => {
        const o = ctx.createOscillator();
        o.type = i===0?"sawtooth":"sine";
        o.frequency.value = midiToFreq(bassMidi(pc,36) + iv);
        o.detune.value = i*4;
        const og = ctx.createGain(); og.gain.value = i===0?0.28:0.16;
        o.connect(og); og.connect(g); o.start(t); oscs.push(o);
      });
      T._drone = { stop(){ const tt=ctx.currentTime; g.gain.exponentialRampToValueAtTime(0.0005,tt+0.3);
        oscs.forEach(o=>o.stop(tt+0.35)); } };
    });
  }

  function chime(kind){
    resume().then(() => {
      const t = ctx.currentTime + 0.02;
      const seq = kind === "done" ? [72,76,79,84] : [79,74,71];
      seq.forEach((m,i) => pluck(t + i*0.13, m, 0.7));
    });
  }

  return {
    ensure, resume, now, T, GROOVES, GROOVE_IDS,
    start, stop, toggle, chime, drone, auditionShape, pluck,
    setChart(chords){ T.chart = chords; },
    setBpm(b){ T.bpm = Math.max(40, Math.min(220, Math.round(b))); },
    kit
  };
})();
</script>
