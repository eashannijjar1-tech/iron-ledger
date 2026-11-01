"use strict";
/* ============ Iron Ledger — standalone app (Supabase backend) ============ */

/* ---------- constants ---------- */
const MUSCLES=["shoulders","chest","back","biceps","triceps","legs","core","other"];
const UNITS=["kg","lb","bw"];
const PROG=[["double","Double progression"],["linear","Linear (add load each time)"],["none","Just log it"]];
const ICON={
  log:'<path d="M6 3v6a6 6 0 0 0 12 0V3"/><path d="M4 3h4M16 3h4M2 21h20"/><path d="M9 21v-3a3 3 0 0 1 6 0v3"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  progress:'<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  library:'<path d="M4 5h16M4 12h16M4 19h10"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>',
  check:'<path d="M5 12l5 5L20 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  dumbbell:'<path d="M6.5 6.5l11 11"/><path d="M4 8l-1 1a2 2 0 0 0 0 3l0 0M8 4l1-1a2 2 0 0 1 3 0M20 16l1-1a2 2 0 0 0 0-3M16 20l-1 1a2 2 0 0 1-3 0"/>'
};
const svg=(p,cls="")=>`<svg viewBox="0 0 24 24" class="${cls}">${p}</svg>`;

/* ---------- seed library ---------- */
let _id=0; const nid=p=>p+"_"+Date.now().toString(36)+(++_id).toString(36)+Math.floor(Math.random()*1e4).toString(36);
function ex(name,muscle,equip,unit,lo,hi,step,prog,notes){return{id:nid("ex"),name,muscle,equip,unit,repLow:lo,repHigh:hi,step,prog:prog||"double",notes:notes||"",archived:false};}
function seedExercises(){return[
  ex("Dumbbell Shoulder Press","shoulders","Dumbbells","kg",6,10,2),
  ex("Lateral Raise","shoulders","Dumbbells","kg",12,18,1),
  ex("Rear-Delt Fly","shoulders","Dumbbells","kg",12,18,1),
  ex("Bench Press","chest","Barbell","kg",5,8,2.5),
  ex("Incline Dumbbell Press","chest","Dumbbells","kg",8,12,2),
  ex("Machine Chest Press","chest","Marcy multi-gym","kg",8,12,5),
  ex("Dips","chest","Dip bars","bw",6,12,0),
  ex("Dumbbell Chest Fly","chest","Dumbbells","kg",10,15,1),
  ex("Lat Pulldown","back","Marcy multi-gym","kg",8,12,5),
  ex("One-Arm Dumbbell Row","back","Dumbbells","kg",8,12,2),
  ex("Chest-Supported Row","back","Dumbbells","kg",8,12,2),
  ex("Dumbbell Curl","biceps","Dumbbells","kg",8,14,1),
  ex("Incline Dumbbell Curl","biceps","Dumbbells","kg",8,14,1),
  ex("Preacher Curl","biceps","Bench","kg",8,14,1),
  ex("Overhead Triceps Extension","triceps","Dumbbells","kg",10,15,1),
  ex("Dumbbell Skullcrusher","triceps","Dumbbells","kg",8,12,1),
  ex("Triceps Pushdown","triceps","Marcy multi-gym","kg",10,15,5),
  ex("Goblet Squat","legs","Dumbbells","kg",8,12,2),
  ex("Romanian Deadlift","legs","Barbell","kg",8,12,2.5),
  ex("Leg Extension","legs","Marcy multi-gym","kg",10,15,5),
  ex("Standing Calf Raise","legs","Dumbbells","kg",12,20,2),
  ex("Hanging Leg Raise","core","Dip bars","bw",8,15,0)
];}
function seedTemplates(list){
  const byName=n=>{const e=list.find(x=>x.name===n);return e?e.id:null;};
  const T=(exs)=>exs.map(([n,s])=>({exId:byName(n),sets:s})).filter(i=>i.exId);
  return[
    {id:nid("tpl"),name:"Upper A",items:T([["Dumbbell Shoulder Press",3],["Lateral Raise",3],["Incline Dumbbell Press",3],["Dumbbell Chest Fly",2],["Rear-Delt Fly",3],["Triceps Pushdown",3],["Overhead Triceps Extension",2]])},
    {id:nid("tpl"),name:"Lower A",items:T([["Goblet Squat",3],["Romanian Deadlift",3],["Leg Extension",3],["Standing Calf Raise",3],["Hanging Leg Raise",3]])},
    {id:nid("tpl"),name:"Upper B",items:T([["Lat Pulldown",3],["One-Arm Dumbbell Row",3],["Lateral Raise",3],["Rear-Delt Fly",3],["Incline Dumbbell Curl",3],["Preacher Curl",2],["Dumbbell Skullcrusher",3]])},
    {id:nid("tpl"),name:"Lower B",items:T([["Romanian Deadlift",3],["Goblet Squat",3],["Leg Extension",3],["Standing Calf Raise",3],["Hanging Leg Raise",3]])}
  ];
}
function defaultMeta(){const exs=seedExercises();return{exercises:exs,templates:seedTemplates(exs),bodyweight:[],profile:{name:""},settings:{defUnit:"kg"},seeded:true,updatedAt:Date.now()};}

/* ---------- state ---------- */
let state={meta:defaultMeta(),workouts:{},dirty:{}};
let supa=null, userId=null, userEmail=null;
let ui={tab:"log", exSel:null, histOpen:null, metric:null};

/* ---------- persistence (local cache, namespaced per user) ---------- */
function lsKey(){return "ironledger.v1."+(userId||"anon");}
function loadLocal(){if(!userId)return false;try{const raw=localStorage.getItem(lsKey());if(raw){const o=JSON.parse(raw);if(o.meta)state.meta=o.meta;state.workouts=o.workouts||{};state.dirty=o.dirty||{};return true;}}catch(e){}return false;}
function saveLocal(){if(!userId)return;try{localStorage.setItem(lsKey(),JSON.stringify({meta:state.meta,workouts:state.workouts,dirty:state.dirty}));}catch(e){}}
const clean=o=>JSON.parse(JSON.stringify(o));
function touchMeta(){state.meta.updatedAt=Date.now();state.dirty["meta"]=1;saveLocal();scheduleFlush();}
function touchWorkout(id){const w=state.workouts[id];if(w){w.updatedAt=Date.now();state.dirty["w:"+id]=1;}saveLocal();scheduleFlush();}

/* ---------- cloud (Supabase) ---------- */
let flushTimer=null, flushing=false;
function scheduleFlush(){if(!supa||!userId)return;clearTimeout(flushTimer);flushTimer=setTimeout(flush,500);}
async function flush(){
  if(!supa||!userId||flushing)return;
  flushing=true;
  try{
    for(const k of Object.keys(state.dirty)){
      try{
        if(k==="meta"){const{error}=await supa.from("app_meta").upsert({user_id:userId,data:clean(state.meta),updated_at:new Date().toISOString()});if(error)throw error;}
        else if(k.startsWith("w:")){const id=k.slice(2);const w=state.workouts[id];if(w){const{error}=await supa.from("workouts").upsert({id,user_id:userId,data:clean(w),updated_at:new Date().toISOString()});if(error)throw error;}}
        delete state.dirty[k];
      }catch(e){break;} // keep remaining dirty, retry later
    }
  }finally{flushing=false;saveLocal();setSync();}
}
async function cloudLoad(){
  try{
    const{data:md}=await supa.from("app_meta").select("data").eq("user_id",userId).maybeSingle();
    if(md&&md.data&&md.data.exercises){const r=md.data;if((r.updatedAt||0)>(state.meta.updatedAt||0))state.meta=r;else if((state.meta.updatedAt||0)>(r.updatedAt||0))state.dirty["meta"]=1;}
    else{state.dirty["meta"]=1;} // brand new user: push the seeded library
  }catch(e){}
  try{
    const{data:ws}=await supa.from("workouts").select("id,data").eq("user_id",userId);
    (ws||[]).forEach(row=>{const r=row.data;const cur=state.workouts[row.id];if(!cur||(r.updatedAt||0)>(cur.updatedAt||0))state.workouts[row.id]=r;});
  }catch(e){}
  saveLocal();
}
function setSync(){const el=document.getElementById("sync"),t=document.getElementById("synctxt");if(!el)return;
  if(!navigator.onLine){el.className="sync off";t.textContent="Offline";return;}
  if(supa&&userId){const pend=Object.keys(state.dirty).length;el.className="sync "+(pend?"local":"ok");t.textContent=pend?"Saving…":"Synced";}
  else{el.className="sync local";t.textContent="Local";}}

