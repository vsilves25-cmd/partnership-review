/* One test per rule in docs\RECONCILIATION.md. */
group("adding exports");

function team1(){ return importInto(Workspace.create("The Marlow Team"),HEADERS_B,WEEK1.map(fx),"2026-08-28"); }
function team2(ws){ return importInto(ws||team1(),HEADERS_B,WEEK2.map(fx),"2026-09-04"); }
function ids(list){ return list.map(function(f){return f.name;}).sort(); }

test("keys: loan number when there is one, otherwise name plus start date",function(){
  eq(Recon.keysFor({loanNumber:" nfm 1001 ",name:"Jordan  Pike",started:"2026-06-01"}),
     {ln:"ln:NFM1001",ns:"ns:jordan pike|2026-06-01"});
  eq(Recon.keysFor({loanNumber:"",name:"O'Neil-Smith, Pat",started:""}),{ln:"",ns:"ns:oneil smith pat|"});
});

test("first export: every row becomes a buyer on the team",function(){
  var ws=team1();
  eq(ws.loans.length,6);
  eq(ws.loans.map(function(L){return L.id;}),["L0001","L0002","L0003","L0004","L0005","L0006"]);
  ok(ws.loans.every(function(L){return L.presence==="present"&&L.firstSeen.importId==="I0001";}));
  var imp=ws.imports[0];
  eq([imp.id,imp.asOf,imp.keyMode,imp.pqRule,imp.rowCount,imp.historical],["I0001","2026-08-28","nameStarted","date",6,false]);
  eq(imp.counts,{matched:0,added:6,changed:0,missing:0,upgraded:0});
  eq(Object.keys(imp.state).length,6);
});

test("one borrower with two files is two buyers, told apart by start date",function(){
  var ws=team1();
  var both=ws.loans.filter(function(L){return L.src.name==="Avery Stone";});
  eq(both.length,2);
  eq(both.map(function(L){return L.keys[0];}),["ns:avery stone|2026-02-02","ns:avery stone|2026-08-11"]);
});

test("the same file dropped twice is recognised and changes nothing",function(){
  var ws0=Workspace.create("T"),x=sourcesOf(HEADERS_B,WEEK1.map(fx)),m=metaFor(x,"2026-08-28");
  var ws1=Recon.apply(ws0,Recon.plan(ws0,x.sources,m),{now:m.importedAt});
  var before=JSON.stringify(ws1);
  var p=Recon.plan(ws1,x.sources,m);
  ok(p.duplicateOf&&p.duplicateOf.id==="I0001");
  eq(p.warnings[0].k,"duplicate");
  throws(function(){Recon.apply(ws1,p);},/already added/);
  eq(JSON.stringify(ws1),before);
});

test("next export: Encompass facts update, the loan officer's work stays",function(){
  var ws=team1();
  var jordan=loanNamed(ws,"Jordan Pike").id,riley=loanNamed(ws,"Riley Chen").id;
  Edit.setNote(ws,jordan,"Appraisal came in at value",false);
  Edit.setNote(ws,jordan,"Tight on reserves",true);
  Edit.hide(ws,riley,true);
  var x=sourcesOf(HEADERS_B,WEEK2.map(fx)),p=Recon.plan(ws,x.sources,metaFor(x,"2026-09-04"));
  eq(p.counts,{rows:5,matched:4,added:1,changed:3,missing:2,upgraded:0,dupInFile:0});
  eq(p.newlyMissing.length,2); eq(p.older,false); eq(p.firstImport,false);

  var ws2=Recon.apply(ws,p,{now:"2026-09-04T15:00:00.000Z"});
  eq(ws.imports.length,1,"the team passed in is not touched");
  var J=Workspace.loanById(ws2,jordan),R=Workspace.loanById(ws2,riley);
  eq([J.src.milestone,J.src.lockDays,J.lastSeen.importId],["CTC",5,"I0002"]);
  eq([J.note,J.privateNote],["Appraisal came in at value","Tight on reserves"]);
  eq([R.src.milestone,R.hidden],["Processing",true]);
  eq(ws2.loans.length,7);
  ok(ws2.log.some(function(e){return e.t==="import"&&e.loan===jordan&&e.f==="milestone"&&e.from==="Approval"&&e.to==="CTC";}));
});

