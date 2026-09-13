
<script>
/* ============================================================
   WOODSHED — microphone, pitch detection, recording, storage
   ============================================================ */

const Mic = (function(){
  let stream = null, src = null, analyser = null, buf = null, lp = null, hp = null;
  let running = false, rafId = null;
  let recorder = null, chunks = [];
  const listeners = [];

  function available(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function enable(){
    if(stream) return Promise.resolve(true);
    if(!available()) return Promise.reject(new Error("no-getusermedia"));
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    }).then(s => {
      stream = s;
      const ctx = Audio2.ensure();
      src = ctx.createMediaStreamSource(s);
      // Guitar fundamentals top out around 660 Hz. The metronome click sits above 2 kHz
      // on purpose, so this pair of filters removes it before detection ever sees it.
      hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 65; hp.Q.value = 0.7;
      lp = ctx.createBiquadFilter(); lp.type = "lowpass";  lp.frequency.value = 1000; lp.Q.value = 0.7;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      buf = new Float32Array(analyser.fftSize);
      src.connect(hp); hp.connect(lp); lp.connect(analyser);
      startLoop();
      return true;
    });
  }

  /* Normalised autocorrelation. Returns Hz, or -1 when there is nothing to hear.
     The signal is already low-passed at 1 kHz, so we decimate 4:1 first — that turns
     an O(n^2) search into something a phone can run every frame without breaking a sweat. */
  const DEC = 4;
  let work = null, corr = null;
  function detect(b, sampleRate){
    const N = Math.floor(b.length / DEC);
    const sr = sampleRate / DEC;
    if(!work || work.length !== N) work = new Float32Array(N);
    for(let i=0;i<N;i++){
      let v = 0;
      for(let k=0;k<DEC;k++) v += b[i*DEC+k];
      work[i] = v / DEC;
    }
    let rms = 0;
    for(let i=0;i<N;i++) rms += work[i]*work[i];
    rms = Math.sqrt(rms/N);
    if(rms < 0.006) return -1;

    const minLag = Math.max(2, Math.floor(sr/1250));
    const maxLag = Math.min(N-2, Math.floor(sr/70));
    if(maxLag <= minLag) return -1;
    if(!corr || corr.length < maxLag+2) corr = new Float32Array(maxLag+2);

    let best = -1, bestVal = 0;
    for(let lag=minLag; lag<=maxLag; lag++){
      let sum = 0, e1 = 0, e2 = 0;
      for(let i=0;i<N-lag;i++){
        const x = work[i], y = work[i+lag];
        sum += x*y; e1 += x*x; e2 += y*y;
      }
      const nc = sum / (Math.sqrt(e1*e2) + 1e-9);
      corr[lag] = nc;
      if(nc > bestVal){ bestVal = nc; best = lag; }
    }
    if(best < 0 || bestVal < 0.86) return -1;

    // prefer the earliest near-equal peak — this is what stops octave-down errors
    for(let lag=minLag+1; lag<best; lag++){
      if(corr[lag] > bestVal*0.94 && corr[lag] > corr[lag-1] && corr[lag] >= corr[lag+1]){ best = lag; break; }
    }
    const y1 = corr[best-1]||0, y2 = corr[best], y3 = corr[best+1]||0;
    const a = (y1 + y3 - 2*y2)/2, bq = (y3 - y1)/2;
    const shift = a ? -bq/(2*a) : 0;
    const freq = sr / (best + shift);
    if(freq < 70 || freq > 1250) return -1;
    return freq;
  }

  let lastHz = -1, stableCount = 0, lastStable = -1, frame = 0;
  function startLoop(){
    if(running) return;
    running = true;
    const ctx = Audio2.ensure();
    const tick = () => {
      if(!running) return;
      if(++frame % 2){ rafId = requestAnimationFrame(tick); return; }  // ~30 Hz is plenty
      analyser.getFloatTimeDomainData(buf);
      const hz = detect(buf, ctx.sampleRate);
      let midi = -1;
      if(hz > 0){
        midi = freqToMidi(hz);
        const r = Math.round(midi);
        if(Math.abs(r - lastStable) < 0.6) stableCount++; else { stableCount = 0; lastStable = r; }
      } else { stableCount = 0; }
      lastHz = hz;
      listeners.forEach(fn => { try{ fn(hz, midi, stableCount); }catch(e){} });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function on(fn){ listeners.push(fn); return () => { const i = listeners.indexOf(fn); if(i>=0) listeners.splice(i,1); }; }

  /* ---------- recording ---------- */
  function canRecord(){ return !!(window.MediaRecorder && stream); }
  function startRec(){
    if(!canRecord()) return false;
    try{
      chunks = [];
      const types = ["audio/webm","audio/mp4","audio/ogg"];
      let opt = {};
      for(const t of types){ if(MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)){ opt = {mimeType:t}; break; } }
      recorder = new MediaRecorder(stream, opt);
      recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
      recorder.start();
      return true;
    }catch(e){ return false; }
  }
  function stopRec(){
    return new Promise(res => {
      if(!recorder || recorder.state === "inactive") return res(null);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : "audio/webm" });
        chunks = []; recorder = null;
        res(blob.size ? blob : null);
      };
      try{ recorder.stop(); }catch(e){ res(null); }
    });
  }
  function isRecording(){ return !!(recorder && recorder.state === "recording"); }

  return { available, enable, on, canRecord, startRec, stopRec, isRecording,
           get enabled(){ return !!stream; } };
})();

