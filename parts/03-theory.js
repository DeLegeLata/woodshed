
<script>
/* ============================================================
   WOODSHED — music theory + fretboard
   ============================================================ */
"use strict";

const SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];
const FLAT_KEYS = [5,10,3,8,1]; // F, Bb, Eb, Ab, Db
const OPEN_MIDI = [40,45,50,55,59,64];      // low E .. high E
const STRING_NAMES = ["E","A","D","G","B","e"];

function noteName(pc, keyPc){
  pc = ((pc%12)+12)%12;
  const useFlats = FLAT_KEYS.indexOf(((keyPc%12)+12)%12) !== -1;
  return (useFlats ? FLAT : SHARP)[pc];
}
function midiName(m){ return noteName(m%12,0) + (Math.floor(m/12)-1); }
function midiToFreq(m){ return 440 * Math.pow(2,(m-69)/12); }
function freqToMidi(f){ return 69 + 12*Math.log2(f/440); }

/* ---------- the seven modes, ordered by how much you'll actually use them ---------- */
const MODES = [
  { id:"dorian", name:"Dorian", degree:1,
    formula:[0,2,3,5,7,9,10], labels:["1","2","♭3","4","5","6","♭7"],
    chord:"m7", quality:"m7",
    charIdx:5, nearest:"natural minor", nearestMove:"flatten that 6th",
    parallel:"minor",
    useWhen:"the harmony parks on a m7 chord and stays there — a two-chord vamp, a one-chord groove, a modal tune.",
    warning:"If the progression resolves to the major chord a tone below, you're hearing that major scale and Dorian never actually happens. Dorian needs the m7 to be home.",
    colour:"Minor — but with a bright natural 6th, the one note that stops it sounding sad.",
    vs:"Take natural minor and raise the ♭6 to a natural 6. That single note is the whole mode.",
    songs:["Oye Como Va — Santana","So What — Miles Davis","Riders on the Storm — The Doors"] },

  { id:"mixolydian", name:"Mixolydian", degree:4,
    formula:[0,2,4,5,7,9,10], labels:["1","2","3","4","5","6","♭7"],
    chord:"7 (dominant)", quality:"7",
    colour:"Major with a flattened 7th. The sound of a dominant chord that never bothers resolving.",
    vs:"Take the major scale and drop the 7th a semitone. Everything else stays put.",
    songs:["Sweet Home Alabama — Lynyrd Skynyrd","Fire on the Mountain — Grateful Dead","Norwegian Wood — The Beatles"] },

  { id:"aeolian", name:"Aeolian", degree:5,
    formula:[0,2,3,5,7,8,10], labels:["1","2","♭3","4","5","♭6","♭7"],
    chord:"m7 / m", quality:"m7",
    colour:"The natural minor scale. Dark, settled, the default minor sound in rock.",
    vs:"This is your reference minor. Every other minor mode is this with one note moved.",
    songs:["All Along the Watchtower — Jimi Hendrix","Stairway to Heaven — Led Zeppelin","Black Magic Woman — Santana"] },

  { id:"ionian", name:"Ionian", degree:0,
    formula:[0,2,4,5,7,9,11], labels:["1","2","3","4","5","6","7"],
    chord:"maj7", quality:"maj7",
    colour:"The major scale itself. Bright, resolved, nowhere left to go.",
    vs:"This is the parent. All seven shapes come from here — you're just choosing where to call home.",
    songs:["Here Comes the Sun — The Beatles","Free Fallin' — Tom Petty","Wonderful Tonight — Eric Clapton"] },

  { id:"lydian", name:"Lydian", degree:3,
    formula:[0,2,4,6,7,9,11], labels:["1","2","3","♯4","5","6","7"],
    chord:"maj7♯11", quality:"maj7",
    colour:"Major with a raised 4th. Floating and cinematic — unresolved in a way that sounds hopeful.",
    vs:"Take the major scale and raise the 4th a semitone. That ♯4 is the whole trick.",
    songs:["Flying in a Blue Dream — Joe Satriani","The Simpsons Theme — Danny Elfman","Freewill — Rush"] },

  { id:"phrygian", name:"Phrygian", degree:2,
    formula:[0,1,3,5,7,8,10], labels:["1","♭2","♭3","4","5","♭6","♭7"],
    chord:"m7 (over a static root)", quality:"m7",
    colour:"Minor with a flattened 2nd. Spanish, menacing — the metal riff mode.",
    vs:"Natural minor with the 2nd dropped a semitone. Play the root then the ♭2 and you'll hear it instantly.",
    songs:["Wherever I May Roam — Metallica","Symphony of Destruction — Megadeth","Sails of Charon — Scorpions"] },

  { id:"locrian", name:"Locrian", degree:6,
    formula:[0,1,3,5,6,8,10], labels:["1","♭2","♭3","4","♭5","♭6","♭7"],
    chord:"m7♭5 (half-diminished)", quality:"m7b5",
    colour:"Flat 2nd and a flat 5th. No perfect fifth to stand on, so it never sits still.",
    vs:"The odd one out. There's no stable root chord, which is exactly why it's rare.",
    songs:["Almost nothing stays in Locrian. You'll meet it as the m7♭5 chord inside a minor ii–V–i — that's the honest use for it."] },
];
const MODE_BY_ID = {}; MODES.forEach(m => MODE_BY_ID[m.id] = m);

/* ---------- the theory the lessons are built from ----------
   nearestId is the mode exactly one note away. Comparing the two side by side
   isolates the characteristic note — the single note that makes the mode itself. */
