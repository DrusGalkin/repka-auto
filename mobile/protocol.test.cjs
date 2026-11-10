const {test}=require('node:test');
const assert=require('node:assert/strict');
async function load(){return import('./protocol.js');}
function frames(data,seq=1){const b=Buffer.from(JSON.stringify(data)),n=Math.ceil(b.length/16);return Array.from({length:n},(_,i)=>Buffer.concat([Buffer.from([1,seq,i,n]),b.subarray(i*16,(i+1)*16)]).toString('base64'));}
test('reassembles snapshot and rejects packet loss',async()=>{const {Decoder}=await load();const d=new Decoder(),s={v:1,status:'connected',demo:false,ts:123,metrics:{RPM:[1200,'rpm',123]}};let result;for(const f of frames(s))result=d.push(f);assert.deepEqual(result,s);const f=frames(s,2);d.push(f[0]);for(const p of f.slice(2))assert.equal(d.push(p),null);for(const p of frames(s,3))result=d.push(p);assert.deepEqual(result,s);});
test('ignores malformed data and mixed snapshots',async()=>{const {Decoder}=await load();const d=new Decoder();assert.equal(d.push('AA=='),null);const a=frames({v:1,ts:1,metrics:{long:'x'.repeat(80)}},1),b=frames({v:1,ts:1,metrics:{}},2);d.push(a[0]);assert.equal(d.push(b[1]),null);});

test('rejects malformed metric schema',async()=>{const {Decoder}=await load();const d=new Decoder();let result;for(const f of frames({v:1,status:'connected',demo:false,ts:1,metrics:{RPM:'invalid'}}))result=d.push(f);assert.equal(result,null);});