/* ---------- auth ---------- */
function configMissing(){return !window.SUPA_URL||!window.SUPA_ANON||/YOUR_/.test(window.SUPA_URL)||/YOUR_/.test(window.SUPA_ANON);}
async function boot(){
  const splash=document.getElementById("splash");
  if(configMissing()){splash.hidden=true;showAuth("config");return;}
  try{supa=window.supabase.createClient(window.SUPA_URL,window.SUPA_ANON);}catch(e){splash.hidden=true;showAuth("config");return;}
  let session=null;
  try{const{data}=await supa.auth.getSession();session=data.session;}catch(e){}
  splash.hidden=true;
  if(session)await onAuthed(session);else showAuth("login");
  supa.auth.onAuthStateChange((_ev,sess)=>{
    if(sess&&!userId)onAuthed(sess);
    else if(!sess&&userId){userId=null;userEmail=null;resetState();showAuth("login");}
  });
}
function resetState(){state={meta:defaultMeta(),workouts:{},dirty:{}};ui={tab:"log",exSel:null,histOpen:null,metric:null};}
async function onAuthed(session){
  userId=session.user.id;userEmail=session.user.email;
  resetState();loadLocal();
  document.getElementById("auth").hidden=true;
  document.getElementById("app").hidden=false;
  render();
  await cloudLoad();
  if(pendingName){state.meta.profile=state.meta.profile||{};if(!state.meta.profile.name){state.meta.profile.name=pendingName;touchMeta();}pendingName="";}
  render();flush();
}
function authHTML(mode){
  if(mode==="config"){
    return `<div class="authcard"><div class="authbrand"><span class="mk"></span>Iron Ledger</div>
      <div class="authmsg err" style="display:block">Not connected yet. Add your Supabase Project URL and anon key to <b>config.js</b>, then reload.</div></div>`;
  }
  const signup=mode==="signup";
  return `<div class="authcard">
    <div class="authbrand"><span class="mk"></span>Iron Ledger</div>
    <div class="authsub">${signup?"Create an account to start tracking.":"Log in to your training log."}</div>
    <div class="authmsg" id="authmsg"></div>
    <form id="authform">
      ${signup?`<div class="formrow"><label>Name</label><input class="inp" id="a_name" autocomplete="name" placeholder="What your mates call you"></div>`:""}
      <div class="formrow"><label>Email</label><input class="inp" id="a_email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com"></div>
      <div class="formrow"><label>Password</label><input class="inp" id="a_pass" type="password" autocomplete="${signup?"new-password":"current-password"}" placeholder="${signup?"At least 6 characters":"Your password"}"></div>
      <button class="btn primary block big-cta" id="a_submit" type="submit" style="margin-top:14px">${signup?"Sign up":"Log in"}</button>
    </form>
    <div class="authtoggle">${signup?"Already have an account? ":"New here? "}<button type="button" id="a_toggle">${signup?"Log in":"Create one"}</button></div>
  </div>`;
}
function showAuth(mode){
  const a=document.getElementById("auth");a.hidden=false;a.innerHTML=authHTML(mode);
  document.getElementById("app").hidden=true;
  if(mode==="config")return;
  document.getElementById("a_toggle").onclick=()=>showAuth(mode==="signup"?"login":"signup");
  document.getElementById("authform").onsubmit=ev=>{ev.preventDefault();doAuth(mode);};
}
function authMsg(text,ok){const m=document.getElementById("authmsg");if(!m)return;m.textContent=text;m.className="authmsg "+(ok?"ok":"err");}
async function doAuth(mode){
  const email=val("a_email"),pass=document.getElementById("a_pass").value;
  const btn=document.getElementById("a_submit");
  if(!email||!pass){authMsg("Enter your email and password.");return;}
  if(mode==="signup"&&pass.length<6){authMsg("Password needs at least 6 characters.");return;}
  btn.disabled=true;btn.textContent=mode==="signup"?"Creating…":"Logging in…";
  try{
    if(mode==="signup"){
      const name=val("a_name");
      const{data,error}=await supa.auth.signUp({email,password:pass});
      if(error){authMsg(error.message);}
      else if(data.session){pendingName=name;/* onAuthStateChange handles the rest */}
      else{authMsg("Account made — check your email to confirm, then log in.",true);}
    }else{
      const{error}=await supa.auth.signInWithPassword({email,password:pass});
      if(error)authMsg(error.message);
    }
  }catch(e){authMsg("Something went wrong — try again.");}
  finally{btn.disabled=false;btn.textContent=mode==="signup"?"Sign up":"Log in";}
}
let pendingName="";
async function doLogout(){closeModal();try{await supa.auth.signOut();}catch(e){}}

/* ---------- date helpers ---------- */
const todayISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
function parseISO(s){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);}
function fmtDate(s){const d=parseISO(s);return d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});}
function daysAgo(s){const ms=parseISO(todayISO())-parseISO(s);const n=Math.round(ms/864e5);if(n<=0)return"today";if(n===1)return"yesterday";if(n<7)return n+" days ago";const w=Math.round(n/7);return w+(w===1?" week ago":" weeks ago");}
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

/* ---------- data helpers ---------- */
const exById=id=>state.meta.exercises.find(e=>e.id===id);
const activeWorkouts=()=>Object.values(state.workouts).filter(w=>!w.deleted);
const completed=()=>activeWorkouts().filter(w=>w.status==="completed").sort((a,b)=>b.date<a.date?-1:1);
const inProgress=()=>activeWorkouts().find(w=>w.status==="in_progress");
function unitLabel(u){return u==="bw"?"BW":u;}
function e1rm(w,r){if(!w||!r)return 0;return w*(1+r/30);}
const round=(n,p=1)=>Math.round(n*Math.pow(10,p))/Math.pow(10,p);
function workSummary(entry){
  const done=entry.sets.filter(s=>s.done&&s.r);
  if(!done.length)return null;
  const unit=entry.unit;
  if(unit==="bw"){const reps=done.map(s=>s.r);return{text:reps.join(", ")+" reps",best:Math.max(...reps),e1rm:0};}
  const reps=done.map(s=>s.r);const w=done.map(s=>s.w||0);const topW=Math.max(...w);
  const best=Math.max(...done.map(s=>e1rm(s.w,s.r)));
  const parts=done.map(s=>(s.w||0)+"×"+s.r);
  return{text:topW+unitLabel(unit)+"  "+reps.join("/")+" reps",compact:parts.join(", "),best,topW};
}
function lastSession(exId,beforeDate){
  const ws=completed().filter(w=>w.entries.some(e=>e.exId===exId&&e.sets.some(s=>s.done)));
  for(const w of ws){if(beforeDate&&w.date>=beforeDate)continue;return{workout:w,entry:w.entries.find(e=>e.exId===exId)};}
  return null;
}
function suggestion(exId){
  const e=exById(exId);if(!e||e.prog==="none")return null;
  const last=lastSession(exId);
  if(!last){return e.unit==="bw"?`First session — aim for ${e.repLow}–${e.repHigh} controlled reps.`:`First session — pick a load you control for ${e.repLow}–${e.repHigh} reps.`;}
  const done=last.entry.sets.filter(s=>s.done&&s.r);
  if(!done.length)return null;
  if(e.unit==="bw"){
    const allTop=done.every(s=>s.r>=e.repHigh);
    return allTop?`Last time you hit ${e.repHigh}+ on every set — add a set or load next.`:`Build toward ${e.repHigh} reps per set (last: ${done.map(s=>s.r).join(", ")}).`;
  }
  const topW=Math.max(...done.map(s=>s.w||0));
  const atTop=done.filter(s=>(s.w||0)===topW);
  const allHit=atTop.length&&atTop.every(s=>s.r>=e.repHigh);
  if(e.prog==="linear"){
    const hit=done.every(s=>s.r>=e.repLow);
    return hit?`Add ${e.step}${e.unit}: try ${round(topW+e.step)}${e.unit} this session.`:`Repeat ${topW}${e.unit} and hold the reps.`;
  }
  if(allHit)return`All top sets reached ${e.repHigh} — add load: ${round(topW+e.step)}${e.unit} next.`;
  return`Stay at ${topW}${e.unit}, chase ${e.repHigh} reps on every set.`;
}