test("a buyer missing from the new export is kept and marked, not deleted",function(){
  var ws=team2();
  var casey=loanNamed(ws,"Casey Nguyen"),morgan=loanNamed(ws,"Morgan Bell");
  eq([casey.presence,casey.missingSince],["missing","2026-09-04"]);
  eq(morgan.presence,"missing");
  var v=viewOf(ws);
  eq(v.files.length,7,"still on the report");
  ok(fileNamed(v,"Casey Nguyen").missing);
  eq(summarize(v.files,"mature").n,7,"and still in the totals");
});

test("a closed loan that drops out of the export stays in the closed totals",function(){
  var ws=importInto(team1(),HEADERS_B,WEEK2.slice(1).map(fx),"2026-09-04");
  var v=viewOf(ws),closed=v.files.filter(function(f){return f.name==="Avery Stone"&&f.missing;})[0];
  ok(closed&&isFunded(closed));
  var s=summarize(v.files,"mature");
  eq([s.funded,s.volume],[1,410000]);
  Edit.setMissingReason(ws,closed.loanId,"withdrawn");
  ok(isFunded(viewOf(ws).files.filter(function(f){return f.loanId===closed.loanId;})[0]),"a closed loan cannot be marked as fallen out");
});

test("saying why a buyer went missing changes how it is counted",function(){
  var ws=team2(),casey=loanNamed(ws,"Casey Nguyen").id,morgan=loanNamed(ws,"Morgan Bell").id;
  Edit.setMissingReason(ws,casey,"withdrawn");
  var f=viewOf(ws).files.filter(function(x){return x.loanId===casey;})[0];
  eq([f.kind,f.milestone,f.stageIdx],["terminal","Withdrawn",-1]);
  Edit.setMissingReason(ws,morgan,"active");
  ok(isActive(viewOf(ws).files.filter(function(x){return x.loanId===morgan;})[0]),"still active keeps its last known stage");
  Edit.setMissingReason(ws,morgan,"removed");
  eq(viewOf(ws).files.length,6,"not this team's buyer: gone from everything");
  ok(Edit.restoreRemoved(ws,morgan));
  eq(Workspace.loanById(ws,morgan).presence,"missing");
  eq(viewOf(ws).files.length,7);
});

test("a buyer who comes back in a later export is present again",function(){
  var ws=team2(),casey=loanNamed(ws,"Casey Nguyen").id;
  Edit.setMissingReason(ws,casey,"withdrawn");
  Edit.setNote(ws,casey,"Paused the search",false);
  var week3=WEEK2.concat([{name:"Casey Nguyen",agent:"Dana Marlow",ms:"Started",started:"2026-08-20",pqAt:"9/8/2026 9:00:00 AM"}]);
  ws=importInto(ws,HEADERS_B,week3.map(fx),"2026-09-11");
  var L=Workspace.loanById(ws,casey);
  eq([L.presence,L.missingReason,L.missingSince,L.note],["present",undefined,undefined,"Paused the search"]);
  ok(L.src.pq);
});

test("a new buyer is added and reported as new",function(){
  var ws=team2();
  var sky=loanNamed(ws,"Sky Okafor");
  eq([sky.id,sky.firstSeen.importId,sky.presence],["L0007","I0002","present"]);
});

test("an older export is kept as history and does not disturb the current report",function(){
  var ws=team2();
  var old=[{name:"Jordan Pike",agent:"Thomas Marlow",ms:"Started",started:"2026-06-01"},
           {name:"Old Timer",agent:"Tom Marlow",ms:"Started",started:"2026-05-20"}];
  var x=sourcesOf(HEADERS_B,old.map(fx)),p=Recon.plan(ws,x.sources,metaFor(x,"2026-08-01"));
  ok(p.older); ok(p.warnings.some(function(w){return w.k==="older";}));
  eq(p.missing.length,0,"an old export says nothing about who is missing now");
  var ws2=Recon.apply(ws,p,{now:"2026-09-05T10:00:00.000Z"});
  eq(loanNamed(ws2,"Jordan Pike").src.milestone,"CTC","newer facts are not overwritten");
  eq(loanNamed(ws2,"Jordan Pike").firstSeen.asOf,"2026-08-01","but first-seen moves back");
  var ot=loanNamed(ws2,"Old Timer");
  eq([ot.presence,ot.missingSince],["missing","2026-09-04"]);
  eq(Workspace.currentImport(ws2).id,"I0002");
  ok(ws2.imports[2].historical&&!ws2.imports[2].state);
});

