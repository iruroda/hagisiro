const K='fake:fs';
const load=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return {}}};
const save=(o)=>localStorage.setItem(K,JSON.stringify(o));
const ls=new Set();
const notify=()=>ls.forEach(f=>f());
window.addEventListener('storage',notify);
const P=(a)=>a.slice(1).join('/');
export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
export const doc=(db,...s)=>({path:s.join('/'),id:s[s.length-1]});
export const collection=(db,...s)=>({path:s.join('/'),col:true});
export const query=(c)=>c; export const where=()=>({});
const kids=(c)=>{const s=load();const pre=c.path+'/';return Object.keys(s).filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(k=>({id:k.slice(pre.length),data:()=>s[k],ref:{path:k}}));};
export const getDocs=async(c)=>({docs:kids(c)});
export const getDoc=async(r)=>{const s=load();return{exists:()=>r.path in s,data:()=>s[r.path],id:r.id}};
const apply=(op)=>{const s=load();
 if(op.t==='set'){ if(op.path.includes('/taken/')&&op.path in s) {const e=new Error('denied');e.code='permission-denied';throw e;}
   s[op.path]=op.o&&op.o.merge?Object.assign({},s[op.path]||{},op.d):op.d;}
 else if(op.t==='del'){delete s[op.path];}
 save(s);};
export const setDoc=async(r,d,o)=>{apply({t:'set',path:r.path,d,o});notify();};
export const updateDoc=async(r,d)=>{const s=load();Object.assign(s[r.path],d);save(s);notify();};
export const deleteDoc=async(r)=>{apply({t:'del',path:r.path});notify();};
export const addDoc=async(c,d)=>{const id='c'+Math.random().toString(36).slice(2,10);const s=load();s[c.path+'/'+id]=d;save(s);notify();return{id};};
export const writeBatch=()=>{const ops=[];return{set:(r,d,o)=>{ops.push({t:'set',path:r.path,d,o});return this},delete:(r)=>{ops.push({t:'del',path:r.path})},commit:async()=>{const snap=JSON.stringify(load());try{ops.forEach(apply)}catch(e){localStorage.setItem(K,snap);throw e}notify();}}};
export const onSnapshot=(r,cb)=>{const f=()=>{if(r.col)cb({docs:kids(r)});else cb({exists:()=>1,docs:[]});};ls.add(f);setTimeout(f,0);return()=>ls.delete(f);};
