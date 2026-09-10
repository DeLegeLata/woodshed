
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

  const PL = 30, PR = 12, PT = 16, PB = 24, FW = 60, SG = 29;
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

  // notes
  shape.notes.forEach((nt, i) => {
    const x = noteX(nt.fret), y = strY(nt.string);
    const isHi = (i === highlight);
    let fill = "#241c15", stroke = "#a3967f", tc = "#ece0c8";
    if(nt.root){ fill = "#ff9d2f"; stroke = "#ffcb84"; tc = "#2a1704"; }
    if(isHi){ fill = "#f2efe6"; stroke = "#ffffff"; tc = "#1a1410"; }
    if(isHi) p.push('<circle cx="'+x+'" cy="'+y+'" r="16" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.55"/>');
    p.push('<circle cx="'+x+'" cy="'+y+'" r="11.5" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.6"/>');
    const txt = labelMode === "deg" ? nt.label : nt.name;
    p.push('<text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-weight="600" font-size="'+(txt.length>2?10:12)+'" fill="'+tc+'">'+txt+'</text>');
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
</script>
