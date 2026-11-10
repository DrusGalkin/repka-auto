import {Buffer} from 'buffer';
export const SERVICE='73310001-8d21-4f2a-9f10-22c26f0c0001';
export const CHARACTERISTIC='73310002-8d21-4f2a-9f10-22c26f0c0001';
export class Decoder {
  constructor(){this.reset();}
  reset(){this.seq=-1;this.count=0;this.parts=[];this.started=0;}
  push(base64){
    const b=Buffer.from(base64,'base64');
    if(b.length<5||b.length>20||b[0]!==1||!b[3]||b[2]>=b[3])return null;
    if(b[2]===0){this.reset();this.seq=b[1];this.count=b[3];this.started=Date.now();}
    if(b[1]!==this.seq||b[3]!==this.count||Date.now()-this.started>15000)return null;
    if(b[2]!==this.parts.length){this.reset();return null;}
    this.parts.push(b.subarray(4));
    if(this.parts.length!==this.count)return null;
    try{const data=JSON.parse(Buffer.concat(this.parts).toString('utf8'));const valid=data.v===1&&['connected','connecting','disconnected'].includes(data.status)&&typeof data.demo==='boolean'&&Number.isFinite(data.ts)&&data.metrics&&typeof data.metrics==='object'&&!Array.isArray(data.metrics)&&Object.values(data.metrics).every(v=>Array.isArray(v)&&v.length===3&&(v[0]===null||Number.isFinite(v[0]))&&typeof v[1]==='string'&&Number.isFinite(v[2]));return valid?data:null;}catch{return null;}finally{this.reset();}
  }
}