test("two rows that cannot be told apart are matched in file order, with a warning",function(){
  var twins=[{name:"Pat Lee",started:"2026-07-01",ms:"Started"},{name:"Pat Lee",started:"2026-07-01",ms:"Processing",proc:"2026-08-01"}];
  var ws0=Workspace.create("T"),x=sourcesOf(HEADERS_B,twins.map(fx)),p=Recon.plan(ws0,x.sources,metaFor(x,"2026-08-28"));
  eq(p.counts.dupInFile,1); ok(p.warnings.some(function(w){return w.k==="dup-in-file";}));
  eq(p.rows.map(function(r){return r.keys[0];}),["ns:pat lee|2026-07-01","ns:pat lee|2026-07-01#2"]);
  var ws=Recon.apply(ws0,p,{now:"2026-08-28T15:00:00.000Z"});
  twins[1].ms="Approval"; twins[1].approval="2026-09-01";
  var x2=sourcesOf(HEADERS_B,twins.map(fx)),p2=Recon.plan(ws,x2.sources,metaFor(x2,"2026-09-04"));
  eq([p2.counts.matched,p2.counts.added],[2,0]);
  eq(Recon.apply(ws,p2).loans.map(function(L){return L.src.milestone;}),["Started","Approval"]);
});

test("when Loan Number first appears, buyers are re-keyed to it and it wins from then on",function(){
  var ws=team1();
  var withLn=WEEK2.map(function(o,i){var c=JSON.parse(JSON.stringify(o));c.ln="NFM-10"+i;return c;});
  var x=sourcesOf(withLoanNumber(HEADERS_B),withLn.map(fx)),p=Recon.plan(ws,x.sources,metaFor(x,"2026-09-04"));
  eq([p.keyMode,p.counts.matched,p.counts.upgraded,p.counts.added],["loanNumber",4,4,1]);
  ws=Recon.apply(ws,p,{now:"2026-09-04T15:00:00.000Z"});
  var J=loanNamed(ws,"Jordan Pike");
  ok(J.keys.indexOf("ln:NFM-101")>=0&&J.keys.indexOf("ns:jordan pike|2026-06-01")>=0);
  eq(ws.imports[1].counts.upgraded,4);
  eq(loanNamed(ws,"Sky Okafor").keys[0],"ln:NFM-104","a new buyer starts out on its loan number");

  /* the borrower's name is corrected in Encompass: the loan number still finds them */
  Edit.setNote(ws,J.id,"Keep me",false);
  var renamed=withLn.map(function(o){var c=JSON.parse(JSON.stringify(o));if(c.name==="Jordan Pike")c.name="Jordan Pike-Vale";return c;});
  var x3=sourcesOf(withLoanNumber(HEADERS_B),renamed.map(fx)),p3=Recon.plan(ws,x3.sources,metaFor(x3,"2026-09-11"));
  eq([p3.counts.matched,p3.counts.added],[5,0]);
  ws=Recon.apply(ws,p3,{now:"2026-09-11T15:00:00.000Z"});
  eq([Workspace.loanById(ws,J.id).src.name,Workspace.loanById(ws,J.id).note],["Jordan Pike-Vale","Keep me"]);

  /* and if the column is dropped again, the name and start date still do */
  var x4=sourcesOf(HEADERS_B,renamed.map(fx)),p4=Recon.plan(ws,x4.sources,metaFor(x4,"2026-09-18"));
  eq([p4.keyMode,p4.counts.matched,p4.counts.added],["nameStarted",5,0]);
});

