
<script>
/* ============================================================
   WOODSHED — chords & rhythm
   Chord shapes, strumming and fingerpicking drills that play along
   in time, one-minute changes, and chord-building theory.
   Runs only after the app script has defined $, esc, Store, toast.
   ============================================================ */

/* ---------- chord spelling ---------- */
const LETTERS = ["C","D","E","F","G","A","B"], LETTER_PC = [0,2,4,5,7,9,11];
const IV_FORMULA = {0:"1",1:"♭2",2:"2",3:"♭3",4:"3",5:"4",6:"♭5",7:"5",8:"♯5",9:"6",10:"♭7",11:"7",14:"9",15:"♯9",21:"13"};
function rootName(pc){ return noteName(pc, pc); }
function namePc(name){ return parseChord(name).pc; }
/* Spell a chord tone by letter, so Cm gets E♭ rather than D♯. */
function spellTone(root, iv, degNum){
  const li = LETTERS.indexOf(root[0]);
  const rpc = namePc(root);
  const tli = (li + degNum - 1) % 7;
  const target = ((rpc + iv) % 12 + 12) % 12;
  const diff = ((target - LETTER_PC[tli] + 18) % 12) - 6;
  const acc = {0:"", 1:"♯", 2:"♯♯", "-1":"♭", "-2":"♭♭"}[diff];
  return acc === undefined ? noteName(target, rpc) : LETTERS[tli] + acc;
}
function formulaFor(q){
  const iv = CHORD_TYPES[q] || CHORD_TYPES[""];
  return iv.map(i => (q === "dim7" && i === 9) ? "♭♭7" : IV_FORMULA[i] || String(i));
}
function spellChord(root, q){
  const iv = CHORD_TYPES[q] || CHORD_TYPES[""];
  return iv.map((i, k) => {
    const lab = formulaFor(q)[k];
    const deg = parseInt(lab.replace(/[^0-9]/g, ""), 10);
    return spellTone(root, i, deg);
  });
}
function qLabel(q){ return String(q).replace(/b/g, "♭").replace(/#/g, "♯"); }
function normQ(q){
  const m = { maj:"", M:"", min:"m", "-":"m", dom7:"7", min7:"m7", "-7":"m7", M7:"maj7", "△7":"maj7",
              "ø":"m7b5", "m7♭5":"m7b5", sus:"sus4", "°":"dim" };
  return m[q] !== undefined ? m[q] : q;
}

/* ---------- shapes ---------- */
/* strings low E → high e; x = muted */
const OPEN_VOICINGS = {
  "C":"x32010","G":"320003","D":"xx0232","A":"x02220","E":"022100","F":"133211","B":"x24442",
  "Am":"x02210","Em":"022000","Dm":"xx0231","Bm":"x24432","F♯m":"244222","Cm":"x35543","Gm":"355333",
  "C7":"x32310","G7":"320001","D7":"xx0212","A7":"x02020","E7":"020100","B7":"x21202",
  "Am7":"x02010","Em7":"022030","Dm7":"xx0211",
  "Cmaj7":"x32000","Gmaj7":"320002","Fmaj7":"xx3210","Dmaj7":"xx0222","Amaj7":"x02120","Emaj7":"021100",
  "Dsus2":"xx0230","Dsus4":"xx0233","Asus2":"x02200","Asus4":"x02230","Esus4":"022200",
  "Cadd9":"x32030","E5":"022xxx","A5":"x022xx","D5":"xx023x","G5":"355xxx"
};
/* movable templates relative to the root fret; a = one fret below the root */
const E_SHAPES = { "":"022100", m:"022000", "7":"020100", m7:"020000", maj7:"0x110x", sus4:"022200",
                   "5":"022xxx", "6":"022120", "9":"020102", aug:"032110", "7sus4":"020200", m7b5:"0x00ax" };
const A_SHAPES = { "":"x02220", m:"x02210", "7":"x02020", m7:"x02010", maj7:"x02120", sus2:"x02200",
                   sus4:"x02230", "5":"x022xx", "6":"x02222", m6:"x02212", m7b5:"x0101x", dim:"x0121x",
                   dim7:"x01212", add9:"x02420", "9":"x0a00x", "7#9":"x0a01x" };
function parseShape(str, base){
  return str.split("").map(c => c === "x" ? -1 : c === "a" ? base - 1 : base + parseInt(c, 10));
}
function voicingFor(ch){
  let q = normQ(ch.quality);
  const key1 = SHARP[ch.pc] + qLabel(q), key2 = FLAT[ch.pc] + qLabel(q);
  let frets = null;
  if(OPEN_VOICINGS[key1]) frets = parseShape(OPEN_VOICINGS[key1], 0);
  else if(OPEN_VOICINGS[key2]) frets = parseShape(OPEN_VOICINGS[key2], 0);
  else {
    if(!E_SHAPES[q] && !A_SHAPES[q]) q = ch.intervals.indexOf(3) !== -1 ? "m" : "";
    const cands = [];
    [[E_SHAPES, 4], [A_SHAPES, 9]].forEach(([set, open]) => {
      if(!set[q]) return;
      let f = ((ch.pc - open) % 12 + 12) % 12;
      if(set[q].indexOf("a") !== -1 && f < 1) f += 12;
      const fr = parseShape(set[q], f);
      cands.push({ fr, hi: Math.max.apply(null, fr) });
    });
    cands.sort((a, b) => a.hi - b.hi);
    frets = cands[0].fr;
  }
  const midis = [], strs = [];
  frets.forEach((f, s) => { if(f >= 0){ midis.push(OPEN_MIDI[s] + f); strs.push(s); } });
  let rootString = strs.filter(s => (OPEN_MIDI[s] + frets[s]) % 12 === ch.pc)[0];
  if(rootString === undefined) rootString = strs[0];
  let alt = rootString <= 1 ? 2 : Math.min(5, rootString + 1);
  if(frets[alt] < 0) alt = rootString;
  return { frets, midis, rootString, altString: alt };
}

function chordDiagramSVG(frets, rootPc){
  const snd = frets.filter(f => f > 0);
  const hi = snd.length ? Math.max.apply(null, snd) : 0, lo = snd.length ? Math.min.apply(null, snd) : 0;
  const base = hi <= 4 ? 1 : lo;
  const L = 22, R = 90, T = 24, FH = 19, NF = 5;
  const sx = s => L + s * (R - L) / 5;
  const p = ['<svg viewBox="0 0 100 128" role="img" aria-label="Chord diagram" xmlns="http://www.w3.org/2000/svg">'];
  for(let i=0;i<=NF;i++){
    const y = T + i*FH, nut = base === 1 && i === 0;
    p.push('<rect x="'+(L-1)+'" y="'+(y-(nut?2.5:0.6))+'" width="'+(R-L+2)+'" height="'+(nut?5:1.2)+'" fill="'+(nut?"#ece0c8":"#6e6355")+'"/>');
  }
  for(let s=0;s<6;s++) p.push('<rect x="'+(sx(s)-0.6)+'" y="'+T+'" width="1.2" height="'+(NF*FH)+'" fill="#a3967f"/>');
  if(base > 1) p.push('<text x="'+(L-5)+'" y="'+(T+FH*0.5+4)+'" text-anchor="end" font-family="Space Mono, monospace" font-size="10" fill="#a3967f">'+base+'</text>');
  frets.forEach((f, s) => {
    if(f < 0) p.push('<text x="'+sx(s)+'" y="'+(T-7)+'" text-anchor="middle" font-family="Karla, sans-serif" font-size="11" fill="#6e6355">×</text>');
    else if(f === 0) p.push('<circle cx="'+sx(s)+'" cy="'+(T-10)+'" r="3.6" fill="none" stroke="#a3967f" stroke-width="1.3"/>');
  });
  // barre: the lowest fret held across three or more strings with nothing lower in between
  if(lo > 0 && frets.indexOf(0) === -1){
    const on = frets.map((f, s) => f === lo ? s : -1).filter(s => s >= 0);
    if(on.length >= 3 || (on.length === 2 && on[1] - on[0] >= 3)){
      const a = on[0], b = on[on.length-1];
      let ok = true;
      for(let s=a;s<=b;s++) if(frets[s] < lo) ok = false;
      if(ok) p.push('<rect x="'+(sx(a)-6)+'" y="'+(T+(lo-base+0.5)*FH-6)+'" width="'+(sx(b)-sx(a)+12)+'" height="12" rx="6" fill="#ece0c8"/>');
    }
  }
  frets.forEach((f, s) => {
    if(f <= 0) return;
    const isRoot = (OPEN_MIDI[s] + f) % 12 === rootPc;
    p.push('<circle cx="'+sx(s)+'" cy="'+(T+(f-base+0.5)*FH)+'" r="6" fill="'+(isRoot?"#ff9d2f":"#ece0c8")+'"/>');
  });
  p.push('</svg>');
  return p.join("");
}
function diagEl(label){
  const ch = parseChord(label), v = voicingFor(ch);
  const el = document.createElement("div");
  el.className = "diag";
  el.innerHTML = chordDiagramSVG(v.frets, ch.pc) + '<b>' + esc(label) + '</b>';
  return el;
}

/* ---------- drill content ---------- */
/* D/U = accented down/up, d/u = normal, x = muted scratch, - = hand moves, strings not hit */
const STRUMS = [
  { id:"quarters", name:"Downstrokes on the beat", level:1, slots:"D-d-D-d-", start:72, groove:"rock",
    how:"One downstroke on each click. Between clicks your hand swings back up without touching the strings.",
    tip:"Get this rock solid before anything else. The \"up\" motion you're skipping is what every other pattern fills in." },
  { id:"eighths", name:"Straight eighths", level:1, slots:"DudUDudU", start:72, groove:"rock",
    how:"Down on the numbers, up on the \"and\"s. Keep the wrist loose and the motion like shaking water off your hand.",
    tip:"Downstrokes hit all six strings. Upstrokes only catch the top three or four. That's normal, and it's why ups sound lighter." },
  { id:"campfire", name:"The campfire strum", level:1, slots:"D-dU-udU", start:76, groove:"rock",
    how:"Down, down-up, (miss), up, down-up. On the miss your hand still swings down but skips the strings.",
    tip:"This is the pattern behind a huge number of acoustic songs. The trick is never stopping the hand, so the missed strum keeps you in time." },
  { id:"shuffle", name:"Shuffle strum", level:2, slots:"DuduDudu", start:84, groove:"shuffle", swing:true,
    how:"The same down-up motion, but each down is long and each up is short: DAA-da DAA-da.",
    tip:"Swing lives in the wrist. Let the downstroke linger, then flick the upstroke in late, right before the next beat." },
  { id:"push", name:"The push", level:2, slots:"D-dU-udU", start:80, groove:"rock", push:true,
    how:"The campfire strum, but the last upstroke of each bar already plays the NEXT chord.",
    tip:"Changing a half-beat early is how pop and rock rhythm parts get their forward lean. Move your fingers on beat 4, not beat 1." },
  { id:"offbeat", name:"Offbeat upstrokes", level:2, slots:"-u-U-u-U", start:96, groove:"rock",
    how:"Only the \"and\"s, as short, choppy upstrokes. Release the pressure right after each hit so the chord cuts off.",
    tip:"Reggae and ska rhythm. Your hand still moves down on every beat. You just don't hit anything." },
  { id:"funk", name:"16th-note funk scratch", level:3, slots:"duxuDuxuduxuDuxu", start:70, groove:"funk",
    how:"Sixteenth notes, where ✕ is a muted scratch: relax the fretting hand so the strings go dead. Accent beats 2 and 4.",
    tip:"The strumming hand runs 16ths the whole time. Your fretting hand decides which strums are chords and which are scratches." },
  { id:"gallop", name:"Gallop", level:3, slots:"D-duD-duD-duD-du", start:78, groove:"rock",
    how:"One long, two short on every beat: DOWN, down-up. Palm-mute it on electric.",
    tip:"The metal and hard-rock rhythm engine. Keep the down on each beat heavy and the two short strums light." }
];
/* B = bass (chord root), B2 = alternate bass, 1/2/3 = high e / B / G strings */
const PICKS = [
  { id:"bassChord", name:"Bass and pinch", level:1, start:72,
    slots:[["B"],[],["3","2","1"],[],["B2"],[],["3","2","1"],[]], fingers:["p","","ima","","p","","ima",""],
    how:"Thumb plays the bass note, then index, middle and ring pluck the top three strings together.",
    tip:"Assign fingers once and keep them: thumb (p) on bass strings, index (i) on G, middle (m) on B, ring (a) on high e." },
  { id:"arp", name:"Rolling arpeggio", level:1, start:66,
    slots:[["B"],["3"],["2"],["1"],["2"],["3"],["2"],["3"]], fingers:["p","i","m","a","m","i","m","i"],
    how:"p-i-m-a-m-i-m-i. Hold the whole chord shape down and let every note ring into the next.",
    tip:"Rest your thumb on the next bass string before you need it. Planting fingers ahead of time is what keeps it even." },
  { id:"pinch", name:"Pinch pattern", level:2, start:64,
    slots:[["B","1"],["3"],["2"],["3"],["B2","1"],["3"],["2"],["3"]], fingers:["p+a","i","m","i","p+a","i","m","i"],
    how:"Thumb and ring finger pluck together on beats 1 and 3, then index and middle fill in between.",
    tip:"The pinch makes the melody note and bass land at the same moment. Squeeze them like picking something up." },
  { id:"travis", name:"Travis picking", level:2, start:62,
    slots:[["B","1"],["2"],["B2"],["1"],["B"],["2"],["B2"],["2"]], fingers:["p+m","i","p","m","p","i","p","i"],
    how:"The thumb alternates between two bass strings on every beat. The fingers fill the offbeats above it.",
    tip:"Loop the thumb alone first until it's automatic, even while talking. Then add one finger note at a time. Country, folk, Chet Atkins, Merle Travis." },
  { id:"classical", name:"Classical p-i-m-i", level:2, start:56,
    slots:[["B"],["3"],["2"],["3"],["B"],["3"],["2"],["3"],["B2"],["3"],["2"],["3"],["B2"],["3"],["2"],["3"]],
    fingers:["p","i","m","i","p","i","m","i","p","i","m","i","p","i","m","i"],
    how:"Sixteenth notes: thumb, index, middle, index, with the bass moving to the alternate string halfway through the bar.",
    tip:"Classical players alternate i and m like walking. Never pluck twice in a row with the same finger." },
  { id:"roll", name:"Forward roll", level:3, start:58,
    slots:[["B"],["3"],["1"],["B2"],["3"],["1"],["B"],["3"]], fingers:["p","i","m","p","i","m","p","i"],
    how:"A three-finger roll, p-i-m, repeated through a four-beat bar, so the accent drifts across the beat.",
    tip:"Groups of three over four: the same trick behind banjo rolls and Eric Johnson's runs. Accent every thumb note." }
];
const DRILL_PROGS = [
  { id:"gcd",   name:"G – C – G – D",           chords:"G | C | G | D",           level:1 },
  { id:"emcgd", name:"Em – C – G – D",          chords:"Em | C | G | D",          level:1 },
  { id:"ade",   name:"A – D – E – A",           chords:"A | D | E | A",           level:1 },
  { id:"camfg", name:"C – Am – Fmaj7 – G",      chords:"C | Am | Fmaj7 | G",      level:1 },
  { id:"amdme", name:"Am – Dm – E – Am",        chords:"Am | Dm | E | Am",        level:1 },
  { id:"dsus",  name:"D – Dsus4 – D – Dsus2",   chords:"D | Dsus4 | D | Dsus2",   level:2 },
  { id:"blues", name:"E7 – A7 – E7 – B7",       chords:"E7 | A7 | E7 | B7",       level:2 },
  { id:"jazzy", name:"Cmaj7 – Am7 – Dm7 – G7",  chords:"Cmaj7 | Am7 | Dm7 | G7",  level:2 },
  { id:"barre", name:"F – C – G – Am (barre F)", chords:"F | C | G | Am",         level:3 },
  { id:"bm",    name:"Bm – G – D – A (barre Bm)", chords:"Bm | G | D | A",        level:3 }
];
const CHANGE_PAIRS = [
  ["G","C",1],["Em","C",1],["G","D",1],["A","D",1],["C","Am",1],["Am","E",1],["D","Em",1],["E","A",1],
  ["G","Cadd9",1],["C","G7",2],["E7","A7",2],["Am","Dm",2],["C","Fmaj7",2],["B7","E",2],
  ["C","F",3],["Bm","G",3],["F","G",3]
].map(a => ({ a:a[0], b:a[1], level:a[2], key:a[0] + "|" + a[1] }));

/* ---------- live drill: highlights and play-along in time with the click ---------- */
const RH = { active:null, along:true, changeIv:null };

function mountDrill(el, drill){
  drill.chart = parseChart(drill.prog.chords).map(ch => ({ ch, v: voicingFor(ch) }));
  drill.ci = 0; drill.lastSlot = -1; drill.el = el;
  el.innerHTML = "";

  const row = document.createElement("div");
  row.className = "chordrow";
  drill.diags = {};
  uniqueChords(drill.chart.map(c => c.ch)).forEach(u => {
    const d = diagEl(u.ch.label);
    drill.diags[u.ch.label] = d;
    row.appendChild(d);
  });
  el.appendChild(row);

  const grid = document.createElement("div");
  el.appendChild(grid);
  drill.gridEl = grid;
  if(drill.type === "strum") paintStrumGrid(drill); else paintPickGrid(drill);

  const along = document.createElement("button");
  along.className = "btn quiet wide";
  const lbl = () => {
    along.textContent = RH.along ? "App plays along: on — tap to play it alone" : "App plays along: off";
    along.style.color = RH.along ? "var(--go)" : "";
    along.style.borderColor = RH.along ? "#3f6a48" : "";
  };
  along.onclick = () => { RH.along = !RH.along; lbl(); };
  lbl();
  el.appendChild(along);

  paintChordHighlight(drill);
  RH.active = drill;
}
function paintChordHighlight(d){
  const cur = d.chart[d.ci % d.chart.length].ch.label;
  Object.keys(d.diags).forEach(k => d.diags[k].classList.toggle("on", k === cur));
}
function paintStrumGrid(d){
  const slots = d.pat.slots, per = slots.length / 4;
  const subs = per === 2 ? ["", "&"] : ["", "e", "&", "a"];
  const g = d.gridEl; g.className = "sgrid"; g.innerHTML = "";
  d.cols = [];
  for(let i=0;i<slots.length;i++){
    const c = slots[i], sub = i % per, down = sub % 2 === 0;
    let cls = "", glyph;
    if(c === "-"){ cls = "miss"; glyph = down ? "↓" : "↑"; }
    else if(c === "x"){ cls = "mute"; glyph = "✕"; }
    else { glyph = (c === "D" || c === "d") ? "↓" : "↑"; if(c === "D" || c === "U") cls = "acc"; }
    const cell = document.createElement("div");
    cell.className = "scell";
    cell.innerHTML = '<span class="bt">' + (sub === 0 ? (Math.floor(i/per) + 1) : subs[sub]) + '</span><span class="ar ' + cls + '">' + glyph + '</span>';
    g.appendChild(cell);
    d.cols.push([cell]);
  }
}
function tokenString(tok, v){
  return tok === "B" ? v.rootString : tok === "B2" ? v.altString : 6 - parseInt(tok, 10);
}
function paintPickGrid(d){
  const v = d.chart[d.ci % d.chart.length].v, slots = d.pat.slots, per = slots.length / 4;
  const subs = per === 2 ? ["", "&"] : ["", "e", "&", "a"];
  const wrap = d.gridEl; wrap.className = "pwrap"; wrap.innerHTML = "";
  const t = document.createElement("table"); t.className = "pgrid";
  d.cols = slots.map(() => []);
  const beats = document.createElement("tr"); beats.className = "beats";
  beats.appendChild(document.createElement("th"));
  slots.forEach((_, i) => { const td = document.createElement("td"); td.textContent = i % per === 0 ? (i/per + 1) : subs[i % per]; beats.appendChild(td); d.cols[i].push(td); });
  t.appendChild(beats);
  for(let s=5;s>=0;s--){
    const tr = document.createElement("tr"); tr.className = "str";
    const th = document.createElement("th"); th.textContent = STRING_NAMES[s]; tr.appendChild(th);
    slots.forEach((toks, i) => {
      const td = document.createElement("td");
      const hit = toks.some(tok => tokenString(tok, v) === s) && v.frets[s] >= 0;
      if(hit){
        td.textContent = v.frets[s];
        td.className = "on" + (toks.some(tok => tok[0] === "B" && tokenString(tok, v) === s) ? " bass" : "");
      } else td.textContent = "·";
      tr.appendChild(td); d.cols[i].push(td);
    });
    t.appendChild(tr);
  }
  const fr = document.createElement("tr"); fr.className = "fing";
  fr.appendChild(document.createElement("th"));
  d.pat.fingers.forEach((f, i) => { const td = document.createElement("td"); td.textContent = f; fr.appendChild(td); d.cols[i].push(td); });
  t.appendChild(fr);
  wrap.appendChild(t);
  d.lastSlot = -1;
}
function clearDrillHit(){
  const d = RH.active; if(!d || d.lastSlot < 0 || !d.cols[d.lastSlot]) return;
  d.cols[d.lastSlot].forEach(e => e.classList.remove("hit"));
  d.lastSlot = -1;
}
/* Called from the metronome for every scheduled beat, with its exact audio time. */
function drillBeat(t, beatInBar, counting, absBeat){
  const d = RH.active;
  if(!d || counting || screen !== d.where || beatInBar >= 4) return;
  const bar = Math.floor(absBeat / Audio2.T.beatsPerBar);
  const ci = bar % d.chart.length;
  const n = d.pat.slots.length / 4, spb = 60 / Audio2.T.bpm;
  for(let k=0;k<n;k++){
    const slot = beatInBar * n + k;
    let frac = k / n;
    if(d.pat.swing && n === 2 && k === 1) frac = 0.667;
    const st = t + frac * spb;
    if(RH.along) playSlot(d, slot, ci, st, spb / n);
    setTimeout(() => showSlot(d, slot, ci), Math.max(0, (st - Audio2.now()) * 1000));
  }
}
function playSlot(d, slot, ci, t, slotDur){
  if(d.type === "strum"){
    const c = d.pat.slots[slot];
    if(c === "-") return;
    const useCi = (d.pat.push && slot === d.pat.slots.length - 1) ? ci + 1 : ci;
    const v = d.chart[useCi % d.chart.length].v;
    if(c === "x"){ Audio2.scratch(t, 0.9); return; }
    const up = (c === "U" || c === "u"), acc = (c === "D" || c === "U");
    Audio2.strum(t, v.midis, up, acc ? 1 : 0.6, Math.min(1.1, slotDur * (d.pat.slots.length === 16 ? 3 : 4)));
  } else {
    const v = d.chart[ci].v;
    d.pat.slots[slot].forEach(tok => {
      const s = tokenString(tok, v);
      if(v.frets[s] >= 0) Audio2.pluck(t, OPEN_MIDI[s] + v.frets[s], Math.min(1.4, slotDur * 5));
    });
  }
}
function showSlot(d, slot, ci){
  if(RH.active !== d || !Audio2.T.playing) return;
  if(ci !== d.ci){
    d.ci = ci;
    paintChordHighlight(d);
    if(d.type === "pick") paintPickGrid(d);
  }
  clearDrillHit();
  if(d.cols[slot]){ d.cols[slot].forEach(e => e.classList.add("hit")); d.lastSlot = slot; }
}

/* ---------- one-minute changes ---------- */
function mountChanges(el, pair, onLogged){
  if(RH.changeIv){ clearInterval(RH.changeIv); RH.changeIv = null; }
  const data = Store.load();
  const rec = data.changes[pair.key] || { best:0, tries:[] };
  el.innerHTML = "";
  const row = document.createElement("div"); row.className = "chordrow"; row.style.justifyContent = "center";
  row.appendChild(diagEl(pair.a));
  const sw = document.createElement("span"); sw.className = "swap"; sw.textContent = "⇄"; row.appendChild(sw);
  row.appendChild(diagEl(pair.b));
  el.appendChild(row);

  const timer = document.createElement("div"); timer.className = "ctimer"; timer.textContent = "60";
  el.appendChild(timer);
  const start = document.createElement("button"); start.className = "btn primary wide"; start.textContent = "Start the minute";
  el.appendChild(start);

  const lab = document.createElement("div"); lab.className = "legend"; lab.textContent = "Clean changes counted";
  el.appendChild(lab);
  const step = document.createElement("div"); step.className = "stepper";
  step.innerHTML = '<button class="btn quiet">&minus;</button><input type="number" min="0" max="200" value="' + (rec.tries[0] ? rec.tries[0].n : 20) + '" aria-label="Changes counted"><button class="btn quiet">+</button>';
  const [minus, input, plus] = step.children;
  minus.onclick = () => { input.value = Math.max(0, (parseInt(input.value,10)||0) - 1); };
  plus.onclick  = () => { input.value = (parseInt(input.value,10)||0) + 1; };
  const save = document.createElement("button"); save.className = "btn"; save.style.flex = "1"; save.textContent = "Log it";
  step.appendChild(save);
  el.appendChild(step);

  const hist = document.createElement("div"); hist.className = "tiny dim mono";
  const paintHist = () => {
    hist.textContent = rec.tries.length
      ? "Best " + rec.best + " · last: " + rec.tries.slice(0,5).map(x => x.n).join(", ") + " · 30 a minute is song-ready, 60 is automatic"
      : "No attempts yet. Around 30 a minute is enough for most songs; 60 means it's automatic.";
  };
  paintHist();
  el.appendChild(hist);

  start.onclick = () => {
    if(RH.changeIv) return;
    Audio2.resume();
    let left = 60;
    timer.classList.add("run"); start.textContent = "Go — change, change, change";
    Audio2.chime("block");
    RH.changeIv = setInterval(() => {
      left--;
      timer.textContent = left;
      if(left <= 0 || !document.body.contains(timer)){
        clearInterval(RH.changeIv); RH.changeIv = null;
        timer.classList.remove("run"); timer.textContent = "60";
        start.textContent = "Start another minute";
        if(document.body.contains(timer)){ Audio2.chime("done"); toast("Time. How many clean changes?"); input.focus(); }
      }
    }, 1000);
  };
  save.onclick = () => {
    const n = parseInt(input.value, 10);
    if(!(n >= 0)){ toast("Enter how many changes you counted."); return; }
    const prev = rec.best || 0;
    rec.tries.unshift({ date: Store.today(), n });
    if(rec.tries.length > 12) rec.tries.length = 12;
    rec.best = Math.max(prev, n);
    data.changes[pair.key] = rec;
    Store.save();
    paintHist();
    toast(n > prev ? "New best: " + n + " changes." : "Logged " + n + ". Best is " + prev + ".");
    if(onLogged) onLogged();
  };
}

/* ---------- picking what to practise ---------- */
function pickByReps(list, bucket){
  const d = Store.load(), st = d[bucket] || {};
  const repsAt = lv => list.filter(r => r.level === lv).some(r => st[r.id] && st[r.id].reps >= 3);
  const maxLv = repsAt(2) ? 3 : repsAt(1) ? 2 : 1;
  const pool = shuffle(list.filter(r => r.level <= maxLv));
  pool.sort((a, b) => ((st[a.id]||{}).reps||0) - ((st[b.id]||{}).reps||0));
  return pool[0];
}
function pickProg(level){ return pick(DRILL_PROGS.filter(p => p.level <= Math.max(1, level))); }
function pickPair(){
  const d = Store.load();
  const good = lv => CHANGE_PAIRS.filter(p => p.level === lv).some(p => d.changes[p.key] && d.changes[p.key].best >= 30);
  const maxLv = good(2) ? 3 : good(1) ? 2 : 1;
  const pool = shuffle(CHANGE_PAIRS.filter(p => p.level <= maxLv));
  pool.sort((a, b) => ((d.changes[a.key]||{tries:[]}).tries.length) - ((d.changes[b.key]||{tries:[]}).tries.length));
  return pool[0];
}

/* ---------- chord theory ---------- */
const QUALS = [
  { q:"",     name:"Major",           desc:"The bright, settled home sound. Take the 1st, 3rd and 5th notes of the major scale." },
  { q:"m",    name:"Minor",           desc:"A major chord with the 3rd lowered a half step. That one note turns bright into sad." },
  { q:"5",    name:"Power chord",     desc:"Just root and 5th. With no 3rd it's neither major nor minor, which is why it stays clear under heavy distortion." },
  { q:"sus2", name:"Sus2",            desc:"The 3rd is swapped for the 2nd. Open and airy. It leans toward resolving but doesn't have to." },
  { q:"sus4", name:"Sus4",            desc:"The 3rd is swapped for the 4th. It pulls hard back to the major chord, so it's used as a tease before resolving." },
  { q:"dim",  name:"Diminished",      desc:"Minor 3rd on top of minor 3rd, so the 5th is flat. Tense and unstable. It's the vii chord of every major key." },
  { q:"aug",  name:"Augmented",       desc:"Major 3rd on top of major 3rd, so the 5th is sharp. Dreamy and unresolved, mostly used as a passing chord." },
  { q:"6",    name:"Major 6",         desc:"Major plus the 6th. Sweet and vintage: surf, swing and big-band endings." },
  { q:"7",    name:"Dominant 7",      desc:"Major plus a flat 7th. The blues chord, and the V chord that pulls a song back home." },
  { q:"maj7", name:"Major 7",         desc:"Major plus the natural 7th, a half step below the root. Soft, lush and jazzy." },
  { q:"m7",   name:"Minor 7",         desc:"Minor plus a flat 7th. Smoother than a plain minor. It's the ii, iii and vi chord of a key." },
  { q:"m7b5", name:"Half-diminished", desc:"A diminished triad plus a flat 7th. The vii chord of a key with its 7th added, and the ii chord in minor keys." },
  { q:"dim7", name:"Diminished 7",    desc:"Minor 3rds stacked all the way up, so the shape repeats every three frets. Pure suspense." },
  { q:"add9", name:"Add 9",           desc:"Major plus the 9th (the 2nd, an octave up), with no 7th. Shimmery. It's all over pop and worship music." },
  { q:"9",    name:"Dominant 9",      desc:"A dominant 7 with the 9th on top. The funk and soul chord." }
];
const QUAL_BY = {}; QUALS.forEach(x => QUAL_BY[x.q] = x);
const STEP_NAME = {1:"half step", 2:"whole step", 3:"minor 3rd", 4:"major 3rd", 5:"perfect 4th", 7:"perfect 5th"};

const LESSONS = [
  { id:"what", title:"What a chord actually is", try:{ q:"" },
    body:"A chord is three or more notes played together. Most chords are built by stacking <em>thirds</em>: skip a note of the scale, take the next. From C: skip D, take E; skip F, take G. That gives C–E–G, the 1st, 3rd and 5th of the scale, which is a C major chord. Every open chord shape you know is just those three notes, doubled across six strings." },
  { id:"minor", title:"Major vs minor is one note", try:{ q:"m" },
    body:"The 3rd decides the mood. A <em>major 3rd</em> (4 half steps above the root) sounds bright; a <em>minor 3rd</em> (3 half steps) sounds dark. Play E, then Em: only one finger moves, the G♯ drops to G. Find the 3rd in any shape and you can turn it major or minor yourself." },
  { id:"no3", title:"Chords with no 3rd: power and sus", try:{ q:"sus4" },
    body:"Leave out the 3rd and the chord stops being major or minor. A <em>power chord</em> is only root and 5th. A <em>sus</em> chord replaces the 3rd with the 2nd or 4th, which leaves it hanging and wanting to resolve. Play Dsus4 → D and hear the 4th fall back to the 3rd." },
  { id:"sevenths", title:"Seventh chords: three flavours", try:{ q:"7" },
    body:"Stack one more third to get four notes. Which 7th you add sets the flavour. A <em>dominant 7</em> (major + ♭7) is bluesy and restless and wants to resolve. A <em>major 7</em> (major + natural 7) is soft and jazzy. A <em>minor 7</em> (minor + ♭7) is smooth. Compare G7, Gmaj7 and Am7 in the builder." },
  { id:"key", title:"Chords that belong to a key", try:null,
    body:"Build a chord on every note of a major scale, using only notes from that scale, and the qualities always fall in the same order: <em>major, minor, minor, major, major, minor, diminished</em>. Written as I ii iii IV V vi vii°. In G that's G, Am, Bm, C, D, Em, F♯°. Most songs are built from this list. See \"Chords in a key\" below." },
  { id:"tension", title:"Diminished and augmented", try:{ q:"dim" },
    body:"Stack two minor 3rds and the 5th comes out flat, giving a <em>diminished</em> chord. Stack two major 3rds and the 5th comes out sharp, giving an <em>augmented</em> chord. Neither has a stable 5th, so both sound like they're about to move. That's exactly how they're used: as passing chords between two stable ones." },
  { id:"colour", title:"Colour notes: 6, add9, 9", try:{ q:"add9" },
    body:"Extensions are notes added on top for colour. The <em>6</em> is sweet, <em>add9</em> is shimmery and open, and <em>9</em> (with a ♭7 underneath) is funky. On guitar you often drop the 5th to make room. A chord still does its job with just its root, 3rd and 7th." }
];

function chordToneShape(rootPc, q){
  const iv = (CHORD_TYPES[q] || CHORD_TYPES[""]).map(i => i % 12);
  const labels = formulaFor(q);
  const notes = [];
  for(let s=0;s<6;s++) for(let f=1;f<=12;f++){
    const midi = OPEN_MIDI[s] + f, rel = ((midi - rootPc) % 12 + 12) % 12, k = iv.indexOf(rel);
    if(k === -1) continue;
    notes.push({ string:s, fret:f, midi, label:labels[k], name:noteName(midi % 12, rootPc), root: rel === 0 });
  }
  return { notes, rootPc, minFret:1, maxFret:12 };
}

const CH = { tab:"strum", strumId:"campfire", pickId:"arp", progId:"gcd", pairKey:"G|C", root:"C", q:"", key:"G" };

function renderChords(){
  const prog = $("#chProg");
  if(!prog.options.length){
    DRILL_PROGS.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; prog.appendChild(o); });
    const roots = ["C","C♯","D♭","D","D♯","E♭","E","F","F♯","G♭","G","G♯","A♭","A","A♯","B♭","B"];
    roots.forEach(r => { const o = document.createElement("option"); o.value = r; o.textContent = r; $("#bRoot").appendChild(o); });
    QUALS.forEach(x => { const o = document.createElement("option"); o.value = x.q; o.textContent = x.name + " (" + (rootName(0) + qLabel(x.q)).replace(/^C/, "") + ")"; $("#bQual").appendChild(o); });
    ["C","G","D","A","E","F","B♭","E♭"].forEach(k => { const o = document.createElement("option"); o.value = k; o.textContent = k + " major"; $("#bKey").appendChild(o); });
    $("#bQual").options[0].textContent = "Major";
    prog.value = CH.progId;
  }
  showChTab(CH.tab);
}
const CH_INTRO = {
  strum:"Pick a pattern, pick some chords, press Play. The grid lights up each strum as it comes round, and the app can strum along so you hear how it should sound. Keep the hand moving down and up the whole time, even through the gaps.",
  changes:"The fastest way to smooth out chord changes. Pick two chords and switch between them as many times as you can in one minute, strumming once per chord. Count only clean arrivals, then try to beat it tomorrow.",
  build:"How chords are made, why they sound the way they do, and which ones belong together. Pick any root and type to see its notes, formula and shape.",
  pick:"Fingerpicking patterns shown as tab for whichever chord is playing. p = thumb, i = index, m = middle, a = ring. Amber numbers are the bass notes, played by the thumb."
};
function showChTab(tab){
  CH.tab = tab;
  $$("#chTabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false"));
  $("#chHead").textContent = { strum:"Strumming", changes:"One-minute changes", build:"Chord theory", pick:"Fingerpicking" }[tab];
  $("#chIntro").textContent = CH_INTRO[tab];
  Audio2.stop(); clearDrillHit(); RH.active = null; $("#chPlay").textContent = "Play";
  if(RH.changeIv){ clearInterval(RH.changeIv); RH.changeIv = null; }
  $("#chDrillWrap").hidden = !(tab === "strum" || tab === "pick");
  $("#chChanges").hidden = tab !== "changes";
  $("#chBuild").hidden = tab !== "build";
  if(tab === "strum" || tab === "pick"){
    $$("#chBacking button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === (tab === "strum" ? "drums" : "click") ? "true" : "false"));
    applyChDrill(true);
  }
  if(tab === "changes") renderChangesTab();
  if(tab === "build"){ renderBuilder(); renderKeyGrid(); renderLessons(); nextBuildQuiz(); }
}
function applyChDrill(resetTempo){
  const isStrum = CH.tab === "strum";
  const list = isStrum ? STRUMS : PICKS, bucket = isStrum ? "strums" : "picks";
  const id = isStrum ? CH.strumId : CH.pickId;
  const pat = list.filter(p => p.id === id)[0] || list[0];
  CH.progId = $("#chProg").value || CH.progId;
  const prog = DRILL_PROGS.filter(p => p.id === CH.progId)[0] || DRILL_PROGS[0];
  const st = Store.tempoState(bucket, pat.id, pat.start);
  const d = Store.load();

  const el = $("#chList"); el.innerHTML = "";
  list.forEach(p => {
    const ps = (d[bucket] || {})[p.id];
    const row = document.createElement("button");
    row.className = "blockrow pick" + (p.id === pat.id ? " active" : "");
    row.innerHTML = '<div class="mins">' + (ps ? ps.bpm : p.start) + '<small>BPM</small></div>' +
      '<div><div class="t">' + esc(p.name) + '</div><div class="s">' +
      (isStrum ? (p.slots.length === 16 ? "16th notes" : "8th notes") + (p.swing ? ", swung" : "") : p.fingers.filter(Boolean).slice(0,4).join(" ") + " …") +
      (ps && ps.reps ? " · " + ps.reps + " reps" : "") + '</div></div>' +
      '<span class="chip' + (p.level === 1 ? ' go' : p.level === 3 ? ' amber' : '') + '">' + ["","Easy","Mid","Hard"][p.level] + '</span>';
    row.onclick = () => {
      if(isStrum) CH.strumId = p.id; else CH.pickId = p.id;
      Audio2.stop(); $("#chPlay").textContent = "Play";
      applyChDrill(true);
    };
    el.appendChild(row);
  });

  $("#chLabel").textContent = (isStrum ? "Strumming" : "Fingerpicking") + " · " + prog.name;
  $("#chLevel").textContent = ["","Easy","Mid","Hard"][pat.level];
  $("#chName").textContent = pat.name;
  $("#chHow").textContent = pat.how;
  $("#chTip").textContent = pat.tip;
  mountDrill($("#chDrill"), { type: isStrum ? "strum" : "pick", pat, prog, where:"chords" });

  Audio2.T.beatsPerBar = 4; Audio2.T.ramp = null; Audio2.setChart([]);
  Audio2.T.groove = pat.groove || "rock";
  const pressed = $$("#chBacking button").filter(b => b.getAttribute("aria-pressed") === "true")[0];
  Audio2.T.mode = pressed ? pressed.dataset.mode : "click";
  if(resetTempo){
    Audio2.setBpm(st.bpm);
    $("#chBpm").value = Audio2.T.bpm;
    $("#chBpmReadout").textContent = Audio2.T.bpm + " BPM";
  }
  $("#chStatus").textContent = "Working tempo " + st.bpm + " BPM" + (st.best ? " · best clean " + st.best : "") + " · " + (st.reps||0) + " reps logged";
}
function renderChangesTab(){
  const d = Store.load();
  const el = $("#chPairs"); el.innerHTML = "";
  let cur = CHANGE_PAIRS.filter(p => p.key === CH.pairKey)[0] || CHANGE_PAIRS[0];
  CHANGE_PAIRS.forEach(p => {
    const r = d.changes[p.key];
    const row = document.createElement("button");
    row.className = "blockrow pick" + (p.key === cur.key ? " active" : "");
    row.innerHTML = '<div class="mins">' + (r ? r.best : "–") + '<small>BEST</small></div>' +
      '<div><div class="t">' + esc(p.a) + " ⇄ " + esc(p.b) + '</div><div class="s">' +
      (r && r.tries.length ? r.tries.length + " minutes logged" : "Not tried yet") + '</div></div>' +
      '<span class="chip' + (p.level === 1 ? ' go' : p.level === 3 ? ' amber' : '') + '">' + ["","Easy","Mid","Barre"][p.level] + '</span>';
    row.onclick = () => { CH.pairKey = p.key; renderChangesTab(); };
    el.appendChild(row);
  });
  const box = $("#chChangeDrill");
  box.innerHTML = '<div class="legend legend-amber">' + esc(cur.a) + " ⇄ " + esc(cur.b) + '</div>' +
    '<div class="prose tiny">Look at the next shape before you move, and lift all your fingers together, not one at a time. Land the new chord, strum once, then switch back.</div>';
  const inner = document.createElement("div"); inner.className = "stack";
  box.appendChild(inner);
  mountChanges(inner, cur, () => {
    const keep = CH.pairKey;
    const d2 = Store.load();
    $$("#chPairs .blockrow").forEach((row, i) => {
      const p = CHANGE_PAIRS[i], r = d2.changes[p.key];
      if(p.key === keep && r) row.querySelector(".mins").innerHTML = r.best + "<small>BEST</small>";
    });
  });
}