const MODE_THEORY = {
  dorian:{ nearestId:"aeolian" },
  mixolydian:{ nearestId:"ionian", charIdx:6, nearest:"the major scale", nearestMove:"raise that ♭7 back up", parallel:"major",
    useWhen:"a dominant 7 chord is home rather than a pit stop — blues, funk, jam-band vamps, a I7 to ♭VII groove.",
    warning:"In a normal progression a dominant 7 wants to resolve up a fourth. When it does, you're in the major key it resolved to. Mixolydian only exists where the 7 chord refuses to move." },
  aeolian:{ nearestId:"dorian", charIdx:5, nearest:"Dorian", nearestMove:"raise that ♭6 to a natural 6", parallel:"minor",
    useWhen:"the song is plainly in a minor key — a minor chord is home and the ♭VI and ♭VII chords turn up around it.",
    warning:"If the progression uses a major IV chord, the ♭6 will clash with it. That clash is your signal to switch to Dorian." },
  ionian:{ nearestId:"mixolydian", charIdx:6, nearest:"Mixolydian", nearestMove:"flatten that 7th", parallel:"major",
    useWhen:"the song is in an ordinary major key and resolves home to the I chord. Most pop, a lot of rock.",
    warning:"Be careful holding the 4th over the I chord — it rubs against the major 3rd. Pass through it rather than landing on it." },
  lydian:{ nearestId:"ionian", charIdx:3, nearest:"the major scale", nearestMove:"lower that ♯4 back down", parallel:"major",
    useWhen:"a major 7 chord is home and the major chord a tone above keeps appearing beside it — film scores, fusion, dreamy clean-tone tunes.",
    warning:"Over a progression that resolves V to I, the ♯4 sounds like a wrong note. Lydian needs harmony that stays put." },
  phrygian:{ nearestId:"aeolian", charIdx:1, nearest:"natural minor", nearestMove:"raise that ♭2", parallel:"minor",
    useWhen:"a minor chord is home and the chord a semitone above it keeps pulling back down — metal riffs, flamenco, anything menacing.",
    warning:"The ♭2 is strong enough to take over. Treat it as tension that falls to the root, not a note to hang on." },
  locrian:{ nearestId:"phrygian", charIdx:4, nearest:"Phrygian", nearestMove:"raise that ♭5 to a perfect 5th", parallel:"minor",
    useWhen:"you're playing over a m7♭5 chord — nearly always the ii chord in a minor ii–V–i.",
    warning:"There's no stable home chord, so Locrian is a colour you pass through for one bar, not somewhere to build a solo." }
};
MODES.forEach(m => { if(MODE_THEORY[m.id]) Object.assign(m, MODE_THEORY[m.id]); });

const MAJOR_STEPS = [0,2,4,5,7,9,11];
const INTERVAL_LABEL = {0:"R",1:"♭9",2:"9",3:"♭3",4:"3",5:"4",6:"♭5",7:"5",8:"♯5",9:"6",10:"♭7",11:"7",14:"9",15:"♯9",21:"13"};
const ORDINAL = ["1st","2nd","3rd","4th","5th","6th","7th"];

/* The major scale a mode borrows its seven notes from. A Dorian -> G major. */
function parentMajorPc(rootPc, modeId){
  return ((rootPc - MAJOR_STEPS[MODE_BY_ID[modeId].degree]) % 12 + 12) % 12;
}
/* Spell with the parent key's accidentals, so D Phrygian reads E♭ not D♯. */
function scaleNotes(rootPc, modeId){
  const m = MODE_BY_ID[modeId], parent = parentMajorPc(rootPc, modeId);
  return m.formula.map(i => ({ pc:(rootPc + i) % 12, name:noteName((rootPc + i) % 12, parent) }));
}
function chordToneList(ch){
  return ch.intervals.map(iv => ({
    pc: (ch.pc + iv) % 12,
    name: noteName((ch.pc + iv) % 12, ch.pc),
    label: INTERVAL_LABEL[iv] || String(iv),
    root: iv === 0
  }));
}

/* Everything a mode lesson needs, computed for the actual key being practised. */
function modeLesson(rootPc, modeId){
  const m = MODE_BY_ID[modeId];
  const near = MODE_BY_ID[m.nearestId];
  const parent = parentMajorPc(rootPc, modeId);
  const R = noteName(rootPc, parent);
  const mine   = scaleNotes(rootPc, modeId);
  const theirs = scaleNotes(rootPc, near.id);
  const major  = scaleNotes(rootPc, "ionian");
  const minor  = scaleNotes(rootPc, "aeolian");
  const suffix = { "m7":"m7", "7":"7", "maj7":"maj7", "m7b5":"m7♭5" }[m.quality] || "";
  return {
    m, near, R,
    parentName: noteName(parent, parent),
    ordinal: ORDINAL[m.degree],
    mine, theirs, major, minor,
    charNote: mine[m.charIdx].name,
    charLabel: m.labels[m.charIdx],
    homeChord: R + suffix,
    vsMajor: mine.filter((n,i) => n.pc !== major[i].pc).length,
    vsMinor: mine.filter((n,i) => n.pc !== minor[i].pc).length
  };
}

/* Guitar-friendly keys first: roots low on the neck where E/A knowledge does the work */
const KEY_ORDER = [4,9,2,7,0,5,11,10,3,8,1,6]; // E A D G C F B Bb Eb Ab Db F#

/* ---------- 3 notes per string shape ---------- */
function extendedFormula(formula){
  const ext = [];
  for(let i=0;i<21;i++) ext.push(formula[i%7] + 12*Math.floor(i/7));
  return ext;
}
/**
 * Build the 3-notes-per-string shape for `modeId` rooted on `rootPc`,
 * starting with the root on the low E string.
 */
function shape3nps(rootPc, modeId){
  const mode = MODE_BY_ID[modeId];
  const ext = extendedFormula(mode.formula);
  let startFret = (((rootPc - (OPEN_MIDI[0]%12)) % 12) + 12) % 12;
  if(startFret === 0) startFret = 12;         // E lives at the 12th, not on open strings
  const rootMidi = OPEN_MIDI[0] + startFret;
  const notes = [];
  for(let i=0;i<18;i++){
    const string = Math.floor(i/3);
    const midi = rootMidi + ext[i];
    notes.push({
      string, fret: midi - OPEN_MIDI[string], midi,
      degree: i % 7,
      label: mode.labels[i % 7],
      name: noteName(midi % 12, rootPc),
      root: (i % 7) === 0
    });
  }
  return { notes, startFret, rootPc, modeId,
           minFret: Math.min.apply(null, notes.map(n=>n.fret)),
           maxFret: Math.max.apply(null, notes.map(n=>n.fret)) };
}

