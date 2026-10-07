/* ============ app ============ */
/* The screens around the report: the list of teams, opening and saving, adding
   an export, and the wiring that turns clicks and typing into saved changes. */

/* Resolves once storage is open. A file dropped in the first moments waits for it. */
var READY=Promise.resolve();
var APP={screen:"home",ws:null,ref:null,view:null,teams:[],
         status:{mode:"browser",folderApi:false,folderName:"",perm:"none"},
         presenting:false,printing:false,agentFilter:"",controls:false,
         sort:{agent:{k:"n",dir:-1},file:{k:"daysInStage",dir:-1}},
         undo:[],undoKey:"",dirty:false,saving:false,again:false,timer:null,force:false,
         save:{cls:"",text:""},banners:[],pointerDown:false,renderPending:false,drag:null,
         profile:Profile.create(),profileDirty:false,profileTimer:null};

function $(id){return document.getElementById(id);}
function timeText(iso){
  var d=iso?new Date(iso):new Date();
  var h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");
  return ((h+11)%12+1)+":"+m+(h<12?" AM":" PM");
}

/* ---------- small UI pieces ---------- */
var toastTimer=null;
function toast(msg,bad){
  var t=$("toast"); t.textContent=msg; t.className="toast"+(bad?" bad":""); t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.hidden=true;},bad?9000:4500);
}
function closeModal(){ var m=$("modal"); m.hidden=true; m.innerHTML=""; m.onclick=null; }
/* Shows a dialog. wire(dialogElement, close) attaches its buttons. */
function modal(html,wire,sticky){
  var m=$("modal");
  m.innerHTML='<div class="dialog" role="dialog" aria-modal="true">'+html+'</div>';
  m.hidden=false;
  m.onclick=sticky?null:function(e){ if(e.target===m) closeModal(); };
  if(wire) wire(m.firstChild,closeModal);
  var first=m.querySelector("input[type=text],button.primary"); if(first) first.focus();
}
function ask(title,body,okLabel,danger){
  return new Promise(function(res){
    modal('<h2>'+esc(title)+'</h2><p>'+body+'</p><div class="acts">'+
      '<button class="btn" data-x="no">Cancel</button>'+
      '<button class="btn primary" data-x="yes">'+esc(okLabel||"OK")+'</button></div>',
      function(d,close){
        d.querySelector('[data-x="no"]').onclick=function(){close();res(false);};
        d.querySelector('[data-x="yes"]').onclick=function(){close();res(true);};
      },true);
  });
}
function askText(title,body,value,okLabel){
  return new Promise(function(res){
    modal('<h2>'+esc(title)+'</h2><p>'+body+'</p><input type="text" id="asktext" value="'+esc(value||"")+'">'+
      '<div class="acts"><button class="btn" data-x="no">Cancel</button>'+
      '<button class="btn primary" data-x="yes">'+esc(okLabel||"OK")+'</button></div>',
      function(d,close){
        var inp=d.querySelector("#asktext");
        function yes(){ var v=clean(inp.value); if(!v){inp.focus();return;} close(); res(v); }
        d.querySelector('[data-x="no"]').onclick=function(){close();res(null);};
        d.querySelector('[data-x="yes"]').onclick=yes;
        inp.onkeydown=function(e){ if(e.key==="Enter") yes(); };
        inp.select();
      },true);
  });
}
function pickFile(accept){
  return new Promise(function(res){
    var inp=document.createElement("input");
    inp.type="file"; inp.accept=accept;
    inp.onchange=function(){ res(inp.files[0]||null); };
    inp.click();
  });
}

/* ---------- reading files ---------- */
function readExport(file){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(e){
      try{
        var u8=new Uint8Array(e.target.result);
        var wb=XLSX.read(u8,{type:"array",cellDates:true});
        var p=parseWorkbook(wb);
        var sources=p.rows.map(sourceFromRow);
        res({sources:sources,meta:{fileName:file.name,fileHash:hashBytes(u8),size:u8.length,
          asOf:isoDate(parseDate(new Date(file.lastModified||Date.now()))),
          importedAt:new Date().toISOString(),headers:p.headers,pqRule:p.pqRule}});
      }catch(ex){
        rej(new Error(ex.message||"That file could not be read. It should be the .xlsx straight out of Encompass."));
      }
    };
    fr.onerror=function(){rej(new Error("The file could not be opened."));};
    fr.readAsArrayBuffer(file);
  });
}
function readText(file){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(e){res(String(e.target.result));};
    fr.onerror=function(){rej(new Error("The file could not be opened."));};
    fr.readAsText(file);
  });
}
/* Dropped photos are usually the wrong shape and the wrong size for a small
   circle. Square them off, scale to 2x the display size for retina screens,
   and re-encode cleanly rather than letting the browser squash the original.
   Logos keep their shape and transparency and are only scaled down. */
function readImage(file,cb,square,wide){
  if(!file||!/^image\//.test(file.type))return;
  var fr=new FileReader();
  fr.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var cv=document.createElement("canvas"),ctx=cv.getContext("2d");
      try{
        if(square){
          var side=Math.min(img.width,img.height);
          var out=Math.min(512,Math.max(256,side));
          cv.width=out; cv.height=out;
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
          // centre horizontally; bias upward, because heads sit above centre
          var sx=(img.width-side)/2;
          var sy=Math.max(0,(img.height-side)*0.25);
          ctx.drawImage(img,sx,sy,side,side,0,0,out,out);
          cb(cv.toDataURL("image/jpeg",0.92));
        } else if(wide){
          /* a background photo: scaled to the width asked for, as a JPEG */
          var kw=Math.min(1,wide/img.width);
          cv.width=Math.round(img.width*kw); cv.height=Math.round(img.height*kw);
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
          ctx.drawImage(img,0,0,cv.width,cv.height);
          cb(cv.toDataURL("image/jpeg",0.82));
        } else {
          var k=Math.min(1,480/img.width,200/img.height);
          if(k===1&&e.target.result.length<200000){ cb(e.target.result); return; }
          cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k);
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
          ctx.drawImage(img,0,0,cv.width,cv.height);
          cb(cv.toDataURL("image/png"));
        }
      }catch(err){ cb(e.target.result); }
    };
    img.onerror=function(){ toast("That image could not be read.",true); };
    img.src=e.target.result;
  };
  fr.readAsDataURL(file);
}

/* ---------- saving ---------- */
function setSave(cls,text,title){
  APP.save={cls:cls,text:text,title:title||""};
  var el=$("savestate");
  if(el){ el.className="savestate "+cls; el.textContent=text; el.title=title||""; }
}
/* The save runs 0.7 seconds after the first unsaved change, not after the last
   one: more changes arriving do not push it back, so steady typing still saves. */
