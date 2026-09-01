import { chromium } from 'playwright'; import { spawn } from 'node:child_process';
const srv=spawn('node',['pub/serve.js','pub','8185'],{stdio:'ignore'}); await new Promise(r=>setTimeout(r,600));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await b.newContext(); const log=(k,v)=>console.log(k+': '+JSON.stringify(v));
async function trial(label, cmd, waitMs){
  const p=await ctx.newPage(); await p.goto('http://127.0.0.1:8185/lock2.html');
  await p.evaluate(()=>window.mk()); await p.evaluate(()=>window.send('openRetry'));
  if(cmd) p.evaluate(c=>window.send(c),cmd).catch(()=>{});
  await new Promise(r=>setTimeout(r,waitMs));
  await p.reload({waitUntil:'load'}); await p.evaluate(()=>window.mk());
  const r=await p.evaluate(()=>window.send('openRetry'));
  log(label, {ok:r.ok, attempts:r.attempts, ms:r.ms, rows:r.rows, integrity:r.integrity, err:r.error});
  await p.close(); await new Promise(r=>setTimeout(r,600));
}
await trial('reload while IDLE', null, 300);
await trial('reload during 10k-row txn', 'smallInsert', 400);
await trial('reload during 300k-row txn', 'bigInsert', 2000);
await b.close(); srv.kill();