/* ---------- toast & modal ---------- */
let toastT=null;
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),1800);}
function openModal(html){const m=document.getElementById("modal");document.getElementById("sheet").innerHTML=html;m.classList.add("open");}
function closeModal(){document.getElementById("modal").classList.remove("open");}
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal();});

/* ---------- tabs ---------- */
const TABS=[["log","Log",ICON.log],["history","History",ICON.history],["progress","Progress",ICON.progress],["library","Library",ICON.library]];
function renderTabs(){document.getElementById("tabs").innerHTML=TABS.map(([k,l,ic])=>
  `<button class="tab ${ui.tab===k?"active":""}" data-act="tab" data-k="${k}">${svg(ic)}<span>${l}</span></button>`).join("");}

/* ---------- LOG VIEW ---------- */
function viewLog(){
  const w=inProgress();
  if(w)return logActive(w);
  const last=completed()[0];
  const wk=sessionsThisWeek();
  let html=`<section class="block">
    <div class="spread"><div><h1 style="font-size:26px">Hey ${esc(greetName())}</h1><div class="muted" style="font-size:12.5px">${last?"Ready for the next one?":"Ready when you are — log your first session."}</div></div><span class="eyebrow">${fmtDate(todayISO())}</span></div>
    <button class="btn primary big-cta block" data-act="startEmpty">${svg(ICON.plus)} New blank workout</button>`;
  if(state.meta.templates.length){
    html+=`<div class="eyebrow" style="margin-top:4px">From a template</div><div class="list">`;
    html+=state.meta.templates.map(t=>`<button class="item" data-act="startTpl" data-id="${t.id}">
      <div class="grow"><div class="t">${esc(t.name)}</div><div class="s">${t.items.length} exercises</div></div><span class="go">${svg(ICON.plus)}</span></button>`).join("");
    html+=`</div>`;
  }
  html+=`<div class="tiles" style="margin-top:6px">
    <div class="tile"><div class="v num">${wk}</div><div class="l">This week</div></div>
    <div class="tile"><div class="v num">${completed().length}</div><div class="l">Sessions</div></div>
    <div class="tile"><div class="v num">${last?daysAgo(last.date).replace(" ago",""):"—"}</div><div class="l">Since last</div></div>
  </div>`;
  if(last){
    html+=`<div class="eyebrow" style="margin-top:6px">Last session · ${fmtDate(last.date)}</div>
    <button class="item" data-act="openHist" data-id="${last.id}"><div class="grow"><div class="t">${esc(last.label||"Workout")}</div><div class="s">${last.entries.filter(e=>!e.skipped).length} exercises · ${totalSets(last)} sets logged</div></div><span class="pill done">done</span></button>`;
  } else {
    html+=`<div class="empty card"><div>${svg(ICON.dumbbell)}</div><div class="big">No sessions yet</div><div>Start your first workout to set the baseline. Every session after shows what you did last time, right where you log.</div></div>`;
  }
  html+=`</section>`;
  return html;
}
function logActive(w){
  let html=`<section class="block">
    <div class="spread">
      <div><h1 style="font-size:24px">${esc(w.label||"Workout")}</h1><div class="muted" style="font-size:12.5px">${fmtDate(w.date)} · in progress</div></div>
      <button class="iconbtn" data-act="editWorkoutMeta" data-id="${w.id}">${svg(ICON.edit)}</button>
    </div>`;
  if(!w.entries.length){
    html+=`<div class="empty card"><div>${svg(ICON.dumbbell)}</div><div class="big">Add your first exercise</div><div>Pick a movement — I'll show last time's numbers so you know what to beat.</div></div>`;
  }
  w.entries.forEach((en,ei)=>{html+=entryCard(w,en,ei);});
  html+=`<button class="btn ghost block" data-act="addEx" data-id="${w.id}">${svg(ICON.plus)} Add exercise</button>
    <div class="row" style="margin-top:6px">
      <button class="btn grow" data-act="saveLater" data-id="${w.id}">Pause & finish later</button>
      <button class="btn primary grow" data-act="finish" data-id="${w.id}">${svg(ICON.check)} Finish</button>
    </div>
    <button class="btn danger sm" data-act="discard" data-id="${w.id}" style="align-self:center;margin-top:2px">Discard this session</button>
  </section>`;
  return html;
}
function entryCard(w,en,ei){
  const e=exById(en.exId);const unit=en.unit;
  const last=lastSession(en.exId,w.date);
  let lastTxt="First time logging this";
  if(last){const sm=workSummary(last.entry);if(sm)lastTxt=`<b>${sm.compact||sm.text}</b> · ${daysAgo(last.workout.date)}`;}
  const sug=en.skipped?null:suggestion(en.exId);
  let rows="";
  en.sets.forEach((s,si)=>{
    rows+=`<div class="setrow ${s.done?"on":""} ${s.warm?"warm":""}" data-w="${w.id}" data-e="${ei}" data-s="${si}">
      <div class="sn">${s.warm?"W":(si+1-en.sets.slice(0,si).filter(x=>x.warm).length)}</div>
      ${unit==="bw"?`<div class="field" style="grid-column:2/4"><span class="u" style="padding-left:8px">reps</span><button data-act="step" data-f="r" data-d="-1">–</button><input class="num" inputmode="numeric" data-f="r" value="${s.r??""}" placeholder="0"><button data-act="step" data-f="r" data-d="1">+</button></div>`
      :`<div class="field"><button data-act="step" data-f="w" data-d="-1">–</button><input class="num" inputmode="decimal" data-f="w" value="${s.w??""}" placeholder="${last&&last.entry.sets[si]?(last.entry.sets[si].w??""):"0"}"><span class="u">${unitLabel(unit)}</span></div>
      <div class="field"><button data-act="step" data-f="r" data-d="-1">–</button><input class="num" inputmode="numeric" data-f="r" value="${s.r??""}" placeholder="${last&&last.entry.sets[si]?(last.entry.sets[si].r??""):"0"}"><span class="u">reps</span></div>`}
      <button class="chk" data-act="toggleSet">${svg(ICON.check)}</button>
    </div>`;
  });
  return `<div class="entry ${en.skipped?"skipped":""}">
    <div class="entry-h">
      <div class="grow"><div class="nm">${esc(e?e.name:en.name)}</div><div class="lasttime">${lastTxt}</div></div>
      <button class="iconbtn" data-act="exMenu" data-id="${w.id}" data-e="${ei}">${svg(ICON.edit)}</button>
    </div>
    ${sug?`<div class="hint">${svg(ICON.bulb)}<div>${sug}</div></div>`:""}
    ${en.skipped?`<div class="pad muted" style="padding-top:0">Marked skipped. <button class="btn sm" data-act="unskip" data-id="${w.id}" data-e="${ei}">Undo</button></div>`:
      `<div class="collabel">${unit==="bw"?'<span></span><span style="grid-column:2/4">Reps</span><span></span>':'<span></span><span>Weight</span><span>Reps</span><span></span>'}</div>
      ${rows}
      <div class="entry-actions">
        <button class="btn sm grow" data-act="addSet" data-id="${w.id}" data-e="${ei}">${svg(ICON.plus)} Set</button>
        ${last?`<button class="btn sm" data-act="repeatLast" data-id="${w.id}" data-e="${ei}">Copy last time</button>`:""}
      </div>`}
  </div>`;
}
function totalSets(w){return w.entries.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);}
function sessionsThisWeek(){const now=parseISO(todayISO());const day=(now.getDay()+6)%7;const monday=new Date(now);monday.setDate(now.getDate()-day);const mISO=iso(monday);return completed().filter(w=>w.date>=mISO).length;}

