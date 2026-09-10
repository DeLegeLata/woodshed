
<script>
/* ============================================================
   WOODSHED — the app
   ============================================================ */

const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const DAY_LETTERS = ["S","M","T","W","T","F","S"];

function toast(msg, ms){
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms || 2600);
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function mmss(sec){
  sec = Math.max(0, Math.round(sec));
  return String(Math.floor(sec/60)).padStart(2,"0") + ":" + String(sec%60).padStart(2,"0");
}

/* ---------- routing ---------- */
const SCREENS = ["home","plan","tuner","block","blockend","done","jam","songs","stats","settings"];
let screen = "home";
function go(name){
  screen = name;
  SCREENS.forEach(s => { const el = $("#scr-"+s); if(el) el.hidden = (s !== name); });
  window.scrollTo(0,0);
  if(name === "home")     renderHome();
  if(name === "stats")    renderStats();
  if(name === "songs")    renderSongs();
  if(name === "settings") renderSettings();
  if(name === "jam")      renderJam();
  if(name !== "block" && name !== "jam"){ Audio2.stop(); Audio2.drone(0,false); setPlayLabel(); }
}

/* ---------- drill content ---------- */
const WARMUPS = [
  "Chromatic 1‑2‑3‑4 up the low E and back down. One finger per fret, one note per click.",
  "Spider walk: 1‑3‑2‑4 across all six strings. Strict alternate picking, no rushing.",
  "Single‑string chromatic run to the 12th fret and back. Watch the picking hand, not the fretting hand.",
  "String skipping: 1‑2‑3‑4 on the low E, then the D, then the G. Skip the strings in between.",
  "Finger independence: hold down 1 and 3, move only 2 and 4. It should feel horrible."
];
const TECHNIQUES = [
  { t:"Ascend and descend the shape", s:"Strict alternate picking, three notes per string. Every note the same volume." },
  { t:"Legato through the shape", s:"Pick only the first note on each string. Hammer and pull the other two." },
  { t:"Sequence it in fours", s:"1‑2‑3‑4, then 2‑3‑4‑5, then 3‑4‑5‑6, all the way up the shape and back." },
  { t:"Sequence it in threes", s:"1‑2‑3, 2‑3‑4, 3‑4‑5 through the shape. Slower than you think." }
];
const RHYTHMS = [
  { t:"Land on 2 and 4 only", s:"One note on the backbeat. Nothing else. Sit exactly on the snare." },
  { t:"Keep the hand moving", s:"Strum the vamp in 8ths, muted. Your hand never stops, even when you don't hit the strings." },
  { t:"Change the subdivision, not the tempo", s:"Play the shape in 8ths, then triplets, then 16ths. Same click throughout." },
  { t:"Syncopate it", s:"Land on the ‘and’ of 2 and the ‘and’ of 4. Nothing on the downbeats." }
];
const IMPROVS = [
  "Start every phrase on the root. End it wherever you like.",
  "Three notes per phrase. Then a full bar of silence. Then three more.",
  "End every phrase on the note that makes this mode what it is.",
  "Call and response — play a phrase, then answer it.",
  "One string only. The whole solo on the G string.",
  "No bends, no vibrato, no tricks. Just note choice and rhythm."
];

/* ---------- progression through the curriculum ---------- */
function nextTarget(){
  for(const m of MODES){
    const st = Store.modeState(m.id);
    if(st.keysDone.length < 3){
      let key = null;
      for(const k of KEY_ORDER){ if(st.keysDone.indexOf(k) === -1){ key = k; break; } }
      if(key === null) key = KEY_ORDER[0];
      return { mode:m, keyPc:key, isNew: (st.reps||0) === 0 };
    }
  }
  // everything covered — rotate for review, oldest first
  let oldest = MODES[0], oldestT = Infinity;
  MODES.forEach(m => {
    const st = Store.modeState(m.id);
    const t = st.lastSeen ? Date.parse(st.lastSeen) : 0;
    if(t < oldestT){ oldestT = t; oldest = m; }
  });
  return { mode:oldest, keyPc: pick(KEY_ORDER), isNew:false, review:true };
}

/* ---------- session generator ---------- */
const ARCHETYPES = [
  { id:"balanced",  parts:[["warmup",.18],["mode",.32],["improv",.30],["song",.20]] },
  { id:"technique", parts:[["warmup",.18],["technique",.30],["mode",.28],["song",.24]] },
  { id:"improv",    parts:[["warmup",.15],["mode",.22],["improv",.43],["song",.20]] },
  { id:"theory",    parts:[["quiz",.15],["mode",.35],["improv",.30],["song",.20]] },
  { id:"rhythm",    parts:[["warmup",.15],["rhythm",.35],["improv",.30],["song",.20]] }
];