function queueSave(){
  APP.dirty=true;
  setSave("busy","Saving…");
  if(APP.timer)return;
  APP.timer=setTimeout(flush,700);
}
function cancelSave(){ clearTimeout(APP.timer); APP.timer=null; }
async function flush(){
  cancelSave();
  if(!APP.ws||!APP.dirty)return;
  if(APP.saving){ APP.again=true; return; }
  APP.saving=true; APP.dirty=false;
  var ws=APP.ws,ref=APP.ref,force=APP.force; APP.force=false;
  try{
    var r=await Store.save(ws,ref.fileName,{force:force});
    if(ws===APP.ws){
      var inFolder=r.where.indexOf("folder")>=0;
      if(r.conflict){
        APP.conflict=r.conflict;
        setSave("bad","File changed elsewhere","Your changes are safe in this browser. Choose what to do in the red bar.");
        renderBar();
      } else if(r.folderError){
        setSave("warn","Saved in this browser only","The file could not be written: "+r.folderError);
      } else {
        APP.conflict=null;
        setSave("",(inFolder?"Saved ":"Saved in this browser ")+timeText(ws.savedAt),inFolder
          ?ref.fileName+" in the folder "+APP.status.folderName
          :"Kept in this browser. Choose a folder on the Teams page to keep a file as well.");
      }
    }
  }catch(e){
    APP.dirty=true;
    setSave("bad","NOT SAVED",e.message);
    toast("Your changes could not be saved: "+e.message+" Use Save a copy in the controls so nothing is lost.",true);
  }
  APP.saving=false;
  if(APP.again){ APP.again=false; if(APP.dirty) queueSave(); }
}

/* ---------- changing the team ---------- */
/* Runs one change. fn returns false when nothing changed. key lets a run of
   keystrokes in one field count as a single step for Undo. */
function change(fn,opts){
  opts=opts||{};
  var before=JSON.stringify(APP.ws);
  var changed=fn(APP.ws);
  if(changed===false)return false;
  if(!(opts.key&&opts.key===APP.undoKey)){
    APP.undo.push(before);
    if(APP.undo.length>40)APP.undo.shift();
  }
  APP.undoKey=opts.key||"";
  rebuild();
  if(!opts.quiet)render();
  queueSave();
  return true;
}
function undo(){
  if(!APP.undo.length)return;
  var rev=APP.ws.revision,prev=JSON.parse(APP.undo.pop());
  prev.revision=rev;                    // revisions only ever go up
  APP.ws=prev; APP.undoKey="";
  rebuild(); render(); queueSave();
  toast("Undone.");
}
function rebuild(){
  APP.view=buildView(APP.ws);
  CLOCK.today=APP.view.today;
  if(APP.agentFilter&&!APP.view.files.some(function(f){return f.agent===APP.agentFilter;})) APP.agentFilter="";
}
function fileById(id){
  return APP.view.files.filter(function(f){return f.loanId===id;})[0]||null;
}

/* ---------- my details ---------- */
/* The loan officer's own name, NMLS number and photo. They are saved apart
   from any team and are not part of Undo. */
function profileChange(fn,quiet){
  if(fn(APP.profile)===false)return false;
  APP.profileDirty=true;
  if(!quiet){ if(APP.screen==="team") render(); else renderHome(); }
  if(!APP.profileTimer) APP.profileTimer=setTimeout(flushProfile,500);
  return true;
}
/* Saves run one after another, and the promise returned settles only when
   every save asked for so far has finished. */
function flushProfile(){
  clearTimeout(APP.profileTimer); APP.profileTimer=null;
  APP.profileSaving=(APP.profileSaving||Promise.resolve()).then(async function(){
    if(!APP.profileDirty)return;
    APP.profileDirty=false;
    try{
      var r=await Store.saveProfile(APP.profile);
      if(r.folderError) toast("Your details are saved in this browser, but not in the folder: "+r.folderError,true);
    }catch(e){ APP.profileDirty=true; toast(e.message,true); }
  });
  return APP.profileSaving;
}
function importProfile(p){
  p.revision=Math.max(p.revision,APP.profile.revision);
  APP.profile=p; APP.profileDirty=true;
  if(APP.screen==="team") render(); else renderHome();
  return flushProfile();
}
function myDetails(){
  var p=APP.profile,photo=p.photo,bg=p.background;
  function pic(){ return '<div class="pic big"'+(photo?' style="background-image:url('+esc(photo)+')"':'')+'>'+(photo?'':'Photo')+'</div>'; }
  modal('<h2>My details</h2><p>These go on every report you make. They are saved on this computer with your teams.</p>'+
    '<div class="formrow"><div id="md-pic">'+pic()+'</div><div class="grow">'+
      '<label>Your name<input type="text" id="md-name" value="'+esc(p.name)+'" placeholder="First and last name"></label>'+
      '<label>NMLS number<input type="text" id="md-nmls" value="'+esc(p.nmls)+'" placeholder="Digits only" inputmode="numeric"></label>'+
    '</div></div>'+
    '<div class="formrow"><button class="btn" id="md-photo">Choose a photo</button>'+
      '<button class="btn" id="md-nophoto">Remove photo</button>'+
      '<span class="who">Or drop a photo on your circle on any report. Drag it there to reframe.</span></div>'+
    '<label>Title<input type="text" id="md-title" value="'+esc(p.title)+'" placeholder="Loan Originator, '+COMPANY+'"></label>'+
    '<label>Footer name, if you sign as a team<input type="text" id="md-sig" value="'+esc(p.signature)+'" placeholder="the Smith Team"></label>'+
    '<p class="who" id="md-foot"></p>'+
    '<div class="formrow"><button class="btn" id="md-bg">Use my own background photo</button>'+
      '<button class="btn" id="md-nobg">Use the standard background</button>'+
      '<span class="who" id="md-bgstate"></span></div>'+
    '<div class="acts"><button class="btn" id="md-export">Save a copy of my details</button><span class="sp"></span>'+
      '<button class="btn" data-x="no">Cancel</button><button class="btn primary" data-x="yes">Save</button></div>',
    function(d,close){
      function val(id){ return clean(d.querySelector(id).value); }
      function foot(){
        d.querySelector("#md-foot").textContent="The foot of each report will read: “"+
          Profile.preparedBy({signature:val("#md-sig"),name:val("#md-name")})+" from Encompass records as of …”";
        d.querySelector("#md-bgstate").textContent=bg?"Using your own background.":"Using the standard background.";
      }
      foot();
      d.querySelector("#md-name").oninput=d.querySelector("#md-sig").oninput=foot;
      d.querySelector("#md-photo").onclick=async function(){
        var f=await pickFile("image/*");
        if(f) readImage(f,function(url){ photo=url; d.querySelector("#md-pic").innerHTML=pic(); },true);
      };
      d.querySelector("#md-nophoto").onclick=function(){ photo=""; d.querySelector("#md-pic").innerHTML=pic(); };
      d.querySelector("#md-bg").onclick=async function(){
        var f=await pickFile("image/*");
        if(f) readImage(f,function(url){ bg=url; foot(); },false,1400);
      };
      d.querySelector("#md-nobg").onclick=function(){ bg=""; foot(); };
      d.querySelector("#md-export").onclick=function(){
        Store.download(PROFILE_FILE,Profile.serialize(APP.profile));
        toast("A copy of your details was saved to your Downloads folder.");
      };
      d.querySelector('[data-x="no"]').onclick=close;
      d.querySelector('[data-x="yes"]').onclick=function(){
        var name=val("#md-name"),nmls=Profile.cleanNmls(val("#md-nmls")),title=val("#md-title"),sig=val("#md-sig");
        close();
        profileChange(function(q){
          var newPhoto=photo!==q.photo;
          q.name=name; q.nmls=nmls; q.title=title||Profile.create().title; q.signature=sig; q.background=bg;
          q.photo=photo; if(newPhoto) q.pos={x:50,y:50,z:100};
        });
        flushProfile();
      };
    },true);
}