function renderBuilder(){
  $("#bRoot").value = CH.root; $("#bQual").value = CH.q;
  const root = CH.root, q = CH.q, info = QUAL_BY[q];
  const label = root + qLabel(q);
  const rpc = namePc(root);
  const tones = spellChord(root, q), labs = formulaFor(q), iv = CHORD_TYPES[q] || CHORD_TYPES[""];
  const out = $("#bOut"); out.innerHTML = "";

  const head = document.createElement("div"); head.className = "bighead";
  head.innerHTML = '<div class="nm">' + esc(label) + '</div><div class="ql">' + esc(info.name) + '</div>';
  out.appendChild(head);

  const f = document.createElement("div"); f.className = "formula";
  tones.forEach((t, k) => {
    const c = document.createElement("div"); c.className = "ftone" + (k === 0 ? " root" : "");
    c.innerHTML = '<b>' + esc(t) + '</b><span>' + esc(labs[k]) + '</span>';
    f.appendChild(c);
  });
  out.appendChild(f);

  const steps = [];
  for(let k=1;k<iv.length;k++){
    const gap = iv[k] - iv[k-1];
    steps.push(esc(tones[k-1]) + " → " + esc(tones[k]) + ": " + (STEP_NAME[gap] || gap + " half steps"));
  }
  const sp = document.createElement("div"); sp.className = "prose tiny";
  sp.innerHTML = "<p>" + esc(info.desc) + "</p><p class=\"dim\">Built as " + steps.join(" · ") + ".</p>";
  out.appendChild(sp);

  const row = document.createElement("div"); row.className = "row"; row.style.alignItems = "center"; row.style.gap = "12px";
  const dg = diagEl(label); row.appendChild(dg);
  const btns = document.createElement("div"); btns.className = "stack-sm"; btns.style.flex = "1";
  const strumB = document.createElement("button"); strumB.className = "btn"; strumB.textContent = "Hear it strummed";
  strumB.onclick = () => Audio2.resume().then(() => Audio2.strum(Audio2.now() + 0.05, voicingFor(parseChord(label)).midis, false, 1, 2));
  const arpB = document.createElement("button"); arpB.className = "btn quiet"; arpB.textContent = "Note by note";
  arpB.onclick = () => Audio2.resume().then(() => {
    const t0 = Audio2.now() + 0.05;
    iv.forEach((i, k) => Audio2.pluck(t0 + k * 0.34, 48 + rpc + i + (rpc > 6 ? -12 : 0), 0.9));
  });
  btns.appendChild(strumB); btns.appendChild(arpB);
  row.appendChild(btns);
  out.appendChild(row);

  const lab = document.createElement("div"); lab.className = "legend"; lab.textContent = "Every " + label + " chord tone, frets 1–12";
  out.appendChild(lab);
  const fw = document.createElement("div"); fw.className = "fretwrap";
  fw.innerHTML = renderFretboard(chordToneShape(rpc, q), { labelMode:"deg" });
  out.appendChild(fw);
  const hint = document.createElement("div"); hint.className = "tiny dim";
  hint.textContent = "Amber dots are roots. Any group of these notes, one per string and within reach, is another way to play " + label + ".";
  out.appendChild(hint);
}
function diatonic(key){
  const scale = [0,2,4,5,7,9,11], tri = ["","m","m","","","m","dim"], sev = ["maj7","m7","m7","maj7","7","m7","m7b5"];
  const roman = ["I","ii","iii","IV","V","vi","vii°"];
  return scale.map((iv, k) => {
    const r = spellTone(key, iv, k + 1);
    return { roman: roman[k], root: r, q: tri[k], sev: sev[k], name: r + qLabel(tri[k]), sevName: r + qLabel(sev[k]) };
  });
}
function renderKeyGrid(){
  $("#bKey").value = CH.key;
  const g = $("#bKeyGrid"); g.innerHTML = "";
  diatonic(CH.key).forEach(c => {
    const b = document.createElement("button");
    b.innerHTML = '<i>' + c.roman + '</i><b>' + esc(c.name) + '</b><span>' + esc(c.sevName) + '</span>';
    b.onclick = () => { CH.root = c.root; CH.q = c.q; normaliseRoot(); renderBuilder(); $("#chBuild").scrollIntoView({ behavior:"smooth" }); };
    g.appendChild(b);
  });
}
/* the root picker offers common spellings; map rare ones (F♭, B♯…) to it */
function normaliseRoot(){
  const opts = $$("#bRoot option").map(o => o.value);
  if(opts.indexOf(CH.root) === -1){
    const pc = namePc(CH.root);
    CH.root = opts.filter(o => namePc(o) === pc)[0] || "C";
  }
}
let lessonOpen = null;
function renderLessons(){
  const d = Store.load(), done = d.theory.done;
  const el = $("#bLessons"); el.innerHTML = "";
  LESSONS.forEach((L, i) => {
    const open = lessonOpen === L.id, learned = done.indexOf(L.id) !== -1;
    const head = document.createElement("button");
    head.className = "songrow libhead";
    if(open) head.style.borderBottom = "none";
    head.innerHTML = '<div class="nm"><b>' + (i + 1) + ". " + esc(L.title) + '</b><span>' + (learned ? "learned" : "not yet") + '</span></div>' +
      (learned ? '<span class="chip go">Learned</span>' : '') + '<span class="chev" aria-hidden="true">' + (open ? "&minus;" : "+") + '</span>';
    head.onclick = () => { lessonOpen = open ? null : L.id; renderLessons(); };
    el.appendChild(head);
    if(!open) return;
    const card = document.createElement("div"); card.className = "libcard";
    card.innerHTML = '<div class="prose">' + L.body + '</div>';
    const btns = document.createElement("div"); btns.className = "row";
    if(L.try){
      const t = document.createElement("button"); t.className = "btn"; t.style.flex = "1"; t.textContent = "Try it in the builder";
      t.onclick = () => { CH.q = L.try.q; renderBuilder(); $("#chBuild").scrollIntoView({ behavior:"smooth" }); };
      btns.appendChild(t);
    }
    const m = document.createElement("button"); m.className = learned ? "btn quiet" : "btn primary"; m.style.flex = "1";
    m.textContent = learned ? "Mark as not learned" : "I've got this";
    m.onclick = () => {
      if(learned) d.theory.done = done.filter(x => x !== L.id); else done.push(L.id);
      Store.save();
      if(!learned){ const nx = LESSONS[i + 1]; lessonOpen = nx ? nx.id : null; }
      renderLessons();
    };
    btns.appendChild(m);
    card.appendChild(btns);
    el.appendChild(card);
  });
}