function buildSession(minutes){
  const target = nextTarget();
  const st = Store.modeState(target.mode.id);
  const baseBpm = Math.max(60, st.bestBpm || 76);

  let parts;
  if(minutes <= 10){
    parts = [["mode",.55],["improv",.45]];
  } else {
    let arch = pick(ARCHETYPES);
    if(target.isNew && arch.id === "improv") arch = ARCHETYPES[0]; // learn it before you jam on it
    parts = arch.parts.slice();
  }

  // allocate whole minutes
  const mins = parts.map(p => Math.max(2, Math.round(minutes * p[1])));
  let sum = mins.reduce((a,b)=>a+b,0);
  let i = 0;
  while(sum !== minutes){
    const j = i % mins.length;
    if(sum > minutes && mins[j] > 2){ mins[j]--; sum--; }
    else if(sum < minutes){ mins[j]++; sum++; }
    i++;
    if(i > 400) break;
  }

  const shape = shape3nps(target.keyPc, target.mode.id);
  const keyName = noteName(target.keyPc, target.keyPc);
  const groove = target.mode.id === "mixolydian" || target.mode.id === "dorian"
    ? pick(["shuffle","rock","funk"]) : pick(Audio2.GROOVE_IDS);
  const chart = parseChart(modalVamp(target.keyPc, target.mode.id).join(" | "));
  const d = Store.load();
  const song = d.songs.length ? d.songs.slice().sort((a,b)=>(a.reps||0)-(b.reps||0))[0] : null;

  const blocks = parts.map((p, idx) => {
    const kind = p[0], m = mins[idx];
    const b = { kind, minutes:m, target, shape, keyName, groove, chart };
    switch(kind){
      case "warmup":
        b.title = "Warm up";
        b.brief = pick(WARMUPS);
        b.backing = "click"; b.bpm = 80;
        break;
      case "technique": {
        const t = pick(TECHNIQUES);
        b.title = t.t;
        b.brief = t.s + " Tempo climbs 4 BPM every two bars — hang on as long as you can, then knock it back.";
        b.backing = "click"; b.bpm = baseBpm; b.showFret = true;
        b.ramp = { every:2, step:4, target: baseBpm + 40 };
        b.listen = true;
        break;
      }
      case "mode":
        b.title = keyName + " " + target.mode.name;
        b.brief = target.mode.colour;
        b.backing = "click"; b.bpm = Math.max(60, baseBpm - 10);
        b.showFret = true; b.drone = true; b.listen = true;
        b.lesson = target.isNew;
        break;
      case "rhythm": {
        const r = pick(RHYTHMS);
        b.title = r.t;
        b.brief = r.s;
        b.backing = "drums"; b.bpm = 92;
        break;
      }
      case "improv":
        b.title = "Solo in " + keyName + " " + target.mode.name;
        b.brief = pick(IMPROVS);
        b.backing = "band"; b.bpm = Math.max(70, baseBpm);
        b.showFret = true;
        break;
      case "quiz":
        b.title = "Quick theory";
        b.brief = "No guitar for a minute.";
        b.backing = "off";
        b.quiz = true;
        break;
      case "song":
        b.title = song ? song.name : "Play something you like";
        b.brief = song
          ? "Work the part that isn't working. Then play it through once for fun."
          : "No agenda. Add songs you're learning from the Songs screen and they'll show up here.";
        b.backing = "off"; b.bpm = 100; b.song = song;
        break;
    }
    return b;
  });

  return { minutes, blocks, target, shape, keyName };
}

/* ---------- quiz generator ---------- */
function makeQuiz(target){
  const qs = [];
  const m = target.mode;
  const others = MODES.filter(x => x.id !== m.id);
  const keyN = noteName(target.keyPc, target.keyPc);

  qs.push({
    q: "Which mode is the major scale with a flattened 7th?",
    opts: shuffle(["Mixolydian","Dorian","Lydian","Phrygian"]),
    a: "Mixolydian",
    why: "Flatten the 7th of a major scale and you get the dominant sound. That's Mixolydian."
  });
  qs.push({
    q: "Which mode has a raised 4th?",
    opts: shuffle(["Lydian","Ionian","Aeolian","Locrian"]),
    a: "Lydian",
    why: "The ♯4 is Lydian's whole identity — it's what makes it float."
  });
  qs.push({
    q: "You're playing over a " + keyN + "m7 chord. Which mode is the natural first choice?",
    opts: shuffle([keyN+" Dorian", keyN+" Lydian", keyN+" Mixolydian", keyN+" Ionian"]),
    a: keyN + " Dorian",
    why: "Dorian is the default minor-7th sound — minor, but with the brighter natural 6th."
  });
  qs.push({
    q: keyN + " " + m.name + " uses the same notes as which major scale?",
    opts: shuffle(uniq([
      noteName((target.keyPc - m.formula[0] - degreeOffset(m)) , target.keyPc),
      noteName((target.keyPc + 2)%12, target.keyPc),
      noteName((target.keyPc + 5)%12, target.keyPc),
      noteName((target.keyPc + 7)%12, target.keyPc)
    ])).slice(0,4),
    a: noteName((target.keyPc - degreeOffset(m)), target.keyPc),
    why: keyN + " " + m.name + " is degree " + (m.degree+1) + " of that major scale — same notes, different home."
  });
  qs.push({
    q: "Which of these is NOT in " + keyN + " " + m.name + "?",
    opts: wrongNoteOptions(target),
    a: wrongNoteOptions(target).__answer,
    why: "Every other note here sits in the shape. Check it against the fretboard."
  });
  qs.push({
    q: "Which mode is built on the 3rd degree of the major scale?",
    opts: shuffle(["Phrygian","Dorian","Lydian","Aeolian"]),
    a: "Phrygian",
    why: "Ionian, Dorian, Phrygian — third one along. It's the ♭2 that gives it that Spanish edge."
  });
  return shuffle(qs).slice(0,5);
}
function degreeOffset(m){ return m.formula[0] + majorOffsetForDegree(m.degree); }
function majorOffsetForDegree(deg){ return [0,2,4,5,7,9,11][deg]; }
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } return a; }
function uniq(a){ const s=[],seen={}; a.forEach(x=>{ if(!seen[x]){seen[x]=1;s.push(x);} }); return s; }
let _wrongCache = null, _wrongKey = null;
function wrongNoteOptions(target){
  const k = target.keyPc + ":" + target.mode.id;
  if(_wrongKey === k && _wrongCache) return _wrongCache;
  const inScale = target.mode.formula.map(i => (target.keyPc + i) % 12);
  let out = null;
  for(let p=0;p<12;p++){ if(inScale.indexOf(p) === -1){ out = p; break; } }
  const opts = shuffle([
    noteName(out, target.keyPc),
    noteName(inScale[1], target.keyPc),
    noteName(inScale[3], target.keyPc),
    noteName(inScale[5], target.keyPc)
  ]);
  opts.__answer = noteName(out, target.keyPc);
  _wrongKey = k; _wrongCache = opts;
  return opts;
}

/* ============================================================
   SESSION RUNNER
   ============================================================ */
const S = {
  plan:null, idx:0, remaining:0, tick:null, paused:false,
  labelMode: "deg", guide:false, guideStep:0,
  score:null, quiz:null, quizIdx:0, quizRight:0,
  recording:false, recStart:0, sessionRecs:[], wakeLock:null,
  lastBeatTime:0, blockSeconds:0
};

function currentBlock(){ return S.plan ? S.plan.blocks[S.idx] : null; }

async function requestWake(){
  if(!Store.load().settings.wake) return;
  try{
    if("wakeLock" in navigator && !S.wakeLock){
      S.wakeLock = await navigator.wakeLock.request("screen");
      S.wakeLock.addEventListener("release", () => { S.wakeLock = null; });
    }
  }catch(e){ /* not available — the app still works */ }
}
function releaseWake(){ if(S.wakeLock){ try{ S.wakeLock.release(); }catch(e){} S.wakeLock = null; } }