/* ---------- home ---------- */
async function showHome(){
  await flush();
  await flushProfile();
  APP.screen="home"; APP.ws=null; APP.ref=null; APP.view=null; APP.undo=[]; APP.presenting=false;
  APP.conflict=null; APP.banners=[];
  document.body.classList.remove("presenting");
  APP.status=Store.status();
  try{ var mine1=await Store.loadProfile(); if(mine1) APP.profile=mine1; }catch(e){}
  try{ APP.teams=await Store.list(); }
  catch(e){ APP.teams=[]; toast("The teams folder could not be read: "+e.message,true); }
  renderHome();
}
function storageCard(){
  var st=APP.status;
  if(!st.folderApi)
    return '<div class="storage"><div>This browser cannot save into a folder, so teams are kept inside the browser. '+
      'Use <b>Save a copy</b> inside a team for a backup. Edge and Chrome can save straight to a folder.</div></div>';
  if(st.mode==="folder")
    return '<div class="storage"><div>Teams are saved as files in the folder <b>'+esc(st.folderName)+
      '</b>, and every change saves itself.</div><span class="sp"></span>'+
      '<button class="btn" id="pickfolder">Change folder</button></div>';
  if(st.folderName)
    return '<div class="storage need"><div>Your teams are in the folder <b>'+esc(st.folderName)+
      '</b>. Edge needs your go-ahead to open it.</div><span class="sp"></span>'+
      '<button class="btn primary" id="grantfolder">Open my teams folder</button>'+
      '<button class="btn" id="pickfolder">Use a different folder</button></div>';
  return '<div class="storage need"><div><b>Choose where to keep your teams.</b> Pick a folder once and each team '+
    'becomes a file there that saves itself as you work. Until then, teams are kept inside this browser.</div>'+
    '<span class="sp"></span><button class="btn primary" id="pickfolder">Choose a folder</button></div>';
}
function renderHome(){
  $("bar").innerHTML=""; $("report").style.display="none"; $("report").innerHTML="";
  var me=APP.profile,lack=Profile.missing(me);
  var h='<div class="homehead"><div><h1>Partnership Reviews</h1>'+
    '<p>'+(me.name?esc(me.name)+', ':'')+COMPANY+'. One saved review per realtor team.</p></div>'+
    '<div class="acts"><button class="btn" id="mydetails">My details</button>'+
    '<button class="btn" id="opencopy">Open a copy</button>'+
    '<button class="btn primary" id="newteam">New team</button></div></div>'+
    (lack.length?'<div class="storage need"><div><b>Add your details.</b> '+
      esc(lack.join(" and ").replace(/^y/,"Y"))+(lack.length>1?" are":" is")+' not set yet. '+
      'They go on every report, with your photo.</div><span class="sp"></span>'+
      '<button class="btn primary" id="setup">Set up my details</button></div>':'')+
    storageCard();
  if(APP.teams.length){
    h+='<div class="teams">';
    APP.teams.forEach(function(t,i){
      var s=t.summary;
      if(t.error){
        h+='<div class="team broken"><div class="pic">!</div><div><div class="nm">'+esc(s.name)+'</div>'+
           '<div class="meta">'+esc(t.error)+'</div>'+
           (t.teamId?'<button class="mini" data-open="'+i+'">Open the copy kept in this browser</button>':'')+'</div></div>';
        return;
      }
      var bits=[plural(s.loans,"buyer")];
      if(s.asOf) bits.push("export of "+fmtDate(parseDate(s.asOf)));
      if(s.lastMeeting) bits.push("presented "+fmtDate(localDay(s.lastMeeting)));
      h+='<button class="team" data-open="'+i+'">'+
         '<div class="pic"'+(s.photo?' style="background-image:url('+esc(s.photo)+')"':'')+'>'+
           (s.photo?'':esc((s.name||"?").replace(/^The\s+/i,"").charAt(0).toUpperCase()))+'</div>'+
         '<div><div class="nm">'+esc(s.name)+'</div><div class="meta">'+esc(bits.join(" · "))+'</div>'+
         (t.source==="browser"&&APP.status.mode==="folder"?'<span class="tagm">in this browser only; opens into the folder</span>':'')+
         '</div></button>';
    });
    h+='</div>';
  } else h+='<p class="empty">No teams yet. Drop an Encompass export below to start the first one.</p>';
  $("ver").textContent="Partnership Review "+APP_VERSION+". Nothing on this page is sent anywhere.";
  $("home").innerHTML=h; $("home").style.display="block";
  var drop=$("drop");
  drop.style.display="block"; drop.className=APP.teams.length?"small":"";
  $("droptitle").textContent=APP.teams.length?"Add an Encompass export":"Team pipeline report";
  $("err").style.display="none";

  $("newteam").onclick=newTeam;
  $("opencopy").onclick=openCopy;
  $("mydetails").onclick=myDetails;
  var su=$("setup"); if(su) su.onclick=myDetails;
  var pf=$("pickfolder"); if(pf) pf.onclick=async function(){
    try{ APP.status=await Store.chooseFolder(); await showHome(); }
    catch(e){ if(e.name!=="AbortError") toast("That folder could not be used: "+e.message,true); }
  };
  var gf=$("grantfolder"); if(gf) gf.onclick=async function(){
    APP.status=await Store.grantFolder();
    if(APP.status.perm!=="granted") toast("Edge did not allow the folder. Teams kept in this browser are still available.",true);
    await showHome();
  };
  $("home").querySelectorAll("[data-open]").forEach(function(el){
    el.onclick=function(){ openTeam(APP.teams[+el.getAttribute("data-open")]); };
  });
}
function fail(m){ var e=$("err"); e.textContent=m; e.style.display="block"; }