/* ---------- fretboard SVG ---------- */
function renderFretboard(shape, opts){
  opts = opts || {};
  const labelMode = opts.labelMode || "deg";
  const highlight = (typeof opts.highlight === "number") ? opts.highlight : -1;
  const from = Math.max(1, shape.minFret - 1);
  const to   = shape.maxFret + 1;
  const n    = to - from + 1;

  const PL = 30, PR = 12, PT = 24, PB = 30, FW = 60, SG = 29;   // room for rings on the outer strings
  const W = PL + n*FW + PR;
  const H = PT + 5*SG + PB;
  const cellX = k => PL + k*FW;
  const noteX = f => PL + (f - from + 0.5)*FW;
  const strY  = s => PT + (5 - s)*SG;

  const p = [];
  p.push('<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Fretboard diagram" xmlns="http://www.w3.org/2000/svg">');
  p.push('<defs>');
  p.push('<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">');
  p.push('<stop offset="0" stop-color="#4a2f20"/><stop offset="0.45" stop-color="#382216"/>');
  p.push('<stop offset="1" stop-color="#2a1a11"/></linearGradient>');
  p.push('<linearGradient id="wire" x1="0" y1="0" x2="0" y2="1">');
  p.push('<stop offset="0" stop-color="#e6e2d8"/><stop offset="0.5" stop-color="#9a9488"/><stop offset="1" stop-color="#5d584e"/></linearGradient>');
  p.push('<linearGradient id="strg" x1="0" y1="0" x2="0" y2="1">');
  p.push('<stop offset="0" stop-color="#d8d2c4"/><stop offset="1" stop-color="#8a8376"/></linearGradient>');
  p.push('</defs>');

  // neck
  p.push('<rect x="'+PL+'" y="'+(PT-8)+'" width="'+(n*FW)+'" height="'+(5*SG+16)+'" rx="3" fill="url(#wood)"/>');
  // grain
  for(let g=0; g<10; g++){
    const y = PT-8 + (g+0.5)*((5*SG+16)/10);
    p.push('<rect x="'+PL+'" y="'+y.toFixed(1)+'" width="'+(n*FW)+'" height="1" fill="rgba(0,0,0,0.16)"/>');
  }

  // inlays
  const single = [3,5,7,9,15,17,19,21], dbl = [12,24];
  for(let f=from; f<=to; f++){
    const x = noteX(f);
    if(dbl.indexOf(f) !== -1){
      p.push('<circle cx="'+x+'" cy="'+(PT+SG*1.5)+'" r="6" fill="#cfc4ae" opacity="0.5"/>');
      p.push('<circle cx="'+x+'" cy="'+(PT+SG*3.5)+'" r="6" fill="#cfc4ae" opacity="0.5"/>');
    } else if(single.indexOf(f) !== -1){
      p.push('<circle cx="'+x+'" cy="'+(PT+SG*2.5)+'" r="6" fill="#cfc4ae" opacity="0.45"/>');
    }
  }

  // fret wires
  for(let k=0;k<=n;k++){
    const x = cellX(k);
    const isNut = (from === 1 && k === 0);
    p.push('<rect x="'+(x-(isNut?3:1.4))+'" y="'+(PT-8)+'" width="'+(isNut?6:2.8)+'" height="'+(5*SG+16)+'" fill="'+(isNut?'#d9cfb8':'url(#wire)')+'"/>');
  }

  // strings
  for(let s=0;s<6;s++){
    const y = strY(s), w = 3.1 - s*0.36;
    p.push('<rect x="'+PL+'" y="'+(y-w/2)+'" width="'+(n*FW)+'" height="'+w.toFixed(2)+'" fill="url(#strg)"/>');
    p.push('<text x="'+(PL-9)+'" y="'+(y+4)+'" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-size="12" fill="#6e6355">'+STRING_NAMES[s]+'</text>');
  }

  // fret numbers
  for(let f=from; f<=to; f++){
    p.push('<text x="'+noteX(f)+'" y="'+(H-7)+'" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-size="12" fill="#6e6355">'+f+'</text>');
  }

  // chord tones the shape doesn't contain — draw them where they fall inside the shape's span
  const tg = opts.targets || null;
  if(tg){
    const inShape = {};
    shape.notes.forEach(nt => inShape[nt.midi % 12] = 1);
    Object.keys(tg).forEach(k => {
      const pc = +k;
      if(inShape[pc] || (tg[pc] !== "guide" && tg[pc] !== "root")) return;
      for(let s=0;s<6;s++){
        for(let f=Math.max(1,shape.minFret); f<=shape.maxFret; f++){
          if((OPEN_MIDI[s] + f) % 12 !== pc) continue;
          const x = noteX(f), y = strY(s);
          const txt = labelMode === "deg" ? DEG_GENERIC[((pc - shape.rootPc) % 12 + 12) % 12] : noteName(pc, shape.rootPc);
          p.push('<circle cx="'+x+'" cy="'+y+'" r="11.5" fill="#1b2a1d" stroke="#7fb489" stroke-width="1.8" stroke-dasharray="3 2.4"/>');
          p.push('<text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-weight="600" font-size="'+(txt.length>2?10:12)+'" fill="#cdeed2">'+txt+'</text>');
        }
      }
    });
  }

  // notes
  const hiSet = opts.highlightSet || null;
  const chordPcs = opts.chordPcs || null;
  const chordRootPc = (typeof opts.chordRootPc === "number") ? opts.chordRootPc : -1;
  const charPc = (typeof opts.charPc === "number") ? opts.charPc : -1;
  shape.notes.forEach((nt, i) => {
    const x = noteX(nt.fret), y = strY(nt.string);
    const isHi = (i === highlight) || (hiSet && hiSet.indexOf(i) !== -1);
    const pc = nt.midi % 12;
    let fill = "#241c15", stroke = "#a3967f", tc = "#ece0c8", sw = 1.6, dash = "", op = 1;
    if(nt.root){ fill = "#ff9d2f"; stroke = "#ffcb84"; tc = "#2a1704"; }
    if(tg){
      const role = tg[pc];
      fill = "#241c15"; stroke = nt.root ? "#c4741a" : "#6e6355"; tc = "#a3967f"; op = 0.62;
      if(role === "guide"){ fill = "#7fb489"; stroke = "#cdeed2"; tc = "#10200f"; op = 1; sw = 2; }
      else if(role === "root"){ fill = "#ff9d2f"; stroke = "#ffcb84"; tc = "#2a1704"; op = 1; }
      else if(role === "fifth"){ fill = "#3a3026"; stroke = "#ece0c8"; tc = "#ece0c8"; op = 1; sw = 2; }
      else if(role === "tension"){ stroke = "#cd5f4d"; tc = "#eab0a4"; op = 1; sw = 1.8; dash = ' stroke-dasharray="3 2.4"'; }
    }
    if(isHi){ fill = "#f2efe6"; stroke = "#ffffff"; tc = "#1a1410"; op = 1; dash = ""; }
    // the characteristic note — the one that makes this mode itself — gets a dashed amber ring
    if(pc === charPc){
      p.push('<circle cx="'+x+'" cy="'+y+'" r="19" fill="none" stroke="#ff9d2f" stroke-width="1.8" stroke-dasharray="3.5 3"/>');
    }
    if(chordPcs && chordPcs.indexOf(pc) !== -1){
      const isChordRoot = pc === chordRootPc;
      p.push('<circle cx="'+x+'" cy="'+y+'" r="'+(isChordRoot?16.5:15.5)+'" fill="none" stroke="#7fb489" stroke-width="'+(isChordRoot?3.4:2.2)+'"/>');
    }
    if(isHi) p.push('<circle cx="'+x+'" cy="'+y+'" r="16" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.55"/>');
    p.push('<g opacity="'+op+'"><circle cx="'+x+'" cy="'+y+'" r="11.5" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"'+dash+'/>');
    const txt = labelMode === "deg" ? nt.label : nt.name;
    p.push('<text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-weight="600" font-size="'+(txt.length>2?10:12)+'" fill="'+tc+'">'+txt+'</text></g>');
  });

  p.push('</svg>');
  return p.join("");
}

