
<script>
/* ============================================================
   WOODSHED — REAPER link (a computer with REAPER only)
   Woodshed runs the session; REAPER records and measures it.
   When connected, each block's start and end are written as small text
   files into a folder REAPER watches (the browser's own folder access,
   so no server and nothing uploaded). REAPER records the guitar and
   Woodshed's sound, measures the block, and writes a result file back,
   which the block-end screen shows. Phones don't have folder access,
   so there the link never appears and nothing changes.
   File format: "key<TAB>value" lines, then one "BEAT" line per click.
   ============================================================ */
const Link = (() => {
  const supported = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  let dir = null, ok = false, sess = "", seq = 0, beats = [], open = 0;
  let q = Promise.resolve();                       // writes go one after another, in order

  /* the folder handle is kept between visits in IndexedDB (a handle can't go in localStorage) */
  function kv(mode, fn){
    return new Promise((res, rej) => {
      const r = indexedDB.open("woodshed-link", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction("kv", mode), rq = fn(tx.objectStore("kv"));
        tx.oncomplete = () => res(rq && rq.result);
        tx.onerror = () => rej(tx.error);
      };
    });
  }

  /* pick the folder (from a tap): Documents\Music\Woodshed\link */
  async function connect(){
    if(!supported) return false;
    dir = await window.showDirectoryPicker({ id:"woodshed-reaper", mode:"readwrite", startIn:"documents" });
    try{ await kv("readwrite", s => s.put(dir, "dir")); }catch(e){}
    ok = true;
    return true;
  }
  async function disconnect(){
    dir = null; ok = false; open = 0; beats = [];
    try{ await kv("readwrite", s => s.delete("dir")); }catch(e){}
  }
  /* ask=true only from a tap: the browser may ask once per visit to allow the folder again */
  async function resume(ask){
    if(!supported) return false;
    try{
      if(!dir) dir = await kv("readonly", s => s.get("dir"));
      if(!dir){ ok = false; return false; }
      let p = await dir.queryPermission({ mode:"readwrite" });
      if(p !== "granted" && ask) p = await dir.requestPermission({ mode:"readwrite" });
      ok = p === "granted";
    }catch(e){ ok = false; }
    return ok;
  }

  const flat = v => String(v == null ? "" : v).replace(/[\t\r\n]+/g, " ");
  function send(type, o, extra){
    q = q.then(async () => {
      if(!ok || !dir) return;
      try{
        seq++;
        const body = Object.keys(o).map(k => k + "\t" + flat(o[k])).join("\n") + "\n" + (extra && extra.length ? extra.join("\n") + "\n" : "");
        const name = "ev-" + Date.now() + "-" + String(seq).padStart(4, "0") + "-" + type + ".txt";
        const fh = await dir.getFileHandle(name, { create:true });
        const w = await fh.createWritable();
        await w.write("type\t" + type + "\nsession\t" + sess + "\nepoch\t" + Date.now() + "\n" + body);
        await w.close();
      }catch(e){ ok = false; }                      // folder gone or permission dropped: carry on without REAPER
    });
    return q;
  }

  function sessionStart(plan){
    if(!supported) return;
    sess = String(Date.now()); seq = 0; open = 0; beats = [];
    q = q.then(() => resume(true));                // this runs inside the Start tap, so the browser may ask here
    send("session_start", { minutes: plan.blocks.reduce((a, b) => a + b.minutes, 0), blocks: plan.blocks.length,
      titles: plan.blocks.map(b => b.kind + ": " + b.title).join(" | ") });
  }
  function blockStart(b, idx, total){
    if(!supported || !sess) return;
    open = idx + 1; beats = [];
    send("block_start", {
      block: idx + 1, of: total, kind: b.kind, title: b.title, minutes: b.minutes,
      bpm: b.bpm || Audio2.T.bpm, backing: b.backing || "", listen: b.listen ? 1 : 0,
      key_pc: b.target ? b.target.keyPc : "", mode: b.target ? b.target.mode.name : "",
      scale: (b.scalePcs || []).join(","), run: b.run ? b.run.def.id : "", quality: b.run ? b.run.quality : "",
      drill: b.drill ? b.drill.type + ":" + b.drill.pat.id : "",
      ramp: b.ramp ? [b.ramp.every, b.ramp.step, b.ramp.target].join(",") : ""
    });
  }
  /* every click Woodshed schedules: when it will sound (clock time and audio time), and the tempo then */
  function beat(t, beatInBar, counting, absBeat){
    if(!ok || !open) return;
    const lat = Audio2.latency ? Audio2.latency() : 0;
    const epoch = performance.timeOrigin + performance.now() + (t - Audio2.now() + lat) * 1000;
    beats.push(["BEAT", epoch.toFixed(1), t.toFixed(6), counting ? 1 : 0, absBeat, Audio2.T.bpm, beatInBar].join("\t"));
  }
  function blockEnd(b, idx){
    if(!supported || !sess || open !== idx + 1) return;
    const list = beats; beats = []; open = 0;
    send("block_end", { block: idx + 1, kind: b.kind, bpm_end: Audio2.T.bpm, beats: list.length }, list);
  }
  function sessionEnd(why){
    if(!supported || !sess) return;
    open = 0; beats = [];
    send("session_end", { why: why || "done" });
    q = q.then(() => { sess = ""; });
  }

  /* REAPER's measurement of a block, or null if none comes within ms */
  async function result(block, ms){
    await q;
    if(!ok || !dir || !sess) return null;
    const name = "result-" + sess + "-" + block + ".json", t0 = Date.now();
    while(Date.now() - t0 < ms){
      try{
        const fh = await dir.getFileHandle(name);
        const txt = await (await fh.getFile()).text();
        if(txt && txt.trim().slice(-1) === "}"){
          const r = JSON.parse(txt);
          try{ await dir.removeEntry(name); }catch(e){}
          return r;
        }
      }catch(e){ /* not there yet */ }
      await new Promise(r => setTimeout(r, 400));
    }
    return null;
  }
  /* REAPER's watcher touches reaper-alive.txt every couple of seconds while it runs */
  async function alive(){
    if(!ok || !dir) return false;
    try{
      const f = await (await dir.getFileHandle("reaper-alive.txt")).getFile();
      return Date.now() - f.lastModified < 8000;
    }catch(e){ return false; }
  }
  async function status(){
    await resume(false);
    if(!dir) return { connected:false, text:"Not connected. On a computer with REAPER, Woodshed can run the session while REAPER records and measures each block." };
    if(!ok) return { connected:true, text:"Connected. The browser will ask to allow the folder again when you start a session." };
    return (await alive())
      ? { connected:true, text:"Connected, and REAPER is listening. It records and measures each block." }
      : { connected:true, text:"Connected, but REAPER isn't answering. Open REAPER before you start a session." };
  }

  return { supported, connect, disconnect, resume, status, alive, ready: () => ok && !!dir && !!sess,
           sessionStart, blockStart, beat, blockEnd, sessionEnd, result,
           _useDir(h){ dir = h; ok = !!h; } };       // the checks hand in a stand-in folder
})();
</script>
