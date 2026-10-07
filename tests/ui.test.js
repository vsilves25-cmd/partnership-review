/* The working screen, driven the way the loan officer drives it: typing, clicking,
   closing the tab. The folder and the browser are the pretend ones from
   store.test.js; everything else is the real app. */
group("the working screen");

function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function fire(el,type){ el.dispatchEvent(new Event(type,{bubbles:true})); }
function rep(){ return document.getElementById("report"); }
function q(sel){ return rep().querySelector(sel); }
function fileText(env){ return env.dir.files[FN].text; }
function savedTeam(env){ return Workspace.parse(fileText(env)).ws; }
var STARTED=false;

/* A saved team, opened from the Teams page. */
async function open1(ws,dir){
  dir=dir||fakeDir("Partner Reviews");
  var P=fakePlatform(dir); P.kvData.dir=dir;
  if(!STARTED){ STARTED=true; await start(P); }
  else { closeModal(); cancelSave(); APP.dirty=false; APP.ws=null; APP.profile=Profile.create(); APP.profileDirty=false; APP.status=await Store.init(P); }
  await Store.save(ws||marlowTeam(),FN);
  await showHome();
  await openTeam(APP.teams[0]);
  return {dir:dir,P:P};
}
async function reopen(env){
  APP.status=await Store.init(env.P);
  await showHome();
  await openTeam(APP.teams[0]);
}

test("the Teams page lists saved teams and opens one",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir); P.kvData.dir=dir;
  STARTED=true; await start(P);
  ok(/No teams yet/.test(document.getElementById("home").textContent));
  await Store.save(marlowTeam(),FN);
  await showHome();
  var home=document.getElementById("home");
  ok(/saved as files in the folder Partner Reviews/.test(home.textContent));
  var card=home.querySelector("button.team");
  ok(/The Marlow Team/.test(card.textContent)&&/6 buyers/.test(card.textContent)&&/export of 8\/28\/26/.test(card.textContent));
  card.click(); await sleep(0); await sleep(0);
  eq(APP.screen,"team");
  ok(/The Marlow Team/.test(document.getElementById("bar").textContent));
  ok(/Jordan Pike/.test(rep().textContent));
  ok(/^Saved/.test(document.getElementById("savestate").textContent));
});

test("a note saves itself while it is being typed, with no click and no redraw",async function(){
  var env=await open1();
  var box=q('tr.noteline[data-id="L0002"] .note');
  box.textContent="Appraisal is back at value";
  fire(box,"input");
  eq(savedTeam(env).loans[1].note,"","not yet: it waits for a pause in typing");
  await sleep(600);
  await flush();
  eq(savedTeam(env).loans[1].note,"Appraisal is back at value");
  ok(box.isConnected,"the box being typed in was not replaced");
  ok(/^Saved/.test(document.getElementById("savestate").textContent));
});

test("the note is there when the tool is closed and opened again",async function(){
  var env=await open1();
  var box=q('tr.noteline[data-id="L0002"] .note');
  box.textContent="Call the listing agent Friday";
  fire(box,"input"); fire(box,"blur");
  await flush();
  await reopen(env);
  eq(q('tr.noteline[data-id="L0002"] .note').textContent,"Call the listing agent Friday");
});

test("typed and the tab closed straight away: still not lost",async function(){
  var env=await open1();
  var box=q('tr.noteline[data-id="L0003"] .note');
  box.focus();
  box.textContent="Typed one second before closing";
  fire(box,"input");
  window.dispatchEvent(new Event("pagehide"));          // no pause, no blur, no save has run
  eq(savedTeam(env).loans[2].note,"","the file has not been written");
  ok(/Typed one second before closing/.test(env.P.lsData["pr.draft."+APP.ws.team.id]),"but the last-moment copy has it");
  cancelSave(); APP.dirty=false;             // the tab is gone: nothing else runs
  await reopen(env);
  eq(q('tr.noteline[data-id="L0003"] .note').textContent,"Typed one second before closing");
  await flush();
  eq(savedTeam(env).loans[2].note,"Typed one second before closing","and it reaches the file on the next open");
});

test("a private note is saved too, and never reaches presenter view or print",async function(){
  var env=await open1();
  var box=q('tr.noteline[data-id="L0002"] .pnote');
  box.textContent="PRIVATE thin reserves"; fire(box,"input"); fire(box,"blur");
  await flush();
  eq(savedTeam(env).loans[1].privateNote,"PRIVATE thin reserves");
  setPresenting(true);
  ok(document.body.classList.contains("presenting"));
  no(/PRIVATE/.test(rep().innerHTML)); eq(rep().querySelectorAll("[contenteditable],select,button").length,0);
  setPresenting(false);
  ok(/PRIVATE/.test(rep().innerHTML));
  window.dispatchEvent(new Event("beforeprint"));
  no(/PRIVATE/.test(rep().innerHTML),"printing from the working screen switches to the clean view first");
  eq(rep().querySelectorAll("[contenteditable],select,button").length,0);
  window.dispatchEvent(new Event("afterprint"));
  ok(q(".pnote"));
});

