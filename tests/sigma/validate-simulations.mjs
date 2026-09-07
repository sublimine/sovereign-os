import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..",".."),fixture=JSON.parse(fs.readFileSync(path.join(root,"tests/sigma/fixtures/simulations.json"),"utf8")),catalog=JSON.parse(fs.readFileSync(path.join(root,"config/sigma/event-catalog.json"),"utf8")),eventTypes=new Set(catalog.events.map(e=>e.type)),all=new Set(Array.from({length:40},(_,i)=>`sigma_${String(i+1).padStart(2,"0")}`)),covered=new Set(),errors=[];let eventCount=0;
if(fixture.simulations.length!==10)errors.push("simulation count !=10");
const byId=new Map(fixture.simulations.map(s=>[s.id,s]));for(const id of "ABCDEFGHIJ")if(!byId.has(id))errors.push(`missing ${id}`);
for(const s of fixture.simulations){const active=new Set(s.active),inactive=new Set(s.inactive),union=new Set([...active,...inactive]);if(union.size!==40||[...all].some(id=>!union.has(id)))errors.push(`${s.id} partition incomplete`);if([...active].some(id=>inactive.has(id)))errors.push(`${s.id} active/inactive overlap`);s.active.forEach(id=>covered.add(id));for(let i=0;i<s.events.length;i++){const e=s.events[i];eventCount++;if(e.seq!==i+1)errors.push(`${s.id} noncontiguous seq`);if(!eventTypes.has(e.type))errors.push(`${s.id} unknown event ${e.type}`);if(!active.has(e.actor))errors.push(`${s.id} inactive actor ${e.actor}`);}for(const a of s.material_artifacts){if(!active.has(a.producer))errors.push(`${s.id} inactive producer ${a.producer}`);if(a.certifiers.includes(a.producer))errors.push(`${s.id} self certification ${a.id}`);if(!a.certifiers.length)errors.push(`${s.id} no certifier ${a.id}`);}if(!s.blocks.length||!s.intelligence_result||!s.omega_handoff)errors.push(`${s.id} incomplete outcome`);}
if(covered.size!==40)errors.push(`coverage ${covered.size} !=40`);if(eventCount!==177)errors.push(`event count ${eventCount} !=177`);
const has=(id,type)=>byId.get(id).events.some(e=>e.type===type),order=(id,a,b)=>byId.get(id).events.find(e=>e.type===a).seq<byId.get(id).events.find(e=>e.type===b).seq;
for(const type of ["SOURCE_DEPENDENCY_FOUND","MEASUREMENT_INCOMPARABLE","PRODUCT_QUALITY_FAILED"])if(!has("A",type))errors.push(`A missing ${type}`);
for(const type of ["EVIDENCE_QUARANTINED","DECEPTION_SUSPECTED","COUNTERINTELLIGENCE_CASE_OPENED"])if(!has("D",type))errors.push(`D missing ${type}`);
if(!order("E","SOURCE_COMPROMISE_SUSPECTED","DEPENDENTS_INVALIDATED")||!order("E","DEPENDENTS_INVALIDATED","PRIOR_CONSUMER_NOTIFIED"))errors.push("E wrong retraction order");
if(!order("F","ENTITY_MERGED","ENTITY_SPLIT")||!order("F","ENTITY_SPLIT","DEPENDENTS_INVALIDATED"))errors.push("F wrong root correction order");
if(!has("G","EFFECTIVENESS_REVIEWED")||!has("G","CHANGE_EXPERIMENT_PROPOSED"))errors.push("G lacks controlled learning");
for(const id of ["H","J"])if(byId.get(id).active.length!==40)errors.push(`${id} must activate 40`);
for(const type of ["MISSION_CHECKPOINTED","BUDGET_EXHAUSTED","MISSION_RESUMED","WATCH_HANDOVER_CREATED"])if(!has("J",type))errors.push(`J missing ${type}`);
if(errors.length){console.error("SIGMA SIMULATION VALIDATION FAILED");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SIGMA SIMULATION VALIDATION PASSED");console.log(JSON.stringify({simulations:10,event_traces:eventCount,all_roles_covered:true,activation_partitions:true,no_self_certification:true}));