/* ---------- chords ---------- */
const CHORD_TYPES = {
  "":[0,4,7], "maj":[0,4,7], "M":[0,4,7],
  "m":[0,3,7], "min":[0,3,7], "-":[0,3,7],
  "5":[0,7],
  "7":[0,4,7,10], "dom7":[0,4,7,10],
  "m7":[0,3,7,10], "min7":[0,3,7,10], "-7":[0,3,7,10],
  "maj7":[0,4,7,11], "M7":[0,4,7,11], "△7":[0,4,7,11],
  "m7b5":[0,3,6,10], "ø":[0,3,6,10], "m7♭5":[0,3,6,10],
  "dim":[0,3,6], "dim7":[0,3,6,9], "°":[0,3,6],
  "aug":[0,4,8], "+":[0,4,8],
  "sus4":[0,5,7], "sus":[0,5,7], "sus2":[0,2,7],
  "6":[0,4,7,9], "m6":[0,3,7,9],
  "9":[0,4,7,10,14], "m9":[0,3,7,10,14], "maj9":[0,4,7,11,14], "add9":[0,4,7,14],
  "7sus4":[0,5,7,10], "13":[0,4,7,10,14,21], "7#9":[0,4,7,10,15]
};
function parseChord(str){
  const s = String(str).trim().replace(/b/g,"♭").replace(/#/g,"♯");
  const m = s.match(/^([A-Ga-g])([♯♭]?)(.*)$/);
  if(!m) return null;
  const base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()];
  let pc = base + (m[2]==="♯"?1:m[2]==="♭"?-1:0);
  pc = ((pc%12)+12)%12;
  let q = m[3].replace(/♯/g,"#").replace(/♭/g,"b").trim();
  const iv = CHORD_TYPES[q] || CHORD_TYPES[q.toLowerCase()] || CHORD_TYPES[""];
  return { pc, quality:q, intervals:iv, label:str.trim() };
}
function parseChart(text){
  return String(text).split(/[|,\n]+/).map(s=>s.trim()).filter(Boolean)
    .map(parseChord).filter(Boolean);
}

/* ---------- progressions ---------- */
function modalVamp(rootPc, modeId){
  const k = p => noteName(((rootPc+p)%12+12)%12, rootPc);
  switch(modeId){
    case "dorian":     return [k(0)+"m7", k(0)+"m7", k(5)+"7", k(5)+"7"];
    case "mixolydian": return [k(0)+"7", k(0)+"7", k(10)+"", k(0)+"7"];
    case "aeolian":    return [k(0)+"m7", k(8)+"maj7", k(10)+"", k(0)+"m7"];
    case "ionian":     return [k(0)+"maj7", k(5)+"maj7", k(7)+"", k(0)+"maj7"];
    case "lydian":     return [k(0)+"maj7", k(2)+"", k(0)+"maj7", k(2)+""];
    case "phrygian":   return [k(0)+"m", k(1)+"", k(0)+"m", k(1)+""];
    case "locrian":    return [k(0)+"m7b5", k(0)+"m7b5", k(1)+"maj7", k(1)+"maj7"];
  }
  return [k(0)+"m7"];
}
function blues12(rootPc){
  const k = p => noteName(((rootPc+p)%12+12)%12, rootPc);
  const I=k(0)+"7", IV=k(5)+"7", V=k(7)+"7";
  return [I,IV,I,I, IV,IV,I,I, V,IV,I,V];
}
const PROGRESSIONS = [
  { id:"vamp",   name:"Modal vamp (follows the mode)", build:(r,m)=>modalVamp(r,m) },
  { id:"blues",  name:"12-bar blues",                  build:(r)=>blues12(r) },
  { id:"1564",   name:"I – V – vi – IV", build:(r)=>{const k=p=>noteName((r+p)%12,r);return [k(0),k(7),k(9)+"m",k(5)];} },
  { id:"251",    name:"ii – V – I",           build:(r)=>{const k=p=>noteName((r+p)%12,r);return [k(2)+"m7",k(7)+"7",k(0)+"maj7",k(0)+"maj7"];} },
  { id:"minblues",name:"Minor blues",                  build:(r)=>{const k=p=>noteName((r+p)%12,r);return [k(0)+"m7",k(0)+"m7",k(0)+"m7",k(0)+"m7",k(5)+"m7",k(5)+"m7",k(0)+"m7",k(0)+"m7",k(8)+"7",k(7)+"7",k(0)+"m7",k(7)+"7"];} },
  { id:"1451",   name:"I – IV – V",           build:(r)=>{const k=p=>noteName((r+p)%12,r);return [k(0),k(0),k(5),k(7)];} }
];

/* ============================================================
   CHORD-TONE TARGETING
   Over any chord: the 3rd and 7th spell it (land on those), root and
   5th are safe, and a scale note a half step above a chord tone is
   tension — great passing through, sour if you park on it.
   ============================================================ */
const IV_NAME = ["R","♭2","2","♭3","3","4","♭5","5","♭6","6","♭7","7"];
const DEG_GENERIC = ["1","♭2","2","♭3","3","4","♭5","5","♭6","6","♭7","7"];