async function newTeam(){
  await READY;
  var name=await askText("New team","What should this team be called? You can change it later.","","Create team");
  if(!name)return;
  await startTeam(Workspace.create(name));
}
async function startTeam(ws){
  var fileName=await Store.uniqueFileName(ws.team.name);
  APP.ws=ws; APP.ref={fileName:fileName,teamId:ws.team.id,source:APP.status.mode};
  APP.undo=[]; APP.agentFilter=""; APP.controls=false; APP.conflict=null; APP.banners=[];
  APP.screen="team"; rebuild(); render();
  APP.dirty=true; await flush();
}
async function openTeam(ref,opts){
  try{
    var r=await Store.open(ref,opts);
    APP.ws=r.ws; APP.ref={fileName:ref.fileName,teamId:r.ws.team.id,source:ref.source};
    APP.undo=[]; APP.agentFilter=""; APP.controls=false; APP.conflict=null;
    APP.banners=r.warnings.slice();
    APP.screen="team"; rebuild();
    setSave("",r.ws.savedAt?"Saved "+timeText(r.ws.savedAt):"Saved");
    render();
    if(r.recovered){ toast("Recovered changes that had not reached the file. Saving them now."); queueSave(); }
    else if(r.migratedFrom!=null||r.from==="browser"&&APP.status.mode==="folder") queueSave();
  }catch(e){ toast(e.message,true); }
}
async function openCopy(){
  var file=await pickFile(".json,.bak");
  if(file) await openCopyFile(file);
}
async function openCopyFile(file){
  await READY;
  var p,text;
  try{ text=await readText(file); }
  catch(e){ toast(e.message,true); return; }

  /* a details file, not a team: someone setting up from a copy of their own */
  if(Profile.isProfileText(text)){
    var mine;
    try{ mine=Profile.parse(text); }catch(e){ toast(e.message,true); return; }
    if(Profile.complete(APP.profile)&&APP.profile.name!==mine.name){
      var swap=await ask("Replace your details?","This file holds the details of <b>"+esc(mine.name||"someone with no name set")+
        "</b>. Yours are currently set to <b>"+esc(APP.profile.name)+"</b>.","Use this file");
      if(!swap)return;
    }
    await importProfile(mine);
    toast("Your details are set"+(mine.name?" to "+mine.name:"")+".");
    return;
  }

  try{ p=Workspace.parse(text); }
  catch(e){ toast(e.message,true); return; }
  var ws=p.ws,existing=APP.teams.filter(function(t){return t.teamId===ws.team.id;})[0];
  if(existing){
    var yes=await ask("Replace the saved team?","A saved copy of <b>"+esc(ws.team.name)+"</b> already exists here"+
      (existing.summary.savedAt?", last saved "+esc(fmtLong(localDay(existing.summary.savedAt))):"")+
      ". Opening this file replaces it with the copy saved "+esc(ws.savedAt?fmtLong(localDay(ws.savedAt)):"earlier")+
      "."+(APP.status.mode==="folder"?" The one being replaced is kept beside it as a .bak file.":""),"Replace it");
    if(!yes)return;
    await openTeam(existing,{fileOnly:true}).catch(function(){});
    ws.revision=Math.max(ws.revision,APP.ws?APP.ws.revision:0);
    APP.ws=ws; APP.undo=[]; rebuild(); render();
    APP.force=true; queueSave();
    return;
  }
  await startTeam(ws);
  toast("Opened "+ws.team.name+" and saved it with your other teams.");
}
async function deleteTeam(){
  var name=APP.ws.team.name;
  var yes=await ask("Delete this team?","This removes <b>"+esc(name)+"</b> and everything saved for it: notes, corrections "+
    "and history. Use <b>Save a copy</b> first if you might want it back. This cannot be undone.","Delete "+name);
  if(!yes)return;
  cancelSave(); APP.dirty=false;
  try{ await Store.remove(APP.ref); }catch(e){ toast("It could not be deleted: "+e.message,true); return; }
  APP.ws=null;
  await showHome();
  toast(name+" was deleted.");
}

/* ---------- adding an export ---------- */
async function exportDropped(file){
  await READY;
  var x;
  try{ x=await readExport(file); }
  catch(e){
    if(APP.screen==="home"||!APP.view||!APP.view.files.length) fail(e.message); else toast(e.message,true);
    return;
  }
  if(APP.screen==="team"){ planImport(x); return; }

  /* on the Teams page: work out which team it belongs to */
  var rows=[];
  for(var i=0;i<APP.teams.length;i++){
    var t=APP.teams[i]; if(t.error)continue;
    try{
      var ws=(await Store.open(t)).ws,ov=Recon.agentOverlap(ws,x.sources);
      rows.push({t:t,shared:ov.shared,of:ov.inExport});
    }catch(e){}
  }
  rows.sort(function(a,b){return b.shared-a.shared;});
  var known=resolveNames(x.sources,"agentRaw");
  var guess=commonSurname(Object.keys(known).map(function(k){return known[k].label;}));
  var best=rows.length&&rows[0].shared?0:-1;
  if(!rows.length){
    var ws0=Workspace.create(guess);
    await startTeam(ws0);
    planImport(x);
    return;
  }
  var h='<h2>Which team is this export for?</h2><p>'+esc(file.name)+', '+plural(x.sources.length,"buyer")+'.</p>';
  rows.forEach(function(r,i){
    h+='<label class="opt"><input type="radio" name="team" value="'+i+'"'+(i===best?" checked":"")+'><span><b>'+
       esc(r.t.summary.name)+'</b><br><span class="who">'+(r.shared?r.shared+" of the "+plural(r.of,"agent")+" in this export "+
       (r.shared===1?"is":"are")+" already on this team":"none of its agents are on this team")+'</span></span></label>';
  });
  h+='<label class="opt"><input type="radio" name="team" value="new"'+(best<0?" checked":"")+'><span><b>A new team</b><br>'+
     '<input type="text" id="newname" value="'+esc(guess)+'"></span></label>'+
     '<div class="acts"><button class="btn" data-x="no">Cancel</button><button class="btn primary" data-x="yes">Continue</button></div>';
  modal(h,function(d,close){
    d.querySelector('[data-x="no"]').onclick=close;
    d.querySelector('[data-x="yes"]').onclick=async function(){
      var v=(d.querySelector('input[name="team"]:checked')||{}).value;
      var name=clean(d.querySelector("#newname").value)||guess;
      close();
      if(v==="new"||v==null) await startTeam(Workspace.create(name));
      else await openTeam(rows[+v].t);
      if(APP.ws) planImport(x);
    };
  },true);
}