function startSession(plan){
  S.plan = plan; S.idx = 0; S.sessionRecs = [];
  Audio2.T.beatsPerBar = Store.load().settings.sig || 4;
  Audio2.T.accent = Store.load().settings.accent;
  Audio2.T.countIn = Store.load().settings.countIn;
  requestWake();
  enterBlock();
  go("block");
}

function enterBlock(){
  const b = currentBlock();
  if(!b){ finishSession(); return; }
  S.remaining = b.minutes * 60;
  S.blockSeconds = S.remaining;
  S.paused = false;
  S.guide = false; S.guideStep = 0;
  S.score = { total:0, inKey:0, timing:[] };

  $("#blockKind").textContent = ({
    warmup:"Warm up", technique:"Technique", mode:"Mode of the day",
    rhythm:"Rhythm", improv:"Improvise", quiz:"Theory", song:"Play a song"
  })[b.kind] || b.kind;
  $("#blockTitle").textContent = b.title;
  $("#blockBrief").textContent = b.brief;
  $("#blockMeta").textContent = "Block " + (S.idx+1) + " of " + S.plan.blocks.length +
    "  ·  " + b.minutes + " min";

  // lesson
  const wantLesson = !!b.lesson;
  $("#lessonCard").hidden = !wantLesson;
  if(wantLesson){
    const m = b.target.mode;
    $("#lessonTitle").textContent = b.keyName + " " + m.name;
    $("#lessonBody").innerHTML =
      "<p>" + esc(m.colour) + "</p>" +
      "<p><em>How to hear it:</em> " + esc(m.vs) + "</p>" +
      "<p><em>Where it lives:</em> over a " + esc(m.chord) + " chord.</p>" +
      "<p><em>You already know this sound:</em><br>" +
      m.songs.map(s => "· " + esc(s)).join("<br>") + "</p>" +
      "<p><em>Finding it:</em> the root is " + esc(b.keyName) +
      ". Put it on the low E string, then play the shape below from there. " +
      "Same shape as every other key — only the starting fret changes.</p>";
  }

  // fretboard
  $("#fretCard").hidden = !b.showFret;
  if(b.showFret){
    $("#fretLabel").textContent = b.keyName + " " + b.target.mode.name + " · 3 notes per string";
    drawFret();
  }

  // quiz
  $("#quizCard").hidden = !b.quiz;
  if(b.quiz){ S.quiz = makeQuiz(b.target); S.quizIdx = 0; S.quizRight = 0; showQuiz(); }

  // transport
  Audio2.T.mode = b.backing || "off";
  Audio2.T.groove = b.groove || "rock";
  Audio2.setBpm(b.bpm || 100);
  Audio2.setChart(b.chart || []);
  Audio2.T.ramp = b.ramp || null;
  syncBacking();
  $("#bpmSlider").value = Audio2.T.bpm;
  $("#bpmReadout").textContent = Audio2.T.bpm + " BPM";

  // extras
  const ex = $("#extraControls"); ex.innerHTML = "";
  if(b.drone){
    const btn = document.createElement("button");
    btn.className = "btn quiet"; btn.textContent = "Root drone";
    btn.setAttribute("aria-pressed","false");
    btn.onclick = () => {
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.style.borderColor = on ? "var(--amber-2)" : "";
      btn.style.color = on ? "var(--amber)" : "";
      Audio2.drone(b.target.keyPc, on);
    };
    ex.appendChild(btn);
  }
  if(b.ramp){
    const tag = document.createElement("span");
    tag.className = "chip amber";
    tag.textContent = "Ramp +" + b.ramp.step + " to " + b.ramp.target;
    ex.appendChild(tag);
  }

  // scoring via mic
  if(b.listen && Mic.enabled) startScoring(b);

  if(Store.load().settings.autoRec && Mic.enabled && b.kind !== "quiz") beginRecording();

  updateClock();
  if(S.tick) clearInterval(S.tick);
  S.tick = setInterval(() => {
    if(S.paused) return;
    S.remaining--;
    updateClock();
    if(S.remaining <= 0) endBlock();
  }, 1000);
}

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

function updateClock(){
  const c = $("#blockClock");
  c.textContent = mmss(S.remaining);
  c.classList.toggle("low", S.remaining <= 30);
  const pct = S.blockSeconds ? (1 - S.remaining/S.blockSeconds)*100 : 0;
  $("#blockBar").style.width = Math.min(100, Math.max(0,pct)) + "%";
}

function drawFret(){
  const b = currentBlock(); if(!b || !b.shape) return;
  $("#fretWrap").innerHTML = renderFretboard(b.shape, {
    labelMode: S.labelMode,
    highlight: S.guide ? S.guideStep % b.shape.notes.length : -1
  });
}

/* ---------- mic scoring ---------- */
let stopScoring = null;
function startScoring(b){
  if(stopScoring) stopScoring();
  const scalePcs = b.target.mode.formula.map(i => (b.target.keyPc + i) % 12);
  let lastNote = -99, lastAt = 0;
  stopScoring = Mic.on((hz, midi, stable) => {
    if(hz <= 0 || stable !== 3) return;           // one count per stable new note
    const t = Audio2.now();
    if(t - lastAt < 0.06) return;
    lastAt = t;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    S.score.total++;
    if(scalePcs.indexOf(pc) !== -1) S.score.inKey++;
    if(Audio2.T.playing && S.lastBeatTime){
      const spb = 60 / Audio2.T.bpm;
      let off = (t - S.lastBeatTime) % spb;
      if(off < 0) off += spb;
      const dist = Math.min(off, spb - off);
      S.score.timing.push(1 - Math.min(1, dist / (spb/2)));
    }
  });
}

/* ---------- transport wiring ---------- */
function syncBacking(){
  $$("#backingSeg button").forEach(btn =>
    btn.setAttribute("aria-pressed", btn.dataset.mode === Audio2.T.mode ? "true" : "false"));
}
function setPlayLabel(){
  const p = $("#playBtn"); if(p) p.textContent = Audio2.T.playing ? "Stop" : "Play";
  const j = $("#jamPlay");  if(j) j.textContent = Audio2.T.playing ? "Stop" : "Play";
}

