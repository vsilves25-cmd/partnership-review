group("corrections");

function teamA(){ return importInto(Workspace.create("The Marlow Team"),HEADERS_B,WEEK1.map(fx),"2026-08-28"); }
function fileOf(ws,id){ return viewOf(ws).files.filter(function(f){return f.loanId===id;})[0]; }
var AT="2026-09-02T14:00:00.000Z";

test("correcting a name lays it over Encompass; putting it back removes the correction",function(){
  var ws=teamA(),id=loanNamed(ws,"Riley Chen").id;
  ok(Edit.setField(ws,id,"name","Riley Chen-Park",null,AT));
  eq(Workspace.loanById(ws,id).overlay.name,{v:"Riley Chen-Park",base:"Riley Chen",at:AT});
  eq([fileOf(ws,id).name,fileOf(ws,id).edited],["Riley Chen-Park",true]);
  eq(Workspace.loanById(ws,id).src.name,"Riley Chen","Encompass's value is untouched");
  no(Edit.setField(ws,id,"name","Riley Chen-Park",null,AT),"the same value again is not a change");
  no(Edit.setField(ws,id,"name","  ",null,AT),"a blanked name keeps the name it had");
  ok(Edit.setField(ws,id,"name","Riley Chen",null,AT));
  eq(Workspace.loanById(ws,id).overlay,{}); no(fileOf(ws,id).edited);
});

test("moving a buyer to another agent",function(){
  var ws=teamA(),id=loanNamed(ws,"Jordan Pike").id;
  eq(fileOf(ws,id).agent,"Tom Marlow","Thomas is shown under the commoner spelling");
  ok(Edit.setField(ws,id,"agent","Dana Marlow","Tom Marlow",AT));
  eq(Workspace.loanById(ws,id).overlay.agent,{v:"Dana Marlow",base:"Thomas Marlow",at:AT});
  eq(fileOf(ws,id).agent,"Dana Marlow");
  ok(Edit.setField(ws,id,"agent","Tom Marlow","Tom Marlow",AT));
  eq(Workspace.loanById(ws,id).overlay,{});
  ok(Edit.setField(ws,id,"agent","","Tom Marlow",AT));
  eq(fileOf(ws,id).agent,"Unassigned");
});

test("marking a buyer closed by hand shows it closed but keeps it out of the timing medians",function(){
  var ws=teamA(),id=loanNamed(ws,"Jordan Pike").id;
  ok(Edit.setField(ws,id,"milestone","Funding",null,AT));
  var v=viewOf(ws),f=v.files.filter(function(x){return x.loanId===id;})[0];
  ok(isFunded(f)); eq(f.fundingSource,"manual"); eq(isoDate(f.closedOn),"2026-09-02","dated when the loan officer marked it");
  eq(summarize(v.files,"mature").funded,2);
  var before=medians(viewOf(teamA()).files),after=medians(v.files);
  eq(after,before,"no median moved");
});

test("an unrecognised stage typed in is kept as typed and lands in Status to confirm",function(){
  var ws=teamA(),id=loanNamed(ws,"Casey Nguyen").id;
  Edit.setField(ws,id,"milestone","Denied",null,AT);
  eq(fileOf(ws,id).kind,"terminal");
  Edit.setField(ws,id,"milestone","On hold",null,AT);
  eq([fileOf(ws,id).kind,fileOf(ws,id).milestone],["unknown","On hold"]);
});

test("setting or clearing the pre-approval date sets or clears pre-approval",function(){
  var ws=teamA(),casey=loanNamed(ws,"Casey Nguyen").id,jordan=loanNamed(ws,"Jordan Pike").id;
  no(fileOf(ws,casey).pq);
  ok(Edit.setField(ws,casey,"pqDate","2026-08-30",null,AT));
  eq([fileOf(ws,casey).pq,isoDate(fileOf(ws,casey).pqDate)],[true,"2026-08-30"]);
  ok(Edit.setField(ws,jordan,"pqDate","",null,AT));
  eq([fileOf(ws,jordan).pq,fileOf(ws,jordan).pqDate],[false,null]);
  eq(summarize(viewOf(ws).files,"mature").pq,4,"one gained, one lost");
});

