/* The real Store code, run against a pretend folder and a pretend browser. */
group("saving");

var FAKE_CLOCK=1000;
function fakeDir(name){
  var files={};
  function handle(n){
    return {kind:"file",name:n,
      getFile:async function(){ var f=files[n]; return {text:async function(){return f.text;},lastModified:f.lm,size:f.text.length}; },
      createWritable:async function(){
        var buf="";
        return {write:async function(t){ if(dir.failWrites) throw new Error("There is not enough space on the disk."); buf+=t; },
                close:async function(){ files[n]={text:buf,lm:++FAKE_CLOCK}; },
                abort:async function(){}};
      }};
  }
  var dir={name:name,kind:"directory",files:files,perm:"granted",failWrites:false,
    queryPermission:async function(){return dir.perm;},
    requestPermission:async function(){dir.perm="granted";return "granted";},
    getFileHandle:async function(n,o){
      if(!(n in files)){
        if(o&&o.create) files[n]={text:"",lm:++FAKE_CLOCK};
        else { var e=new Error("A requested file or directory could not be found."); e.name="NotFoundError"; throw e; }
      }
      return handle(n);
    },
    removeEntry:async function(n){ delete files[n]; },
    entries:async function*(){ var names=Object.keys(files); for(var i=0;i<names.length;i++) yield [names[i],handle(names[i])]; },
    /* something other than this tool changes the file */
    touch:function(n,text){ files[n]={text:text==null?files[n].text:text,lm:++FAKE_CLOCK}; }
  };
  return dir;
}
function fakePlatform(dir){
  var kv={},ls={};
  var P={hasFolderApi:!!dir,kvFail:false,lsFail:false,downloads:[],kvData:kv,lsData:ls,
    pickFolder:async function(){return dir;},
    kv:{ready:async function(){return true;},
        get:async function(k){return kv[k];},
        put:async function(k,v){ if(P.kvFail) throw new Error("The browser refused the write."); kv[k]=v; },
        del:async function(k){ delete kv[k]; },
        keys:async function(){ return Object.keys(kv); }},
    ls:{get:function(k){return k in ls?ls[k]:null;},
        set:function(k,v){ if(P.lsFail) return false; ls[k]=v; return true; },
        del:function(k){ delete ls[k]; },
        keys:function(){ return Object.keys(ls); }},
    download:function(n,t){ P.downloads.push([n,t]); }};
  return P;
}
function marlowTeam(){ return importInto(Workspace.create("The Marlow Team"),HEADERS_B,WEEK1.map(fx),"2026-08-28"); }
var FN="The Marlow Team.partnership.json";
async function folderStore(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir);
  await Store.init(P); await Store.chooseFolder();
  return {dir:dir,P:P};
}

test("with no folder, a team is kept inside the browser and comes back",async function(){
  var P=fakePlatform(null),st=await Store.init(P);
  eq([st.mode,st.folderApi],["browser",false]);
  var ws=marlowTeam(),r=await Store.save(ws,FN,{now:"2026-08-28T16:00:00.000Z"});
  eq([r.revision,r.where],[1,["browser"]]);
  eq([ws.revision,ws.savedAt,ws.device,ws.appVersion],[1,"2026-08-28T16:00:00.000Z",st.device,APP_VERSION]);
  await Store.init(P);                                   // the browser is closed and reopened
  var list=await Store.list();
  eq([list.length,list[0].source,list[0].summary.name,list[0].summary.loans],[1,"browser","The Marlow Team",6]);
  var back=await Store.open(list[0]);
  eq(back.ws,ws); eq(back.recovered,false);
});

test("with a folder, every save writes the team's file and a second copy in the browser",async function(){
  var s=await folderStore();
  eq(Store.status().mode,"folder"); eq(Store.status().folderName,"Partner Reviews");
  var ws=marlowTeam(),r=await Store.save(ws,FN);
  eq(r.where,["browser","folder"]);
  eq(Workspace.parse(s.dir.files[FN].text).ws,ws);
  ok(s.P.kvData["draft:"+ws.team.id].revision===1);
  no(s.dir.files[FN+".bak"],"nothing to back up the first time");
  var list=await Store.list();
  eq([list.length,list[0].source,list[0].fileName],[1,"folder",FN]);
});

test("the folder is remembered, and the first save of a session keeps the old file as .bak",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  var first=s.dir.files[FN].text;
  var st=await Store.init(s.P);                          // a new session
  eq([st.mode,st.folderName],["folder","Partner Reviews"]);
  var opened=(await Store.open({fileName:FN,source:"folder"})).ws;
  Edit.setNote(opened,"L0002","A new note",false);
  await Store.save(opened,FN);
  eq(s.dir.files[FN+".bak"].text,first);
  eq(Workspace.parse(s.dir.files[FN].text).ws.revision,2);
  Edit.setNote(opened,"L0002","A second note",false);
  await Store.save(opened,FN);
  eq(s.dir.files[FN+".bak"].text,first,"one backup per session, not one per keystroke");
});