/* ---------- HISTORY VIEW ---------- */
function viewHistory(){
  if(ui.histOpen)return histDetail(ui.histOpen);
  const ws=activeWorkouts().slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.createdAt||0)-(a.createdAt||0));
  if(!ws.length)return `<section class="block"><h1 style="font-size:26px">History</h1><div class="empty card"><div>${svg(ICON.history)}</div><div class="big">Nothing logged yet</div><div>Finished and planned sessions will stack up here, newest first.</div></div></section>`;
  let html=`<section class="block"><div class="spread"><h1 style="font-size:26px">History</h1><button class="btn sm ghost" data-act="planWorkout">Plan one</button></div><div class="list">`;
  let curWeek="";
  ws.forEach(w=>{
    const wl=weekLabel(w.date);
    if(wl!==curWeek){curWeek=wl;html+=`<div class="weekhead">${wl}</div>`;}
    const st=w.status==="completed"?(allDone(w)?`<span class="pill done">done</span>`:`<span class="pill partial">partial</span>`):w.status==="planned"?`<span class="pill planned">planned</span>`:`<span class="pill partial">in progress</span>`;
    html+=`<button class="item" data-act="openHist" data-id="${w.id}"><div class="grow"><div class="t">${esc(w.label||"Workout")}</div><div class="s">${fmtDate(w.date)} · ${w.entries.filter(e=>!e.skipped).length} exercises · ${totalSets(w)} sets</div></div>${st}</button>`;
  });
  html+=`</div></section>`;
  return html;
}
function allDone(w){const ent=w.entries.filter(e=>!e.skipped);if(!ent.length)return false;return ent.every(e=>e.sets.length&&e.sets.every(s=>s.done));}
function weekLabel(isoStr){const d=parseISO(isoStr),now=parseISO(todayISO());const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);const diff=Math.floor((mon-d)/864e5);if(d>=mon)return"This week";if(diff<7)return"Last week";return d.toLocaleDateString(undefined,{month:"long",year:"numeric"});}
function histDetail(id){
  const w=state.workouts[id];if(!w){ui.histOpen=null;return viewHistory();}
  let html=`<section class="block">
    <button class="btn sm ghost" data-act="closeHist" style="align-self:flex-start">${svg(ICON.back)} Back</button>
    <div class="spread"><div><h1 style="font-size:24px">${esc(w.label||"Workout")}</h1><div class="muted" style="font-size:12.5px">${fmtDate(w.date)} · ${w.status}</div></div>
    <button class="iconbtn" data-act="editWorkoutMeta" data-id="${w.id}">${svg(ICON.edit)}</button></div>`;
  if(w.status==="planned")html+=`<button class="btn primary block" data-act="startPlanned" data-id="${w.id}">${svg(ICON.log)} Start this session</button>`;
  else if(w.status==="in_progress")html+=`<button class="btn primary block" data-act="resume" data-id="${w.id}">Resume logging</button>`;
  if(w.notes)html+=`<div class="card pad muted" style="font-size:13px">${esc(w.notes)}</div>`;
  w.entries.forEach(en=>{
    const e=exById(en.exId);const sm=workSummary(en);
    html+=`<div class="entry"><div class="entry-h"><div class="grow"><div class="nm">${esc(e?e.name:en.name)}</div>
      <div class="lasttime">${en.skipped?"Skipped":(sm?(sm.compact||sm.text):"No sets completed")}</div></div></div></div>`;
  });
  html+=`<button class="btn danger sm" data-act="delWorkout" data-id="${w.id}" style="align-self:center">Delete session</button></section>`;
  return html;
}

