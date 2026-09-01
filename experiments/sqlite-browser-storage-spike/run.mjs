import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('node',['pub/serve.js','pub','8137'],{stdio:'inherit'});
await new Promise(r=>setTimeout(r,800));
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console',m=>{ if(m.type()==='error') console.log('  [console.error]',m.text().slice(0,300)); });
const results=[];
async function go(kind,N,phase){
  await page.goto('http://127.0.0.1:8137/',{waitUntil:'load'});
  const t0=Date.now();
  try{ const r=await page.evaluate(([k,n,p])=>window.runBench(k,n,p),[kind,N,phase]);
    r.wallMs=Date.now()-t0; results.push(r); console.log(JSON.stringify(r)); }
  catch(e){ console.log(JSON.stringify({kind,N,phase,error:String(e.message).slice(0,600)})); }
}
for(const N of [2000,10000]){
  for(const kind of ['B','A','C']){
    await go(kind,N,'build');
    await go(kind,N,'reopen');   // fresh page load -> cold start against persisted data
  }
}
await browser.close(); srv.kill();
import fs from 'node:fs'; fs.writeFileSync('results.json',JSON.stringify(results,null,1));
console.log('DONE');
