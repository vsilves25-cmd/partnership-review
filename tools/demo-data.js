/* A made-up realtor team for the demo page. Every person here is invented.
   Two exports a week apart, in the real column layout, so the demo shows what
   a second week looks like: moves, a new buyer, buyers that drop out. */
var DEMO1=[
 {name:"Avery Stone",   agent:"Tom Marlow",   ms:"Funding", started:"2026-02-02",pqAt:"2/10/2026 9:00:00 AM",proc:"2026-03-01",approval:"2026-03-15",ctc:"2026-03-25",funded:"2026-04-01",amount:410000},
 {name:"Blake Romero",  agent:"Tom Marlow",   ms:"Funding", started:"2026-03-09",pqAt:"3/12/2026 2:00:00 PM",proc:"2026-04-06",approval:"2026-04-20",ctc:"2026-05-01",funded:"2026-05-08",amount:365000},
 {name:"Devon Hale",    agent:"Dana Marlow",  ms:"Funding", started:"2026-04-14",pqAt:"4/16/2026 11:00:00 AM",proc:"2026-05-11",approval:"2026-05-26",ctc:"2026-06-05",funded:"2026-06-12",amount:298000},
 {name:"Emery Castillo",agent:"Chris Vale",   ms:"Funding", started:"2026-05-04",pqAt:"5/6/2026 10:00:00 AM",proc:"2026-06-01",approval:"2026-06-17",ctc:"2026-06-29",funded:"2026-07-07",amount:452000},
 {name:"Jordan Pike",   agent:"Thomas Marlow",ms:"Approval",started:"2026-06-01",pqAt:"6/10/2026 3:15:07 PM",proc:"2026-07-20",approval:"2026-08-10",amount:325000,estClose:"2026-09-18",lock:21,apprOrdered:"2026-07-22",apprReceived:"2026-08-03",
   comments:{"Milestone Comments - Processing":"RC 8/3 - Appraisal is back at value"}},
 {name:"Harper Lindqvist",agent:"Dana Marlow",ms:"Processing",started:"2026-07-06",pqAt:"7/8/2026 1:00:00 PM",proc:"2026-08-17",amount:389000,estClose:"2026-09-30",lock:33,apprOrdered:"2026-08-18",
   comments:{"Milestone Comments - Processing":"8/20/2026 4:11 PM(EST) Pat Doe > Waiting on the second pay stub"}},
 {name:"Quinn Abara",   agent:"Chris Vale",   ms:"Processing",started:"2026-07-13",pqAt:"7/15/2026 9:30:00 AM",proc:"2026-08-24",amount:274000,estClose:"2026-10-09",lock:40},
 {name:"Riley Chen",    agent:"Dana Marlow",  ms:"Started", started:"2026-07-15",pqAt:"7/20/2026 1:00:00 PM",amount:280000},
 {name:"Morgan Bell",   agent:"Chris Vale",   ms:"Ready for Pack Out",started:"2026-05-05",pqAt:"5/12/2026 10:00:00 AM",rfpo:"2026-07-01",amount:350000},
 {name:"Sasha Whitlock",agent:"Tom Marlow",   ms:"Started", started:"2026-06-22",pqAt:"6/25/2026 3:00:00 PM",amount:310000},
 {name:"Parker Osei",   agent:"T. Marlow",    ms:"Started", started:"2026-08-03",pqAt:"8/6/2026 12:00:00 PM",amount:265000},
 {name:"Casey Nguyen",  agent:"Dana Marlow",  ms:"Started", started:"2026-07-28"},
 {name:"Rowan Fitch",   agent:"Chris Vale",   ms:"Started", started:"2026-08-05"},
 {name:"Avery Stone",   agent:"Tom Marlow",   ms:"Started", started:"2026-08-11"},
 {name:"Lennox Ward",   agent:"Dana Marlow",  ms:"Started", started:"2026-08-20"},
 {name:"Taylor Brandt", agent:"Tom Marlow",   ms:"Started", started:"2026-08-24"},
 {name:"Indigo Marsh",  agent:" ",            ms:"Started", started:"2026-08-26"}
];
var DEMO2=[
 {name:"Avery Stone",   agent:"Tom Marlow",   ms:"Funding", started:"2026-02-02",pqAt:"2/10/2026 9:00:00 AM",proc:"2026-03-01",approval:"2026-03-15",ctc:"2026-03-25",funded:"2026-04-01",amount:410000},
 {name:"Devon Hale",    agent:"Dana Marlow",  ms:"Funding", started:"2026-04-14",pqAt:"4/16/2026 11:00:00 AM",proc:"2026-05-11",approval:"2026-05-26",ctc:"2026-06-05",funded:"2026-06-12",amount:298000},
 {name:"Emery Castillo",agent:"Chris Vale",   ms:"Funding", started:"2026-05-04",pqAt:"5/6/2026 10:00:00 AM",proc:"2026-06-01",approval:"2026-06-17",ctc:"2026-06-29",funded:"2026-07-07",amount:452000},
 {name:"Jordan Pike",   agent:"Thomas Marlow",ms:"Funding", started:"2026-06-01",pqAt:"6/10/2026 3:15:07 PM",proc:"2026-07-20",approval:"2026-08-10",ctc:"2026-08-27",funded:"2026-09-03",amount:325000,apprOrdered:"2026-07-22",apprReceived:"2026-08-03"},
 {name:"Harper Lindqvist",agent:"Dana Marlow",ms:"Approval",started:"2026-07-06",pqAt:"7/8/2026 1:00:00 PM",proc:"2026-08-17",approval:"2026-09-01",amount:389000,estClose:"2026-09-30",lock:26,apprOrdered:"2026-08-18",apprReceived:"2026-08-29",
   comments:{"Milestone Comments - Processing":"8/29/2026 2:40 PM(EST) Pat Doe > Appraisal received, sent to underwriting"}},
 {name:"Quinn Abara",   agent:"Chris Vale",   ms:"Processing",started:"2026-07-13",pqAt:"7/15/2026 9:30:00 AM",proc:"2026-08-24",amount:274000,estClose:"2026-09-12",lock:6},
 {name:"Riley Chen",    agent:"Dana Marlow",  ms:"Processing",started:"2026-07-15",pqAt:"7/20/2026 1:00:00 PM",proc:"2026-09-01",amount:280000,estClose:"2026-10-02",lock:28,apprOrdered:"2026-09-02"},
 {name:"Sasha Whitlock",agent:"Tom Marlow",   ms:"Started", started:"2026-06-22",pqAt:"6/25/2026 3:00:00 PM",amount:310000},
 {name:"Parker Osei",   agent:"T. Marlow",    ms:"Started", started:"2026-08-03",pqAt:"8/6/2026 12:00:00 PM",amount:265000},
 {name:"Rowan Fitch",   agent:"Chris Vale",   ms:"Started", started:"2026-08-05",pqAt:"9/2/2026 10:00:00 AM"},
 {name:"Avery Stone",   agent:"Tom Marlow",   ms:"Started", started:"2026-08-11"},
 {name:"Lennox Ward",   agent:"Dana Marlow",  ms:"Started", started:"2026-08-20"},
 {name:"Taylor Brandt", agent:"Tom Marlow",   ms:"Started", started:"2026-08-24"},
 {name:"Indigo Marsh",  agent:" ",            ms:"Started", started:"2026-08-26"},
 {name:"Sky Okafor",    agent:"Chris Vale",   ms:"Started", started:"2026-09-01"}
];