Audio2.T.onBeat = function(t, beatInBar, isDown, counting, absBeat){
  S.lastBeatTime = t;
  const delay = Math.max(0, (t - Audio2.now()) * 1000);
  setTimeout(() => {
    const lamp = $("#lamp");
    lamp.classList.add("on");
    lamp.classList.toggle("accent", !!isDown);
    setTimeout(() => lamp.classList.remove("on"), 85);
    if(S.guide && screen === "block" && !counting){
      S.guideStep++;
      drawFret();
    }
  }, delay);
};
Audio2.T.onRamp = function(bpm){
  const s = $("#bpmSlider"); if(s) s.value = bpm;
  const r = $("#bpmReadout"); if(r) r.textContent = bpm + " BPM";
};

/* ---------- block end ---------- */
function endBlock(){
  if(S.tick){ clearInterval(S.tick); S.tick = null; }
  Audio2.stop(); Audio2.drone(0,false); setPlayLabel();
  Audio2.chime("block");
  if(S.recording) finishRecording();
  const b = currentBlock();

  $("#endBlockTitle").textContent = b.title;
  const hasScore = b.listen && Mic.enabled && S.score.total >= 8;
  $("#endScoreWrap").hidden = !hasScore;
  if(hasScore){
    const acc = Math.round(100 * S.score.inKey / S.score.total);
    $("#endAcc").textContent = acc + "%  (" + S.score.inKey + " of " + S.score.total + ")";
    if(S.score.timing.length > 4){
      const tm = Math.round(100 * S.score.timing.reduce((a,c)=>a+c,0) / S.score.timing.length);
      $("#endTime").textContent = tm + "%";
    } else $("#endTime").textContent = "not enough played to judge";
  }
  if(b.quiz){
    $("#endScoreWrap").hidden = false;
    $("#endAcc").textContent = S.quizRight + " of " + (S.quiz ? S.quiz.length : 0) + " right";
    $("#endTime").textContent = "—";
  }
  $("#endRateWrap").hidden = false;
  $$("#scr-blockend .rate button").forEach(x => x.style.borderColor = "");
  S.pendingRate = hasScore ? Math.max(1, Math.min(3, Math.round((100*S.score.inKey/S.score.total)/34))) : 2;
  go("blockend");
}

function commitBlock(rate){
  const b = currentBlock();
  if(!b) return;
  if(b.kind === "mode" || b.kind === "technique"){
    const st = Store.modeState(b.target.mode.id);
    st.reps = (st.reps||0) + 1;
    st.lastSeen = new Date().toISOString();
    if(rate >= 2 && st.keysDone.indexOf(b.target.keyPc) === -1) st.keysDone.push(b.target.keyPc);
    if(b.ramp) st.bestBpm = Math.max(st.bestBpm||0, Audio2.T.bpm);
    else st.bestBpm = Math.max(st.bestBpm||0, b.bpm||0);
    Store.save();
  }
  if(b.kind === "song" && b.song){
    const d = Store.load();
    const s = d.songs.filter(x => x.name === b.song.name)[0];
    if(s){ s.reps = (s.reps||0)+1; s.rate = rate; s.last = Store.today(); }
    Store.save();
  }
}

function nextBlock(){
  commitBlock(S.pendingRate || 2);
  S.idx++;
  if(S.idx >= S.plan.blocks.length){ finishSession(); return; }
  enterBlock();
  go("block");
}

function finishSession(){
  if(S.tick){ clearInterval(S.tick); S.tick = null; }
  Audio2.stop(); Audio2.drone(0,false);
  releaseWake();
  if(stopScoring){ stopScoring(); stopScoring = null; }
  Audio2.chime("done");

  const mins = S.plan ? S.plan.blocks.reduce((a,b)=>a+b.minutes,0) : 0;
  const streak = Store.recordSession(mins, {
    mode: S.plan && S.plan.target ? S.plan.target.mode.id : null,
    key:  S.plan && S.plan.target ? S.plan.target.keyPc : null
  });

  $("#doneStreak").textContent = streak;
  $("#doneMins").textContent = mins;
  $("#doneWeek").textContent = Store.weekMinutes();
  $("#doneTotal").textContent = (Store.totalMinutes()/60).toFixed(1);
  renderWeek($("#doneWeekDots"));

  const t = S.plan && S.plan.target;
  if(t){
    const st = Store.modeState(t.mode.id);
    const left = Math.max(0, 3 - st.keysDone.length);
    $("#doneNotes").innerHTML = left
      ? "<p>" + esc(t.mode.name) + " in " + esc(noteName(t.keyPc,t.keyPc)) + " logged. " +
        left + " more " + (left===1?"key":"keys") + " and this mode counts as learned.</p>"
      : "<p><em>" + esc(t.mode.name) + " is done.</em> Next session moves you on.</p>";
  } else $("#doneNotes").innerHTML = "";

  const rl = $("#doneRecs"); rl.innerHTML = "";
  S.sessionRecs.forEach(r => rl.appendChild(recRow(r)));
  S.plan = null;
  go("done");
}

/* ---------- recording ---------- */
function beginRecording(){
  if(!Mic.enabled){ toast("Turn the microphone on first — it's on the tuner screen."); return; }
  if(!Mic.startRec()){ toast("This browser won't let the app record."); return; }
  S.recording = true; S.recStart = Date.now();
  $("#recBtn").textContent = "Stop rec";
  $("#recBtn").style.color = "var(--bad)";
}
function finishRecording(){
  S.recording = false;
  $("#recBtn").textContent = "Record";
  $("#recBtn").style.color = "";
  const b = currentBlock();
  Mic.stopRec().then(blob => {
    if(!blob) return;
    const rec = {
      id: "r" + Date.now(),
      date: new Date().toISOString(),
      title: (b ? b.title : "Jam"),
      seconds: Math.round((Date.now() - S.recStart)/1000),
      blob
    };
    Recs.put(rec).then(() => { S.sessionRecs.push(rec); toast("Saved that take."); });
  });
}
function recRow(r){
  const d = document.createElement("div");
  d.style.border = "1px solid var(--edge)";
  d.style.borderRadius = "8px";
  d.style.padding = "10px";
  const head = document.createElement("div");
  head.className = "row";
  head.style.alignItems = "center";
  head.innerHTML = '<div style="flex:1"><b style="font-weight:500">' + esc(r.title) +
    '</b><br><span class="tiny dim mono">' + new Date(r.date).toLocaleString() +
    " · " + r.seconds + 's</span></div>';
  const del = document.createElement("button");
  del.className = "btn quiet"; del.textContent = "Delete";
  del.onclick = () => { Recs.del(r.id).then(() => { d.remove(); }); };
  head.appendChild(del);
  const a = document.createElement("audio");
  a.controls = true;
  try{ a.src = URL.createObjectURL(r.blob); }catch(e){}
  d.appendChild(head); d.appendChild(a);
  return d;
}