test("resetting a row drops its corrections; clearing all drops every correction but no note",function(){
  var ws=teamA(),a=loanNamed(ws,"Riley Chen").id,b=loanNamed(ws,"Morgan Bell").id;
  Edit.setField(ws,a,"name","R. Chen",null,AT); Edit.setField(ws,a,"milestone","Processing",null,AT);
  Edit.setField(ws,b,"name","M. Bell",null,AT); Edit.hide(ws,b,true); Edit.setNote(ws,b,"Keep this",false,AT);
  Edit.renameAgent(ws,viewOf(ws).files,"Chris Vale","Christopher Vale",AT);
  ok(Edit.resetLoan(ws,a)); eq(Workspace.loanById(ws,a).overlay,{}); no(Edit.resetLoan(ws,a));
  ok(Edit.clearAll(ws));
  var L=Workspace.loanById(ws,b);
  eq([L.overlay,L.hidden,L.note,ws.aliases],[{},false,"Keep this",{}]);
  no(Edit.clearAll(ws));
});

group("notes");

test("a note is saved against the buyer; the private one is separate",function(){
  var ws=teamA(),id=loanNamed(ws,"Jordan Pike").id;
  ok(Edit.setNote(ws,id,"  Appraisal is back  ",false,AT));
  ok(Edit.setNote(ws,id,"Thin reserves",true,AT));
  no(Edit.setNote(ws,id,"Appraisal is back",false,AT));
  var L=Workspace.loanById(ws,id);
  eq([L.note,L.privateNote,L.noteAt],["Appraisal is back","Thin reserves",AT]);
  eq([fileOf(ws,id).note,fileOf(ws,id).privateNote],["Appraisal is back","Thin reserves"]);
  ok(Edit.setNote(ws,id,"",false,AT)); eq(Workspace.loanById(ws,id).note,"");
  ok(ws.log.some(function(e){return e.t==="note"&&e.from==="Appraisal is back"&&e.to==="";}),"the old text is in the change log");
});

test("an Encompass comment is only a suggestion until the loan officer puts it on the report",function(){
  var rows=[fx({name:"Jordan Pike",ms:"Processing",started:"2026-06-01",pqAt:"6/10/2026 3:15:07 PM",
    comments:{"Milestone Comments - Processing":"6/8/2026 5:08 PM(EST) Pat Doe > Borrower's credit was re-pulled"}})];
  var ws=importInto(Workspace.create("T"),HEADERS_B,rows,"2026-08-28"),id=ws.loans[0].id;
  var f=fileOf(ws,id);
  eq([f.note,f.encNote,f.encNoteSource],["","Borrower's credit was re-pulled","Milestone Comments - Processing"]);
  ok(Edit.useEncNote(ws,id,AT));
  eq(fileOf(ws,id).note,"Borrower's credit was re-pulled");
  no(Edit.useEncNote(ws,id,AT));
  no(Edit.useEncNote(teamA(),"L0001",AT),"nothing to use when the export had no comment");
});

group("hiding and renaming");

test("a hidden buyer leaves the lists but stays in the totals",function(){
  var ws=teamA(),id=loanNamed(ws,"Riley Chen").id;
  ok(Edit.hide(ws,id,true)); no(Edit.hide(ws,id,true));
  var v=viewOf(ws);
  ok(fileOf(ws,id).hidden); eq(v.files.filter(shown).length,5);
  eq(summarize(v.files,"mature").n,6);
  ok(Edit.unhideAll(ws)); no(Edit.unhideAll(ws)); no(fileOf(ws,id).hidden);
});

test("renaming an agent moves every spelling, and next week's export follows",function(){
  var ws=teamA();
  ok(Edit.renameAgent(ws,viewOf(ws).files,"Tom Marlow","Tom Marlow Jr",AT));
  eq(ws.aliases,{"tom marlow":"Tom Marlow Jr","thomas marlow":"Tom Marlow Jr"});
  eq(viewOf(ws).files.filter(function(f){return f.agent==="Tom Marlow Jr";}).length,3);
  ws=importInto(ws,HEADERS_B,WEEK2.concat([{name:"Newcomer",agent:"Thomas Marlow",started:"2026-09-02"}]).map(fx),"2026-09-04");
  eq(fileNamed(viewOf(ws),"Newcomer").agent,"Tom Marlow Jr");
  no(Edit.renameAgent(ws,viewOf(ws).files,"Tom Marlow Jr","Tom Marlow Jr",AT));
  no(Edit.renameAgent(ws,viewOf(ws).files,"Tom Marlow Jr","  ",AT));
});

