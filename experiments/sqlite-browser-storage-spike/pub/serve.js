import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=process.argv[2]||'.'; const port=+process.argv[3]||8137; const coop=process.argv[4]==='coop';
const mt={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.map':'application/json'};
http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
 const f=path.join(root,p);
 fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end('nf '+p);} const h={'Content-Type':mt[path.extname(f)]||'application/octet-stream'};
  if(coop){h['Cross-Origin-Opener-Policy']='same-origin';h['Cross-Origin-Embedder-Policy']='require-corp';}
  res.writeHead(200,h); res.end(d); }); }).listen(port,()=>console.log('serving '+root+' on '+port+(coop?' (COOP/COEP)':'')));