/* ---------- theory quiz ---------- */
const BQ = { right:0, asked:0, locked:false };
function nextBuildQuiz(){
  const roots = ["C","G","D","A","E","F","B♭"];
  const kinds = ["spell","formula","key","change"];
  const kind = pick(kinds);
  let q, a, opts, why;
  if(kind === "spell"){
    const r = pick(roots), qq = pick(["","m","7","maj7","m7","sus4","dim"]);
    a = spellChord(r, qq).join(" – ");
    const others = shuffle(["","m","7","maj7","m7","sus4","sus2","dim","aug","6"].filter(x => x !== qq))
      .map(x => spellChord(r, x).join(" – ")).filter((s, i, arr) => s !== a && arr.indexOf(s) === i).slice(0, 3);
    q = "Which notes make up " + r + qLabel(qq) + "?";
    opts = shuffle([a].concat(others));
    why = r + qLabel(qq) + " is " + formulaFor(qq).join(" ") + " from the " + r + " major scale: " + a + ".";
  } else if(kind === "formula"){
    const x = pick(QUALS.filter(z => ["","m","7","maj7","m7","dim","aug","sus4","m7b5"].indexOf(z.q) !== -1));
    a = x.name;
    q = "Which chord is spelled " + formulaFor(x.q).join(" ") + "?";
    opts = shuffle([a].concat(shuffle(QUALS.filter(z => z.q !== x.q && ["","m","7","maj7","m7","dim","aug","sus4","m7b5"].indexOf(z.q) !== -1)).slice(0,3).map(z => z.name)));
    why = x.name + ": " + x.desc;
  } else if(kind === "key"){
    const k = pick(["C","G","D","A","E","F"]), chords = diatonic(k), i = pick([1,2,3,4,5]);
    a = chords[i].name;
    q = "In the key of " + k + " major, which chord is the " + chords[i].roman + "?";
    opts = shuffle([a].concat(shuffle(chords.filter((c, j) => j !== i && j !== 6)).slice(0,3).map(c => c.name)));
    why = "The chords in " + k + " run " + chords.map(c => c.roman + " " + c.name).join(", ") + ".";
  } else {
    const pairs = [
      ["C","C","m","Lower the 3rd a half step","Moving the 3rd from E down to E♭ is the whole difference."],
      ["G","G","7","Add the ♭7","G7 is G major plus F, the flat 7th."],
      ["D","D","sus4","Replace the 3rd with the 4th","Dsus4 swaps F♯ for G. There's no 3rd left, so it's neither major nor minor."],
      ["A","Am","m7","Add the ♭7","Am7 is Am plus G."],
      ["E","E","5","Remove the 3rd","A power chord keeps only E and B, the root and 5th."],
      ["C","C","maj7","Add the natural 7th","Cmaj7 adds B, a half step under the root."]
    ];
    const p = pick(pairs);
    const fromName = p[1], toName = p[0] + qLabel(p[2]);
    q = "What turns " + fromName + " into " + toName + "?";
    a = p[3];
    opts = shuffle(uniq([a, "Lower the 3rd a half step", "Add the ♭7", "Replace the 3rd with the 4th", "Raise the 5th a half step", "Remove the 3rd", "Add the natural 7th"]).filter(o => o !== a).slice(0,3).concat([a]));
    why = p[4];
  }
  BQ.cur = { a, why };
  BQ.locked = false;
  $("#bQuizCount").textContent = BQ.asked ? "Quick quiz · " + BQ.right + " of " + BQ.asked + " right" : "Quick quiz";
  $("#bQuizQ").textContent = q;
  $("#bQuizWhy").hidden = true;
  const box = $("#bQuizOpts"); box.innerHTML = "";
  opts.forEach(o => {
    const b = document.createElement("button"); b.textContent = o;
    b.onclick = () => {
      if(BQ.locked) return; BQ.locked = true; BQ.asked++;
      const ok = o === a;
      if(ok) BQ.right++;
      b.classList.add(ok ? "right" : "wrong");
      if(!ok) $$("#bQuizOpts button").forEach(x => { if(x.textContent === a) x.classList.add("right"); });
      $("#bQuizWhy").hidden = false; $("#bQuizWhy").textContent = why;
      $("#bQuizCount").textContent = "Quick quiz · " + BQ.right + " of " + BQ.asked + " right";
    };
    box.appendChild(b);
  });
}