/* ---------- quiz ---------- */
function showQuiz(){
  const q = S.quiz[S.quizIdx];
  if(!q){
    $("#quizQ").textContent = "That's the lot — " + S.quizRight + " of " + S.quiz.length + " right.";
    $("#quizOpts").innerHTML = "";
    $("#quizWhy").hidden = true;
    $("#quizCount").textContent = "Done";
    return;
  }
  $("#quizCount").textContent = "Question " + (S.quizIdx+1) + " of " + S.quiz.length;
  $("#quizQ").textContent = q.q;
  $("#quizWhy").hidden = true;
  const box = $("#quizOpts"); box.innerHTML = "";
  q.opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.onclick = () => {
      if(box.dataset.locked) return;
      box.dataset.locked = "1";
      const right = opt === q.a;
      btn.classList.add(right ? "right" : "wrong");
      if(!right){
        $$("#quizOpts button").forEach(x => { if(x.textContent === q.a) x.classList.add("right"); });
      } else S.quizRight++;
      $("#quizWhy").hidden = false;
      $("#quizWhy").textContent = q.why;
      setTimeout(() => { box.dataset.locked = ""; S.quizIdx++; showQuiz(); }, 2200);
    };
    box.appendChild(btn);
  });
}

/* ============================================================
   SCREEN RENDERERS
   ============================================================ */
let chosenMinutes = 20;

function renderHome(){
  const d = Store.load();
  chosenMinutes = d.lastMinutes || 20;
  chosenMinutes = 20;                       // always opens at 20, by design
  $("#minsNum").textContent = chosenMinutes;
  const streak = Store.currentStreak();
  $("#streakChip").textContent = streak + (streak === 1 ? " day" : " days");
  $("#stStreak").textContent = streak;
  $("#stWeek").textContent = Store.weekMinutes();
  const learned = MODES.filter(m => Store.modeState(m.id).keysDone.length >= 3).length;
  $("#stModes").textContent = learned + "/7";
  renderWeek($("#weekDots"));
  const t = nextTarget();
  $("#homeNext").textContent = "Up next: " + noteName(t.keyPc,t.keyPc) + " " + t.mode.name +
    (t.isNew ? " — new tonight" : t.review ? " — review" : "");
}
function renderWeek(el){
  if(!el) return;
  const d = Store.load();
  el.innerHTML = "";
  for(let i=6;i>=0;i--){
    const key = Store.dayKey(-i);
    const dow = new Date(key + "T12:00:00").getDay();
    const wrap = document.createElement("div");
    const b = document.createElement("b");
    if(d.days[key]) b.className = "on";
    else if(d.settings.restDays.indexOf(dow) !== -1) b.className = "rest";
    const s = document.createElement("span");
    s.textContent = DAY_LETTERS[dow];
    wrap.appendChild(b); wrap.appendChild(s);
    el.appendChild(wrap);
  }
}

let previewPlan = null;
function renderPlan(plan){
  previewPlan = plan;
  $("#planTitle").textContent = plan.minutes + " minutes · " + plan.keyName + " " + plan.target.mode.name;
  const list = $("#planList"); list.innerHTML = "";
  plan.blocks.forEach((b,i) => {
    const row = document.createElement("div");
    row.className = "blockrow";
    row.innerHTML = '<div class="mins">' + b.minutes + '</div>' +
      '<div><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.brief) + '</div></div>' +
      '<span class="chip' + (b.lesson ? ' amber' : '') + '">' +
        esc(b.lesson ? "New" : ({warmup:"Warm",technique:"Tech",mode:"Mode",rhythm:"Time",improv:"Solo",quiz:"Theory",song:"Song"})[b.kind] || b.kind) +
      '</span>';
    list.appendChild(row);
  });
}

function renderSongs(){
  const d = Store.load();
  const el = $("#songList"); el.innerHTML = "";
  if(!d.songs.length){
    el.innerHTML = '<div class="tiny dim">Nothing here yet. Add a song you\'re working on.</div>';
    return;
  }
  d.songs.forEach((s,i) => {
    const row = document.createElement("div");
    row.className = "songrow";
    row.innerHTML = '<div class="nm"><b>' + esc(s.name) + '</b><span>' +
      (s.reps ? s.reps + " session" + (s.reps>1?"s":"") : "not touched yet") +
      (s.last ? " · " + s.last : "") + '</span></div>';
    const del = document.createElement("button");
    del.className = "btn quiet"; del.textContent = "Remove";
    del.onclick = () => { d.songs.splice(i,1); Store.save(); renderSongs(); };
    row.appendChild(del);
    el.appendChild(row);
  });
}

function renderStats(){
  const d = Store.load();
  $("#pgStreak").textContent = Store.currentStreak();
  $("#pgBest").textContent = d.streak.best || 0;
  $("#pgHours").textContent = (Store.totalMinutes()/60).toFixed(1);
  const mp = $("#modeProgress"); mp.innerHTML = "";
  MODES.forEach(m => {
    const st = Store.modeState(m.id);
    const row = document.createElement("div");
    row.className = "blockrow";
    row.style.gridTemplateColumns = "1fr auto";
    const keys = st.keysDone.map(k => noteName(k,k)).join(" ");
    row.innerHTML = '<div><div class="t">' + esc(m.name) + '</div><div class="s">' +
      (st.keysDone.length ? "Solid in " + esc(keys) : "Not started") +
      (st.bestBpm ? " · best " + st.bestBpm + " BPM" : "") + '</div></div>' +
      '<span class="chip' + (st.keysDone.length >= 3 ? ' go' : '') + '">' +
      Math.min(3, st.keysDone.length) + '/3</span>';
    mp.appendChild(row);
  });
  const rl = $("#recList"); rl.innerHTML = '<div class="tiny dim">Loading…</div>';
  Recs.all().then(list => {
    rl.innerHTML = "";
    if(!list.length){ rl.innerHTML = '<div class="tiny dim">No recordings yet.</div>'; return; }
    list.slice(0,15).forEach(r => rl.appendChild(recRow(r)));
  });
}