function chordInfo(ch, scalePcs){
  const ivs = [];
  ch.intervals.forEach(i => { const v = ((i%12)+12)%12; if(ivs.indexOf(v) === -1) ivs.push(v); });
  const has = x => ivs.indexOf(x) !== -1;
  const guide = [];
  if(has(3)) guide.push(3); else if(has(4)) guide.push(4);
  if(has(10)) guide.push(10); else if(has(11)) guide.push(11); else if(has(9) && ivs.length >= 4) guide.push(9);
  if(!guide.length){ if(has(5)) guide.push(5); else if(has(2)) guide.push(2); }
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : null;
  const core = [0].concat(guide.filter(g => g <= 5)).concat(fifth == null ? [] : [fifth]);
  const tensions = [];
  (scalePcs || []).forEach(pc => {
    const iv = ((pc - ch.pc) % 12 + 12) % 12;
    if(has(iv)) return;
    const below = (iv + 11) % 12;
    if(core.indexOf(below) !== -1) tensions.push({ pc, iv, to:(ch.pc + below) % 12, toIv:below });
  });
  // chord tones the scale doesn't have: the neighbouring scale note will clash, so swap it
  const clashes = [];
  if(scalePcs && scalePcs.length){
    ivs.forEach(iv => {
      const pc = (ch.pc + iv) % 12;
      if(scalePcs.indexOf(pc) !== -1) return;
      [11, 1].forEach(d => {
        const n = (pc + d) % 12, niv = ((n - ch.pc) % 12 + 12) % 12;
        // only a rival version of a chord function (♭3 vs 3, ♭7 vs 7, ♭5/♯5 vs 5) truly clashes
        if(scalePcs.indexOf(n) !== -1 && !has(niv) && [0,3,4,6,7,8,10,11].indexOf(niv) !== -1)
          clashes.push({ pc:n, to:pc, iv:niv });
      });
    });
  }
  return { ivs, guide, fifth, tensions: tensions.filter(t => !clashes.some(c => c.pc === t.pc)), clashes };
}
function targetMap(ch, scalePcs){
  const info = chordInfo(ch, scalePcs), m = {};
  info.ivs.forEach(iv => m[(ch.pc+iv)%12] = "fifth");
  m[ch.pc] = "root";
  info.guide.forEach(iv => m[(ch.pc+iv)%12] = "guide");
  info.tensions.forEach(t => { if(!m[t.pc]) m[t.pc] = "tension"; });
  info.clashes.forEach(c => { if(!m[c.pc]) m[c.pc] = "tension"; });
  return m;
}
function tnHTML(pc, spell, cls, iv){
  return '<span class="tn '+cls+'">'+noteName(pc, spell)+'<i>'+iv+'</i></span>';
}
/* One line of plain-English guidance for a chord. */
function targetLineHTML(ch, spell, scalePcs){
  const info = chordInfo(ch, scalePcs);
  const out = [];
  if(info.guide.length && (info.guide.indexOf(3) !== -1 || info.guide.indexOf(4) !== -1)){
    out.push('<span class="tgt-lbl">Land on</span>' + info.guide.map(iv => tnHTML((ch.pc+iv)%12, spell, "g", IV_NAME[iv])).join(" "));
  } else if(info.guide.length){
    out.push('<span class="tgt-lbl">No 3rd · lean on</span>' + info.guide.map(iv => tnHTML((ch.pc+iv)%12, spell, "g", IV_NAME[iv])).join(" "));
  } else {
    out.push('<span class="tgt-lbl">No 3rd</span><span class="dim">your note choice decides major or minor</span>');
  }
  out.push('<span class="tgt-lbl">Safe</span>' + tnHTML(ch.pc, spell, "r", "R") +
    (info.fifth != null ? " " + tnHTML((ch.pc+info.fifth)%12, spell, "f", info.fifth === 8 ? "♯5" : IV_NAME[info.fifth]) : ""));
  if(info.tensions.length){
    out.push('<span class="tgt-lbl">Tension</span>' + info.tensions.map(t =>
      tnHTML(t.pc, spell, "t", IV_NAME[t.iv]) + ' → ' + noteName(t.to, spell)).join(" · "));
  }
  if(info.clashes.length){
    out.push('<span class="tgt-lbl">Swap</span>' + info.clashes.map(c =>
      tnHTML(c.pc, spell, "t", "clash") + ' → ' + tnHTML(c.to, spell, "g", "chord")).join(" · "));
  }
  return out.join(" ");
}
function uniqueChords(chart){
  const seen = {}, out = [];
  (chart || []).forEach((ch, i) => { if(!seen[ch.label]){ seen[ch.label] = 1; out.push({ ch, first:i }); } });
  return out;
}
const FRETKEY_HTML =
  '<span><i class="kd g"></i>3rd / 7th — land here</span>' +
  '<span><i class="kd r"></i>chord root</span>' +
  '<span><i class="kd f"></i>5th &amp; other chord tones</span>' +
  '<span><i class="kd t"></i>tension — resolve down</span>' +
  '<span><i class="kd o"></i>chord tone outside the scale</span>';

/* ============================================================
   PENTATONIC SPEED RUNS
   ============================================================ */
const PENTA = {
  minor:{ formula:[0,3,5,7,10], labels:["1","♭3","4","5","♭7"] },
  major:{ formula:[0,2,4,7,9],  labels:["1","2","3","5","6"] }
};
/* box: the classic 2-notes-per-string shape from the root on the low E.
   wide: the same area stretched across a 6-fret window, so some strings get
   three notes and the run covers more ground without shifting. */
function pentaShape(rootPc, quality, wide){
  const P = PENTA[quality] || PENTA.minor;
  let rootFret = (((rootPc - 4) % 12) + 12) % 12;
  if(rootFret === 0) rootFret = 12;
  const rootMidi = OPEN_MIDI[0] + rootFret;
  const notes = [];
  const mk = (i, string, midi) => ({
    string, fret: midi - OPEN_MIDI[string], midi,
    degree: i % 5, label: P.labels[i % 5],
    name: noteName(midi % 12, rootPc), root: (i % 5) === 0
  });
  if(!wide){
    for(let i=0;i<12;i++){
      const midi = rootMidi + P.formula[i%5] + 12*Math.floor(i/5);
      notes.push(mk(i, Math.floor(i/2), midi));
    }
  } else {
    const lo = rootFret, hi = rootFret + 5;
    let s = 0;
    for(let i=0;i<30;i++){
      const midi = rootMidi + P.formula[i%5] + 12*Math.floor(i/5);
      while(s < 6 && (midi - OPEN_MIDI[s] > hi || midi - OPEN_MIDI[s] < lo)){
        if(midi - OPEN_MIDI[s] < lo){ s = 6; break; }
        s++;
      }
      if(s >= 6) break;
      notes.push(mk(i, s, midi));
    }
  }
  return { notes, rootPc, quality,
    minFret: Math.min.apply(null, notes.map(n=>n.fret)),
    maxFret: Math.max.apply(null, notes.map(n=>n.fret)) };
}
function pentaPcs(rootPc, quality){ return (PENTA[quality]||PENTA.minor).formula.map(i => (rootPc+i)%12); }

