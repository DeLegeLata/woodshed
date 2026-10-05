
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
  /* voice a chord in a comfortable register: each note is folded into G3 to D5 */
  function voiceChord(ch){
    const fold = i => { let m = 48 + ch.pc + i; while(m < 55) m += 12; while(m > 74) m -= 12; return m; };
    // One of each chord tone, and four notes is a full pad. A bigger chord gives up its root (the bass
    // has that) and then its 5th, so the 9th, ♯9 or 13th it is named for is still in there.
    let ivs = ch.intervals.filter((iv, k, a) => a.findIndex(x => x % 12 === iv % 12) === k);
    if(ivs.length > 4) ivs = ivs.filter(iv => iv % 12 !== 0);
    if(ivs.length > 4) ivs = ivs.filter(iv => iv % 12 !== 7);
    const v = ivs.slice(0,4).map(fold).sort((a,b)=>a-b);
    // Two notes a semitone apart grind against each other: the root on top of a major 7th, a ♯9 under
    // the 3rd. One of them moves an octave, whichever stays nearer the middle, and they ring a major 7th apart.
    for(let k = 0; k < v.length - 1; k++) if(v[k+1] - v[k] === 1){
      if(v[k] < 64) v[k] += 12; else v[k+1] -= 12;
      break;
    }
    return v.sort((a,b)=>a-b);
  }
  /* pc counts up from C, so it's added to a C (MIDI 24): the root lands between C2 and B2 */
  function bassMidi(pc, low){ let m = 24 + pc; while(m < (low||36)) m += 12; while(m > 50) m -= 12; return m; }

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
    /* played as a slow 12/8: four beats, each split in three, which is two bars of 6/8 to the bar */
    ballad: { name:"Slow 6/8", swing:0, beats:4, comp:"push", ev:[
      {b:0,i:"kick"},{b:0,i:"hat"},{b:0.333,i:"hat",v:0.45},{b:0.667,i:"hat",v:0.55},
      {b:1,i:"snare"},{b:1,i:"hat",v:0.7},{b:1.333,i:"hat",v:0.45},{b:1.667,i:"hat",v:0.55},
      {b:2,i:"kick"},{b:2,i:"hat"},{b:2.333,i:"hat",v:0.45},{b:2.667,i:"hat",v:0.55},
      {b:3,i:"snare"},{b:3,i:"hat",v:0.7},{b:3.333,i:"hat",v:0.45},{b:3.667,i:"hat",v:0.55}
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
    _guide:null, _aud:null, _countInOnce:false
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
        // the bass only plays notes the chord has: a ♭5 under a m7♭5, and no 3rd or 7th the chord doesn't spell out
        const has = iv => ch.intervals.some(x => x % 12 === iv);
        const fifth = rootB + (has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7);
        const third = rootB + (has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : has(2) ? 2 : 12);
        const sev   = has(10) ? rootB + 10 : has(11) ? rootB + 11 : has(9) ? rootB + 9 : third;
        if(g.comp === "jazz"){
          // walking bass, one note per beat: root, 3rd, 5th, 7th. A chord with no 7th comes back
          // down to its 3rd, and one with no 3rd either goes root, 5th, octave, 5th.
          // Each bar starts on whichever octave of its root is nearer the note just played, so the line
          // never drops more than an octave at a bar line. From the upper root it walks the same notes
          // back down.
          if(isDownbeat || T._walkCh !== ch){
            const up = [rootB].concat(third === rootB + 12 ? [fifth, third, fifth] : [third, fifth, sev]);
            const high = T._lastBass != null && T._lastBass - rootB > 6;
            T._walk = !high ? up : third === rootB + 12 ? [third, fifth, rootB, fifth]
                    : sev === third ? [rootB + 12, fifth, third, fifth] : [rootB + 12, sev, fifth, third];
            T._walkCh = ch;
          }
          T._lastBass = T._walk[beatInBar % 4];
          bassNote(t, T._lastBass, spb()*0.9, 0.9);
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

    /* An audition is a phrase handed to the scheduler rather than played on its
       own clock: its notes are laid out from this beat's own timestamp, so they
       sit on the click instead of drifting against it. It waits for a downbeat
       to start, and follows the tempo live if the slider moves. */
    if(T._aud){
      const A = T._aud;
      if(A.beat0 == null && isDownbeat) A.beat0 = absBeat;
      if(A.beat0 != null){
        const k = absBeat - A.beat0;
        const notes = A.spec.at(k);
        if(!notes){ T._aud = null; if(A.spec.onEnd) A.spec.onEnd(); }
        else {
          const sp = spb();
          notes.forEach(n => pluck(t + n.at * sp, n.midi, Math.max(0.08, n.dur * sp), n.v));
          if(A.spec.onGroup) A.spec.onGroup(k, t);
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
      T._walk = T._walkCh = T._lastBass = null;
      T.countInLeft = (T.countIn || T._countInOnce) ? T.beatsPerBar : 0;
      T._countInOnce = false;
      T.nextTime = ctx.currentTime + 0.08;
      T.timer = setInterval(loop, TICK);
      loop();
    });
  }
  function stop(){
    T.playing = false;
    T._aud = null;
    if(T.timer){ clearInterval(T.timer); T.timer = null; }
  }
  function toggle(){ return T.playing ? (stop(), Promise.resolve(false)) : start().then(()=>true); }

  /* "Hear it": spec.at(k) returns the notes for the k-th beat since the phrase
     started — {at} is the fraction of that beat, {dur} is in beats — or null to
     finish. If the click is stopped this starts it and counts in a bar first. */
  function audition(spec){
    return resume().then(() => {
      T._aud = { spec, beat0:null };
      if(T.playing) return;
      T._countInOnce = true;
      return start();
    }).then(() => true);
  }
  function auditionStop(){ T._aud = null; }
  function auditioning(){ return !!T._aud; }
  function pluck(t, midi, dur, v){
    v = v == null ? 1 : v;
    const f = midiToFreq(midi);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f*2.005;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.4 * v, t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t+dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.16;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t+dur+0.03); o2.stop(t+dur+0.03);
  }
  function drone(pc, on, fifth){
    // sustained root so a mode actually sounds like that mode. The fifth on top is
    // left out when the mode hasn't got a perfect one (Locrian).
    T._droneWant = !!on;
    if(!on){ if(T._drone){ try{ T._drone.stop(); }catch(e){} T._drone = null; } return; }
    resume().then(() => {
      if(T._drone || !T._droneWant) return;      // switched off again while the audio was still starting up
      const t = ctx.currentTime;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.10, t+0.6); g.connect(master);
      const oscs = [];
      (fifth === false ? [0,12] : [0,12,19]).forEach((iv,i) => {
        const o = ctx.createOscillator();
        o.type = i===0?"sawtooth":"sine";
        o.frequency.value = midiToFreq(bassMidi(pc,36) + iv);
        o.detune.value = i*4;
        const og = ctx.createGain(); og.gain.value = i===0?0.28:0.16;
        o.connect(og); og.connect(g); o.start(t); oscs.push(o);
      });
      T._drone = { stop(){ const tt=ctx.currentTime;
        g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt);   // fade from where it is now
        g.gain.exponentialRampToValueAtTime(0.0005,tt+0.3);
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

  /* a strummed chord: notes staggered low→high (down) or high→low (up) */
  function strum(t, midis, up, v, dur){
    v = v || 1; dur = dur || 0.9;
    const bus = ctx.createGain(); bus.gain.value = 0.16 * v; bus.connect(master);
    const order = up ? midis.slice(-4).reverse() : midis;
    order.forEach((m, i) => {
      const tt = t + i * (up ? 0.009 : 0.013);
      const f = midiToFreq(m);
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f * 2.003;
      const g2 = ctx.createGain(); g2.gain.value = 0.22;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(up ? 4200 : 3200, tt);
      lp.frequency.exponentialRampToValueAtTime(650, tt + dur);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.0001, tt);
      eg.gain.exponentialRampToValueAtTime(1, tt + 0.004);
      eg.gain.exponentialRampToValueAtTime(0.001, tt + dur);
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(eg); eg.connect(bus);
      o.start(tt); o2.start(tt); o.stop(tt + dur + 0.05); o2.stop(tt + dur + 0.05);
    });
  }
  function scratch(t, v){ ensure(); noise(t, 0.045, 1400, 5200, 0.32 * (v || 1), master); }

  return {
    ensure, resume, now, T, GROOVES, GROOVE_IDS,
    start, stop, toggle, chime, drone, pluck, strum, scratch,
    audition, auditionStop, auditioning,
    setChart(chords){ T.chart = chords; },
    setBpm(b){ T.bpm = Math.max(40, Math.min(220, Math.round(b))); },
    kit
  };
})();
</script>