function planImport(x){
  var ws=APP.ws,p;
  try{ p=Recon.plan(ws,x.sources,x.meta); }
  catch(e){ toast(e.message,true); return; }
  if(p.firstImport&&!p.warnings.length){ applyImport(p,{}); return; }

  function names(list){ return '<div class="scroll"><ul>'+list.map(function(s){return '<li>'+s+'</li>';}).join("")+'</ul></div>'; }
  var h='<h2>Add this export?</h2><p>'+esc(x.meta.fileName)+', dated '+esc(fmtLong(parseDate(x.meta.asOf)))+
        ', '+plural(p.counts.rows,"buyer")+'.</p>';
  p.warnings.forEach(function(w){ h+='<div class="warnline'+(w.k==="duplicate"?" bad":"")+'">'+esc(w.t)+'</div>'; });
  if(!p.duplicateOf){
    var changed=p.rows.filter(function(r){return r.status==="matched"&&r.changes.some(function(c){return c.f==="milestone";});});
    var added=p.rows.filter(function(r){return r.status==="new";});
    h+='<p><b>'+p.counts.matched+'</b> already on this team'+(p.counts.changed?', '+p.counts.changed+' with changes':'')+
       '. <b>'+p.counts.added+'</b> new. <b>'+p.newlyMissing.length+'</b> no longer in the export.</p>';
    if(p.counts.upgraded) h+='<p>'+plural(p.counts.upgraded,"buyer")+' will now be tracked by loan number.</p>';
    if(changed.length&&!p.older){
      h+='<h3>Stage changes</h3>'+names(changed.map(function(r){
        var c=r.changes.filter(function(c){return c.f==="milestone";})[0];
        return esc(r.src.name)+': '+esc(label(classify(c.from).raw))+' → '+esc(label(classify(c.to).raw));}));
    }
    if(added.length) h+='<h3>New</h3>'+names(added.map(function(r){return esc(r.src.name)+' <span class="who">'+esc(r.src.agentRaw||"no agent")+'</span>';}));
    if(p.newlyMissing.length){
      h+='<h3>No longer in the export</h3><p>They stay on the team. You will be asked what happened to each.</p>'+
         names(p.newlyMissing.map(function(id){var L=Workspace.loanById(ws,id);
           return esc(L.src.name)+' <span class="who">'+esc(label(classify(L.src.milestone).raw))+'</span>';}));
    }
    if(p.suggestions.length){
      h+='<h3>Possibly the same buyer</h3><p>A new row and a missing buyer started on the same day with similar names. '+
         'Tick the ones that are the same person so their notes carry over.</p>';
      p.suggestions.forEach(function(s){
        h+='<label class="opt"><input type="checkbox" data-link="'+s.i+'" data-loan="'+esc(s.loanId)+'" checked><span>'+
           esc(s.newName)+' is <b>'+esc(s.oldName)+'</b> <span class="who">started '+esc(fmtDate(parseDate(s.started)))+'</span></span></label>';
      });
    }
  }
  h+='<div class="acts"><button class="btn" data-x="no">'+(p.duplicateOf?"Close":"Cancel")+'</button>'+
     (p.duplicateOf?'':'<button class="btn primary" data-x="yes">Add this export</button>')+'</div>';
  modal(h,function(d,close){
    d.querySelector('[data-x="no"]').onclick=close;
    var y=d.querySelector('[data-x="yes"]');
    if(y) y.onclick=function(){
      var links={};
      d.querySelectorAll("[data-link]").forEach(function(c){ if(c.checked) links[c.getAttribute("data-link")]=c.getAttribute("data-loan"); });
      close(); applyImport(p,links);
    };
  },true);
}
function applyImport(p,links){
  var next;
  try{ next=Recon.apply(APP.ws,p,{links:links}); }
  catch(e){ toast("Nothing was changed. "+e.message,true); return; }
  APP.undo.push(JSON.stringify(APP.ws)); APP.undoKey="";
  if(APP.undo.length>40)APP.undo.shift();
  if(!APP.ws.imports.length&&/^(New team|Team)$/i.test(APP.ws.team.name)){
    var v0=buildView(next);
    next.team.name=commonSurname(v0.files.map(function(f){return f.agent;}).filter(function(a){return a!=="Unassigned";}));
  }
  APP.ws=next;
  rebuild(); render(); queueSave();
  var c=next.imports[next.imports.length-1].counts;
  toast(p.older?"Kept as history. The current report is unchanged."
    :"Export added: "+c.matched+" matched, "+c.added+" new, "+c.missing+" not in it.");
}

/* ---------- the team screen ---------- */
function renderBar(){
  if(APP.screen!=="team"){ $("bar").innerHTML=""; return; }
  var ws=APP.ws,has=ws.imports.length>0,h="";
  if(APP.conflict){
    h+='<div class="banner bad" style="width:100%"><div><b>This team’s file was changed somewhere else.</b> '+
       'Your changes are safe in this browser but are not in the file.</div><span class="sp"></span>'+
       '<button id="cf-mine">Keep mine</button><button id="cf-theirs">Open the other version</button>'+
       '<button id="cf-both">Keep both</button></div>';
  }
  APP.banners.forEach(function(b,i){
    h+='<div class="banner" style="width:100%"><div>'+esc(b)+'</div><span class="sp"></span><button data-dismiss="'+i+'">OK</button></div>';
  });
  var lack=Profile.missing(APP.profile);
  if(has&&lack.length){
    h+='<div class="banner" style="width:100%"><div>This report does not carry <b>'+esc(lack.join(" or "))+
       '</b> yet. Type '+(lack.length>1?"them":"it")+' in under your photo circle at the top, or use the button.</div>'+
       '<span class="sp"></span><button id="banner-details">My details</button></div>';
  }
  if(has&&APP.view.asOf){
    var age=days(APP.view.today,parseDate(new Date()));
    if(age>7) h+='<div class="banner" style="width:100%"><div>This Encompass export is <b>'+age+' days old</b>. '+
      'Day counts are measured to '+esc(fmtLong(APP.view.today))+'. Drop a fresh export on the page to update.</div></div>';
  }
  h+='<button class="back" id="tohome">← Teams</button><span class="teamname">'+esc(ws.team.name)+'</span>'+
     '<span class="savestate '+APP.save.cls+'" id="savestate" title="'+esc(APP.save.title||"")+'">'+esc(APP.save.text||"Saved")+'</span>'+
     '<span class="sp"></span>'+
     '<button id="undo"'+(APP.undo.length?"":" disabled")+' title="Ctrl+Z">Undo</button>'+
     '<button id="addexport">Add export</button>'+
     (has?'<button id="present">Presenter view</button><button id="presented" title="Records what is on the report today, so next time shows what changed">Mark as presented</button>'+
          '<button class="primary" id="print">Save as PDF</button>':'');
  $("bar").innerHTML=h;

  $("tohome").onclick=showHome;
  $("undo").onclick=undo;
  $("addexport").onclick=async function(){ var f=await pickFile(".xlsx,.xls"); if(f) exportDropped(f); };
  var b;
  if(b=$("present")) b.onclick=function(){ setPresenting(true); };
  if(b=$("presented")) b.onclick=function(){
    change(function(ws){ Recon.markPresented(ws,APP.view,ws.settings.basis); });
    toast("Marked as presented. From now on the report shows what changed since today.");
  };
  if(b=$("print")) b.onclick=function(){ window.print(); };
  if(b=$("banner-details")) b.onclick=myDetails;
  $("bar").querySelectorAll("[data-dismiss]").forEach(function(el){
    el.onclick=function(){ APP.banners.splice(+el.getAttribute("data-dismiss"),1); renderBar(); };
  });
  if(b=$("cf-mine")) b.onclick=function(){ APP.force=true; APP.conflict=null; queueSave(); renderBar(); };
  if(b=$("cf-theirs")) b.onclick=async function(){
    cancelSave(); APP.dirty=false;
    await openTeam(APP.ref,{fileOnly:true});
  };
  if(b=$("cf-both")) b.onclick=async function(){
    var ws=APP.ws;
    ws.team.id=uid("T"); ws.team.name=ws.team.name+" (my copy)";
    APP.ref={fileName:await Store.uniqueFileName(ws.team.name),teamId:ws.team.id,source:APP.status.mode};
    APP.conflict=null; render(); queueSave();
    toast("Your version is now a separate team. The other version is untouched.");
  };
}
function setPresenting(on){
  APP.presenting=on;
  document.body.classList.toggle("presenting",on);
  render();
  if(on) window.scrollTo(0,0);
}

