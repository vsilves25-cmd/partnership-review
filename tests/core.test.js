/* Pins the behaviour lifted from Pipeline Report V16. */
group("helpers");

test("clean trims and turns non-breaking spaces into spaces",function(){
  eq(clean("  a b  "),"a b"); eq(clean(null),""); eq(clean(undefined),""); eq(clean(0),"0");
});

test("parseDate reads every shape an export produces",function(){
  eq(isoDate(parseDate("2026-08-28")),"2026-08-28");
  eq(isoDate(parseDate("8/28/2026")),"2026-08-28");
  eq(isoDate(parseDate("8-28-2026")),"2026-08-28");
  eq(isoDate(parseDate("8/28/26")),"2026-08-28");
  eq(isoDate(parseDate("9/4/2026 3:15:07 PM")),"2026-09-04");
  eq(isoDate(parseDate(serial("2026-08-28"))),"2026-08-28");
  eq(isoDate(parseDate(serial("2026-08-28")+0.73)),"2026-08-28","a time of day does not move the date");
  eq(isoDate(parseDate(new Date(2026,7,28,23,59))),"2026-08-28");
  eq(parseDate(new Date(2026,7,28,1,0)).getHours(),12,"always pinned to noon");
});
test("parseDate gives null for blanks and nonsense",function(){
  eq(parseDate(""),null); eq(parseDate(" "),null); eq(parseDate(null),null);
  eq(parseDate("soon"),null); eq(parseDate(new Date("nope")),null);
});
test("parseMoney",function(){
  eq(parseMoney(325000),325000); eq(parseMoney("$1,234.50"),1234.5);
  eq(parseMoney("(500)"),-500); eq(parseMoney(""),0); eq(parseMoney(" "),0); eq(parseMoney("n/a"),0);
});
test("days, fmtDate, fmtLong, isoDate, money",function(){
  eq(days(parseDate("2026-08-28"),parseDate("2026-09-04")),7);
  eq(fmtDate(parseDate("2026-09-04")),"9/4/26"); eq(fmtDate(null),"—");
  eq(fmtLong(parseDate("2026-09-04")),"September 4, 2026");
  eq(isoDate(null),"");
  eq(money(1250000),"$1.3M"); eq(money(325000),"$325K"); eq(money(900),"$900");
});
test("esc neutralises every character that could start markup",function(){
  eq(esc('<img src=x onerror="a()">&\''),"&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
});
test("label renames the two stages buyers know by other names",function(){
  eq(label("CTC"),"Clear to close"); eq(label("Funding"),"Closed"); eq(label("Approval"),"Approval");
});

group("milestones");
test("classify sorts a milestone into stage, terminal or unknown",function(){
  eq(classify("Processing"),{kind:"stage",idx:2,raw:"Processing"});
  eq(classify("withdrawn").kind,"terminal");
  eq(classify("Adverse Action").kind,"terminal");
  eq(classify("Docs Out"),{kind:"unknown",raw:"Docs Out"});
  eq(classify(" "),{kind:"unknown",raw:"No milestone recorded"});
});

group("notes");
test("latestNote keeps the newest line and strips a processor stamp",function(){
  eq(latestNote("RC 1/14 - Sent the pre-approval letter\nRC 1/10 - Called"),"RC 1/14 - Sent the pre-approval letter");
  eq(latestNote("6/8/2026 5:08 PM(EST) Pat Doe > Waiting on the foundation report"),"Waiting on the foundation report");
  eq(latestNote(" "),"");
});
test("note columns: current milestone first, then latest stage back, then generic",function(){
  discoverNoteColumns(HEADERS_B);
  eq(NOTE_COLS.length,8);
  var order=noteColumnsFor("Processing");
  eq(order[0],"Milestone Comments - Processing");
  eq(order[1],"Milestone Comments - Docs Signing");
  ok(order.indexOf("Comments")>order.indexOf("Milestone Comments - Started"));
  var row={"Milestone Comments - Started":"early","Milestone Comments - Processing":"now","Comments":"generic"};
  eq(noteFrom(row,"Processing"),{text:"now",source:"Milestone Comments - Processing"});
  eq(noteFrom({"Comments":"generic"},"Processing"),{text:"generic",source:"Comments"});
  eq(noteFrom({},"Processing"),{text:"",source:""});
});

group("agent names");
test("sameAgent merges nicknames, initials and a surname typo, never two people",function(){
  var p=nameParts;
  ok(sameAgent(p("Tom Marlow"),p("Thomas Marlow")),"nickname");
  ok(sameAgent(p("T Marlow"),p("Thomas Marlow")),"initial");
  ok(sameAgent(p("Thomas Marlow"),p("Thomas Marlowe")),"surname typo, same first name");
  no(sameAgent(p("Tom Marlow"),p("Tim Marlow")),"Tom and Tim are different people");
  no(sameAgent(p("Tom Marlow"),p("Tom Vale")),"different surname");
  ok(sameAgent(p("Tom Marlowe"),p("Thomas Marlow")),"a typo is absorbed when the first names are the same person");
  no(sameAgent(p("T Marlowe"),p("Thomas Marlow")),"a typo is never absorbed on an initial alone");
});
test("resolveNames groups spellings under the most common one",function(){
  var rows=[{a:"Tom Marlow"},{a:"Tom Marlow"},{a:"Thomas Marlow"},{a:"T. Marlow"},{a:"Dana Marlow"},{a:""}];
  var names=resolveNames(rows,"a"),find=names.__find;
  eq(Object.keys(names).length,2);
  eq(names[find("thomas marlow")].label,"Tom Marlow");
  eq(names[find("t marlow")].variants.length,3,"the initial joins the only group it fits");
  eq(names[find("dana marlow")].label,"Dana Marlow");
  ok(Object.keys(names).indexOf("__find")<0,"__find never shows up as a name");
});
test("an initial that fits two people joins neither, so it cannot merge them",function(){
  var rows=[{a:"Tom Marlow"},{a:"Thomas Marlow"},{a:"T Marlow"},{a:"Tim Marlow"}];
  var names=resolveNames(rows,"a"),find=names.__find;
  eq(Object.keys(names).length,3);
  ok(find("tom marlow")===find("thomas marlow"));
  ok(find("tom marlow")!==find("tim marlow"),"Tom and Tim stay apart");
  ok(find("t marlow")!==find("tom marlow")&&find("t marlow")!==find("tim marlow"));
});
test("commonSurname names the team after the surname most agents share",function(){
  eq(commonSurname(["Tom Marlow","Dana Marlow","Chris Vale"]),"The Marlow Team");
  eq(commonSurname(["Chris Vale"]),"Chris Vale");
  eq(commonSurname([]),"Team");
});

group("reading an export");
test("a date cell comes back as the same calendar day in this time zone",function(){
  var w=workbook(HEADERS_A,[fx({name:"Avery Stone",started:"2026-03-08",pq:true}),
                            fx({name:"Jordan Pike",started:"2026-11-01",pq:true}),
                            fx({name:"Riley Chen",started:"2026-01-01",pq:true})]);
  var s=parseWorkbook(w.wb).rows.map(sourceFromRow);
  eq(s.map(function(x){return x.started;}),["2026-03-08","2026-11-01","2026-01-01"]);
});
test("the Data sheet is preferred, and the first sheet is used when there is none",function(){
  var w=workbook(HEADERS_A,[fx({name:"Avery Stone",pq:true})],{tableAoa:[["Something else"],["x"]]});
  eq(parseWorkbook(w.wb).sheet,"Data");
  var w2=workbook(HEADERS_A,[fx({name:"Avery Stone",pq:true})],{noTable:true,sheetName:"Sheet1"});
  eq(parseWorkbook(w2.wb).sheet,"Sheet1");
});
test("pre-approval rule: flag, then timestamp, then milestone date",function(){
  eq(parseWorkbook(workbook(HEADERS_A,[fx({name:"A B",pq:true})]).wb).pqRule,"flag");
  eq(parseWorkbook(workbook(HEADERS_B,[fx({name:"A B",pq:true})]).wb).pqRule,"date");
  var hm=HEADERS_B.filter(function(h){return h!=="PreQualified Client DateTime";});
  eq(parseWorkbook(workbook(hm,[fx({name:"A B"})]).wb).pqRule,"milestone");
});
test("a missing required column stops the import with a message the loan officer can act on",function(){
  function without(h){return HEADERS_A.filter(function(x){return x!==h;});}
  throws(function(){parseWorkbook(workbook(without("Borrower Name"),[fx({name:"A B"})]).wb);},/no Borrower Name column/);
  throws(function(){parseWorkbook(workbook(without("Buyers Agent Contact Name"),[fx({name:"A B"})]).wb);},/Buyers Agent Contact Name/);
  var noMs=HEADERS_A.filter(function(x){return x!=="Current Milestone"&&x!=="Last Finished Milestone";});
  throws(function(){parseWorkbook(workbook(noMs,[fx({name:"A B"})]).wb);},/no milestone column/);
  var noPq=HEADERS_A.filter(function(x){return !/PreQualified|Pre-Qualification/.test(x);});
  throws(function(){parseWorkbook(workbook(noPq,[fx({name:"A B"})]).wb);},/identifies a pre-approval/);
  throws(function(){parseWorkbook(workbook(HEADERS_A,[]).wb);},/No borrower rows/);
});
test("rows with no borrower are dropped; a repeated header keeps its first column",function(){
  var w=workbook(HEADERS_A,[fx({name:"Avery Stone",pq:true,ms:"Approval"}),fx({name:" "}),fx({name:"Jordan Pike"})]);
  var p=parseWorkbook(w.wb);
  eq(p.rows.length,2);
  eq(clean(p.rows[0]["Last Finished Milestone"]),"Approval");
  ok(p.headers.indexOf("Application Date")>=0);
});
test("sourceFromRow keeps what the report needs, and only that",function(){
  var w=workbook(withLoanNumber(HEADERS_B),[fx({name:"Jordan Pike",ln:"NFM-1001",agent:"Thomas Marlow",ms:"Approval",
    started:"2026-06-01",pqAt:"6/10/2026 3:15:07 PM",proc:"2026-07-20",approval:"2026-08-10",lastMs:"2026-08-10",
    amount:325000,estClose:"2026-09-18",lock:-12,apprOrdered:"2026-07-22",apprReceived:"2026-08-01",
    comments:{"Milestone Comments - Processing":"RC 8/1 - Appraisal is back"}})]);
  var s=sourceFromRow(parseWorkbook(w.wb).rows[0]);
  eq(s,{loanNumber:"NFM-1001",name:"Jordan Pike",agentRaw:"Thomas Marlow",milestone:"Approval",pq:true,
    pqDate:"2026-06-10",started:"2026-06-01",lastMs:"2026-08-10",
    d:{"Started":"2026-06-01","Processing":"2026-07-20","Approval":"2026-08-10"},
    amount:325000,encNote:"RC 8/1 - Appraisal is back",encNoteSource:"Milestone Comments - Processing",
    estClose:"2026-09-18",lockDays:-12,lockStatus:"",apprOrdered:"2026-07-22",apprReceived:"2026-08-01",
    loanType:"Conventional"});
  ok(!("address" in s)&&JSON.stringify(s).indexOf("Purchase")<0,"nothing beyond the listed fields is kept");
});
test("a blank lock column is no lock, not a lock of zero days",function(){
  var s=sourceFromRow(parseWorkbook(workbook(HEADERS_B,[fx({name:"A B",pqAt:"6/1/2026 1:00:00 PM"})]).wb).rows[0]);
  eq(s.lockDays,null); eq(s.estClose,""); eq(s.loanNumber,"");
});
test("missingRecommended lists what the export lacks, Loan Number first",function(){
  var m=missingRecommended(HEADERS_A).map(function(x){return x.key;});
  eq(m,["loanNumber","comments"]);
  eq(missingRecommended(withLoanNumber(HEADERS_B)).map(function(x){return x.key;}),["pqFlag"]);
});

group("clocks");
test("days in stage uses the stage's own date, then says when it is falling back",function(){
  var today=parseDate("2026-09-04");
  var b=build(parseWorkbook(workbook(HEADERS_B,[
    fx({name:"Has Stage",ms:"Processing",started:"2026-06-01",proc:"2026-08-25",pqAt:"6/2/2026 1:00:00 PM"}),
    fx({name:"Has Last",ms:"Resubmittal",started:"2026-06-01",lastMs:"2026-08-30",pqAt:"6/2/2026 1:00:00 PM"}),
    fx({name:"Has Start",ms:"Rec'd by Closer",started:"2026-08-05",pqAt:"8/6/2026 1:00:00 PM"}),
    fx({name:"Was Started",ms:"Started",started:"2026-08-20"})]).wb).rows,today);
  var f=b.files;
  eq([f[0].clockBasis,f[0].daysInStage],["stage",10]);
  eq([f[1].clockBasis,f[1].daysInStage],["lastMilestone",5]);
  eq([f[2].clockBasis,f[2].daysInStage],["fileStart",30]);
  eq([f[3].clockBasis,f[3].daysInStage,f[3].daysSinceReferral],["stage",15,15]);
});

group("statistics");
function statFiles(today){
  CLOCK.today=today;
  return build(parseWorkbook(workbook(HEADERS_A,[
    fx({name:"Closed Old",ms:"Funding",started:"2026-01-05",pq:true,pqAt:"1/10/2026 9:00:00 AM",proc:"2026-02-01",approval:"2026-02-15",ctc:"2026-02-25",funded:"2026-03-01",amount:400000}),
    fx({name:"Closed New",ms:"Funding",started:"2026-07-01",pq:true,pqAt:"7/5/2026 9:00:00 AM",proc:"2026-07-20",approval:"2026-08-01",ctc:"2026-08-11",funded:"2026-08-20",amount:250000}),
    fx({name:"Mature Open",ms:"Started",started:"2026-03-01",pq:true,pqAt:"3/5/2026 9:00:00 AM"}),
    fx({name:"Fresh PA",ms:"Started",started:"2026-08-01",pq:true,pqAt:"8/10/2026 9:00:00 AM"}),
    fx({name:"In Process",ms:"Processing",started:"2026-07-10",pq:true,pqAt:"7/15/2026 9:00:00 AM",proc:"2026-08-20"}),
    fx({name:"No PA",ms:"Started",started:"2026-08-25"}),
    fx({name:"Gone",ms:"Withdrawn",started:"2026-05-01",pq:true,pqAt:"5/5/2026 9:00:00 AM"})]).wb).rows,today).files;
}
test("summarize: the three close-rate bases",function(){
  var files=statFiles(parseDate("2026-09-04"));
  var m=summarize(files,"mature");
  eq([m.n,m.pq,m.pqRate,m.funded,m.volume],[7,6,86,2,650000]);
  eq([m.closeDen,m.closeRate],[4,50],"mature: closed, plus pre-approved 120 or more days ago");
  var a=summarize(files,"all");   eq([a.closeDen,a.closeRate],[6,33]);
  var c=summarize(files,"contract"); eq([c.closeDen,c.closeRate],[3,67]);
});
test("a rate over nothing is no rate, not zero",function(){
  eq(rate(0,0),null);
  var s=summarize([], "mature"); eq([s.pqRate,s.closeRate],[null,null]);
});
test("medians measure stage-to-stage days and ignore a funding date typed in a meeting",function(){
  var files=statFiles(parseDate("2026-09-04"));
  var m=medians(files);
  eq(m["CTC"],null,"CTC to Rec'd by Closer has no dates");
  eq(m["Approval"],null,"Approval to Resubmittal has no dates");
  eq(m["Processing"],14,"two files: 14 and 12 days, upper median");
  files[4]._d["Funding"]=parseDate("2026-09-04"); files[4]._d["Rec'd by Closer"]=parseDate("2026-09-01");
  files[4].fundingSource="manual";
  eq(medians(files)["Rec'd by Closer"],null);
  files[4].fundingSource="export";
  eq(medians(files)["Rec'd by Closer"],3);
});
test("monthly fills empty months so a quiet month reads as zero",function(){
  var files=statFiles(parseDate("2026-09-04"));
  var mo=monthly(files);
  eq(mo.map(function(x){return x.label+":"+x.n;}),["Jan:1","Feb:0","Mar:1","Apr:0","May:1","Jun:0","Jul:2","Aug:2"]);
});
test("sortRows puts blanks last in either direction",function(){
  var rows=[{k:3},{k:null},{k:1}];
  eq(sortRows(rows,{k:"k",dir:-1}).map(function(r){return r.k;}),[3,1,null]);
  eq(sortRows(rows,{k:"k",dir:1}).map(function(r){return r.k;}),[1,3,null]);
  eq(sortRows([{k:"b"},{k:"A"}],{k:"k",dir:1}).map(function(r){return r.k;}),["A","b"]);
});
test("benchmarkFrom works out a sourced average from a whole pipeline",function(){
  var today=parseDate("2026-09-04"),files=statFiles(today);
  CLOCK.today=null;
  var b=benchmarkFrom(files,today);
  eq([b.pq,b.close,b.population],[86,50,7]);
  eq(b.period,"files started 1/5/26 – 8/25/26");
  eq(CLOCK.today,null,"leaves the clock as it found it");
});