test("a corrected name with no loan number is offered as a link, never assumed",function(){
  var ws=team1(),riley=loanNamed(ws,"Riley Chen").id;
  Edit.setNote(ws,riley,"Wants a 30-day close",false);
  var rows=WEEK2.map(function(o){var c=JSON.parse(JSON.stringify(o));if(c.name==="Riley Chen")c.name="Riley Chen-Park";return c;});
  var x=sourcesOf(HEADERS_B,rows.map(fx)),m=metaFor(x,"2026-09-04"),p=Recon.plan(ws,x.sources,m);
  eq(p.counts.added,2,"unlinked, it looks like a new buyer");
  eq(p.suggestions.length,1);
  eq([p.suggestions[0].newName,p.suggestions[0].oldName,p.suggestions[0].loanId],["Riley Chen-Park","Riley Chen",riley]);

  var apart=Recon.apply(ws,p,{now:m.importedAt});
  eq(apart.loans.length,8); eq(Workspace.loanById(apart,riley).presence,"missing");

  var links={}; links[p.suggestions[0].i]=riley;
  var joined=Recon.apply(ws,p,{links:links,now:m.importedAt});
  eq(joined.loans.length,7);
  var L=Workspace.loanById(joined,riley);
  eq([L.src.name,L.src.milestone,L.note,L.presence],["Riley Chen-Park","Processing","Wants a 30-day close","present"]);
  ok(L.keys.indexOf("ns:riley chen park|2026-07-15")>=0,"and next week it matches on its own");
  ok(joined.log.some(function(e){return e.t==="linked"&&e.loan===riley;}));
});

test("when Encompass catches up with a correction, the correction is retired",function(){
  var ws=team1(),jordan=loanNamed(ws,"Jordan Pike").id;
  Edit.setField(ws,jordan,"milestone","CTC",null,"2026-08-30T14:00:00.000Z");
  eq(Workspace.loanById(ws,jordan).overlay.milestone,{v:"CTC",base:"Approval",at:"2026-08-30T14:00:00.000Z"});
  ws=team2(ws);
  eq(Workspace.loanById(ws,jordan).overlay,{});
  ok(ws.log.some(function(e){return e.t==="caught-up"&&e.loan===jordan;}));
});

test("when Encompass and the loan officer disagree, their value stays and the difference is shown",function(){
  var ws=team1(),riley=loanNamed(ws,"Riley Chen").id,avery2=ws.loans[5].id;
  Edit.setField(ws,riley,"milestone","Approval",null,"2026-08-30T14:00:00.000Z");
  Edit.setField(ws,avery2,"name","Avery Stone Jr",null,"2026-08-30T14:00:00.000Z");
  ws=team2(ws);
  var f=viewOf(ws).files.filter(function(x){return x.loanId===riley;})[0];
  eq(f.milestone,"Approval");
  eq(f.conflicts,[{field:"milestone",now:"Processing"}]);
  eq(Workspace.loanById(ws,avery2).overlay.name.pending,undefined,"Encompass did not change the name, so nothing to settle");

  var kept=clone(ws); ok(Edit.keepMine(kept,riley,"milestone"));
  eq(Workspace.loanById(kept,riley).overlay.milestone.base,"Processing");
  eq(viewOf(kept).files.filter(function(x){return x.loanId===riley;})[0].conflicts,[]);
  var week3=importInto(kept,HEADERS_B,WEEK2.concat([{name:"Extra One",started:"2026-09-08"}]).map(fx),"2026-09-11");
  eq(Workspace.loanById(week3,riley).overlay.milestone.pending,undefined,"same Encompass value next week does not ask again");

  ok(Edit.acceptEncompass(ws,riley,"milestone"));
  eq(viewOf(ws).files.filter(function(x){return x.loanId===riley;})[0].milestone,"Processing");
});

test("an import that fails part-way leaves the team exactly as it was",function(){
  var ws=team1(),before=JSON.stringify(ws);
  var x=sourcesOf(HEADERS_B,WEEK2.map(fx)),p=Recon.plan(ws,x.sources,metaFor(x,"2026-09-04"));
  p.rows[2].src=null;                      // a row the reader could not make sense of
  throws(function(){Recon.apply(ws,p);});
  eq(JSON.stringify(ws),before);
});

