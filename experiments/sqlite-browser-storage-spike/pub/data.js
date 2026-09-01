// Deterministic synthetic corpus + normalized 384-d float32 vectors.
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const VOCAB=("epub reader annotation embedding retrieval chunk vector index lexical semantic hybrid ranking fusion reciprocal rank query token passage highlight bookmark chapter section paragraph sentence corpus transformer attention gradient optimizer inference latency throughput memory cache buffer worker thread storage quota persistence origin private filesystem database transaction schema migration serialize deserialize compression quantization cosine similarity distance neighbor approximate exact scan traversal pointer allocation heap stack recursion iteration convergence divergence entropy distribution sampling temperature logits softmax normalization dimension projection matrix tensor kernel pipeline batch stream").split(" ");
export function makeChunks(n,seed=42){const rnd=mulberry32(seed);const out=new Array(n);
 for(let i=0;i<n;i++){const len=500+Math.floor(rnd()*500);let s="";while(s.length<len){s+=VOCAB[Math.floor(rnd()*VOCAB.length)]+" ";}
  out[i]={id:i+1,section:"ch"+((i%40)+1),ord:i,text:s.slice(0,len)};}
 return out;}
export function makeVectors(n,dim=384,seed=7){const rnd=mulberry32(seed);const all=new Float32Array(n*dim);
 for(let i=0;i<n;i++){let ss=0;const o=i*dim;for(let d=0;d<dim;d++){const v=rnd()*2-1;all[o+d]=v;ss+=v*v;}const inv=1/Math.sqrt(ss);for(let d=0;d<dim;d++)all[o+d]*=inv;}
 return all;}
export const QUERY_TERMS=["embedding retrieval","hybrid ranking fusion","worker storage quota","attention softmax logits","chapter paragraph highlight","cosine similarity neighbor","transaction schema migration","quantization compression cache","approximate exact scan","tensor projection kernel"];