test("a folder that needs permission again is asked for, and works once granted",async function(){
  var s=await folderStore();
  s.dir.perm="prompt";
  var st=await Store.init(s.P);
  eq([st.mode,st.perm,st.folderName],["browser","prompt","Partner Reviews"]);
  st=await Store.grantFolder();
  eq([st.mode,st.perm],["folder","granted"]);
});

test("a file changed somewhere else is never overwritten without being asked",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  var other=clone(ws); other.revision=7; other.team.leadName="Changed elsewhere";
  s.dir.touch(FN,Workspace.serialize(other));
  Edit.setNote(ws,"L0002","Mine",false);
  var r=await Store.save(ws,FN);
  ok(r.conflict,"reported as a conflict"); eq(r.conflict.theirs.team.leadName,"Changed elsewhere");
  eq(r.where,["browser"],"my change is still safe in the browser");
  eq(Workspace.parse(s.dir.files[FN].text).ws.team.leadName,"Changed elsewhere","their file is untouched");
  var r2=await Store.save(ws,FN,{force:true});
  eq(r2.where,["browser","folder"]);
  eq(Workspace.parse(s.dir.files[FN].text).ws.loans[1].note,"Mine");
  eq(Workspace.parse(s.dir.files[FN+".bak"].text).ws.team.leadName,"Changed elsewhere","and the one replaced is kept");
});

test("a file merely touched, with the same contents, is not a conflict",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  s.dir.touch(FN);
  no((await Store.save(ws,FN)).conflict);
});

test("a full disk does not lose the change: it stays in the browser and is recovered",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  s.dir.failWrites=true;
  Edit.setNote(ws,"L0002","Typed while the disk was full",false);
  var r=await Store.save(ws,FN);
  eq(r.where,["browser"]); ok(/not enough space/.test(r.folderError));
  eq(Workspace.parse(s.dir.files[FN].text).ws.revision,1,"the file still holds the last good save");

  s.dir.failWrites=false;
  await Store.init(s.P);                                 // next time the tool is opened
  var back=await Store.open({fileName:FN,source:"folder"});
  eq([back.recovered,back.from,back.ws.revision],[true,"browser",2]);
  eq(back.ws.loans[1].note,"Typed while the disk was full");
});

test("when nothing at all can be written, the save fails loudly",async function(){
  var P=fakePlatform(null); await Store.init(P);
  P.kvFail=true; P.lsFail=true;
  await rejects(Store.save(marlowTeam(),FN),/Nothing could be saved/);
});

test("if the browser's database refuses, the simpler browser store is used instead",async function(){
  var P=fakePlatform(null); await Store.init(P);
  P.kvFail=true;
  var ws=marlowTeam(),r=await Store.save(ws,FN);
  eq(r.where,["browser"]); ok(r.browserError);
  P.kvFail=false; await Store.init(P);
  var list=await Store.list();
  eq(list.length,1);
  eq((await Store.open(list[0])).ws.loans.length,6);
});

test("text typed just before the tab closes is caught by the last-moment save",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  Edit.setNote(ws,"L0003","Typed, then the tab was closed",false);
  ok(Store.lastGasp(ws));
  eq(ws.revision,1,"the team in memory is not disturbed");
  await Store.init(s.P);
  var back=await Store.open({fileName:FN,source:"folder"});
  eq([back.recovered,back.ws.revision,back.ws.loans[2].note],[true,2,"Typed, then the tab was closed"]);
  await Store.save(back.ws,FN);
  eq(s.P.lsData["pr.draft."+ws.team.id],undefined,"cleared once it has been saved properly");
  eq(Workspace.parse(s.dir.files[FN].text).ws.loans[2].note,"Typed, then the tab was closed");
});

test("a damaged file is reported, and the browser's copy opens in its place",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  s.dir.touch(FN,s.dir.files[FN].text.slice(0,300));
  await Store.init(s.P);
  var list=await Store.list();
  eq(list.length,1); ok(/damaged or incomplete/.test(list[0].error)); eq(list[0].teamId,ws.team.id);
  var back=await Store.open(list[0]);
  eq([back.ws.loans.length,back.recovered],[6,true]);
  ok(/could not be read/.test(back.warnings[back.warnings.length-1]));
  var damaged=s.dir.files[FN].text;
  var r=await Store.save(back.ws,FN);
  eq(r.where,["browser","folder"],"written back, as the warning said it would be");
  eq(Workspace.parse(s.dir.files[FN].text).ws.loans.length,6);
  eq(s.dir.files[FN+".bak"].text,damaged,"and the damaged file is kept beside it");
});

test("asking for the file alone ignores a newer browser copy",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  s.dir.failWrites=true; Edit.setNote(ws,"L0001","Only in the browser",false); await Store.save(ws,FN);
  s.dir.failWrites=false;
  var back=await Store.open({fileName:FN,source:"folder"},{fileOnly:true});
  eq([back.from,back.ws.revision,back.ws.loans[0].note],["file",1,""]);
});