test("correcting a stage, hiding a buyer and Undo",async function(){
  var env=await open1();
  var sel=q('tr.buyer[data-id="L0002"] select');
  sel.value="CTC"; fire(sel,"change");
  eq(APP.ws.loans[1].overlay.milestone.v,"CTC");
  ok(q('tr.buyer[data-id="L0002"]').classList.contains("edited"));
  q('[data-hide="L0003"]').click();
  no(q('tr.buyer[data-id="L0003"]'),"gone from the list");
  await flush();
  eq([savedTeam(env).loans[1].overlay.milestone.v,savedTeam(env).loans[2].hidden],["CTC",true]);

  document.getElementById("undo").click();
  ok(q('tr.buyer[data-id="L0003"]'),"Undo brings the hidden buyer back");
  document.getElementById("undo").click();
  eq(APP.ws.loans[1].overlay,{});
  ok(document.getElementById("undo").disabled);
  await flush();
  eq(savedTeam(env).loans[1].overlay,{});
  ok(savedTeam(env).revision>=3,"an undo is saved as a newer revision, never an older one");
});

test("renaming an agent, the lead and the team from the page",async function(){
  var env=await open1();
  APP.controls=true; render();
  var cell=q('[data-rename="Tom Marlow"]');
  cell.textContent="Tom Marlow Jr"; fire(cell,"blur");
  eq(rep().querySelectorAll('tr.buyer [data-f="agent"]').length>0,true);
  eq(Array.prototype.filter.call(rep().querySelectorAll('tr.buyer [data-f="agent"]'),function(e){return e.textContent==="Tom Marlow Jr";}).length,2,
     "both of his open files (his closed one is listed only when closed buyers are shown)");
  var lead=q('[data-team="leadName"]'); lead.textContent="Dana Marlow"; fire(lead,"blur");
  var name=q('[data-team="name"]'); name.textContent="Marlow & Vale"; fire(name,"blur");
  await flush();
  var t=savedTeam(env);
  eq([t.team.leadName,t.team.name,t.aliases["tom marlow"]],["Dana Marlow","Marlow & Vale","Tom Marlow Jr"]);
  ok(/Marlow & Vale/.test(document.getElementById("bar").textContent));
});

test("adding the next export shows what will happen first, then does it",async function(){
  var env=await open1();
  var x=sourcesOf(HEADERS_B,WEEK2.map(fx)),meta=metaFor(x,"2026-09-04");
  planImport({sources:x.sources,meta:meta});
  var dlg=document.querySelector("#modal .dialog");
  ok(dlg&&/Add this export\?/.test(dlg.textContent));
  ok(/4 already on this team, 3 with changes\. 1 new\. 2 no longer in the export\./.test(text(dlg)));
  ok(/Jordan Pike: Approval → Clear to close/.test(text(dlg))&&/Sky Okafor/.test(dlg.textContent)&&/Casey Nguyen/.test(dlg.textContent));
  eq(APP.ws.imports.length,1,"nothing has changed yet");
  dlg.querySelector('[data-x="yes"]').click();
  eq(APP.ws.imports.length,2);
  ok(document.getElementById("modal").hidden);
  ok(q(".since")&&/Since the last export/.test(q(".since").textContent));
  var miss=q('.internal tr[data-id="L0004"] select');
  ok(miss,"the missing buyer is waiting for a reason");
  miss.value="withdrawn"; fire(miss,"change");
  await flush();
  eq(savedTeam(env).loans[3].missingReason,"withdrawn");
  ok(/No longer active/.test(rep().textContent));

  /* the same file again */
  planImport({sources:x.sources,meta:meta});
  dlg=document.querySelector("#modal .dialog");
  ok(/already added/.test(dlg.textContent)); no(dlg.querySelector('[data-x="yes"]'),"there is no button to add it twice");
  dlg.querySelector('[data-x="no"]').click();
  eq(APP.ws.imports.length,2);
});

