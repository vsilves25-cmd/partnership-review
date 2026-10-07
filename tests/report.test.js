/* What ends up on the page, drawn into a hidden corner of the test page. */
group("the report");

function ctx(ws,over){
  var v=viewOf(ws),cur=v.current,hd=cur?cur.headers:[];
  var R={ws:ws,files:v.files,allFiles:v.files,today:v.today,asOf:v.asOf,names:v.names,
    basis:ws.settings.basis,showAll:ws.settings.showClosed,controls:true,edit:true,agentFilter:"",
    sort:{agent:{k:"n",dir:-1},file:{k:"daysInStage",dir:-1}},baseline:baselineFor(ws),
    haveCols:{apprOrdered:hasColumn(hd,COLS.apprOrdered),apprReceived:hasColumn(hd,COLS.apprReceived)},
    pqRule:cur?cur.pqRule:"",storage:{mode:"browser"},fileName:"x.partnership.json"};
  Object.keys(over||{}).forEach(function(k){R[k]=over[k];});
  if(R.agentFilter) R.files=v.files.filter(function(f){return f.agent===R.agentFilter;});
  return R;
}
function draw(ws,over){
  var stage=document.getElementById("stage");
  stage.innerHTML=reportHTML(ctx(ws,over));
  return stage;
}
function text(el){ return el.textContent.replace(/\s+/g," "); }
function week1(){ return importInto(Workspace.create("The Marlow Team"),HEADERS_B,WEEK1.map(fx),"2026-08-28"); }
function week2(ws){ return importInto(ws||week1(),HEADERS_B,WEEK2.map(fx),"2026-09-04"); }
function statcards(stage){ return Array.prototype.map.call(stage.querySelectorAll(".statcard .v"),function(e){return e.textContent;}); }

test("text from a file is shown as text, wherever it appears, and never runs",function(){
  var evil='<img src=x onerror="window.__pwned=1">',evil2='"><script>window.__pwned=2<\/script>',evil3="'onmouseover='window.__pwned=3";
  var rows=[fx({name:evil,agent:evil2,ms:"Processing",started:"2026-06-01",pqAt:"6/2/2026 1:00:00 PM",proc:"2026-08-01",estClose:"2026-09-10",
               comments:{"Milestone Comments - Processing":evil}}),
            fx({name:"Plain Buyer",agent:evil3,ms:evil,started:"2026-06-03"})];
  var ws=importInto(Workspace.create(evil),HEADERS_B,rows,"2026-09-04");
  ws.team.leadName=evil2; ws.team.leadRole=evil; ws.settings.bench={pq:40,close:40,source:evil,period:evil2,population:9,validated:evil};
  Edit.setNote(ws,"L0001",evil,false); Edit.setNote(ws,"L0001",evil2,true);
  ws=importInto(ws,HEADERS_B,[rows[1]],"2026-09-11");          // the first buyer is now missing: more places to appear
  delete window.__pwned;
  [{edit:true},{edit:false},{edit:true,agentFilter:evil2}].forEach(function(over){
    var stage=draw(ws,over);
    eq(stage.querySelectorAll("script").length,0,"no script element");
    eq(stage.querySelectorAll("img[src='x']").length,0,"no injected image");
    eq(stage.querySelectorAll("[onerror],[onmouseover]").length,0,"no injected handler");
    ok(stage.textContent.indexOf(evil)>=0,"the text itself is there to read");
  });
  var stage=draw(ws,{edit:true});
  eq(stage.querySelector("tr.buyer td.name [data-f=name]").textContent,evil);
  eq(window.__pwned,undefined);
});