function context(edit){
  var v=APP.view,ws=APP.ws,cur=v.current,hd=cur?cur.headers||[]:[];
  var files=APP.agentFilter?v.files.filter(function(f){return f.agent===APP.agentFilter;}):v.files;
  return {ws:ws,files:files,allFiles:v.files,today:v.today,asOf:v.asOf,names:v.names,
    basis:ws.settings.basis,showAll:ws.settings.showClosed,sort:APP.sort,controls:APP.controls,
    edit:edit,agentFilter:APP.agentFilter,baseline:baselineFor(ws),
    haveCols:{apprOrdered:hasColumn(hd,COLS.apprOrdered),apprReceived:hasColumn(hd,COLS.apprReceived)},
    pqRule:cur?cur.pqRule:"",storage:APP.status,fileName:APP.ref.fileName,profile:APP.profile};
}
function render(){
  if(APP.screen!=="team")return;
  if(APP.pointerDown){ APP.renderPending=true; return; }
  APP.renderPending=false;
  $("home").style.display="none"; $("ver").textContent="";
  renderBar();
  var rep=$("report"),drop=$("drop");
  if(!APP.ws.imports.length){
    rep.style.display="none"; rep.innerHTML="";
    drop.style.display="block"; drop.className="";
    $("droptitle").textContent=APP.ws.team.name;
    return;
  }
  drop.style.display="none";
  var edit=!(APP.presenting||APP.printing);
  var y=window.scrollY;
  rep.innerHTML=reportHTML(context(edit));
  rep.style.display="block";
  if(edit) wire(rep);
  window.scrollTo(0,y);
  if(APP.refocus){
    var next=rep.querySelector('[data-id="'+APP.refocus.id+'"] [data-f="'+APP.refocus.f+'"]');
    if(next) next.focus();
  }
}
/* Where the keyboard focus is heading, so a redraw can put it back there. */
function locate(el){
  if(!el||!el.closest||!el.getAttribute("data-f"))return null;
  var row=el.closest("[data-id]");
  return row?{id:row.getAttribute("data-id"),f:el.getAttribute("data-f")}:null;
}

/* ---------- interaction ---------- */
function commit(el){
  var txt=clean(el.tagName==="INPUT"||el.tagName==="SELECT"?el.value:el.textContent);
  var done;

  if(el.hasAttribute("data-bench")){
    var key=el.getAttribute("data-bench");
    done=change(function(ws){
      var b=ws.settings.bench,v;
      if(key==="pq"||key==="close"){
        v=txt===""?null:parseInt(txt,10);
        if(v!==null&&(isNaN(v)||v<0||v>100))return false;
      } else v=txt;
      if(b[key]===v)return false;
      b[key]=v;
    });
    if(!done)render();
    return;
  }
  if(el.hasAttribute("data-rename")){
    var from=el.getAttribute("data-rename");
    done=change(function(ws){ return Edit.renameAgent(ws,APP.view.files,from,txt); });
    if(!done)render();
    return;
  }
  if(el.hasAttribute("data-profile")){
    var pk=el.getAttribute("data-profile");
    done=profileChange(function(p){
      var v=pk==="nmls"?Profile.cleanNmls(txt):txt;
      if(pk==="title"&&!v) v=Profile.create().title;
      if(p[pk]===v)return false;
      p[pk]=v;
    });
    if(!done)render();
    return;
  }
  if(el.hasAttribute("data-team")){
    var k=el.getAttribute("data-team");
    done=change(function(ws){ var v=txt||ws.team[k]; if(v===ws.team[k])return false; ws.team[k]=v; });
    if(!done)render();
    return;
  }
  var row=el.closest("[data-id]");
  if(!row)return;
  var id=row.getAttribute("data-id"),field=el.getAttribute("data-f");
  if(field==="note"||field==="privateNote"){
    done=change(function(ws){ return Edit.setNote(ws,id,txt,field==="privateNote"); },{key:field+id});
    if(!done&&APP.renderPending)render();
    return;
  }
  var f=fileById(id); if(!f)return;
  done=change(function(ws){ return Edit.setField(ws,id,field,txt,field==="agent"?f.agentBase:null); });
  if(!done)render();
}
/* Notes save as they are typed, not only when the cursor leaves the box. The
   page is not redrawn, so the cursor stays where it is. */
var typeTimer=null;
function stopTyping(){ clearTimeout(typeTimer); typeTimer=null; }
/* Half a second after the first uncommitted keystroke, whether or not the
   typing has paused. */
function noteTyped(el){
  if(typeTimer)return;
  typeTimer=setTimeout(function(){ commitTyping(el); },500);
}
function commitTyping(el){
  stopTyping();
  if(!el||!el.isConnected||!APP.ws)return;
  var row=el.closest("[data-id]"),field=el.getAttribute("data-f");
  if(!row)return;
  var id=row.getAttribute("data-id"),txt=clean(el.textContent);
  change(function(ws){ return Edit.setNote(ws,id,txt,field==="privateNote"); },{key:field+id,quiet:true});
}
/* Whatever is half-typed in the focused box goes into the team before a save
   that cannot wait (closing the tab, leaving the team). */
