group("team file");

test("a new team starts empty, with the comparison switched off",function(){
  var ws=Workspace.create("  The Marlow Team ");
  eq(ws.format,"partnership-review-workspace"); eq(ws.schemaVersion,1);
  eq(ws.team.name,"The Marlow Team"); ok(/^T/.test(ws.team.id));
  eq(ws.settings.bench,{pq:null,close:null,source:"",period:"",population:null,validated:""});
  eq([ws.loans.length,ws.imports.length,ws.meetings.length,ws.log.length],[0,0,0,0]);
  eq(Workspace.create("").team.name,"New team");
});
test("file names are safe for Windows",function(){
  eq(Workspace.fileNameFor("The Marlow Team"),"The Marlow Team.partnership.json");
  eq(Workspace.fileNameFor('A/B: "C"?'),"A B C.partnership.json");
  eq(Workspace.fileNameFor("Dots..."),"Dots.partnership.json");
  eq(Workspace.fileNameFor("  "),"Team.partnership.json");
  ok(Workspace.fileNameFor(new Array(120).join("x")).length<=60+WS_EXT.length);
});
test("what is saved is what comes back",function(){
  var ws=importInto(Workspace.create("The Marlow Team"),HEADERS_B,WEEK1.map(fx),"2026-08-28");
  Edit.setNote(ws,"L0002","Appraisal is back",false,"2026-08-28T16:00:00.000Z");
  ws.team.photo="data:image/jpeg;base64,AAAA";
  var text=Workspace.serialize(ws);
  var back=Workspace.parse(text);
  eq(back.warnings,[]); eq(back.migratedFrom,null);
  eq(back.ws,ws);
  ok(text.indexOf("\n")>0,"written one item per line so it can be read in Notepad");
});
test("a file edited by hand opens, with a warning",function(){
  var text=Workspace.serialize(Workspace.create("The Marlow Team"));
  var back=Workspace.parse(text.replace("The Marlow Team","The Marlowe Team"));
  eq(back.ws.team.name,"The Marlowe Team");
  eq(back.warnings.length,1); ok(/changed outside the tool/.test(back.warnings[0]));
});
test("a damaged, foreign or too-new file is refused with a reason",function(){
  var text=Workspace.serialize(Workspace.create("X"));
  eq(throws(function(){Workspace.parse(text.slice(0,text.length-40));}).code,"not-json");
  eq(throws(function(){Workspace.parse('{"hello":"world"}');}).code,"not-workspace");
  eq(throws(function(){Workspace.parse("[]");}).code,"not-workspace");
  var newer=JSON.parse(text); newer.schemaVersion=99;
  var e=throws(function(){Workspace.parse(JSON.stringify(newer));},/newer version/);
  eq(e.code,"too-new");
});
test("an older file is upgraded step by step",function(){
  var text=Workspace.serialize(Workspace.create("X"));
  var steps={1:function(ws){ws.settings.added="in 2";},2:function(ws){ws.settings.added+=", then 3";ws.schemaVersion=3;}};
  var back=Workspace.parse(text,3,steps);
  eq([back.ws.schemaVersion,back.migratedFrom,back.ws.settings.added],[3,1,"in 2, then 3"]);
  eq(throws(function(){Workspace.parse(text,3,{1:steps[1]});},/no upgrade path/).code,"no-migration");
});
test("gaps in a file are filled in so the rest of the tool can rely on its shape",function(){
  var back=Workspace.parse(JSON.stringify({format:WS_FORMAT,schemaVersion:1,team:{name:"X"},
    loans:[{id:"L0007",src:{name:"Avery Stone"}}]}));
  var ws=back.ws;
  eq(ws.settings.basis,"mature"); eq(ws.settings.bench.pq,null); eq(ws.aliases,{});
  eq(ws.loans[0].overlay,{}); eq(ws.loans[0].note,""); eq(ws.loans[0].presence,"present"); eq(ws.loans[0].src.d,{});
  eq(ws.nextLoan,8,"new loans will not reuse a number already in the file");
  eq(ws.team.pos,{x:50,y:50,z:100});
});
test("the current export is the newest by its own date, never a historical one",function(){
  var ws=Workspace.create("X");
  ws.imports=[{id:"I1",asOf:"2026-08-28",importedAt:"2026-08-28T10:00:00Z"},
              {id:"I2",asOf:"2026-09-04",importedAt:"2026-09-04T10:00:00Z"},
              {id:"I3",asOf:"2026-09-04",importedAt:"2026-09-04T12:00:00Z"},
              {id:"I4",asOf:"2026-09-10",importedAt:"2026-09-11T10:00:00Z",historical:true}];
  eq(Workspace.currentImport(ws).id,"I3");
  eq(Workspace.currentImport(Workspace.create("Y")),null);
});
test("the change log keeps the newest entries and drops the oldest",function(){
  var ws=Workspace.create("X");
  for(var i=0;i<LOG_MAX+25;i++) Workspace.log(ws,{at:String(i),t:"edit"});
  eq(ws.log.length,LOG_MAX); eq(ws.log[0].at,"25"); eq(ws.log[LOG_MAX-1].at,String(LOG_MAX+24));
});
test("hashBytes tells two files apart and recognises the same one",function(){
  var a=new Uint8Array([1,2,3,4]),b=new Uint8Array([1,2,3,5]);
  eq(hashBytes(a),hashBytes(new Uint8Array([1,2,3,4])));
  ok(hashBytes(a)!==hashBytes(b));
  ok(hashBytes(a)!==hashBytes(new Uint8Array([1,2,3,4,0])),"length counts");
});