test("presenter view and print carry nothing private and nothing editable",function(){
  var rows=WEEK1.map(fx);
  rows[1]["Milestone Comments - Processing"]="RC 8/1 - Credit score dropped after the re-pull";
  var ws=importInto(Workspace.create("The Marlow Team"),HEADERS_B,rows,"2026-08-28");
  var jordan=loanNamed(ws,"Jordan Pike").id,riley=loanNamed(ws,"Riley Chen").id;
  Edit.setNote(ws,jordan,"Appraisal is back at value",false);
  Edit.setNote(ws,jordan,"PRIVATE: thin reserves",true);
  Edit.hide(ws,riley,true);
  var next=WEEK2.map(fx);
  next[1]["Milestone Comments - Processing"]="RC 8/1 - Credit score dropped after the re-pull";
  ws=importInto(ws,HEADERS_B,next,"2026-09-04");             // two buyers go missing, so the private panel has content

  var html=reportHTML(ctx(ws,{edit:false})),stage=draw(ws,{edit:false});
  eq(stage.querySelectorAll("[contenteditable],select,input,button").length,0);
  eq(stage.querySelectorAll(".internal,.drawer,.pnote,.sug,.conf,.hidebtn,[data-drop]").length,0);
  no(/PRIVATE/.test(html),"the private note is not in the page at all");
  no(/Credit score dropped/.test(html),"nor the Encompass comment the loan officer did not approve");
  no(/not in latest export|For you only|Watch list/.test(html));
  ok(/Appraisal is back at value/.test(html),"the note they did write is there");
  no(/Riley Chen/.test(text(stage.querySelector(".sec:not(.since)")).split("Active buyers")[1]||""),"a hidden buyer is not listed");
  eq(stage.querySelectorAll(".avatar:not(.fixed)").length,0,"no empty photo placeholder for the partner");

  var edit=draw(ws,{edit:true});
  ok(edit.querySelector(".internal")&&edit.querySelector(".drawer")&&edit.querySelector(".pnote"));
  ok(/PRIVATE: thin reserves/.test(edit.innerHTML)&&/Credit score dropped/.test(edit.innerHTML));
  ok(Array.prototype.every.call(edit.querySelectorAll(".internal,.drawer,.pnote,.sug"),function(e){return e.classList.contains("noprint");}),
     "and on the working screen every private piece is marked never-print");
});

test("no comparison prints until the benchmark has a source and a period",function(){
  var ws=week1();
  no(/[Oo]ur average/.test(draw(ws,{edit:false}).textContent),"off by default");
  ws.settings.bench.pq=48; ws.settings.bench.close=46;
  no(/[Oo]ur average/.test(draw(ws,{edit:false}).textContent),"numbers alone are not enough");
  eq(draw(ws,{edit:false}).querySelectorAll(".track .mark").length,0);
  ws.settings.bench.source="NFM branch pipeline"; ws.settings.bench.period="2025";
  var stage=draw(ws,{edit:false});
  ok(/against our average of 48%/.test(stage.textContent));
  ok(/Our average: NFM branch pipeline, 2025\./.test(stage.textContent),"and the source is printed with it");
  eq(stage.querySelectorAll(".track .mark").length,2);
});

test("the headline counts and the two dates in the footer",function(){
  var ws=week1(),stage=draw(ws,{edit:false});
  eq(statcards(stage),["6","1","$410K"]);
  ok(/from Encompass records as of August 28, 2026\./.test(stage.querySelector(".foot").textContent));
  no(/Notes last updated/.test(stage.querySelector(".foot").textContent));
  Edit.setNote(ws,"L0002","A note",false,new Date(2026,8,2,10,0,0).toISOString());
  ok(/Notes last updated September 2, 2026\./.test(draw(ws,{edit:false}).querySelector(".foot").textContent));
  ws.settings.asOfOverride="2026-08-31";
  ok(/as of August 31, 2026/.test(draw(ws,{edit:false}).querySelector(".foot").textContent),"the as-of date can be corrected");
});

test("a closed loan that left the export still counts on the page",function(){
  var ws=importInto(week1(),HEADERS_B,WEEK2.slice(1).map(fx),"2026-09-04");
  eq(statcards(draw(ws,{edit:false})),["7","1","$410K"]);
});

test("since last time appears once there is something to compare, and says what changed",function(){
  no(draw(week1(),{edit:false}).querySelector(".since"),"one export: nothing to compare");
  var ws=week2(),since=draw(ws,{edit:false}).querySelector(".since");
  ok(since);
  eq(since.querySelector("h2").textContent,"Since the last export");
  ok(/since August 28, 2026/.test(since.textContent));
  var t=text(since);
  ok(/Under contract: Riley Chen/.test(t)&&/Pre-approved: Avery Stone/.test(t)&&/New: Sky Okafor/.test(t));
  ok(/Moved on: Jordan Pike Approval → Clear to close/.test(t));
  Recon.markPresented(ws,viewOf(ws),"mature","2026-09-04T18:00:00.000Z");
  no(draw(ws,{edit:false}).querySelector(".since"),"just presented: nothing has changed since");
});

test("a single-agent report shows only that agent's buyers",function(){
  var ws=week1(),stage=draw(ws,{edit:false,agentFilter:"Dana Marlow"});
  eq(statcards(stage)[0],"2");
  var t=stage.textContent;
  ok(/Riley Chen/.test(t)&&/Casey Nguyen/.test(t));
  no(/Jordan Pike|Morgan Bell|Avery Stone/.test(t));
  no(/By agent/.test(t));
  eq(stage.querySelector(".heroname h1").textContent,"Dana Marlow");
});