const RUN_GEN = {
  sixesDown(n){ const q=[]; for(let s=n-1; s-5>=0; s-=2) for(let k=0;k<6;k++) q.push(s-k); return q; },
  sixesUp(n){   const q=[]; for(let s=0; s+5<n; s+=2)   for(let k=0;k<6;k++) q.push(s+k); return q; },
  fivesDown(n){ const q=[]; for(let s=n-1; s-4>=0; s-=2) for(let k=0;k<5;k++) q.push(s-k); if(q[q.length-1] !== 0) q.push(0); return q; },
  foursUp(n){   const q=[]; for(let s=0; s+3<n; s++)     for(let k=0;k<4;k++) q.push(s+k); return q; },
  tripletLoop(n){
    const q=[];
    for(let s=n-1, pairs=0; s-2>=0 && pairs<3; s-=2, pairs++)
      for(let r=0;r<4;r++) q.push(s, s-1, s-2);
    return q;
  },
  burst(n){
    const q=[];
    for(let r=0;r<4;r++) for(let k=0;k<6;k++) q.push(n-1-k);
    for(let i=n-7;i>=0;i--){ if(i % 5 === 0){ q.push(i); break; } }
    return q;
  }
};
const RUNS = [
  { id:"up4", name:"Rolling fours", who:"Foundation", level:1, shape:"box", npb:4, gen:RUN_GEN.foursUp, start:64,
    how:"Play 1‑2‑3‑4, then 2‑3‑4‑5, climbing the box in 16ths. Strictly alternate your picking.",
    tip:"It's not glamorous, but it builds the pick-hand timing every fast run depends on. If this falls apart at a tempo, nothing faster will hold together either." },
  { id:"page6", name:"Descending sixes", who:"Bonamassa", level:1, shape:"box", npb:6, gen:RUN_GEN.sixesDown, start:56,
    how:"Six notes across three strings. Then start one string lower and repeat. Once it's even, pull off the second note on each string.",
    tip:"Bonamassa (by way of Page and Clapton) uses this cell to take a solo up a gear. Accent the first note of every six so the speed sounds deliberate, not frantic." },
  { id:"trip", name:"Pull-off triplet loop", who:"Bonamassa", level:1, shape:"box", npb:3, gen:RUN_GEN.tripletLoop, start:70,
    how:"Pick, pull off, then pick the next string down. Loop it four times, then move down a pair of strings.",
    tip:"You only pick two of every three notes, so your pick hand has time to spare. Keep the loop loose. Tension kills speed faster than anything." },
  { id:"ej5", name:"Five-note cascades", who:"Eric Johnson", level:2, shape:"box", npb:5, gen:RUN_GEN.fivesDown, start:52,
    how:"Five notes per click, starting a string lower each time. Accent the first note of each group so the grouping lands on the beat.",
    tip:"Eric Johnson's runs shimmer because he groups notes in fives and sixes that roll across the beat. Count \"hip-po-pot-a-mus\" on each click until it's automatic." },
  { id:"burst", name:"Repeat-the-cell burst", who:"Bonamassa", level:2, shape:"box", npb:6, gen:RUN_GEN.burst, start:56,
    how:"Play the top six-note cell four times in a row, then land on the root.",
    tip:"Burst method: play ONE cell faster than you comfortably can, then stop dead. Then play two. Short bursts teach your hands the motion. Long, strained runs teach them tension." },
  { id:"ej6up", name:"Wide-box sixes, climbing", who:"Eric Johnson", level:2, shape:"wide", npb:6, gen:RUN_GEN.sixesUp, start:50,
    how:"The box is stretched to three notes on some strings, so you cover two octaves without shifting. Play six-note groups, climbing two notes at a time.",
    tip:"EJ covers the neck by stretching the pentatonic across 5–6 frets and using economy picking. When the next note is on a higher string, let the pick keep travelling in that direction." },
  { id:"ej6down", name:"Wide-box sixes, cascading", who:"Eric Johnson", level:3, shape:"wide", npb:6, gen:RUN_GEN.sixesDown, start:48,
    how:"The same wide box with six-note groups coming down. Where the pick is already heading to the next string, sweep it.",
    tip:"This is the cascading EJ sound. Keep every note the same volume. Pentatonic runs only sound fast when the notes are even." }
];
const RUN_BY_ID = {}; RUNS.forEach(r => RUN_BY_ID[r.id] = r);

function runGroup(run, step){
  const npb = run.def.npb, groups = Math.ceil(run.seq.length / npb);
  const g = ((step % groups) + groups) % groups;
  return run.seq.slice(g*npb, g*npb + npb);
}
function runTab(shape, seq, npb){
  const lines = [[],[],[],[],[],[]];
  seq.forEach((ni, k) => {
    const nt = shape.notes[ni], f = String(nt.fret);
    for(let s=0;s<6;s++) lines[s].push((s === nt.string ? f : "-".repeat(f.length)) + "-");
    if((k+1) % npb === 0 && k < seq.length-1) for(let s=0;s<6;s++) lines[s].push("|-");
  });
  return [5,4,3,2,1,0].map(s => STRING_NAMES[s] + "|-" + lines[s].join("") + "|").join("\n");
}

/* ============================================================
   CLASSICS LIBRARY — 50 songs
   [id, name, artist, level, style, key, mode, groove, bpm, chart, teaches, tip]
   Charts are simplified jam changes, one chord per bar.
   ============================================================ */
