import assert from "node:assert/strict";
import {db} from "../../lib/config/firebase.js";
import {Timestamp} from "firebase-admin/firestore";
export function memoryFirestore(initial=[]) {
  const records=new Map(initial);let nextId=0;
  // Real QueryDocumentSnapshots always carry commit-time updateTime and
  // createTime. This test double previously omitted both, so an ordinary
  // accepted replay falsely failed the revision-fenced relationship rebuild.
  let tick=0;
  const revisions=new Map(),created=new Map();
  const stamp=()=>new Timestamp(1700000000,++tick);
  for(const path of records.keys()){const time=stamp();created.set(path,time);revisions.set(path,time);}
  records.set=(path,data)=>{
    if(!created.has(path))created.set(path,stamp());
    revisions.set(path,stamp());
    Map.prototype.set.call(records,path,data);
    return records;
  };
  records.delete=path=>{
    revisions.delete(path);created.delete(path);return Map.prototype.delete.call(records,path);
  };
  records.clear=()=>{revisions.clear();created.clear();Map.prototype.clear.call(records);};
  const snapshot=path=>({id:path.split("/").at(-1),exists:records.has(path),
    data:()=>records.get(path),ref:ref(path),
    createTime:created.get(path),updateTime:revisions.get(path)});
  const query=(path,filters=[],order=null,cap=null)=>{
    let docs=[...records.keys()].filter(key=>key.startsWith(path+"/")&&key.split("/").length===path.split("/").length+1).map(snapshot);
    for(const [field,operator,value] of filters){assert.equal(operator,"==");docs=docs.filter(doc=>doc.data()?.[field]===value);}
    if(order)docs.sort((a,b)=>{const x=a.data()[order[0]],y=b.data()[order[0]];return (x?.toMillis?.()??x)-(y?.toMillis?.()??y);});
    if(order?.[1]==="desc")docs.reverse();if(cap!=null)docs=docs.slice(0,cap);
    return {docs,empty:!docs.length,size:docs.length};
  };
  function ref(path,isCollection=false,filters=[],order=null,cap=null) {
    return {path,id:path.split("/").at(-1),isCollection,filters,order,cap,
      doc:id=>ref(path+"/"+(id??"auto-"+(++nextId))),collection:id=>ref(path+"/"+id,true),
      where:(field,op,value)=>ref(path,true,[...filters,[field,op,value]],order,cap),
      orderBy:(field,direction)=>ref(path,true,filters,[field,direction],cap),
      limit:value=>ref(path,true,filters,order,value),
      create:async data=>{assert.equal(records.has(path),false);records.set(path,data);},
      set:async(data,options)=>records.set(path,options?.merge?{...records.get(path),...data}:data),
      update:async data=>{assert.equal(records.has(path),true);records.set(path,{...records.get(path),...data});},
      get:async()=>isCollection?query(path,filters,order,cap):snapshot(path)};
  }
  Object.defineProperty(db,"collection",{configurable:true,value:path=>ref(path,true)});
  Object.defineProperty(db,"runTransaction",{configurable:true,value:async callback=>{
    const staged=new Map(records);let wrote=false;
    const tx={delete:reference=>{wrote=true;staged.delete(reference.path);},get:async reference=>{assert.equal(wrote,false,"Firestore reads must precede all writes");return reference.isCollection?query(reference.path,reference.filters,reference.order,reference.cap):snapshot(reference.path);},
      create:(reference,data)=>{assert.equal(staged.has(reference.path),false,"create requires a new document");wrote=true;staged.set(reference.path,data);},
      set:(reference,data,options)=>{wrote=true;staged.set(reference.path,options?.merge?{...staged.get(reference.path),...data}:data);},
      update:(reference,data)=>{assert.equal(staged.has(reference.path),true,"update requires an existing document");wrote=true;staged.set(reference.path,{...staged.get(reference.path),...data});}};
    const result=await callback(tx);
    // Commit only actual changes. Replacing the entire Map would incorrectly
    // rewrite unchanged Firestore snapshots and mask unaffected-pair stability.
    for(const key of [...records.keys()])if(!staged.has(key))records.delete(key);
    for(const [key,value] of staged)if(!records.has(key)||records.get(key)!==value)
      records.set(key,value);
    return result;
  }});
  Object.defineProperty(db,"bulkWriter",{configurable:true,value:()=>({
    delete:reference=>records.delete(reference.path),
    set:(reference,data)=>records.set(reference.path,data),
    update:(reference,data)=>records.set(reference.path,{...records.get(reference.path),...data}),
    close:async()=>{},
  })});
  return records;
}