test("closing soon appears when the export has estimated closing dates in range",function(){
  var stage=draw(week1(),{edit:false});
  var h=Array.prototype.filter.call(stage.querySelectorAll("h2"),function(e){return /Closing in the next 30 days/.test(e.textContent);})[0];
  ok(h); ok(/Jordan Pike/.test(h.parentNode.textContent)&&/in 21 days/.test(h.parentNode.textContent));
  var none=importInto(Workspace.create("T"),HEADERS_B,[fx({name:"A B"})],"2026-08-28");
  no(/Closing in the next/.test(draw(none,{edit:false}).textContent));
});

test("a disagreement with Encompass is shown beside the buyer with both ways out",function(){
  var ws=week1(),riley=loanNamed(ws,"Riley Chen").id;
  Edit.setField(ws,riley,"milestone","Approval",null,"2026-08-30T14:00:00.000Z");
  ws=week2(ws);
  var stage=draw(ws,{edit:true}),conf=stage.querySelector('tr.noteline[data-id="'+riley+'"] .conf');
  ok(conf); ok(/Encompass now has Processing for the stage/.test(conf.textContent));
  ok(conf.querySelector('[data-accept="milestone"]')&&conf.querySelector('[data-keep="milestone"]'));
  eq(stage.querySelector('tr.buyer[data-id="'+riley+'"] select').value,"Approval","their value is the one in force");
});

test("the controls list what the export is missing and where the team is saved",function(){
  var ws=week1(),d=text(draw(ws,{edit:true}).querySelector(".drawer"));
  ok(/Loan Number: lets the tool follow a file/.test(d));
  ok(/PreQualified Client: the clearest marker/.test(d));
  ok(/matched between exports by name and file start date/.test(d));
  ok(/No withdrawn or denied file has ever appeared/.test(d));
  ok(/In this browser only/.test(d));
  ok(/Export of August 28, 2026: 6 rows, 6 new/.test(d));
  var f=text(draw(ws,{edit:true,storage:{mode:"folder",folderName:"Partner Reviews"},fileName:"The Marlow Team.partnership.json"}).querySelector(".drawer"));
  ok(/File The Marlow Team\.partnership\.json in the folder Partner Reviews/.test(f));
});

test("the loan officer's side comes from My details, and nothing about anyone is built in",function(){
  var ws=week1();
  var blank=draw(ws,{edit:false});
  eq(blank.querySelectorAll(".hero .person").length,1,"with nothing set up, only the partner's side is shown");
  no(/NMLS|Loan Originator/.test(blank.querySelector(".hero").textContent));
  ok(/Prepared at NFM Lending from Encompass records/.test(blank.querySelector(".foot").textContent));

  var working=draw(ws,{edit:true});
  eq(working.querySelectorAll(".hero .person").length,2);
  ok(working.querySelector('[data-drop="myphoto"]')&&working.querySelector('[data-profile="nmls"]'));
  eq(working.querySelector('[data-profile="name"]').getAttribute("data-ph"),"Your name");
  eq(working.querySelector('[data-profile="name"]').textContent,"");

  var me=Profile.create();
  me.name="Jamie Rivera"; me.nmls="123456"; me.signature="the Rivera Team";
  me.photo="data:image/jpeg;base64,AAAA"; me.title="Senior Loan Originator, NFM Lending";
  var mine=draw(ws,{edit:false,profile:me}),hero=text(mine.querySelector(".hero"));
  ok(/Jamie Rivera/.test(hero)&&/Senior Loan Originator, NFM Lending/.test(hero)&&/NMLS #123456/.test(hero));
  ok(/base64,AAAA/.test(mine.querySelector(".hero .person .avatar").getAttribute("style")));
  ok(/Prepared by the Rivera Team at NFM Lending from Encompass records as of August 28, 2026\./.test(mine.querySelector(".foot").textContent));
  eq(mine.querySelectorAll("[contenteditable],[data-drop]").length,0);
  ok(/Jamie Rivera, NMLS #123456/.test(text(draw(ws,{edit:true,profile:me}).querySelector(".drawer"))),"and the controls say whose details are in use");
});

test("the loan officer's own details are shown as text too",function(){
  var evil='<img src=x onerror="window.__pwned=9">';
  var me=Profile.create(); me.name=evil; me.title=evil; me.signature=evil; me.nmls="12";
  delete window.__pwned;
  [true,false].forEach(function(edit){
    var stage=draw(week1(),{edit:edit,profile:me});
    eq(stage.querySelectorAll("img[src='x'],script,[onerror]").length,0);
    ok(stage.textContent.indexOf(evil)>=0);
  });
  eq(window.__pwned,undefined);
});