function bindChords(){
  $$("#chTabs button").forEach(b => b.onclick = () => showChTab(b.dataset.tab));
  $("#chProg").onchange = () => { Audio2.stop(); $("#chPlay").textContent = "Play"; applyChDrill(false); };
  const setB = v => { Audio2.setBpm(v); $("#chBpm").value = Audio2.T.bpm; $("#chBpmReadout").textContent = Audio2.T.bpm + " BPM"; };
  $("#chBpm").oninput = e => setB(parseInt(e.target.value, 10));
  $("#chUp").onclick = () => setB(Audio2.T.bpm + 5);
  $("#chDown").onclick = () => setB(Audio2.T.bpm - 5);
  $$("#chBacking button").forEach(b => b.onclick = () => {
    Audio2.T.mode = b.dataset.mode;
    $$("#chBacking button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  });
  $("#chPlay").onclick = () => {
    Audio2.T.beatsPerBar = 4;
    Audio2.toggle().then(on => { $("#chPlay").textContent = on ? "Stop" : "Play"; if(!on) clearDrillHit(); });
  };
  $$("#chRate button").forEach(b => b.onclick = () => {
    const isStrum = CH.tab === "strum";
    const list = isStrum ? STRUMS : PICKS, id = isStrum ? CH.strumId : CH.pickId;
    const pat = list.filter(p => p.id === id)[0];
    const st = Store.logTempo(isStrum ? "strums" : "picks", pat.id, parseInt(b.dataset.rate, 10), Audio2.T.bpm, pat.start);
    toast(["","Backing off — ","Holding steady — ","Moving up — "][parseInt(b.dataset.rate,10)] + "working tempo is now " + st.bpm + " BPM.");
    applyChDrill(true);
  });
  $("#bRoot").onchange = e => { CH.root = e.target.value; renderBuilder(); };
  $("#bQual").onchange = e => { CH.q = e.target.value; renderBuilder(); };
  $("#bKey").onchange = e => { CH.key = e.target.value; renderKeyGrid(); };
  $("#bQuizNext").onclick = () => nextBuildQuiz();
}
</script>