/* The demo saves nowhere. Its "browser" is a pair of objects that vanish when
   the tab closes, so a made-up team can never turn up among the loan officer's real ones. */
window.PR_PLATFORM=(function(){
  var kv={},ls={};
  return {hasFolderApi:false,pickFolder:function(){return Promise.reject(new Error("The demo has no folder."));},
    kv:{ready:function(){return Promise.resolve(true);},
        get:function(k){return Promise.resolve(kv[k]);},
        put:function(k,v){kv[k]=v;return Promise.resolve();},
        del:function(k){delete kv[k];return Promise.resolve();},
        keys:function(){return Promise.resolve(Object.keys(kv));}},
    ls:{get:function(k){return k in ls?ls[k]:null;},set:function(k,v){ls[k]=v;return true;},
        del:function(k){delete ls[k];},keys:function(){return Object.keys(ls);}},
    download:function(){ toast("The demo does not write files."); }};
})();
/* Loads the two exports the way the loan officer would, with a little of their own work in
   between, so the page opens on a team that already has a history. */
(async function(){
  if(document.readyState==="loading") await new Promise(function(r){document.addEventListener("DOMContentLoaded",r);});
  await new Promise(function(r){setTimeout(r,0);});
  await READY;
  function file(rows,name,when){ return new File([workbook(HEADERS_B,rows.map(fx)).bytes],name,{lastModified:when.getTime()}); }
  APP.profile=Profile.create();
  profileChange(function(p){ p.name="Sam Carter"; p.nmls="000000"; p.signature="the Carter Team"; });
  await flushProfile();
  await startTeam(Workspace.create("The Marlow Team"));
  await exportDropped(file(DEMO1,"Marlow team export 8-28.xlsx",new Date(2026,7,28,17,0)));
  change(function(ws){
    ws.team.leadName="Tom Marlow"; ws.team.leadRole="Team lead, Harbor Realty (demo)";
    var id=function(n){return ws.loans.filter(function(L){return L.src.name===n;})[0].id;};
    Edit.setNote(ws,id("Jordan Pike"),"Appraisal came in at value. Clear to close expected next week.",false);
    Edit.setNote(ws,id("Jordan Pike"),"Thin reserves after closing costs. Watch the final CD.",true);
    Edit.setNote(ws,id("Sasha Whitlock"),"Lost out on two offers. Still looking in the same area.",false);
    Edit.setField(ws,id("Morgan Bell"),"name","Morgan Bell-Ortiz",null);
    Recon.markPresented(ws,buildView(ws),"mature",new Date(2026,7,28,18,0).toISOString());
  });
  planImport(await readExport(file(DEMO2,"Marlow team export 9-4.xlsx",new Date(2026,8,4,11,0))));
  var yes=document.querySelector('#modal [data-x="yes"]');
  if(location.hash!=="#preview"&&yes) yes.click();
  await flush();
  if(location.hash==="#controls"){ APP.controls=true; render(); }
  if(location.hash==="#present") setPresenting(true);
  if(location.hash==="#home") await showHome();
  if(location.hash==="#details"){ await showHome(); myDetails(); }
  if(location.hash==="#newuser"){ APP.profile=Profile.create(); render(); }
  document.title="DEMO, made-up data — Partnership Review";
  var tag=document.createElement("div");
  tag.className="noprint";
  tag.textContent="DEMO · made-up people · nothing here is saved";
  tag.style.cssText="position:fixed;left:14px;bottom:14px;z-index:45;background:#12203A;color:#fff;font:600 12px/1 Segoe UI,sans-serif;padding:9px 12px;border-radius:6px;opacity:.85";
  document.body.appendChild(tag);
})();