test("buyers with no agent in Encompass can be given one by renaming Unassigned",function(){
  var ws=importInto(Workspace.create("T"),HEADERS_B,[fx({name:"No Agent",agent:" "}),fx({name:"Has Agent",agent:"Dana Marlow",started:"2026-06-02"})],"2026-08-28");
  eq(fileNamed(viewOf(ws),"No Agent").agent,"Unassigned");
  ok(Edit.renameAgent(ws,viewOf(ws).files,"Unassigned","Pat Lee",AT));
  eq(fileNamed(viewOf(ws),"No Agent").agent,"Pat Lee");
  eq(fileNamed(viewOf(ws),"Has Agent").agent,"Dana Marlow");
});

group("for the loan officer only");

function watchTeam(){
  var rows=[
    {name:"Lock Soon",   ms:"Approval",  started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-07-01",approval:"2026-08-20",lock:5,apprOrdered:"2026-07-02",apprReceived:"2026-07-10"},
    {name:"Lock Fine",   ms:"Approval",  started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-07-01",approval:"2026-08-20",lock:25,apprOrdered:"2026-07-02",apprReceived:"2026-07-10"},
    {name:"Lock Gone",   ms:"Processing",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-08-01",lock:-3,apprOrdered:"2026-08-02",apprReceived:"2026-08-10",estClose:"2026-08-30"},
    {name:"No Appraisal",ms:"Processing",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-08-25"},
    {name:"Slow Appraisal",ms:"Processing",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-08-01",apprOrdered:"2026-08-10"},
    {name:"Quick Appraisal",ms:"Processing",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-08-20",apprOrdered:"2026-08-28"},
    {name:"Closes Today",ms:"CTC",started:"2026-05-01",pqAt:"5/2/2026 1:00:00 PM",proc:"2026-06-01",ctc:"2026-09-01",estClose:"2026-09-04",apprOrdered:"2026-06-02",apprReceived:"2026-06-10"},
    {name:"Closes Soon", ms:"Approval",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-07-01",approval:"2026-08-20",estClose:"2026-09-25",apprOrdered:"2026-07-02",apprReceived:"2026-07-10"},
    {name:"Closes Later",ms:"Approval",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-07-01",approval:"2026-08-20",estClose:"2026-11-01",apprOrdered:"2026-07-02",apprReceived:"2026-07-10"},
    {name:"Already Closed",ms:"Funding",started:"2026-03-01",pqAt:"3/2/2026 1:00:00 PM",funded:"2026-05-01",estClose:"2026-09-10",lock:-90},
    {name:"Shopping",    ms:"Started", started:"2026-08-01",pqAt:"8/2/2026 1:00:00 PM"}];
  return importInto(Workspace.create("T"),HEADERS_B,rows.map(fx),"2026-09-04");
}
test("the watch list flags locks, late closings and appraisals on active files only",function(){
  var ws=watchTeam(),v=viewOf(ws);
  var w=watchList(v.files,{apprOrdered:true,apprReceived:true});
  eq(w.map(function(x){return x.f.name+" | "+x.t;}),[
    "Lock Soon | Rate lock expires in 5 days",
    "Lock Gone | Rate lock expired 3 days ago",
    "Lock Gone | Estimated closing date passed 5 days ago",
    "No Appraisal | Under contract with no appraisal ordered",
    "Slow Appraisal | Appraisal ordered 25 days ago, not back yet"]);
  var w2=watchList(v.files,{apprOrdered:false,apprReceived:false});
  eq(w2.length,3,"with no appraisal columns in the export, no appraisal warnings are guessed");
});
test("a buyer missing from the latest export is on the watch list until the loan officer says why",function(){
  var ws=importInto(teamA(),HEADERS_B,WEEK2.map(fx),"2026-09-04"),casey=loanNamed(ws,"Casey Nguyen").id;
  var w=watchList(viewOf(ws).files,{});
  eq(w.filter(function(x){return x.k==="missing";}).map(function(x){return x.f.name;}).sort(),["Casey Nguyen","Morgan Bell"]);
  Edit.setMissingReason(ws,casey,"active");
  eq(watchList(viewOf(ws).files,{}).filter(function(x){return x.k==="missing";}).length,1);
});
test("closing soon lists active buyers due in the next 30 days, soonest first",function(){
  var ws=watchTeam();
  eq(closingSoon(viewOf(ws).files).map(function(f){return f.name+":"+f.daysToClose;}),["Closes Today:0","Closes Soon:21"]);
  Edit.hide(ws,loanNamed(ws,"Closes Soon").id,true);
  eq(closingSoon(viewOf(ws).files).length,1);
});
