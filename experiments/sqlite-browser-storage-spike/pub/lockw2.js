let sqlite3, pool, db;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
self.onmessage = async (ev)=>{
 const {cmd}=ev.data;
 try{
  if(cmd==='openRetry'){
    sqlite3 = await (await import('/vendor/official/index.mjs')).default({print:()=>{},printErr:()=>{}});
    const t0=performance.now(); let attempts=0, lastErr=null;
    while(performance.now()-t0 < 10000){
      attempts++;
      try{ pool = await sqlite3.installOpfsSAHPoolVfs({name:'locktest2', directory:'/locktest2', initialCapacity:8}); lastErr=null; break; }
      catch(e){ lastErr=String(e.message||e).slice(0,120); await sleep(250); }
    }
    if(lastErr) return self.postMessage({ok:false,cmd,attempts,ms:Math.round(performance.now()-t0),error:lastErr});
    db = new pool.OpfsSAHPoolDb('/t.sqlite');
    db.exec("CREATE TABLE IF NOT EXISTS t(id INTEGER PRIMARY KEY, v TEXT)");
    let n=0; db.exec({sql:"SELECT count(*) FROM t",rowMode:0,callback:r=>n=r});
    let ic=[]; db.exec({sql:"PRAGMA integrity_check",rowMode:0,callback:r=>ic.push(r)});
    return self.postMessage({ok:true,cmd,attempts,ms:Math.round(performance.now()-t0),rows:n,integrity:ic,
      hasPause: typeof pool.pauseVfs, hasUnpause: typeof pool.unpauseVfs, capacity: pool.getCapacity?.(), files: pool.getFileNames?.()});
  }
  if(cmd==='bigInsert'||cmd==='smallInsert'){ const NROWS = (cmd==='smallInsert')?10000:300000;
    db.exec("BEGIN"); const st=db.prepare("INSERT INTO t(v) VALUES(?)");
    for(let i=0;i<NROWS;i++){ st.bind(['x'.repeat(200)+i]); st.step(); st.reset(); }
    st.finalize(); db.exec("COMMIT"); return self.postMessage({ok:true,cmd,done:true});
  }
 }catch(e){ self.postMessage({ok:false,cmd,error:String(e.message||e).slice(0,300)}); }
};