/* ---------- PROGRESS VIEW ---------- */
function viewProgress(){
  const exs=state.meta.exercises.filter(e=>!e.archived);
  const withData=exs.filter(e=>completed().some(w=>w.entries.some(en=>en.exId===e.id&&en.sets.some(s=>s.done))));
  let html=`<section class="block"><h1 style="font-size:26px">Progress</h1>`;
  if(!withData.length){
    html+=`<div class="empty card"><div>${svg(ICON.progress)}</div><div class="big">No data to chart yet</div><div>Log two or three sessions and your strength curve for each lift shows up here — weight, reps and estimated 1-rep max over time.</div></div>`;
    html+=consistencyCard();html+=bodyweightCard();return html+`</section>`;
  }
  if(!ui.exSel||!withData.some(e=>e.id===ui.exSel))ui.exSel=withData[0].id;
  html+=`<div class="chips">`+withData.map(e=>`<button class="chip ${ui.exSel===e.id?"active":""}" data-act="selEx" data-id="${e.id}">${esc(e.name)}</button>`).join("")+`</div>`;
  html+=exerciseProgress(ui.exSel);
  html+=consistencyCard();html+=bodyweightCard();
  return html+`</section>`;
}
function exerciseProgress(exId){
  const e=exById(exId);const bw=e.unit==="bw";
  const avail=bw?["best","volume"]:["best","e1rm","volume"];
  if(!avail.includes(ui.metric))ui.metric=bw?"best":(e.repHigh<=12?"e1rm":"volume");
  const metric=ui.metric;
  const pts=completed().slice().reverse().map(w=>{
    const en=w.entries.find(x=>x.exId===exId&&x.sets.some(s=>s.done));if(!en)return null;
    const done=en.sets.filter(s=>s.done&&s.r);if(!done.length)return null;
    return{date:w.date,
      best:bw?Math.max(...done.map(s=>s.r)):Math.max(...done.map(s=>s.w||0)),
      e1rm:Math.max(...done.map(s=>e1rm(s.w,s.r))),
      volume:done.reduce((a,s)=>a+(bw?s.r:(s.w||0)*s.r),0)};
  }).filter(Boolean);
  if(!pts.length)return"";
  const valOf=p=>p[metric];
  const META={
    best:{lab:bw?"Best-set reps":"Best set",axis:bw?"Best-set reps over time":"Top working weight over time"},
    e1rm:{lab:"Est. 1RM",axis:"Estimated 1-rep max over time"},
    volume:{lab:"Session volume",axis:bw?"Total reps per session":"Session volume (weight × reps) over time"}
  };
  const unit=bw?"reps":e.unit;
  const fmt=v=>metric==="volume"?Math.round(v).toLocaleString():round(v);
  const first=valOf(pts[0]),last=valOf(pts[pts.length-1]),delta=last-first,peak=Math.max(...pts.map(valOf));
  const seg=`<div class="seg">${avail.map(m=>`<button data-act="metric" data-m="${m}" class="${metric===m?"on":""}">${m==="best"?(bw?"Best reps":"Best set"):m==="e1rm"?"Est. 1RM":"Volume"}</button>`).join("")}</div>`;
  const u=`<span style="font-size:13px" class="muted"> ${unit}</span>`;
  const tiles=`<div class="tiles">
    <div class="tile"><div class="v num">${fmt(last)}${u}</div><div class="l">Latest</div></div>
    <div class="tile"><div class="v num">${fmt(peak)}${u}</div><div class="l">Best</div></div>
    <div class="tile"><div class="v num" style="color:${delta>=0?"var(--up)":"var(--down)"}">${delta>=0?"+":""}${fmt(delta)}</div><div class="l">Since start</div></div>
  </div>`;
  const sug=suggestion(exId);
  return `<div class="spread wrap" style="margin-top:2px"><div class="eyebrow">${META[metric].lab}</div>${seg}</div>`
    +tiles+lineChart(pts.map(p=>({date:p.date,v:valOf(p)})),META[metric].axis)
    +(sug?`<div class="hint">${svg(ICON.bulb)}<div><b>Next session:</b> ${sug}</div></div>`:"");
}
function lineChart(points,axisLabel){
  const W=680,H=220,pL=48,pR=14,pT=16,pB=30;
  const series=points.map(p=>p.v),n=points.length;
  let mn=Math.min(...series),mx=Math.max(...series);
  if(mn===mx){mn=mn*0.9;mx=mx*1.1||1;}
  const padv=(mx-mn)*0.15;mn=Math.max(0,mn-padv);mx=mx+padv;
  const x=i=>pL+(n<=1?(W-pL-pR)/2:i*(W-pL-pR)/(n-1));
  const y=v=>pT+(1-(v-mn)/((mx-mn)||1))*(H-pT-pB);
  const fy=v=>v>=1000?(Math.round(v/100)/10)+"k":round(v);
  let grid="",labels="";
  for(let g=0;g<=3;g++){const v=mn+(mx-mn)*g/3;const yy=y(v);grid+=`<line x1="${pL}" y1="${yy}" x2="${W-pR}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>`;labels+=`<text x="${pL-7}" y="${yy+4}" text-anchor="end" font-size="11">${fy(v)}</text>`;}
  const path=points.map((p,i)=>(i?"L":"M")+x(i)+" "+y(series[i])).join(" ");
  const area=`M${x(0)} ${y(series[0])} `+points.map((p,i)=>`L${x(i)} ${y(series[i])}`).join(" ")+` L${x(n-1)} ${H-pB} L${x(0)} ${H-pB} Z`;
  let dots="";points.forEach((p,i)=>{dots+=`<circle cx="${x(i)}" cy="${y(series[i])}" r="${i===n-1?4.5:3}" fill="var(--accent)"/>`;});
  let xlab="";[...new Set(n<=1?[0]:[0,Math.floor((n-1)/2),n-1])].forEach(i=>{const d=parseISO(points[i].date);xlab+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="11">${d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</text>`;});
  return `<div class="card pad chartwrap"><div class="eyebrow">${axisLabel}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${axisLabel}">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#g)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}${xlab}
    </svg></div>`;
}
function consistencyCard(){
  const weeks=[];const now=parseISO(todayISO());const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);
  for(let i=7;i>=0;i--){const s=new Date(mon);s.setDate(mon.getDate()-i*7);const e=new Date(s);e.setDate(s.getDate()+7);const sI=iso(s),eI=iso(e);const c=completed().filter(w=>w.date>=sI&&w.date<eI).length;weeks.push({label:(s.getMonth()+1)+"/"+s.getDate(),c});}
  const mx=Math.max(3,...weeks.map(w=>w.c));
  const bars=weeks.map(w=>`<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px"><div style="width:100%;max-width:26px;height:${6+w.c/mx*58}px;background:${w.c?"var(--accent)":"var(--surface-2)"};border-radius:4px"></div><div style="font-size:9.5px;color:var(--muted)">${w.label}</div></div>`).join("");
  return `<div class="card pad"><div class="eyebrow">Sessions per week · last 8</div><div style="display:flex;gap:6px;align-items:flex-end;height:80px;margin-top:8px">${bars}</div></div>`;
}
function bodyweightCard(){
  const bwl=(state.meta.bodyweight||[]).slice().sort((a,b)=>a.date<b.date?-1:1);
  const latest=bwl[bwl.length-1];
  let spark="";
  if(bwl.length>1){const vs=bwl.map(b=>b.kg);let mn=Math.min(...vs),mx=Math.max(...vs);if(mn===mx){mn-=1;mx+=1;}const W=300,H=40;const pts=bwl.map((b,i)=>`${8+i*(W-16)/(bwl.length-1)},${4+(1-(b.kg-mn)/(mx-mn))*(H-8)}`).join(" ");spark=`<svg viewBox="0 0 ${W} ${H}" style="width:120px;height:40px"><polyline points="${pts}" fill="none" stroke="var(--planned)" stroke-width="2.5"/></svg>`;}
  return `<div class="card pad"><div class="spread"><div class="eyebrow">Bodyweight <span class="muted" style="text-transform:none;letter-spacing:0">(optional)</span></div><button class="btn sm" data-act="addBw">${svg(ICON.plus)} Log</button></div>
    <div class="spread" style="margin-top:8px">${latest?`<div class="num" style="font-family:var(--font-display);font-size:26px;font-weight:700">${latest.kg} <span style="font-size:13px" class="muted">kg · ${daysAgo(latest.date)}</span></div>`:`<div class="muted" style="font-size:13px">Tracking bodyweight is optional. Log it whenever you weigh in to see the trend beside your lifts.</div>`}${spark}</div></div>`;
}

/* ---------- LIBRARY VIEW ---------- */
function viewLibrary(){
  let html=`<section class="block"><h1 style="font-size:26px">Library</h1>`;
  html+=`<div class="spread"><div class="eyebrow">Templates</div><button class="btn sm" data-act="newTpl">${svg(ICON.plus)} New</button></div><div class="list">`;
  if(!state.meta.templates.length)html+=`<div class="muted" style="font-size:13px">No templates. Build one to start sessions in a tap.</div>`;
  html+=state.meta.templates.map(t=>`<button class="item" data-act="editTpl" data-id="${t.id}"><div class="grow"><div class="t">${esc(t.name)}</div><div class="s">${t.items.length} exercises</div></div><span class="go">${svg(ICON.edit)}</span></button>`).join("");
  html+=`</div><hr class="sep">`;
  html+=`<div class="spread"><div class="eyebrow">Exercises</div><button class="btn sm" data-act="newEx">${svg(ICON.plus)} New</button></div>`;
  const active=state.meta.exercises.filter(e=>!e.archived);
  MUSCLES.forEach(m=>{const g=active.filter(e=>e.muscle===m);if(!g.length)return;
    html+=`<div class="weekhead">${m}</div><div class="list">`;
    html+=g.map(e=>`<button class="item" data-act="editEx" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.equip||"")} · ${e.repLow}–${e.repHigh} reps · ${unitLabel(e.unit)}${e.unit!=="bw"?" +"+e.step:""}</div></div><span class="pill">${PROG.find(p=>p[0]===e.prog)[1].split(" ")[0]}</span></button>`).join("");
    html+=`</div>`;
  });
  const arch=state.meta.exercises.filter(e=>e.archived);
  if(arch.length)html+=`<button class="btn ghost sm" data-act="showArch" style="align-self:flex-start;margin-top:8px">${arch.length} archived</button>`;
  html+=`<hr class="sep"><div class="eyebrow">Account</div>
    <div class="card pad"><div class="spread"><div class="grow" style="min-width:0"><div style="font-family:var(--font-display);font-weight:600">${esc(state.meta.profile&&state.meta.profile.name?state.meta.profile.name:"You")}</div><div class="muted" style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis">${esc(userEmail||"")}</div></div><button class="btn sm ghost" data-act="editName">Name</button></div>
      <div class="helptext" id="syncline"></div>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="exportData">Export backup</button><button class="btn sm" data-act="importData">Import</button><button class="btn sm" data-act="logout">Log out</button></div>
    </div>
    <button class="btn danger sm" data-act="resetData" style="align-self:flex-start">Reset all my data</button>
    </section>`;
  return html;
}

/* ---------- render ---------- */
function esc(s){return(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function greetName(){const n=((state.meta.profile&&state.meta.profile.name)||"").trim();if(n)return n.split(/\s+/)[0];return "there";}
function render(){
  if(!userId)return;
  renderTabs();
  const v=document.getElementById("view");
  if(ui.tab==="log")v.innerHTML=viewLog();
  else if(ui.tab==="history")v.innerHTML=viewHistory();
  else if(ui.tab==="progress")v.innerHTML=viewProgress();
  else v.innerHTML=viewLibrary();
  const sl=document.getElementById("syncline");
  if(sl)sl.textContent=navigator.onLine?"Synced to your account — opens with your history on any device you log into.":"Offline — saved on this device and will sync when you're back online.";
  setSync();
}

/* ---------- actions ---------- */
function newWorkout(label,entries,status){const id=nid("w");state.workouts[id]={id,date:todayISO(),label:label||"",status:status||"in_progress",notes:"",entries:entries||[],createdAt:Date.now(),updatedAt:Date.now(),deleted:false};return id;}
function entryFor(exId,nsets){const e=exById(exId);const sets=[];for(let i=0;i<(nsets||3);i++){sets.push({w:null,r:null,done:false});}return{exId,name:e?e.name:"",unit:e?e.unit:"kg",sets,skipped:false};}

const actions={
  tab(el){ui.tab=el.dataset.k;ui.histOpen=null;render();},
  startEmpty(){newWorkout("Workout "+fmtDate(todayISO()));ui.tab="log";startSaved();},
  startTpl(el){const t=state.meta.templates.find(x=>x.id===el.dataset.id);if(!t)return;const entries=t.items.map(it=>entryFor(it.exId,it.sets)).filter(e=>e.name);newWorkout(t.name,entries);ui.tab="log";startSaved();},
  startPlanned(el){const w=state.workouts[el.dataset.id];if(!w)return;w.status="in_progress";w.date=todayISO();ui.tab="log";ui.histOpen=null;touchWorkout(w.id);render();},
  resume(){ui.tab="log";ui.histOpen=null;render();},
  addEx(el){openExPicker(el.dataset.id);},
  addSet(el){const w=state.workouts[el.dataset.id];const en=w.entries[+el.dataset.e];const prev=en.sets.filter(s=>!s.warm).slice(-1)[0];en.sets.push({w:prev?prev.w:null,r:prev?prev.r:null,done:false});touchWorkout(w.id);render();},
  repeatLast(el){const w=state.workouts[el.dataset.id];const en=w.entries[+el.dataset.e];const last=lastSession(en.exId,w.date);if(!last)return;en.sets=last.entry.sets.map(s=>({w:s.w,r:s.r,done:false,warm:s.warm}));touchWorkout(w.id);render();toast("Copied last time");},
  toggleSet(el){const row=el.closest(".setrow");const w=state.workouts[row.dataset.w];const en=w.entries[+row.dataset.e];const s=en.sets[+row.dataset.s];s.done=!s.done;if(s.done&&s.w==null){const ph=row.querySelector('input[data-f="w"]');if(ph&&ph.placeholder&&ph.placeholder!=="0")s.w=parseFloat(ph.placeholder);}if(s.done&&s.r==null){const ph=row.querySelector('input[data-f="r"]');if(ph&&ph.placeholder&&ph.placeholder!=="0")s.r=parseInt(ph.placeholder);}touchWorkout(w.id);render();},
  step(el){const row=el.closest(".setrow");const w=state.workouts[row.dataset.w];const en=w.entries[+row.dataset.e];const s=en.sets[+row.dataset.s];const f=el.dataset.f;const dir=+el.dataset.d;const e=exById(en.exId);if(f==="w"){const step=e?e.step||2.5:2.5;s.w=Math.max(0,round((s.w||0)+dir*step,2));}else{s.r=Math.max(0,(s.r||0)+dir);}touchWorkout(w.id);render();},
  saveLater(el){const w=state.workouts[el.dataset.id];w.status="in_progress";touchWorkout(w.id);toast("Saved — resume from History");render();},
  finish(el){const w=state.workouts[el.dataset.id];const anyDone=w.entries.some(e=>e.sets.some(s=>s.done));
    w.entries.forEach(e=>{e.sets=e.sets.filter(s=>s.done||s.w||s.r);});
    w.entries=w.entries.filter(e=>e.sets.length||e.skipped);
    w.status="completed";touchWorkout(w.id);ui.tab="log";render();toast(anyDone?"Session logged ✓":"Session saved");},
  discard(el){confirmModal("Discard this session?","Nothing will be saved.",()=>{const w=state.workouts[el.dataset.id];w.deleted=true;touchWorkout(w.id);render();});},
  openHist(el){ui.tab="history";ui.histOpen=el.dataset.id;render();},
  closeHist(){ui.histOpen=null;render();},
  delWorkout(el){confirmModal("Delete this session?","This removes it from your history and charts.",()=>{const w=state.workouts[el.dataset.id];w.deleted=true;touchWorkout(w.id);ui.histOpen=null;render();});},
  planWorkout(){openPlan();},
  selEx(el){ui.exSel=el.dataset.id;render();},
  metric(el){ui.metric=el.dataset.m;render();},
  editWorkoutMeta(el){openWorkoutMeta(el.dataset.id);},
  exMenu(el){openExMenu(el.dataset.id,+el.dataset.e);},
  unskip(el){const w=state.workouts[el.dataset.id];w.entries[+el.dataset.e].skipped=false;touchWorkout(w.id);render();},
  newEx(){openExEditor(null);},
  editEx(el){openExEditor(el.dataset.id);},
  newTpl(){openTplEditor(null);},
  editTpl(el){openTplEditor(el.dataset.id);},
  addBw(){openBw();},
  showArch(){openArchive();},
  editName(){openName();},
  logout(){confirmModal("Log out?","Your data stays saved to your account. You'll need your email and password to get back in.",doLogout);},
  exportData(){doExport();},
  importData(){doImport();},
  resetData(){confirmModal("Reset everything?","Deletes all your sessions and restores the starter library. Export a backup first if you might want it.",()=>{state.meta=defaultMeta();state.workouts={};state.dirty={meta:1};saveLocal();scheduleFlush();ui.histOpen=null;render();toast("Reset");});}
};
function startSaved(){const w=inProgress();if(w)touchWorkout(w.id);render();}

/* delegation */
document.getElementById("app").addEventListener("click",e=>{
  const b=e.target.closest("[data-act]");if(!b)return;
  const a=actions[b.dataset.act];if(a){e.preventDefault();a(b);}
});
document.getElementById("app").addEventListener("change",e=>{
  const inp=e.target;if(!inp.matches(".setrow input"))return;
  const row=inp.closest(".setrow");const w=state.workouts[row.dataset.w];if(!w)return;const en=w.entries[+row.dataset.e];const s=en.sets[+row.dataset.s];const f=inp.dataset.f;const v=inp.value.trim();
  if(f==="w")s.w=v===""?null:Math.max(0,parseFloat(v)||0);
  else s.r=v===""?null:Math.max(0,parseInt(v)||0);
  touchWorkout(w.id);
});
document.getElementById("app").addEventListener("focusout",()=>{if(window._pendRender){window._pendRender=0;setTimeout(()=>{render();},50);}});

/* ---------- modals ---------- */
function confirmModal(title,body,onYes){openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p><div class="row" style="margin-top:16px"><button class="btn ghost grow" data-x="no">Cancel</button><button class="btn primary grow" data-x="yes" style="background:var(--down);color:#fff">Yes</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="yes")onYes();closeModal();};}
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():"";};

function openExPicker(wid,forTpl){
  const exs=state.meta.exercises.filter(e=>!e.archived);
  const groups=MUSCLES.map(m=>({m,items:exs.filter(e=>e.muscle===m)})).filter(g=>g.items.length);
  const body=groups.map(g=>`<div class="weekhead">${g.m}</div>`+g.items.map(e=>`<button class="pickitem" data-pick="${e.id}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s muted" style="font-size:12px">${esc(e.equip||"")}</div></div><span class="go">${svg(ICON.plus)}</span></button>`).join("")).join("");
  openModal(`<h2>Add exercise</h2><div class="search"><input class="inp" id="exsearch" placeholder="Search movements…"></div><div id="picklist">${body}</div><hr class="sep"><button class="btn ghost block" data-newfrompick>${svg(ICON.plus)} Create new exercise</button>`);
  const sheet=document.getElementById("sheet");
  document.getElementById("exsearch").addEventListener("input",ev=>{const q=ev.target.value.toLowerCase();sheet.querySelectorAll("[data-pick]").forEach(el=>{el.hidden=!el.querySelector(".t").textContent.toLowerCase().includes(q);});sheet.querySelectorAll(".weekhead").forEach(h=>{let n=h.nextElementSibling,any=false;while(n&&n.hasAttribute("data-pick")){if(!n.hidden)any=true;n=n.nextElementSibling;}h.hidden=!any;});});
  sheet.onclick=ev=>{
    const p=ev.target.closest("[data-pick]");
    if(p){addPicked(wid,forTpl,p.dataset.pick);return;}
    if(ev.target.closest("[data-newfrompick]")){closeModal();openExEditor(null,id=>{addPicked(wid,forTpl,id);});}
  };
}
function addPicked(wid,forTpl,exId){
  if(forTpl){forTpl(exId);return;}
  const w=state.workouts[wid];w.entries.push(entryFor(exId,3));touchWorkout(w.id);closeModal();render();
}
function openExMenu(wid,ei){
  const w=state.workouts[wid];const en=w.entries[ei];
  openModal(`<h2>${esc(exById(en.exId)?exById(en.exId).name:en.name)}</h2>
    <button class="btn block ghost" data-m="skip" style="margin-top:12px">Mark skipped (keep in session)</button>
    <button class="btn block ghost" data-m="up" style="margin-top:8px">Move up</button>
    <button class="btn block ghost" data-m="down" style="margin-top:8px">Move down</button>
    <button class="btn block danger" data-m="remove" style="margin-top:8px">Remove from session</button>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-m]");if(!t)return;const m=t.dataset.m;
    if(m==="skip"){en.skipped=true;}
    else if(m==="remove"){w.entries.splice(ei,1);}
    else if(m==="up"&&ei>0){[w.entries[ei-1],w.entries[ei]]=[w.entries[ei],w.entries[ei-1]];}
    else if(m==="down"&&ei<w.entries.length-1){[w.entries[ei+1],w.entries[ei]]=[w.entries[ei],w.entries[ei+1]];}
    touchWorkout(w.id);closeModal();render();};
}
function openWorkoutMeta(id){
  const w=state.workouts[id];
  openModal(`<h2>Session details</h2>
    <div class="formrow"><label>Name</label><input class="inp" id="w_label" value="${esc(w.label)}"></div>
    <div class="formrow"><label>Date</label><input class="inp" id="w_date" type="date" value="${w.date}"></div>
    <div class="formrow"><label>Notes</label><textarea class="inp" id="w_notes" rows="2" placeholder="How it felt, niggles, anything to remember">${esc(w.notes||"")}</textarea></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Save</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="save"){w.label=val("w_label");w.date=val("w_date")||w.date;w.notes=val("w_notes");touchWorkout(w.id);render();}closeModal();};
}
function openName(){
  openModal(`<h2>Your name</h2><p class="helptext">Shown on your account. Handy later when friends features arrive.</p>
    <div class="formrow"><label>Name</label><input class="inp" id="nm" value="${esc(state.meta.profile&&state.meta.profile.name||"")}" placeholder="Your name"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Save</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="save"){state.meta.profile=state.meta.profile||{};state.meta.profile.name=val("nm");touchMeta();render();}closeModal();};
}
function openExEditor(id,onSave){
  const e=id?exById(id):{name:"",muscle:"shoulders",equip:"",unit:state.meta.settings.defUnit||"kg",repLow:8,repHigh:12,step:2,prog:"double",notes:""};
  openModal(`<h2>${id?"Edit exercise":"New exercise"}</h2>
    <div class="formrow"><label>Name</label><input class="inp" id="e_name" value="${esc(e.name)}" placeholder="e.g. Cable Lateral Raise"></div>
    <div class="two">
      <div class="formrow"><label>Muscle</label><select class="inp" id="e_muscle">${MUSCLES.map(m=>`<option ${e.muscle===m?"selected":""}>${m}</option>`).join("")}</select></div>
      <div class="formrow"><label>Unit</label><select class="inp" id="e_unit">${UNITS.map(u=>`<option value="${u}" ${e.unit===u?"selected":""}>${u==="bw"?"bodyweight":u}</option>`).join("")}</select></div>
    </div>
    <div class="formrow"><label>Equipment</label><input class="inp" id="e_equip" value="${esc(e.equip||"")}" placeholder="Dumbbells, Barbell, Marcy multi-gym…"></div>
    <div class="three">
      <div class="formrow"><label>Rep low</label><input class="inp num" id="e_lo" type="number" value="${e.repLow}"></div>
      <div class="formrow"><label>Rep high</label><input class="inp num" id="e_hi" type="number" value="${e.repHigh}"></div>
      <div class="formrow"><label>Load step</label><input class="inp num" id="e_step" type="number" step="0.5" value="${e.step}"></div>
    </div>
    <div class="formrow"><label>Progression</label><select class="inp" id="e_prog">${PROG.map(p=>`<option value="${p[0]}" ${e.prog===p[0]?"selected":""}>${p[1]}</option>`).join("")}</select>
      <div class="helptext" id="prdoc"></div></div>
    <div class="formrow"><label>Notes</label><textarea class="inp" id="e_notes" rows="2" placeholder="Cues, setup, anything to remember">${esc(e.notes||"")}</textarea></div>
    <div class="row" style="margin-top:16px">${id?'<button class="btn ghost" data-x="arch">Archive</button>':""}<button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Save</button></div>`);
  const pdoc={double:"Add load only once every set hits the top of the rep range.",linear:"Add the load step every session you hit the reps.",none:"No prompts — just record what you do."};
  const prsel=document.getElementById("e_prog");
  function refreshDoc(){const el=document.getElementById("prdoc");if(el)el.textContent=pdoc[prsel.value];}
  refreshDoc();prsel.addEventListener("change",refreshDoc);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;
    if(t.dataset.x==="save"){
      const name=val("e_name");if(!name){toast("Name needed");return;}
      const obj={name,muscle:val("e_muscle"),equip:val("e_equip"),unit:document.getElementById("e_unit").value,repLow:+val("e_lo")||1,repHigh:+val("e_hi")||1,step:parseFloat(val("e_step"))||0,prog:prsel.value,notes:val("e_notes")};
      if(id){Object.assign(exById(id),obj);}else{const ne=Object.assign({id:nid("ex"),archived:false},obj);state.meta.exercises.push(ne);id=ne.id;}
      touchMeta();closeModal();render();if(onSave)onSave(id);
    } else if(t.dataset.x==="arch"){exById(id).archived=true;touchMeta();closeModal();render();toast("Archived");}
    else closeModal();
  };
}
function openArchive(){
  const arch=state.meta.exercises.filter(e=>e.archived);
  openModal(`<h2>Archived</h2><p class="muted" style="font-size:13px">Hidden from pickers and the library. Past sessions keep their data.</p>`+arch.map(e=>`<div class="pickitem"><div class="grow"><div class="t">${esc(e.name)}</div></div><button class="btn sm" data-restore="${e.id}">Restore</button></div>`).join("")+`<button class="btn ghost block" data-x="close" style="margin-top:14px">Close</button>`);
  document.getElementById("sheet").onclick=ev=>{const r=ev.target.closest("[data-restore]");if(r){exById(r.dataset.restore).archived=false;touchMeta();closeModal();render();return;}if(ev.target.closest('[data-x="close"]'))closeModal();};
}
function openTplEditor(id){
  const existing=id?state.meta.templates.find(x=>x.id===id):null;
  const t={id:existing?existing.id:nid("tpl"),name:existing?existing.name:"",items:existing?existing.items.map(i=>({...i})):[]};
  function body(){return `<h2>${existing?"Edit template":"New template"}</h2>
    <div class="formrow"><label>Name</label><input class="inp" id="t_name" value="${esc(t.name)}" placeholder="e.g. Push day"></div>
    <div class="eyebrow" style="margin-top:14px">Exercises</div>
    <div>${t.items.map((it,i)=>{const e=exById(it.exId);return `<div class="pickitem"><div class="grow"><div class="t">${esc(e?e.name:"?")}</div></div><div class="field" style="width:118px;height:34px"><button data-ts="-1" data-i="${i}">–</button><input class="num" value="${it.sets}" style="font-size:14px" readonly><span class="u">sets</span><button data-ts="1" data-i="${i}">+</button></div><button class="iconbtn" data-trm="${i}" style="width:32px;height:32px;font-size:16px">✕</button></div>`;}).join("")||'<div class="muted" style="font-size:13px;margin-top:8px">No exercises yet.</div>'}</div>
    <button class="btn ghost block" data-addtpl style="margin-top:10px">${svg(ICON.plus)} Add exercise</button>
    <div class="row" style="margin-top:16px">${existing?'<button class="btn ghost danger" data-x="del">Delete</button>':""}<button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Save</button></div>`;}
  function paint(){const s=document.getElementById("sheet");s.innerHTML=body();const ni=document.getElementById("t_name");if(ni)ni.oninput=()=>{t.name=ni.value;};s.onclick=onClick;}
  function onClick(ev){
    const ts=ev.target.closest("[data-ts]");if(ts){const i=+ts.dataset.i;t.items[i].sets=Math.max(1,t.items[i].sets+ +ts.dataset.ts);paint();return;}
    const rm=ev.target.closest("[data-trm]");if(rm){t.items.splice(+rm.dataset.trm,1);paint();return;}
    if(ev.target.closest("[data-addtpl]")){openExPicker(null,exId=>{t.items.push({exId,sets:3});paint();});return;}
    const x=ev.target.closest("[data-x]");if(!x)return;
    if(x.dataset.x==="save"){if(!t.name)t.name="Template";if(existing){const idx=state.meta.templates.findIndex(z=>z.id===id);state.meta.templates[idx]=t;}else state.meta.templates.push(t);touchMeta();closeModal();render();}
    else if(x.dataset.x==="del"){state.meta.templates=state.meta.templates.filter(z=>z.id!==id);touchMeta();closeModal();render();}
    else closeModal();
  }
  openModal(body());paint();
}
function openBw(){
  openModal(`<h2>Log bodyweight</h2>
    <div class="two">
      <div class="formrow"><label>Weight (kg)</label><input class="inp num" id="bw_kg" type="number" step="0.1" inputmode="decimal" placeholder="e.g. 52.5"></div>
      <div class="formrow"><label>Date</label><input class="inp" id="bw_date" type="date" value="${todayISO()}"></div>
    </div>
    <p class="helptext">Optional, and judgement-free — it just gives context next to your lifts.</p>
    <div class="row" style="margin-top:14px"><button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Save</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="save"){const kg=parseFloat(val("bw_kg"));const d=val("bw_date")||todayISO();if(kg>0){state.meta.bodyweight=(state.meta.bodyweight||[]).filter(b=>b.date!==d);state.meta.bodyweight.push({date:d,kg:round(kg,1)});touchMeta();render();toast("Logged");}}closeModal();};
}
function openPlan(){
  openModal(`<h2>Plan a session</h2><p class="muted" style="font-size:13px">Schedule a workout from a template for a future day. It waits in History until you start it.</p>
    <div class="formrow"><label>Template</label><select class="inp" id="pl_tpl">${state.meta.templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")||'<option value="">— none —</option>'}</select></div>
    <div class="formrow"><label>Date</label><input class="inp" id="pl_date" type="date" value="${todayISO()}"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="save">Plan it</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const x=ev.target.closest("[data-x]");if(!x)return;if(x.dataset.x==="save"){const t=state.meta.templates.find(z=>z.id===val("pl_tpl"));if(t){const entries=t.items.map(it=>entryFor(it.exId,it.sets)).filter(e=>e.name);const id=newWorkout(t.name,entries,"planned");state.workouts[id].date=val("pl_date")||todayISO();touchWorkout(id);render();toast("Planned");}}closeModal();};
}

/* ---------- export / import ---------- */
function doExport(){
  const data=JSON.stringify({v:1,exported:new Date().toISOString(),meta:state.meta,workouts:state.workouts},null,2);
  openModal(`<h2>Backup</h2><p class="helptext">Your data already lives safely in your account. This is just an extra copy you can keep or move elsewhere.</p>
    <textarea class="inp" id="expbox" rows="8" style="font-family:monospace;font-size:12px" readonly>${esc(data)}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary grow" data-x="copy">Copy</button><button class="btn ghost" data-x="close">Close</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="copy"){const ta=document.getElementById("expbox");ta.select();navigator.clipboard?.writeText(ta.value).then(()=>toast("Copied")).catch(()=>{try{document.execCommand("copy");toast("Copied");}catch(e){}});}else closeModal();};
}
function doImport(){
  openModal(`<h2>Import backup</h2><p class="helptext">Paste a backup. This replaces everything in your account.</p>
    <textarea class="inp" id="impbox" rows="8" style="font-family:monospace;font-size:12px" placeholder="Paste backup JSON…"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn ghost grow" data-x="cancel">Cancel</button><button class="btn primary grow" data-x="load">Restore</button></div>`);
  document.getElementById("sheet").onclick=ev=>{const t=ev.target.closest("[data-x]");if(!t)return;if(t.dataset.x==="load"){try{const o=JSON.parse(document.getElementById("impbox").value);if(o.meta&&o.workouts){state.meta=o.meta;state.workouts=o.workouts;state.meta.updatedAt=Date.now();state.dirty={meta:1};Object.keys(state.workouts).forEach(k=>state.dirty["w:"+k]=1);saveLocal();scheduleFlush();ui.histOpen=null;render();toast("Restored");}else toast("Not a valid backup");}catch(e){toast("Could not read that");return;}}closeModal();};
}

/* ---------- connectivity ---------- */
window.addEventListener("online",()=>{setSync();flush();if(userId)cloudLoad().then(render);});
window.addEventListener("offline",setSync);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&userId){flush();cloudLoad().then(render);}});

/* ---------- boot ---------- */
boot();