function commitFocused(){
  var el=document.activeElement;
  if(!el||!el.closest||!el.closest("#report"))return;
  var f=el.getAttribute&&el.getAttribute("data-f");
  if(f==="note"||f==="privateNote") commitTyping(el);
  var pk=el.getAttribute&&el.getAttribute("data-profile");
  if(pk){
    var txt=clean(el.textContent);
    profileChange(function(p){
      var v=pk==="nmls"?Profile.cleanNmls(txt):txt;
      if(p[pk]===v||pk==="title"&&!v)return false;
      p[pk]=v;
    },true);
  }
}

/* "myphoto" is the loan officer's own picture and goes to their details;
   "photo" and "logo" belong to the team. */
function setImage(key,file){
  readImage(file,function(url){
    if(key==="myphoto"){
      profileChange(function(p){ p.photo=url; p.pos={x:50,y:50,z:100}; });
      return;
    }
    change(function(ws){
      ws.team[key]=url;
      if(key==="photo") ws.team.pos={x:50,y:50,z:100};
    });
  },key!=="logo");
}
/* The framing (position and zoom) of whichever photo is being adjusted. */
function framing(key){ return key==="myphoto"?APP.profile.pos:APP.ws.team.pos; }
function wireBrand(rep){
  rep.querySelectorAll("[data-drop]").forEach(function(el){
    var key=el.getAttribute("data-drop");
    el.addEventListener("dragover",function(e){e.preventDefault();e.stopPropagation();
      el.style.outline="2px solid #fff";});
    el.addEventListener("dragleave",function(){el.style.outline="";});
    el.addEventListener("drop",function(e){
      e.preventDefault();e.stopPropagation();el.style.outline="";
      setImage(key,e.dataTransfer.files[0]);
    });
    if(key==="photo"&&APP.ws.team.photo||key==="myphoto"&&APP.profile.photo){
      /* drag to reframe, wheel to zoom; the document-level half of the drag is
         wired once in start(), not on every redraw as V16 did */
      el.addEventListener("mousedown",function(e){
        var p=framing(key);
        APP.drag={el:el,key:key,sx:e.clientX,sy:e.clientY,x:p.x,y:p.y,z:p.z,moved:false,before:JSON.stringify(APP.ws)};
        e.preventDefault();
      });
      el.addEventListener("wheel",function(e){
        e.preventDefault();
        var p=framing(key),before=JSON.stringify(APP.ws);
        p.z=Math.max(100,Math.min(260,p.z+(e.deltaY<0?8:-8)));
        el.style.backgroundSize = p.z<=100 ? "cover" : p.z+"%";
        APP.suppressClick=true;
        setTimeout(function(){APP.suppressClick=false;},400);
        if(key==="myphoto"){ profileChange(function(){},true); return; }
        if(APP.undoKey!=="zoom"){ APP.undo.push(before); APP.undoKey="zoom"; }
        queueSave();
      },{passive:false});
    }
    el.addEventListener("click",async function(e){
      if(APP.suppressClick){ APP.suppressClick=false; return; }
      var f=await pickFile("image/*"); if(f) setImage(key,f);
    });
  });
}

function wire(rep){
  wireBrand(rep);

  rep.querySelectorAll("[contenteditable]").forEach(function(el){
    var f=el.getAttribute("data-f"),isNote=f==="note"||f==="privateNote";
    el.addEventListener("blur",function(e){ stopTyping(); APP.refocus=locate(e.relatedTarget); commit(el); APP.refocus=null; });
    if(isNote) el.addEventListener("input",function(){ noteTyped(el); });
    el.addEventListener("keydown",function(e){
      if(e.key==="Enter"){e.preventDefault();el.blur();}
      if(e.key==="Escape"){ stopTyping(); el.textContent=el.getAttribute("data-was")||el.textContent; el.blur(); }
    });
    el.addEventListener("focus",function(){ el.setAttribute("data-was",el.textContent); });
    /* pasted text arrives as text, never as markup */
    el.addEventListener("paste",function(e){
      e.preventDefault();
      var t=(e.clipboardData||window.clipboardData).getData("text");
      document.execCommand("insertText",false,t.replace(/\s*\n\s*/g," "));
    });
  });
  rep.querySelectorAll("select[data-f],input[data-f]").forEach(function(el){
    el.addEventListener("change",function(){commit(el);});
  });
  function each(sel,ev,fn){ rep.querySelectorAll(sel).forEach(function(el){ el.addEventListener(ev,function(e){ fn(el,e); }); }); }
  function idOf(el){ var r=el.closest("[data-id]"); return r?r.getAttribute("data-id"):null; }

  each("[data-hide]","click",function(el){ var id=el.getAttribute("data-hide"); change(function(ws){return Edit.hide(ws,id,true);}); });
  each("[data-reset]","click",function(el){ var id=el.getAttribute("data-reset"); change(function(ws){return Edit.resetLoan(ws,id);}); });
  each("[data-unhide]","click",function(){ change(function(ws){return Edit.unhideAll(ws);}); });
  each("[data-use-enc]","click",function(el){ var id=idOf(el); change(function(ws){return Edit.useEncNote(ws,id);}); });
  each("[data-accept]","click",function(el){ var id=idOf(el),f=el.getAttribute("data-accept"); change(function(ws){return Edit.acceptEncompass(ws,id,f);}); });
  each("[data-keep]","click",function(el){ var id=idOf(el),f=el.getAttribute("data-keep"); change(function(ws){return Edit.keepMine(ws,id,f);}); });
  each("[data-missing]","change",function(el){ var id=idOf(el),v=el.value; change(function(ws){return Edit.setMissingReason(ws,id,v);}); });
  each("[data-remove]","click",function(el){ var id=idOf(el); change(function(ws){return Edit.setMissingReason(ws,id,"removed");}); });
  each("[data-restore]","click",function(el){ var id=idOf(el); change(function(ws){return Edit.restoreRemoved(ws,id);}); });

  each("th.sortable","click",function(el){
    var t=el.getAttribute("data-sort"),k=el.getAttribute("data-key");
    var cfg=APP.sort[t];
    if(cfg.k===k)cfg.dir=-cfg.dir; else {cfg.k=k;cfg.dir=(k==="name"||k==="agent"||k==="milestone")?1:-1;}
    render();
  });

  var b;
  if(b=$("drawerToggle")) b.onclick=function(){APP.controls=!APP.controls;render();};
  if(b=$("printbtn")) b.onclick=function(){window.print();};
  if(b=$("basis")) b.onchange=function(){ var v=this.value; change(function(ws){ if(ws.settings.basis===v)return false; ws.settings.basis=v; }); };
  if(b=$("showall")) b.onchange=function(){ var v=this.checked; change(function(ws){ ws.settings.showClosed=v; }); };
  if(b=$("agentfilter")) b.onchange=function(){ APP.agentFilter=this.value; render(); window.scrollTo(0,0); };
  if(b=$("asof")) b.onchange=function(){ var v=this.value; change(function(ws){ ws.settings.asOfOverride=v; }); };
  if(b=$("asofreset")) b.onclick=function(){ change(function(ws){ ws.settings.asOfOverride=""; }); };
  if(b=$("clearall")) b.onclick=async function(){
    var yes=await ask("Clear every correction?","This puts every name, agent, stage and date back to what Encompass says and "+
      "brings back hidden buyers. Your notes are kept. Undo will bring the corrections back.","Clear them");
    if(yes) change(function(ws){return Edit.clearAll(ws);});
  };
  if(b=$("benchclear")) b.onclick=function(){
    change(function(ws){ ws.settings.bench={pq:null,close:null,source:"",period:"",population:null,validated:""}; });
  };
  if(b=$("benchfile")) b.onclick=async function(){
    var f=await pickFile(".xlsx,.xls"); if(!f)return;
    try{
      var x=await readExport(f),today=parseDate(x.meta.asOf);
      var files=x.sources.map(fileFromSource);
      files.forEach(function(q){setClocks(q,today);});
      var bm=benchmarkFrom(files,today);
      if(bm.pq==null||bm.close==null){ toast("That export has too few closed or mature files to work out an average.",true); return; }
      change(function(ws){
        ws.settings.bench={pq:bm.pq,close:bm.close,population:bm.population,period:bm.period,
          source:Profile.possessive(APP.profile)+" full pipeline, Encompass export of "+fmtDate(today),validated:fmtLong(today)};
      });
      toast("Our averages worked out from "+plural(bm.population,"buyer")+".");
    }catch(e){ toast(e.message,true); }
  };
  if(b=$("savecopy")) b.onclick=function(){
    commitFocused();
    var copy=clone(APP.ws);
    Store.download(APP.ref.fileName,Workspace.serialize(copy));
    toast("A copy was saved to your Downloads folder.");
  };
  if(b=$("deleteteam")) b.onclick=deleteTeam;
  if(b=$("mydetails")) b.onclick=myDetails;
}