const LEVEL_NAME = ["","Beginner","Intermediate","Advanced"];
const CLASSICS = [
 ["smoke","Smoke on the Water","Deep Purple",1,"Rock","G","aeolian","rock",112,"Gm | Gm | Gm | Gm | C | A♭ | Gm | Gm","Two-note fourths riff","Barre the riff as fourths on the D and G strings with one finger, and pluck both strings together. Fingers or hybrid picking get the bite."],
 ["sevennation","Seven Nation Army","The White Stripes",1,"Rock","E","aeolian","rock",124,"Em | Em | C | B","Single-note riff with slides","The riff sits on one string. Slide into the long notes instead of picking them again, and let the gaps breathe."],
 ["wildthing","Wild Thing","The Troggs",1,"Rock","A","mixolydian","rock",106,"A | D | E | D","Three-chord strumming","Big open chords with a loose wrist. Mute with your fretting hand between hits to get the stop-start punch."],
 ["louie","Louie Louie","The Kingsmen",1,"Rock","A","mixolydian","rock",120,"A | D | Em | D","Changing chords on time","Start moving your fingers on the last eighth note of the bar, so the new chord lands right on beat one."],
 ["knockin","Knockin' on Heaven's Door","Bob Dylan",1,"Folk rock","G","ionian","rock",69,"G | D | Am | Am | G | D | C | C","Slow strumming, first lead lines","A great first solo. The G major pentatonic box at the 3rd fret fits every chord. Aim for each chord's 3rd as it arrives."],
 ["horse","A Horse with No Name","America",1,"Folk rock","E","dorian","rock",122,"Em | D6","16th-note strumming, two shapes","There are only two chord shapes, so it's all in the strumming hand. Keep it moving in 16ths and accent the backbeat."],
 ["wonderwall","Wonderwall","Oasis",1,"Britpop","F♯","aeolian","rock",87,"F♯m7 | A | Esus4 | B7sus4","Anchor fingers, syncopated strum","Capo 2 and play Em7, G, Dsus4 and A7sus4 shapes. The band plays at concert pitch. Your ring and pinky fingers stay on the B and high E strings the whole way."],
 ["alabama","Sweet Home Alabama","Lynyrd Skynyrd",1,"Southern rock","D","mixolydian","rock",98,"D | C | G | G","Picked chord riff","Pick single strings out of the chord shapes instead of strumming. Add hammer-ons inside the shapes for the fills."],
 ["browneyed","Brown Eyed Girl","Van Morrison",1,"Pop rock","G","ionian","rock",150,"G | C | G | D","Melodic riff in thirds","The intro is a melody harmonised in thirds on two neighbouring strings. Learn the top line alone first, then add the harmony."],
 ["teenspirit","Smells Like Teen Spirit","Nirvana",1,"Grunge","F","aeolian","rock",117,"F5 | B♭5 | A♭5 | D♭5","Power chords, loud–quiet dynamics","The record fits two chords into each bar, but this chart gives each one a full bar. Scratch muted strums between the shapes to keep the groove going."],
 ["ironman","Iron Man","Black Sabbath",1,"Metal","B","aeolian","rock",76,"B5 | D5 | E5 | E5 | G5 | F♯5 | D5 | E5","Heavy power-chord riff","Slow and heavy beats fast and sloppy. Let each power chord ring its full length before you move."],
 ["backinblack","Back in Black","AC/DC",2,"Hard rock","E","mixolydian","rock",94,"E5 | D | A | A","Tight rhythm and muting","The silence between the chords is part of the riff. Lift your fretting hand just enough to cut the strings off exactly on time."],
 ["johnnyb","Johnny B. Goode","Chuck Berry",2,"Rock 'n' roll","B♭","mixolydian","rock",168,"B♭ | B♭ | B♭ | B♭ | E♭ | E♭ | B♭ | B♭ | F | F | B♭ | B♭","Double stops, boogie rhythm","The intro is double stops on the top two strings. The rhythm part rocks between the 5th and 6th over each chord, which is the backbone of rock 'n' roll."],
 ["prideandjoy","Pride and Joy","Stevie Ray Vaughan",2,"Texas blues","E","mixolydian","shuffle",118,"E7 | E7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7","Texas shuffle, muted strums","Your strumming hand never stops moving down and up, and your fretting hand decides which strums actually sound. The record is tuned down a half step."],
 ["redhouse","Red House","Jimi Hendrix",3,"Blues","B","mixolydian","shuffle",60,"B7 | B7 | B7 | B7 | E7 | E7 | B7 | B7 | F♯7 | E7 | B7 | F♯7","Slow blues phrasing","At this tempo every note is exposed. Play fewer notes, bend them in tune, and let each phrase finish before starting the next."],
 ["thrillgone","The Thrill Is Gone","B.B. King",2,"Blues","B","aeolian","rock",90,"Bm7 | Bm7 | Bm7 | Bm7 | Em7 | Em7 | Bm7 | Bm7 | Gmaj7 | F♯7 | Bm7 | Bm7","Minor blues, vibrato, space","B.B. worked out of one small patch of the neck. Pick a comfortable box and let your vibrato do the talking. Over F♯7, hit A♯."],
 ["crossroads","Crossroads","Cream",3,"Blues rock","A","mixolydian","rock",126,"A7 | A7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7","Fast pentatonic over a driving 12-bar","Clapton mixes minor and major pentatonic. Land on C♯ (the 3rd of A7) and the minor licks turn into pure blues."],
 ["sunshine","Sunshine of Your Love","Cream",1,"Blues rock","D","dorian","rock",116,"D | D | G | D","Blues-scale riff","The riff uses the blues scale's ♭5. For the G section, play the same fingering one string set higher."],
 ["purplehaze","Purple Haze","Jimi Hendrix",2,"Rock","E","dorian","rock",108,"E7♯9 | E7♯9 | G | A","The Hendrix chord","E7♯9 has both a major and a minor third in it. Play minor pentatonic over it, since the ♯9 is already in the chord."],
 ["littlewing","Little Wing","Jimi Hendrix",3,"Rock","E","aeolian","rock",70,"Em | G | Am | Em | Bm | B♭ | Am | C | G | F | C | D","Chord embellishments","Hendrix decorates each chord with hammer-ons and pentatonic notes from inside the shape. Keep your thumb on the bass note while your fingers add the ornaments."],
 ["heyjoe","Hey Joe","Jimi Hendrix",2,"Rock","E","mixolydian","rock",82,"C | G | D | A | E | E","Circle-of-fifths changes","Each chord is a fifth above the one before. Link them with short walks on the bass strings up to the next root."],
 ["watchtower","All Along the Watchtower","Jimi Hendrix",2,"Rock","C♯","aeolian","rock",113,"C♯m | B | A | B","Soloing over a repeating loop","The changes never stop, so your solo has to create the structure. Build it in sections, for example slide, then wah, then fast pentatonic."],
 ["layla","Layla","Derek and the Dominos",2,"Blues rock","D","aeolian","rock",115,"Dm | B♭ | C | Dm","Pentatonic riff in octaves","The famous riff is D minor pentatonic. Learn it low, then an octave up, and play both to hear why it was doubled."],
 ["wonderfultonight","Wonderful Tonight","Eric Clapton",1,"Ballad","G","ionian","rock",96,"G | D | C | D","Melodic lead over slow changes","The intro line is almost entirely chord tones. End every phrase on a note from the chord underneath it."],
 ["stairway","Stairway to Heaven (solo)","Led Zeppelin",3,"Rock","A","aeolian","rock",98,"Am | G | F | F","Pentatonic across two boxes","Page starts in the A minor box at the 5th fret and climbs into the box above. Over F, aim for C. It's the 5th, and it rings."],
 ["wholelotta","Whole Lotta Love","Led Zeppelin",1,"Hard rock","E","dorian","rock",90,"E5 | E5 | E5 | E5","Riff against an open string","The riff bounces off the open low E. Palm-mute it so the fretted notes pop out."],
 ["comfnumb","Comfortably Numb (solo)","Pink Floyd",3,"Rock","B","aeolian","rock",64,"Bm | A | G | Em","Bending in tune, phrasing","Gilmour's bends hit the exact pitch. Fret the target note first to hear it, then bend up until you match it."],
 ["wishyouwere","Wish You Were Here","Pink Floyd",2,"Rock","G","ionian","rock",60,"C | D | Am | G | D | C | Am | G","Melodic lick over open chords","The intro lick is G major pentatonic in open position. Let the open strings ring into each other."],
 ["hotelcal","Hotel California","Eagles",3,"Rock","B","aeolian","rock",74,"Bm | F♯ | A | E | G | D | Em | F♯","Arpeggio targeting, harmony leads","The outro solos trace each chord. Over F♯ play A♯. It's outside B minor, and it's what makes the line sound composed."],
 ["sultans","Sultans of Swing","Dire Straits",3,"Rock","D","aeolian","rock",148,"Dm | C | B♭ | A","Fingerpicked lead, fast triplets","Knopfler plays with his thumb and fingers, no pick. Over the A chord, C♯ is the note that pulls straight back to Dm."],
 ["freefallin","Free Fallin'","Tom Petty",1,"Rock","F","ionian","rock",84,"F | Fsus4 | F | C","Sus-chord movement","Capo 3 and play D, Dsus4, D and A shapes. The band plays at concert pitch. Only one finger moves for the sus chord."],
 ["paranoid","Paranoid","Black Sabbath",1,"Metal","E","aeolian","rock",164,"E5 | E5 | D5 | E5","Fast palm-muted eighths","Play all downstrokes on the palm-muted notes. It's a stamina drill disguised as a song."],
 ["sandman","Enter Sandman","Metallica",2,"Metal","E","aeolian","rock",123,"E5 | E5 | E5 | E5","Palm-muted riff, chromatic moves","Downpick the whole riff. The chromatic notes are where the menace comes from, so don't rush them."],
 ["sweetchild","Sweet Child O' Mine","Guns N' Roses",3,"Hard rock","D♭","mixolydian","rock",125,"D♭ | B | G♭ | D♭","String-skipping arpeggio","It's tuned down a half step, so the shapes are D, C, G and D. The intro is a string-skipping exercise: alternate pick and keep every note even."],
 ["underbridge","Under the Bridge","Red Hot Chili Peppers",2,"Alt rock","E","ionian","rock",84,"E | B | C♯m | G♯m | A | E | B | B","Chord-melody embellishments","Frusciante borrows Hendrix's trick of playing small melodies inside the chord shapes. Keep each chord's root under your fingers."],
 ["californication","Californication","Red Hot Chili Peppers",2,"Alt rock","A","aeolian","rock",96,"Am | F | Am | F | C | G | F | Dm","Arpeggiated chords, clean melody","The verse arpeggiates Am and F. Pick one string at a time and let the notes overlap."],
 ["crazytrain","Crazy Train","Ozzy Osbourne",3,"Metal","F♯","aeolian","rock",138,"F♯m | F♯m | D | E","Fast alternate-picked riff","Rhoads's riff is F♯ minor against a pedal note. Keep the pick close to the strings, and practise at 70% speed first."],
 ["cliffsdover","Cliffs of Dover","Eric Johnson",3,"Instrumental","G","ionian","rock",118,"G | D | Em | C","Pentatonic speed runs, clean tone","The intro is built from fast pentatonic groupings, so pair this song with the Speed runs drills. The chart is a simplified jam loop."],
 ["lagrange","La Grange","ZZ Top",2,"Blues rock","A","mixolydian","shuffle",160,"A7 | A7 | A7 | A7","Boogie shuffle","The boogie riff moves between the root, 5th and 6th while palm-muted. Keep your palm down and the swing lazy."],
 ["rocknroll","Rock and Roll","Led Zeppelin",2,"Hard rock","A","mixolydian","rock",170,"A | A | A | A | D | D | A | A | E | D | A | A","Straight-eighths 12-bar","A 12-bar blues at a gallop. Rock between the 5th and 6th on the rhythm part, and don't let the tempo drift."],
 ["texasflood","Texas Flood","Stevie Ray Vaughan",3,"Texas blues","G","mixolydian","shuffle",60,"G7 | C7 | G7 | G7 | C7 | C7 | G7 | G7 | D7 | C7 | G7 | D7","Slow blues, turnarounds","SRV attacks hard, then drops to a whisper. Practise the turnaround in bars 11–12 until it's automatic."],
 ["sweethomechicago","Sweet Home Chicago","Robert Johnson",1,"Blues","E","mixolydian","shuffle",120,"E7 | A7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7","The 12-bar shuffle pattern","The classic two-string shuffle: root plus 5th, stretching up to the 6th. Learn this and you can sit in at any blues jam."],
 ["oyecomova","Oye Como Va","Santana",2,"Latin rock","A","dorian","funk",124,"Am7 | D9","Dorian soloing, singing sustain","Two chords, one Dorian scale. Lean on F♯ over Am7. It's the note that makes the scale Dorian, and it's also the 3rd of D9."],
 ["blackmagic","Black Magic Woman","Santana",2,"Latin rock","D","aeolian","funk",118,"Dm | Dm | Am | Am | Dm | Dm | Gm | Gm | Dm | A7 | Dm | Dm","Minor phrasing over a Latin groove","Over A7 play C♯. It's outside D minor, and it resolves straight back to D."],
 ["messagebottle","Message in a Bottle","The Police",3,"Rock","C♯","aeolian","rock",150,"C♯m | A | B | F♯m","Stretched add9 riff","Summers stretches root–5th–9th shapes. Warm up first, because it's a big reach and a relaxed hand beats a strong one."],
 ["satisfaction","(I Can't Get No) Satisfaction","The Rolling Stones",1,"Rock","E","mixolydian","rock",136,"E | A | E | A","Short single-note riff","A three-note riff low on the neck. Keep it locked to the beat, because it only works when it's tight."],
 ["daytripper","Day Tripper","The Beatles",2,"Rock","E","mixolydian","rock",138,"E7 | E7 | A7 | E7","Blues-scale riff","The riff climbs the E blues scale and comes back down. Use one finger per fret, with no position shifts."],
 ["blackbird","Blackbird","The Beatles",2,"Folk","G","ionian","rock",94,"G | Am | G | C","Fingerstyle with a skipped string","Pluck a bass note and a melody note together with one string between them, and brush that middle string on the offbeat."],
 ["herecomessun","Here Comes the Sun","The Beatles",1,"Pop","A","ionian","rock",129,"A | D | E7 | A","Hammer-ons inside open chords","Capo 7 and play D, G and A7 shapes. The band plays at concert pitch. The riff is hammer-ons and pull-offs inside those shapes."],
 ["standbyme","Stand By Me","Ben E. King",1,"Soul","A","ionian","rock",118,"A | A | F♯m | F♯m | D | E | A | A","I–vi–IV–V progression","This is one of the most-used progressions in pop. Learn the bass line on the low strings, then play it together with the chords."]
].map(a => ({ id:a[0], name:a[1], artist:a[2], level:a[3], style:a[4], key:a[5], mode:a[6],
             groove:a[7], bpm:a[8], chords:a[9], teaches:a[10], tip:a[11] }));
const CLASSIC_BY_ID = {}; CLASSICS.forEach(c => CLASSIC_BY_ID[c.id] = c);
function classicKeyPc(c){ return parseChord(c.key).pc; }
function classicKeyLabel(c){
  const minor = ["aeolian","dorian","phrygian"].indexOf(c.mode) !== -1;
  return c.key + (minor ? " minor" : " major");
}
</script>