test("a team that only exists in the browser shows up beside the folder's teams",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir);
  P.kvData.dir=undefined;
  await Store.init(P);                                   // no folder chosen yet
  var early=Workspace.create("Early Team");
  await Store.save(early,"Early Team.partnership.json");
  await Store.chooseFolder();
  await Store.save(marlowTeam(),FN);
  var list=await Store.list();
  eq(list.map(function(t){return t.summary.name+":"+t.source;}).sort(),["Early Team:browser","The Marlow Team:folder"]);
  var opened=await Store.open(list.filter(function(t){return t.source==="browser";})[0]);
  await Store.save(opened.ws,"Early Team.partnership.json");
  ok(dir.files["Early Team.partnership.json"],"opening and saving it puts it in the folder");
});

test("two teams never share a file name",async function(){
  var s=await folderStore();
  await Store.save(marlowTeam(),FN);
  eq(await Store.uniqueFileName("The Marlow Team"),"The Marlow Team (2).partnership.json");
  eq(await Store.uniqueFileName("Another Team"),"Another Team.partnership.json");
});

test("deleting a team removes its file, its previous version and its browser copy",async function(){
  var s=await folderStore(),ws=marlowTeam();
  await Store.save(ws,FN);
  s.dir.touch(FN+".bak","an earlier version");
  await Store.remove({fileName:FN,teamId:ws.team.id,source:"folder"});
  no(s.dir.files[FN]); no(s.dir.files[FN+".bak"]); no(s.P.kvData["draft:"+ws.team.id]);
  eq((await Store.list()).length,0);
});

test("Save a copy hands the file to the browser's download",async function(){
  var P=fakePlatform(null); await Store.init(P);
  Store.download("x.partnership.json","{}");
  eq(P.downloads,[["x.partnership.json","{}"]]);
});

group("saving my details");

function jamie(){ var p=Profile.create(); p.name="Jamie Rivera"; p.nmls="123456"; return p; }

test("details are kept in the browser when there is no folder, and come back",async function(){
  var P=fakePlatform(null); await Store.init(P);
  eq(await Store.loadProfile(),null);
  var p=jamie(),r=await Store.saveProfile(p,{now:"2026-10-07T12:00:00.000Z"});
  eq([r.where,p.revision,p.savedAt],[["browser"],1,"2026-10-07T12:00:00.000Z"]);
  await Store.init(P);
  eq((await Store.loadProfile()).name,"Jamie Rivera");
});

test("with a folder, details are one small file beside the teams, and never listed as a team",async function(){
  var s=await folderStore(),p=jamie();
  eq((await Store.saveProfile(p)).where,["browser","folder"]);
  eq(Profile.parse(s.dir.files[PROFILE_FILE].text).name,"Jamie Rivera");
  await Store.save(marlowTeam(),FN);
  eq((await Store.list()).map(function(t){return t.fileName;}),[FN]);
  no(/Jamie Rivera|123456/.test(s.dir.files[FN].text),"and a team file never holds them");
});

test("a teams folder moved to a new PC brings the details with it",async function(){
  var s=await folderStore();
  await Store.saveProfile(jamie());
  var P2=fakePlatform(s.dir);                            // a different browser, the same folder
  await Store.init(P2); await Store.chooseFolder();
  var back=await Store.loadProfile();
  eq([back.name,back.nmls],["Jamie Rivera","123456"]);
  ok(P2.kvData.profile,"and the new browser now has its own copy");
});

test("details set before a folder was chosen are written into it",async function(){
  var dir=fakeDir("Partner Reviews"),P=fakePlatform(dir);
  await Store.init(P);
  await Store.saveProfile(jamie());
  no(dir.files[PROFILE_FILE]);
  await Store.chooseFolder();
  eq((await Store.loadProfile()).name,"Jamie Rivera");
  eq(Profile.parse(dir.files[PROFILE_FILE].text).name,"Jamie Rivera");
});

test("the newer of the folder's details and the browser's wins, and the other is brought up to date",async function(){
  var s=await folderStore(),p=jamie();
  await Store.saveProfile(p);
  var newer=clone(p); newer.name="Jamie Rivera-Cole"; newer.revision=5;
  s.dir.touch(PROFILE_FILE,Profile.serialize(newer));
  eq((await Store.loadProfile()).name,"Jamie Rivera-Cole");
  eq(Profile.parse(s.P.kvData.profile).name,"Jamie Rivera-Cole");
});

test("details typed just before the tab closes are caught",async function(){
  var P=fakePlatform(null); await Store.init(P);
  var p=Profile.create(); p.name="Jamie Rivera"; await Store.saveProfile(p);
  p.nmls="123456"; ok(Store.profileLastGasp(p)); eq(p.revision,1,"the copy in memory is not disturbed");
  await Store.init(P);
  var back=await Store.loadProfile();
  eq([back.nmls,back.revision],["123456",2]);
});