/* ---------- start ---------- */
function wantsFiles(e){
  var t=e.dataTransfer&&e.dataTransfer.types;
  return !!t&&Array.prototype.indexOf.call(t,"Files")>=0;
}
/* platform is only passed by tests, to stand in for the folder and the browser. */
async function start(platform){
  var drop=$("drop"),fileIn=$("file");
  drop.onclick=function(){fileIn.click();};
  fileIn.onchange=function(){ if(fileIn.files[0]) exportDropped(fileIn.files[0]); fileIn.value=""; };

  /* a file dropped anywhere on the page is taken, not opened by the browser */
  ["dragenter","dragover"].forEach(function(ev){
    document.addEventListener(ev,function(e){ if(!wantsFiles(e))return; e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave","drop"].forEach(function(ev){
    document.addEventListener(ev,function(e){ if(wantsFiles(e))e.preventDefault(); drop.classList.remove("over"); });
  });
  document.addEventListener("drop",function(e){
    var f=e.dataTransfer&&e.dataTransfer.files[0]; if(!f)return;
    if(!$("modal").hidden)return;
    if(/\.(json|bak)$/i.test(f.name)){ if(APP.screen==="home") openCopyFile(f); else toast("Go back to Teams to open a saved copy."); }
    else if(/^image\//.test(f.type)) toast("Drop a photo on the photo circle or the logo chip.");
    else exportDropped(f);
  });

  /* hold a redraw while the mouse is down, so the thing being clicked is not
     replaced out from under the click */
  document.addEventListener("mousedown",function(){ APP.pointerDown=true; },true);
  document.addEventListener("mouseup",function(){
    APP.pointerDown=false;
    if(APP.drag){
      var d=APP.drag; APP.drag=null;
      if(d.moved){
        APP.suppressClick=true;
        if(d.key==="myphoto") profileChange(function(){},true);
        else { APP.undo.push(d.before); APP.undoKey=""; queueSave(); }
      }
    }
    setTimeout(function(){
      if(!APP.renderPending)return;
      var a=document.activeElement;
      if(a&&a.closest&&a.closest("#report")&&a.matches("select,input,[contenteditable]"))return;   // its own commit will redraw
      render();
    },0);
  },true);
  document.addEventListener("mousemove",function(e){
    var d=APP.drag; if(!d||!APP.ws)return;
    var dx=e.clientX-d.sx,dy=e.clientY-d.sy,p=framing(d.key);
    if(Math.abs(dx)>2||Math.abs(dy)>2)d.moved=true;
    var span=Math.max(1,p.z-100);
    p.x=Math.max(0,Math.min(100,d.x-dx/124*span*1.6));
    p.y=Math.max(0,Math.min(100,d.y-dy/124*span*1.6));
    d.el.style.backgroundPosition=p.x+"% "+p.y+"%";
  });

  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){
      if(!$("modal").hidden){ return; }
      if(APP.presenting){ setPresenting(false); return; }
    }
    var typing=e.target&&e.target.closest&&e.target.closest("input,textarea,select,[contenteditable]");
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!typing&&APP.screen==="team"&&!APP.presenting){ e.preventDefault(); undo(); }
  });
  $("exitpresent").onclick=function(){ setPresenting(false); };

  /* printing always uses the clean view, whatever is on screen */
  window.addEventListener("beforeprint",function(){ if(APP.screen==="team"&&!APP.presenting){ commitFocused(); APP.printing=true; render(); } });
  window.addEventListener("afterprint",function(){ if(APP.printing){ APP.printing=false; render(); } });

  /* nothing typed is lost when the tab closes */
  function leaving(){
    commitFocused();
    var ok=true;
    if(APP.profileDirty) ok=Store.profileLastGasp(APP.profile);
    if(!APP.ws||(!APP.dirty&&!APP.saving))return ok;
    return Store.lastGasp(APP.ws)&&ok;
  }
  document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="hidden") leaving(); });
  window.addEventListener("pagehide",leaving);
  window.addEventListener("beforeunload",function(e){
    if(!leaving()){ e.preventDefault(); e.returnValue=""; }
  });

  READY=Store.init(platform).then(function(st){ APP.status=st; },function(){}).then(showHome);
  await READY;
}
if(typeof document!=="undefined"&&document.getElementById("report")&&!window.PR_NO_START){
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){start(window.PR_PLATFORM);}); else start(window.PR_PLATFORM);
}
