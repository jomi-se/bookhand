import { makeChunks, makeVectors, QUERY_TERMS } from './data.js';
const now = () => performance.now();
const med = a => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
const r2 = x => Math.round(x*100)/100;

function cosineTopK(matrix, n, dim, q, k){
  const scores = new Float32Array(n);
  for(let i=0;i<n;i++){ let s=0; const o=i*dim; for(let d=0;d<dim;d++) s+=matrix[o+d]*q[d]; scores[i]=s; }
  // partial top-k
  const idx=[]; for(let i=0;i<n;i++){ if(idx.length<k){idx.push(i); if(idx.length===k) idx.sort((a,b)=>scores[b]-scores[a]);} else if(scores[i]>scores[idx[k-1]]){ let p=k-1; while(p>0&&scores[i]>scores[idx[p-1]]) {idx[p]=idx[p-1];p--;} idx[p]=i; } }
  return idx.map(i=>[i+1,scores[i]]);
}

async function sqliteVariant(kind, N, phase){
  const out={kind,N,phase};
  const mod = kind==='A' ? '/vendor/vec/sqlite3.mjs' : kind==='A2' ? '/vendor/vec2/sqlite3.mjs' : '/vendor/official/index.mjs';
  let t=now();
  const sqlite3InitModule = (await import(mod)).default;
  const sqlite3 = await sqlite3InitModule({print:()=>{},printErr:()=>{}});
  out.moduleInitMs = r2(now()-t);
  out.libVersion = sqlite3.version.libVersion;
  t=now();
  const pool = await sqlite3.installOpfsSAHPoolVfs({name:'bench-'+kind, directory:'/bench-'+kind, initialCapacity:8});
  out.vfsInstallMs = r2(now()-t);
  t=now();
  const db = new pool.OpfsSAHPoolDb('/study.sqlite');
  out.openMs = r2(now()-t);
  const dim=384;
  const vectors = makeVectors(N,dim);
  const chunks = makeChunks(N);

  if(phase==='build'){
    db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL;");
    db.exec("DROP TABLE IF EXISTS chunks_fts; DROP TABLE IF EXISTS chunks;");
    try{ db.exec("DROP TABLE IF EXISTS vec_chunks"); }catch(e){}
    try{ db.exec("DROP TABLE IF EXISTS vecs"); }catch(e){}
    db.exec("CREATE TABLE chunks(id INTEGER PRIMARY KEY, section TEXT, ord INTEGER, text TEXT)");
    t=now();
    db.exec("BEGIN");
    const st=db.prepare("INSERT INTO chunks VALUES(?,?,?,?)");
    for(const c of chunks){ st.bind([c.id,c.section,c.ord,c.text]); st.step(); st.reset(); }
    st.finalize(); db.exec("COMMIT");
    out.insertRowsMs = r2(now()-t);

    t=now();
    db.exec("CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')");
    db.exec("INSERT INTO chunks_fts(rowid,text) SELECT id,text FROM chunks");
    out.fts5BuildMs = r2(now()-t);

    if(kind==='A'||kind==='A2'){
      t=now();
      let ok=true;
      try{ db.exec(`CREATE VIRTUAL TABLE vec_chunks USING vec0(id integer primary key, embedding float[${dim}])`); }
      catch(e){ ok=false; out.vec0CreateError=String(e.message||e); }
      if(ok){
        db.exec("BEGIN");
        const vs=db.prepare("INSERT INTO vec_chunks(id,embedding) VALUES (?,?)");
        for(let i=0;i<N;i++){ const sub=new Uint8Array(vectors.buffer, i*dim*4, dim*4); vs.bind([i+1, sub]); vs.step(); vs.reset(); }
        vs.finalize(); db.exec("COMMIT");
        out.vecInsertMs = r2(now()-t);
      }
    } else {
      t=now();
      db.exec("CREATE TABLE vecs(id INTEGER PRIMARY KEY, v BLOB)");
      db.exec("BEGIN");
      const vs=db.prepare("INSERT INTO vecs VALUES(?,?)");
      for(let i=0;i<N;i++){ const sub=new Uint8Array(vectors.buffer, i*dim*4, dim*4); vs.bind([i+1, sub]); vs.step(); vs.reset(); }
      vs.finalize(); db.exec("COMMIT");
      out.vecInsertMs = r2(now()-t);
    }
  }

  // size
  let pc=0,ps=0; db.exec({sql:"PRAGMA page_count",rowMode:0,callback:r=>pc=r}); db.exec({sql:"PRAGMA page_size",rowMode:0,callback:r=>ps=r});
  out.dbBytes = pc*ps;

  // FTS query latency (top 10 by bm25)
  const ftsT=[]; let ftsHits=0;
  for(const q of QUERY_TERMS){ const t0=now(); const rows=[];
    db.exec({sql:"SELECT rowid, bm25(chunks_fts) AS s FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY s LIMIT 10", bind:[q.split(' ').join(' OR ')], rowMode:'array', callback:r=>rows.push(r)});
    ftsT.push(now()-t0); ftsHits+=rows.length; }
  out.ftsMedianMs=r2(med(ftsT)); out.ftsMaxMs=r2(Math.max(...ftsT)); out.ftsHits=ftsHits;

  // vector top-k
  const vT=[];
  if((kind==='A'||kind==='A2') && !out.vec0CreateError){
    for(let i=0;i<10;i++){ const q=new Uint8Array(vectors.buffer, i*dim*4, dim*4); const t0=now(); const rows=[];
      try{ db.exec({sql:"SELECT id, distance FROM vec_chunks WHERE embedding MATCH ? AND k=10 ORDER BY distance", bind:[q], rowMode:'array', callback:r=>rows.push(r)}); }
      catch(e){ out.vecQueryError=String(e.message||e); break; }
      vT.push(now()-t0); }
  } else {
    // load blobs -> matrix (cold), then scan
    const t0=now(); const mat=new Float32Array(N*dim); let i=0;
    db.exec({sql:"SELECT v FROM vecs ORDER BY id", rowMode:0, callback:(blob)=>{ mat.set(new Float32Array(blob.buffer,blob.byteOffset,dim), i*dim); i++; }});
    out.vecLoadFromDbMs=r2(now()-t0);
    for(let j=0;j<10;j++){ const q=vectors.subarray(j*dim,(j+1)*dim); const t1=now(); cosineTopK(mat,N,dim,q,10); vT.push(now()-t1); }
  }
  if(vT.length){ out.vecMedianMs=r2(med(vT)); out.vecMaxMs=r2(Math.max(...vT)); }
  db.close();
  return out;
}