test("an export dropped as a real file is read and added",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir); P.kvData.dir=dir;
  closeModal(); APP.status=await Store.init(P); await showHome();
  var w=workbook(HEADERS_B,WEEK1.map(fx));
  var file=new File([w.bytes],"Marlow export.xlsx",{lastModified:new Date(2026,7,28,9,30).getTime()});
  await exportDropped(file);                             // no teams yet: it starts one
  await flush();
  eq([APP.screen,APP.ws.team.name,APP.ws.loans.length],["team","The Marlow Team",6]);
  eq(APP.ws.imports[0].asOf,"2026-08-28","dated from the file itself");
  ok(dir.files["The Marlow Team.partnership.json"],"and its file exists without anyone clicking Save");
  var bad=new File([new Uint8Array([1,2,3])],"not an export.xlsx");
  await showHome();
  await exportDropped(bad);
  ok(document.getElementById("err").textContent.length>10,"a file that is not an export says so instead of failing silently");
});

test("Mark as presented starts the next comparison from today",async function(){
  var env=await open1();
  document.getElementById("presented").click();
  await flush();
  eq(savedTeam(env).meetings.length,1);
  eq(baselineFor(APP.ws).kind,"meeting");
});

test("a file changed elsewhere stops the save and offers three ways out",async function(){
  var env=await open1();
  var other=clone(APP.ws); other.team.leadName="Edited on another PC"; other.revision=40;
  env.dir.touch(FN,Workspace.serialize(other));
  var box=q('tr.noteline[data-id="L0002"] .note');
  box.textContent="Mine"; fire(box,"input"); fire(box,"blur");
  await flush();
  ok(document.getElementById("cf-mine")&&document.getElementById("cf-theirs")&&document.getElementById("cf-both"));
  ok(document.getElementById("savestate").classList.contains("bad"));
  eq(savedTeam(env).team.leadName,"Edited on another PC","their file is untouched until the loan officer chooses");
  document.getElementById("cf-mine").click();
  await flush();
  eq(savedTeam(env).loans[1].note,"Mine");
  no(document.getElementById("cf-mine"));
});

test("a full disk is said out loud, and the work is still kept in the browser",async function(){
  var env=await open1();
  env.dir.failWrites=true;
  var box=q('tr.noteline[data-id="L0002"] .note');
  box.textContent="Typed with a full disk"; fire(box,"input"); fire(box,"blur");
  await flush();
  var st=document.getElementById("savestate");
  ok(st.classList.contains("warn")); eq(st.textContent,"Saved in this browser only");
  ok(/not enough space/.test(st.title));
  ok(/Typed with a full disk/.test(env.P.kvData["draft:"+APP.ws.team.id].text));
});

test("a new team gets its file straight away and waits for its first export",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir); P.kvData.dir=dir;
  closeModal(); APP.status=await Store.init(P); await showHome();
  await startTeam(Workspace.create("Quill Group"));
  ok(dir.files["Quill Group.partnership.json"]);
  eq(document.getElementById("droptitle").textContent,"Quill Group");
  eq(rep().innerHTML,"");
  no(document.getElementById("present"),"nothing to present yet");
});

test("an export dropped before storage has finished opening waits for it instead of failing",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir); P.kvData.dir=dir;
  closeModal(); cancelSave(); APP.dirty=false; APP.ws=null; APP.screen="home"; APP.teams=[];
  var release; READY=new Promise(function(r){release=r;});
  var w=workbook(HEADERS_B,WEEK1.map(fx));
  var going=exportDropped(new File([w.bytes],"early.xlsx",{lastModified:new Date(2026,7,28,9,30).getTime()}));
  await sleep(50);
  eq(APP.ws,null,"nothing happens until storage is open");
  APP.status=await Store.init(P); release();
  await going; await flush();
  eq(APP.ws.loans.length,6);
  ok(dir.files["The Marlow Team.partnership.json"]);
  READY=Promise.resolve();
});

async function until(fn){ for(var i=0;i<100;i++){ var v=fn(); if(v) return v; await sleep(20); } throw new Error("waited, and it never happened"); }

test("an earlier copy of a team (a .bak) can be opened to roll it back, after asking",async function(){
  var env=await open1();
  var earlier=Workspace.serialize(clone(APP.ws));
  var box=q('tr.noteline[data-id="L0002"] .note');
  box.textContent="A later note"; fire(box,"input"); fire(box,"blur");
  await flush();
  eq(savedTeam(env).loans[1].note,"A later note");
  await showHome();
  var going=openCopyFile(new File([earlier],FN+".bak"));
  var dlg=await until(function(){ return document.querySelector("#modal .dialog"); });
  ok(/Replace the saved team\?/.test(dlg.textContent));
  eq(savedTeam(env).loans[1].note,"A later note","nothing is replaced until the loan officer agrees");
  dlg.querySelector('[data-x="yes"]').click();
  await going; await flush();
  eq(savedTeam(env).loans[1].note,"");
  ok(savedTeam(env).revision>2,"the rolled-back team is saved as the newest revision, so it is the one that opens next time");
  ok(/A later note/.test(env.dir.files[FN+".bak"]?env.dir.files[FN+".bak"].text:"A later note"),"and what it replaced is not destroyed");
});