function renderSettings(){
  const s = Store.load().settings;
  const set = (id,v) => $(id).setAttribute("aria-pressed", v ? "true":"false");
  set("#setCountin", s.countIn); set("#setAccent", s.accent);
  set("#setWake", s.wake); set("#setAutoRec", s.autoRec);
  const sig = $("#setSig");
  if(!sig.options.length){
    [[4,"4/4"],[3,"3/4"],[6,"6/8"],[5,"5/4"],[2,"2/4"]].forEach(o => {
      const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sig.appendChild(op);
    });
  }
  sig.value = s.sig || 4;
  $("#setReminder").value = s.reminder || "19:00";
  const rd = $("#restDays"); rd.innerHTML = "";
  for(let i=0;i<7;i++){
    const wrap = document.createElement("div");
    const b = document.createElement("b");
    if(s.restDays.indexOf(i) !== -1) b.className = "rest";
    b.style.cursor = "pointer";
    b.onclick = () => {
      const k = s.restDays.indexOf(i);
      if(k === -1) s.restDays.push(i); else s.restDays.splice(k,1);
      Store.save(); renderSettings();
    };
    const sp = document.createElement("span"); sp.textContent = DAY_LETTERS[i];
    wrap.appendChild(b); wrap.appendChild(sp); rd.appendChild(wrap);
  }
}