async function dexieVariant(N, phase){
  const out={kind:'C',N,phase};
  let t=now();
  const {default:Dexie} = await import('/vendor/lib/dexie.mjs');
  const {default:MiniSearch} = await import('/vendor/lib/minisearch/index.js');
  out.moduleInitMs=r2(now()-t);
  const dim=384; const chunks=makeChunks(N); const vectors=makeVectors(N,dim);
  const db=new Dexie('studyC'); db.version(1).stores({chunks:'id,section',vecs:'id',meta:'k'});
  t=now(); await db.open(); out.openMs=r2(now()-t);
  if(phase==='build'){
    await db.chunks.clear(); await db.vecs.clear(); await db.meta.clear();
    t=now(); await db.chunks.bulkPut(chunks); out.insertRowsMs=r2(now()-t);
    t=now(); const recs=new Array(N); for(let i=0;i<N;i++) recs[i]={id:i+1,v:vectors.slice(i*dim,(i+1)*dim)};
    await db.vecs.bulkPut(recs); out.vecInsertPerRowMs=r2(now()-t);
    t=now(); await db.meta.put({k:'packed', v:vectors.buffer.slice(0)}); out.vecInsertPackedMs=r2(now()-t);
    t=now(); const ms=new MiniSearch({fields:['text'],storeFields:['section']});
    ms.addAll(chunks); out.miniBuildMs=r2(now()-t);
    t=now(); const json=JSON.stringify(ms.toJSON()); out.miniSerializeMs=r2(now()-t); out.miniJsonBytes=json.length;
    t=now(); await db.meta.put({k:'mini',v:json}); out.miniStoreMs=r2(now()-t);
  }
  // warm/reload path: load minisearch + vectors
  t=now(); const rec=await db.meta.get('mini'); const ms=MiniSearch.loadJSON(rec.v,{fields:['text'],storeFields:['section']}); out.miniLoadMs=r2(now()-t);
  t=now(); const packed=await db.meta.get('packed'); const mat=new Float32Array(packed.v); out.vecLoadPackedMs=r2(now()-t);
  t=now(); const rows=await db.vecs.toArray(); const mat2=new Float32Array(N*dim); for(let i=0;i<N;i++) mat2.set(rows[i].v,i*dim); out.vecLoadPerRowMs=r2(now()-t);
  const ftsT=[]; let hits=0;
  for(const q of QUERY_TERMS){ const t0=now(); const res=ms.search(q,{prefix:false,fuzzy:false}).slice(0,10); ftsT.push(now()-t0); hits+=res.length; }
  out.ftsMedianMs=r2(med(ftsT)); out.ftsMaxMs=r2(Math.max(...ftsT)); out.ftsHits=hits;
  const vT=[]; for(let j=0;j<10;j++){ const q=vectors.subarray(j*dim,(j+1)*dim); const t0=now(); cosineTopK(mat,N,dim,q,10); vT.push(now()-t0); }
  out.vecMedianMs=r2(med(vT)); out.vecMaxMs=r2(Math.max(...vT));
  // idb size estimate
  try{ const e=await navigator.storage.estimate(); out.storageUsageBytes=e.usage; }catch(e){}
  db.close();
  return out;
}

self.onmessage = async (ev)=>{
  const {kind,N,phase}=ev.data;
  try{
    const res = kind==='C' ? await dexieVariant(N,phase) : await sqliteVariant(kind,N,phase);
    self.postMessage({ok:true,res});
  }catch(e){ self.postMessage({ok:false,error:String(e&&e.stack||e)}); }
};