test("an export for a different team is flagged before anything is added",function(){
  var ws=team1();
  var other=[{name:"Lee Park",agent:"Robin Quill",started:"2026-07-01"},{name:"Sam Ortiz",agent:"Jo Quill",started:"2026-07-02"}];
  var x=sourcesOf(HEADERS_B,other.map(fx)),p=Recon.plan(ws,x.sources,metaFor(x,"2026-09-04"));
  ok(p.warnings.some(function(w){return w.k==="wrong-team";}));
  eq(Recon.agentOverlap(ws,x.sources),{shared:0,inExport:2,known:4});
  var x2=sourcesOf(HEADERS_B,WEEK2.map(fx));
  eq(Recon.agentOverlap(ws,x2.sources).shared,4);
  no(Recon.plan(ws,x2.sources,metaFor(x2,"2026-09-04")).warnings.length);
});

test("a buyer taken off the team stays off when a later export lists them again",function(){
  var ws=team1(),casey=loanNamed(ws,"Casey Nguyen").id;
  Edit.setMissingReason(ws,casey,"removed");
  ws=importInto(ws,HEADERS_B,WEEK1.concat([{name:"Extra One",started:"2026-08-27"}]).map(fx),"2026-09-04");
  eq(Workspace.loanById(ws,casey).presence,"removed");
  eq(viewOf(ws).files.length,6);
});

test("only the last "+STATE_KEEP+" exports keep a full where-things-stood record",function(){
  var ws=Workspace.create("T");
  for(var i=1;i<=STATE_KEEP+2;i++)
    ws=importInto(ws,HEADERS_B,[fx({name:"Avery Stone",started:"2026-02-02",amount:1000*i})],"2026-06-"+pad(i,2));
  eq(ws.imports.length,STATE_KEEP+2);
  eq(ws.imports.filter(function(x){return x.state;}).length,STATE_KEEP);
  ok(!ws.imports[0].state&&!ws.imports[1].state&&ws.imports[2].state);
  eq(ws.loans.length,1);
});

group("since last time");

test("with no meeting marked, changes are measured from the previous export",function(){
  var ws=team2(),v=viewOf(ws),b=baselineFor(ws);
  eq([b.kind,b.label,isoDate(b.date)],["import","Since the last export","2026-08-28"]);
  var d=diffSince(b.state,v.files);
  eq(ids(d.added),["Sky Okafor"]);
  eq(ids(d.contract),["Riley Chen"]);
  eq(ids(d.preApproved),["Avery Stone"]);
  eq(d.moved.map(function(m){return m.f.name+":"+m.from+">"+m.to;}),["Jordan Pike:Approval>CTC"]);
  eq([d.closed.length,d.dropped.length,d.any],[0,0,true]);
  eq(baselineFor(team1()),null,"one export alone has nothing to compare with");
});

test("after a meeting is marked, changes are measured from that meeting",function(){
  var ws=team1(),v=viewOf(ws);
  var m=Recon.markPresented(ws,v,"mature","2026-08-28T18:00:00.000Z");
  eq([m.id,m.importId,m.stats.n,m.stats.pq,m.stats.funded,m.stats.volume],["M0001","I0001",6,4,1,410000]);
  no(diffSince(baselineFor(ws).state,viewOf(ws).files).any,"nothing has changed yet");

  ws=team2(ws);
  var closing=WEEK2.map(function(o){var c=JSON.parse(JSON.stringify(o));
    if(c.name==="Jordan Pike"){c.ms="Funding";c.funded="2026-09-09";} return c;});
  ws=importInto(ws,HEADERS_B,closing.map(fx),"2026-09-11");
  Edit.setMissingReason(ws,loanNamed(ws,"Casey Nguyen").id,"elsewhere");
  var b=baselineFor(ws);
  eq([b.kind,b.label],["meeting","Since we last met"]);
  var d=diffSince(b.state,viewOf(ws).files);
  eq(ids(d.closed),["Jordan Pike"]); eq(d.closedVolume,325000);
  eq(ids(d.dropped),["Casey Nguyen"]);
  eq(ids(d.added),["Sky Okafor"]);
  eq(ids(d.contract),["Riley Chen"]);
});

test("a buyer left off the report is left out of the changes too",function(){
  var ws=team2();
  Edit.hide(ws,loanNamed(ws,"Sky Okafor").id,true);
  eq(diffSince(baselineFor(ws).state,viewOf(ws).files).added.length,0);
});