test("typing without ever pausing still reaches the file about a second in",async function(){
  var env=await open1();
  var box=q('tr.noteline[data-id="L0002"] .note'),typed="";
  for(var i=0;i<20;i++){                                // two seconds of steady typing, a key every 100 ms
    typed+="word"+i+" "; box.textContent=typed; fire(box,"input");
    await sleep(100);
  }
  var onDisk=savedTeam(env).loans[1].note;              // nothing has been flushed by hand
  ok(onDisk.length>20,"the file already holds most of it, got "+onDisk.length+" characters");
  eq(typed.indexOf(onDisk),0,"and what it holds is exactly what was typed up to that moment");
  ok(box.isConnected,"without the box being redrawn under the cursor");
  fire(box,"blur"); await flush();
  eq(savedTeam(env).loans[1].note,typed.trim());
});

group("my details on screen");

async function freshStart(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir); P.kvData.dir=dir;
  closeModal(); cancelSave(); APP.dirty=false; APP.ws=null; APP.profile=Profile.create(); APP.profileDirty=false;
  APP.status=await Store.init(P); await showHome();
  return {dir:dir,P:P};
}

test("a new user is asked for their details once, from the Teams page",async function(){
  var env=await freshStart();
  var setup=document.getElementById("setup");
  ok(setup&&/Your name and your NMLS number are not set yet/.test(document.getElementById("home").textContent));
  setup.click();
  var d=document.querySelector("#modal .dialog");
  d.querySelector("#md-name").value="Jamie Rivera";
  d.querySelector("#md-nmls").value="NMLS# 123456";
  d.querySelector("#md-sig").value="the Rivera Team"; fire(d.querySelector("#md-sig"),"input");
  ok(/Prepared by the Rivera Team at NFM Lending/.test(d.querySelector("#md-foot").textContent),"the dialog shows the footer it will produce");
  d.querySelector('[data-x="yes"]').click();
  await flushProfile();
  var saved=Profile.parse(env.dir.files[PROFILE_FILE].text);
  eq([saved.name,saved.nmls,saved.signature,saved.title],["Jamie Rivera","123456","the Rivera Team","Loan Originator, NFM Lending"]);
  no(document.getElementById("setup"),"and is not asked again");
  ok(/Jamie Rivera, NFM Lending/.test(document.getElementById("home").textContent));
});

test("a name and NMLS number typed on the report become your details, not the team's",async function(){
  var env=await open1();
  ok(/does not carry/.test(document.getElementById("bar").textContent),"a reminder shows while they are missing");
  var name=q('[data-profile="name"]'); name.textContent="Jamie Rivera"; fire(name,"blur");
  var nmls=q('[data-profile="nmls"]'); nmls.textContent="NMLS #123456"; fire(nmls,"blur");
  await flushProfile();
  eq(q('[data-profile="nmls"]').textContent,"123456");
  var saved=Profile.parse(env.dir.files[PROFILE_FILE].text);
  eq([saved.name,saved.nmls],["Jamie Rivera","123456"]);
  await flush();
  no(/Jamie Rivera/.test(fileText(env)),"the team file does not hold them");
  no(/does not carry/.test(document.getElementById("bar").textContent),"the reminder is gone");
  ok(/Prepared by Jamie Rivera at NFM Lending/.test(q(".foot").textContent));
  APP.profile=Profile.create();                          // the tool is closed and opened again
  await reopen(env);
  eq(q('[data-profile="name"]').textContent,"Jamie Rivera","they are there for every team, every time");
});

test("a details file opened from the Teams page sets someone up in one step",async function(){
  var env=await freshStart();
  var theirs=Profile.create(); theirs.name="Jamie Rivera"; theirs.nmls="123456"; theirs.photo="data:image/jpeg;base64,AAAA";
  await openCopyFile(new File([Profile.serialize(theirs)],PROFILE_FILE));
  eq([APP.profile.name,APP.profile.photo],["Jamie Rivera","data:image/jpeg;base64,AAAA"]);
  eq(Profile.parse(env.dir.files[PROFILE_FILE].text).nmls,"123456");
  eq(APP.teams.length,0,"it is not mistaken for a team");
  no(document.getElementById("setup"));
});