/* ============================================================
   Storage — device only, with export / restore
   ============================================================ */
const Store = (function(){
  const KEY = "woodshed.v1";
  const DEFAULTS = {
    lastMinutes: 20,
    settings: { countIn:true, accent:true, wake:true, autoRec:false, sig:4, reminder:"19:00", restDays:[0] },
    streak: { count:0, best:0, last:null },
    days: {},                       // "2026-09-09": minutes
    sessions: [],
    modes: {},                      // dorian: { level, keysDone:[], bestBpm, lastSeen }
    songs: [],                      // { name, reps, classicId? }
    runs: {},                       // page6: { bpm, best, reps, last }
    runPrefs: {},
    strums: {},                     // strumming pattern tempos
    picks: {},                      // fingerpicking pattern tempos
    changes: {},                    // "G|C": { best, tries:[{date,n}] }
    theory: { done:[] },            // chord lessons marked learned
    labelMode: "deg"
  };
  let data = null;

  function load(){
    if(data) return data;
    try{
      const raw = localStorage.getItem(KEY);
      data = raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : JSON.parse(JSON.stringify(DEFAULTS));
      data.settings = Object.assign({}, DEFAULTS.settings, data.settings||{});
      data.streak   = Object.assign({}, DEFAULTS.streak, data.streak||{});
      ["songs","runs","runPrefs","strums","picks","changes","theory","modes","days","sessions"].forEach(k => {
        if(data[k] === DEFAULTS[k]) data[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
      });
    }catch(e){
      data = JSON.parse(JSON.stringify(DEFAULTS));
    }
    return data;
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(load())); }catch(e){} }
  function today(){ const d = new Date(); return d.toISOString().slice(0,10); }
  function dayKey(offset){
    const d = new Date(); d.setDate(d.getDate() + (offset||0));
    return d.toISOString().slice(0,10);
  }

  function recordSession(minutes, detail){
    const d = load(), t = today();
    d.days[t] = (d.days[t]||0) + minutes;
    d.sessions.unshift(Object.assign({ date:t, minutes }, detail||{}));
    if(d.sessions.length > 200) d.sessions.length = 200;
    bumpStreak();
    save();
    return d.streak.count;
  }
  /* Any session of any length counts. Rest days never break it. */
  function bumpStreak(){
    const d = load(), t = today();
    if(d.streak.last === t) return d.streak.count;
    let count = 1;
    let cursor = -1, guard = 0;
    while(guard++ < 400){
      const key = dayKey(cursor);
      const dow = new Date(key + "T12:00:00").getDay();
      if(d.days[key]) { count++; cursor--; continue; }
      if(d.settings.restDays.indexOf(dow) !== -1){ cursor--; continue; }
      break;
    }
    d.streak.count = count;
    d.streak.best = Math.max(d.streak.best||0, count);
    d.streak.last = t;
    return count;
  }
  /* Recompute for display without writing */
  function currentStreak(){
    const d = load();
    let count = 0, cursor = 0, guard = 0;
    while(guard++ < 400){
      const key = dayKey(cursor);
      const dow = new Date(key + "T12:00:00").getDay();
      if(d.days[key]){ count++; cursor--; continue; }
      if(cursor === 0){ cursor--; continue; }            // today not done yet — doesn't break it
      if(d.settings.restDays.indexOf(dow) !== -1){ cursor--; continue; }
      break;
    }
    return count;
  }
  function weekMinutes(){
    const d = load(); let n = 0;
    for(let i=0;i<7;i++) n += d.days[dayKey(-i)] || 0;
    return n;
  }
  function totalMinutes(){
    const d = load(); let n = 0;
    Object.keys(d.days).forEach(k => n += d.days[k]);
    return n;
  }
  function modeState(id){
    const d = load();
    if(!d.modes[id]) d.modes[id] = { level:0, keysDone:[], bestBpm:0, lastSeen:null, reps:0 };
    return d.modes[id];
  }
  /* Per-drill working tempo, shared by speed runs, strumming and fingerpicking. */
  function tempoState(bucket, id, start){
    const d = load();
    if(!d[bucket]) d[bucket] = {};
    if(!d[bucket][id]) d[bucket][id] = { bpm: start || 60, best:0, reps:0, last:null };
    return d[bucket][id];
  }
  function runState(id){ const def = RUN_BY_ID[id]; return tempoState("runs", id, def ? def.start : 56); }
  function logRun(id, rate, playedBpm){ const def = RUN_BY_ID[id]; return logTempo("runs", id, rate, playedBpm, def ? def.start : 56); }
  /* The app finds your speed: every logged rep nudges the working tempo. */
  function logTempo(bucket, id, rate, playedBpm, start){
    const st = tempoState(bucket, id, start), played = playedBpm || st.bpm;
    // only playing at (or near) the working tempo counts as evidence to move it up
    if(rate >= 3)      st.bpm = played >= st.bpm - 2 ? played + 4 : st.bpm + 1;
    else if(rate == 2) st.bpm = played >= st.bpm ? played + 1 : st.bpm;
    else               st.bpm = Math.min(st.bpm, played) - 4;
    st.bpm = Math.max(40, Math.min(220, Math.round(st.bpm)));
    if(rate >= 2) st.best = Math.max(st.best||0, played);
    st.reps = (st.reps||0) + 1;
    st.last = today();
    save();
    return st;
  }
  function exportJSON(){ return JSON.stringify(load(), null, 2); }
  function importJSON(txt){
    const parsed = JSON.parse(txt);
    data = Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), parsed);
    save(); return true;
  }
  function reset(){ data = JSON.parse(JSON.stringify(DEFAULTS)); save(); }

  return { load, save, today, dayKey, recordSession, currentStreak, weekMinutes,
           totalMinutes, modeState, runState, logRun, tempoState, logTempo, exportJSON, importJSON, reset };
})();

/* ---------- recordings live in IndexedDB (blobs don't fit in localStorage) ---------- */
const Recs = (function(){
  let dbp = null;
  function db(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("woodshed-recs", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("recs", { keyPath:"id" }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function put(rec){
    return db().then(d => new Promise((res,rej) => {
      const tx = d.transaction("recs","readwrite");
      tx.objectStore("recs").put(rec);
      tx.oncomplete = () => res(rec); tx.onerror = () => rej(tx.error);
    })).catch(()=>null);
  }
  function all(){
    return db().then(d => new Promise((res,rej) => {
      const out = [];
      const tx = d.transaction("recs","readonly");
      const cur = tx.objectStore("recs").openCursor();
      cur.onsuccess = e => {
        const c = e.target.result;
        if(c){ out.push(c.value); c.continue(); } else res(out.reverse());
      };
      cur.onerror = () => rej(cur.error);
    })).catch(()=>[]);
  }
  function del(id){
    return db().then(d => new Promise(res => {
      const tx = d.transaction("recs","readwrite");
      tx.objectStore("recs").delete(id);
      tx.oncomplete = res;
    })).catch(()=>null);
  }
  return { put, all, del };
})();
</script>