/* ---------- free jam ---------- */
let jamShape = null;
function renderJam(){
  const kSel = $("#jamKey"), mSel = $("#jamMode"), pSel = $("#jamProg"), gSel = $("#jamGroove");
  if(!kSel.options.length){
    KEY_ORDER.forEach(k => { const o = document.createElement("option"); o.value = k; o.textContent = noteName(k,k); kSel.appendChild(o); });
    MODES.forEach(m => { const o = document.createElement("option"); o.value = m.id; o.textContent = m.name; mSel.appendChild(o); });
    PROGRESSIONS.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; pSel.appendChild(o); });
    Audio2.GROOVE_IDS.forEach(g => { const o = document.createElement("option"); o.value = g; o.textContent = Audio2.GROOVES[g].name; gSel.appendChild(o); });
    kSel.value = 4; mSel.value = "dorian"; pSel.value = "vamp"; gSel.value = "rock";
  }
  applyJam();
}
function applyJam(){
  const keyPc = parseInt($("#jamKey").value,10);
  const modeId = $("#jamMode").value;
  const progId = $("#jamProg").value;
  const custom = $("#jamChords").value.trim();
  jamShape = shape3nps(keyPc, modeId);
  $("#jamFret").innerHTML = renderFretboard(jamShape, { labelMode: S.labelMode });
  const prog = PROGRESSIONS.filter(p => p.id === progId)[0];
  const chords = custom ? parseChart(custom) : parseChart(prog.build(keyPc, modeId).join(" | "));
  Audio2.setChart(chords);
  Audio2.T.groove = $("#jamGroove").value;
  Audio2.T.ramp = null;
  Audio2.setBpm(parseInt($("#jamBpm").value,10));
  $("#jamBpmReadout").textContent = Audio2.T.bpm + " BPM";
  const pressed = $$("#jamSeg button").filter(b => b.getAttribute("aria-pressed") === "true")[0];
  Audio2.T.mode = pressed ? pressed.dataset.mode : "band";
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function bind(){
  // nav
  $$("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));

  // home timer
  const setMins = v => {
    chosenMinutes = Math.max(5, Math.min(90, v));
    $("#minsNum").textContent = chosenMinutes;
    $("#minusBtn").disabled = chosenMinutes <= 5;
    $("#plusBtn").disabled  = chosenMinutes >= 90;
    const d = Store.load(); d.lastMinutes = chosenMinutes; Store.save();
  };
  $("#minusBtn").onclick = () => { setMins(chosenMinutes - 5); Audio2.resume(); };
  $("#plusBtn").onclick  = () => { setMins(chosenMinutes + 5); Audio2.resume(); };
  $("#buildBtn").onclick = () => { renderPlan(buildSession(chosenMinutes)); go("plan"); };

  $("#reshuffleBtn").onclick = () => renderPlan(buildSession(chosenMinutes));
  $("#planBackBtn").onclick  = () => go("home");
  $("#startBtn").onclick = () => { go("tuner"); initTuner(); };
  $("#skipTuneBtn").onclick = () => startSession(previewPlan);

  // tuner
  $("#micBtn").onclick = () => {
    Audio2.resume().then(() => Mic.enable()).then(() => {
      $("#tunerMsg").textContent = "Listening. Play one string at a time.";
      $("#micBtn").hidden = true;
    }).catch(err => {
      $("#tunerMsg").innerHTML = micDiagnosis(err);
    });
  };
  $("#tunerDoneBtn").onclick = () => { if(previewPlan) startSession(previewPlan); else go("home"); };

  // block transport
  $("#playBtn").onclick = () => { Audio2.toggle().then(setPlayLabel); };
  $("#bpmSlider").oninput = e => {
    Audio2.setBpm(parseInt(e.target.value,10));
    $("#bpmReadout").textContent = Audio2.T.bpm + " BPM";
  };
  $("#bpmUp").onclick   = () => { Audio2.setBpm(Audio2.T.bpm + 5); $("#bpmSlider").value = Audio2.T.bpm; $("#bpmReadout").textContent = Audio2.T.bpm + " BPM"; };
  $("#bpmDown").onclick = () => { Audio2.setBpm(Audio2.T.bpm - 5); $("#bpmSlider").value = Audio2.T.bpm; $("#bpmReadout").textContent = Audio2.T.bpm + " BPM"; };

  let taps = [];
  $("#tapBtn").onclick = () => {
    const t = performance.now();
    taps = taps.filter(x => t - x < 2500); taps.push(t);
    if(taps.length >= 2){
      let sum = 0;
      for(let i=1;i<taps.length;i++) sum += taps[i] - taps[i-1];
      const bpm = Math.round(60000 / (sum/(taps.length-1)));
      Audio2.setBpm(bpm);
      $("#bpmSlider").value = Audio2.T.bpm;
      $("#bpmReadout").textContent = Audio2.T.bpm + " BPM";
    }
  };
  $("#recBtn").onclick = () => { S.recording ? finishRecording() : beginRecording(); };
  $$("#backingSeg button").forEach(b => b.onclick = () => {
    Audio2.T.mode = b.dataset.mode; syncBacking();
  });
  $("#pauseBtn").onclick = () => {
    S.paused = !S.paused;
    $("#pauseBtn").textContent = S.paused ? "Resume" : "Pause";
    if(S.paused){ Audio2.stop(); setPlayLabel(); }
  };
  $("#lblDeg").onclick  = () => { S.labelMode = "deg";  $("#lblDeg").setAttribute("aria-pressed","true");  $("#lblNote").setAttribute("aria-pressed","false"); drawFret(); };
  $("#lblNote").onclick = () => { S.labelMode = "note"; $("#lblDeg").setAttribute("aria-pressed","false"); $("#lblNote").setAttribute("aria-pressed","true");  drawFret(); };
  $("#guideBtn").onclick = () => {
    S.guide = !S.guide; S.guideStep = 0;
    $("#guideBtn").textContent = S.guide ? "Stop the guide" : "Guide me through it";
    drawFret();
    if(S.guide && !Audio2.T.playing) Audio2.start().then(setPlayLabel);
  };
  $("#listenBtn").onclick = () => {
    const b = currentBlock(); if(!b || !b.shape) return;
    Audio2.auditionShape(b.shape, Math.max(90, Audio2.T.bpm));
  };
  $("#lessonGotIt").onclick = () => { $("#lessonCard").hidden = true; };
  $("#skipBlockBtn").onclick = () => {
    const b = currentBlock();
    if(b && b.target){ const st = Store.modeState(b.target.mode.id); st.skips = (st.skips||0)+1; Store.save(); }
    S.pendingRate = 1; nextBlock();
  };
  $("#nextBlockBtn").onclick = () => endBlock();
  $("#bailBtn").onclick = () => {
    const done = S.plan ? S.plan.blocks.slice(0, S.idx).reduce((a,b)=>a+b.minutes,0) : 0;
    const partial = Math.max(1, done + Math.round((S.blockSeconds - S.remaining)/60));
    if(S.tick) clearInterval(S.tick);
    Store.recordSession(partial, { bailed:true });
    S.plan = null; releaseWake();
    toast("Logged " + partial + " min. Go and play.");
    go("jam");
  };

  // block end
  $$("#scr-blockend .rate button").forEach(b => b.onclick = () => {
    S.pendingRate = parseInt(b.dataset.rate,10);
    $$("#scr-blockend .rate button").forEach(x => x.style.borderColor = "");
    b.style.borderColor = "var(--amber)";
  });
  $("#extendBtn").onclick = () => {
    S.remaining = 5*60; S.blockSeconds += 5*60;
    S.paused = false;
    if(S.tick) clearInterval(S.tick);
    S.tick = setInterval(() => {
      if(S.paused) return;
      S.remaining--; updateClock();
      if(S.remaining <= 0) endBlock();
    }, 1000);
    updateClock();
    go("block");
  };
  $("#continueBtn").onclick = () => nextBlock();

  // jam
  ["#jamKey","#jamMode","#jamProg","#jamGroove"].forEach(id => $(id).onchange = applyJam);
  $("#jamChords").oninput = applyJam;
  $("#jamBpm").oninput = () => { Audio2.setBpm(parseInt($("#jamBpm").value,10)); $("#jamBpmReadout").textContent = Audio2.T.bpm + " BPM"; };
  $$("#jamSeg button").forEach(b => b.onclick = () => {
    Audio2.T.mode = b.dataset.mode;
    $$("#jamSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true":"false"));
  });
  $("#jamPlay").onclick = () => { applyJam(); Audio2.toggle().then(setPlayLabel); };

  // songs
  $("#songAdd").onclick = () => {
    const v = $("#songInput").value.trim();
    if(!v) return;
    Store.load().songs.push({ name:v, reps:0 });
    Store.save(); $("#songInput").value = ""; renderSongs();
  };
  $("#songInput").onkeydown = e => { if(e.key === "Enter") $("#songAdd").click(); };

  // settings
  const tog = (id, key, after) => {
    $(id).onclick = () => {
      const s = Store.load().settings;
      s[key] = !s[key];
      $(id).setAttribute("aria-pressed", s[key] ? "true":"false");
      Store.save();
      if(after) after(s[key]);
    };
  };
  tog("#setCountin","countIn", v => Audio2.T.countIn = v);
  tog("#setAccent","accent",  v => Audio2.T.accent = v);
  tog("#setWake","wake");
  tog("#setAutoRec","autoRec");
  $("#setSig").onchange = e => {
    const s = Store.load().settings;
    s.sig = parseInt(e.target.value,10); Store.save();
    Audio2.T.beatsPerBar = s.sig;
  };
  $("#setReminder").onchange = e => {
    const s = Store.load().settings;
    s.reminder = e.target.value; Store.save();
    scheduleReminder();
  };
  $("#exportBtn").onclick = () => {
    const txt = Store.exportJSON();
    navigator.clipboard && navigator.clipboard.writeText(txt)
      .then(() => toast("Backup copied to your clipboard. Paste it somewhere safe."))
      .catch(() => window.prompt("Copy this and keep it safe:", txt));
  };
  $("#importBtn").onclick = () => {
    const txt = window.prompt("Paste a Woodshed backup:");
    if(!txt) return;
    try{ Store.importJSON(txt); toast("Restored."); go("home"); }
    catch(e){ toast("That didn't look like a Woodshed backup."); }
  };
  $("#resetBtn").onclick = () => {
    if(window.confirm("Erase every session, streak and setting on this device?")){
      Store.reset(); toast("Wiped."); go("home");
    }
  };
}

/* ---------- why the mic didn't open ----------
   Four different causes look identical to a user. Name the real one. */
function micDiagnosis(err){
  const framed = (window.self !== window.top);
  const secure = window.isSecureContext;
  const haveApi = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const name = err && err.name ? err.name : "unknown";
  const msg  = err && err.message ? err.message : "";
  const detail = '<br><span class="mono tiny" style="color:var(--cream-3)">' +
    esc(name + (msg ? ": " + msg : "")) +
    " · framed=" + framed + " · secure=" + secure + " · api=" + haveApi + "</span>";

  if(!secure)
    return "This page isn't on a secure connection, so no browser will hand over a microphone. " +
           "It needs to be served over https." + detail;
  if(!haveApi || /permission|policy/i.test(msg))
    return "<b>The page itself is blocked from using the microphone.</b> This isn't your phone " +
           "and it isn't a setting you can change — the page is running inside a frame that " +
           "doesn't pass microphone access through. Woodshed needs its own web address to fix it. " +
           "Tell Claude and it'll move the app." + detail;
  if(name === "NotAllowedError")
    return "Chrome blocked the microphone for this site. Tap the icon to the left of the address " +
           "bar &rarr; Permissions &rarr; Microphone &rarr; Allow, then reload and try again. " +
           "If there's no microphone entry at all, the page is frame-blocked and needs its own " +
           "web address instead." + detail;
  if(name === "NotFoundError" || name === "OverconstrainedError")
    return "No microphone was found on this device." + detail;
  if(name === "NotReadableError")
    return "Something else is holding the microphone — close other apps that might be using it, " +
           "then try again." + detail;
  return "Couldn't open the microphone. Everything except the tuner, note detection and " +
         "recording still works." + detail;
}

/* Runs before anything is tapped, and says plainly whether this page is even
   permitted to ask for a microphone. Chrome exposes the frame's permissions policy
   directly, which is the difference between "you blocked it" and "it was never allowed". */
function micPreflight(){
  const el = $("#tunerMsg");
  const framed = (window.self !== window.top);
  const fp = document.featurePolicy || document.permissionsPolicy;
  let policy = null;
  try{ if(fp && fp.allowsFeature) policy = fp.allowsFeature("microphone"); }catch(e){}
  const haveApi = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const foot = () => '<br><span class="mono tiny" style="color:var(--cream-3)">' +
    "framed=" + framed + " · policy=" + (policy === null ? "unknown" : policy) +
    " · api=" + haveApi + " · secure=" + window.isSecureContext + "</span>";

  if(policy === false || !haveApi){
    el.innerHTML = "<b>This page is not allowed to ask for the microphone.</b> " +
      "It's running inside a frame that doesn't pass microphone access through, which is " +
      "why no permission popup ever appeared — the request never got that far. " +
      "Not a phone setting, and not something you can grant. Woodshed needs its own web " +
      "address to fix it." + foot();
    $("#micBtn").disabled = true;
    return;
  }
  if(navigator.permissions && navigator.permissions.query){
    navigator.permissions.query({ name:"microphone" }).then(p => {
      if(p.state === "denied"){
        el.innerHTML = "<b>Chrome has microphone blocked for this site.</b> Tap the icon left " +
          "of the address bar &rarr; Permissions &rarr; Microphone &rarr; Allow, then reload." + foot();
      } else if(p.state === "granted"){
        el.innerHTML = "Microphone is allowed. Tap below to start listening." + foot();
      } else {
        el.innerHTML = "Tap below and Chrome will ask for microphone access." + foot();
      }
    }).catch(() => {
      el.innerHTML = "Tap below to let Woodshed hear your guitar." + foot();
    });
  } else {
    el.innerHTML = "Tap below to let Woodshed hear your guitar." + foot();
  }
}

/* ---------- tuner screen ---------- */
let tunerOff = null;
function initTuner(){
  const ticks = $("#tunerTicks");
  if(!ticks.children.length){
    for(let i=0;i<21;i++){
      const t = document.createElement("i");
      if(i === 10) t.className = "mid";
      ticks.appendChild(t);
    }
  }
  const dots = $("#stringDots");
  if(!dots.children.length){
    ["E","A","D","G","B","e"].forEach((n,i) => {
      const d = document.createElement("div");
      d.textContent = n; d.dataset.midi = OPEN_MIDI[i];
      dots.appendChild(d);
    });
  }
  $("#micBtn").hidden = Mic.enabled;
  if(Mic.enabled) $("#tunerMsg").textContent = "Listening. Play one string at a time.";
  else micPreflight();
  if(tunerOff) tunerOff();
  tunerOff = Mic.on((hz, midi) => {
    if(screen !== "tuner") return;
    if(hz <= 0){
      $("#tunerNote").textContent = "—";
      $("#tunerCents").textContent = "play a string";
      $("#tunerNeedle").style.left = "50%";
      $("#tunerNeedle").classList.remove("ok");
      return;
    }
    const near = Math.round(midi);
    const cents = Math.round((midi - near) * 100);
    $("#tunerNote").textContent = noteName(near % 12, 0);
    $("#tunerCents").textContent = (cents > 0 ? "+" : "") + cents + " cents · " + hz.toFixed(1) + " Hz";
    $("#tunerNeedle").style.left = Math.max(2, Math.min(98, 50 + cents)) + "%";
    $("#tunerNeedle").classList.toggle("ok", Math.abs(cents) <= 5);
    $$("#stringDots div").forEach(d => {
      const m = parseInt(d.dataset.midi,10);
      d.classList.toggle("hit", Math.abs(near - m) <= 0 && Math.abs(cents) <= 8);
    });
  });
}

/* ---------- reminder (honest about its limits) ---------- */
let reminderTimer = null;
function scheduleReminder(){
  if(reminderTimer) clearTimeout(reminderTimer);
  if(!("Notification" in window)) return;
  const s = Store.load().settings;
  if(!s.reminder) return;
  const run = () => {
    const parts = s.reminder.split(":");
    const now = new Date();
    const at = new Date();
    at.setHours(parseInt(parts[0],10), parseInt(parts[1],10), 0, 0);
    if(at <= now) at.setDate(at.getDate()+1);
    reminderTimer = setTimeout(() => {
      try{
        if(!Store.load().days[Store.today()])
          new Notification("Woodshed", { body:"Your streak is waiting. Even five minutes counts." });
      }catch(e){}
      scheduleReminder();
    }, Math.min(at - now, 2147483647));
  };
  if(Notification.permission === "granted") run();
  else if(Notification.permission === "default") Notification.requestPermission().then(p => { if(p === "granted") run(); });
}

/* ---------- boot ---------- */
function boot(){
  Store.load();
  bind();
  S.labelMode = Store.load().labelMode || "deg";
  go("home");
  scheduleReminder();
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible" && screen === "block") requestWake();
  });
  // dim between blocks rather than sleeping outright
  window.addEventListener("pagehide", () => Audio2.stop());
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
</script>
