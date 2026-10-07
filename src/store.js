/* ============ store ============ */
/* Where a team is kept. Three layers, all of them automatic except the last:

     folder    one file per team in a folder the loan officer picks once (the saved copy)
     browser   a second copy inside the browser, written on every change, so a
               crash or a closed tab loses nothing
     copy      "Save a copy" / "Open a copy", for backups and a new PC

   Everything that touches the outside world goes through a platform object,
   so tests can swap in a pretend folder and a pretend browser. */

function ConflictError(theirs){
  var e=new Error("This team's file was changed somewhere else since it was opened here.");
  e.name="ConflictError"; e.theirs=theirs||null; return e;
}

var Store=(function(){
  var P=null;                 // platform
  var S={dir:null,perm:"none",device:"",stamps:{},backedUp:{},kvOk:false};

  /* ---------- the real browser ---------- */
  function browserPlatform(){
    var db=null,mem={};
    function ls(){ return window.localStorage; }
    function open(){
      return new Promise(function(res){
        var done=false,t=setTimeout(function(){ if(!done){done=true;res(null);} },3000);
        try{
          var rq=indexedDB.open("partnership-review",1);
          rq.onupgradeneeded=function(){ rq.result.createObjectStore("kv"); };
          rq.onsuccess=function(){ if(done)return; done=true; clearTimeout(t); res(rq.result); };
          rq.onerror=rq.onblocked=function(){ if(done)return; done=true; clearTimeout(t); res(null); };
        }catch(e){ if(!done){done=true;clearTimeout(t);res(null);} }
      });
    }
    function tx(mode,fn){
      return new Promise(function(res,rej){
        var t=db.transaction("kv",mode),out;
        try{ out=fn(t.objectStore("kv")); }catch(e){ rej(e); return; }
        t.oncomplete=function(){ res(out&&"result" in out?out.result:undefined); };
        t.onerror=t.onabort=function(){ rej(t.error||new Error("Browser storage refused the write.")); };
      });
    }
    return {
      hasFolderApi:typeof window.showDirectoryPicker==="function",
      pickFolder:function(){ return window.showDirectoryPicker({mode:"readwrite",id:"partnership-review"}); },
      kv:{
        ready:async function(){ db=await open(); return !!db; },
        get:function(k){ return db?tx("readonly",function(s){return s.get(k);}):Promise.resolve(mem[k]); },
        put:function(k,v){ if(db) return tx("readwrite",function(s){s.put(v,k);}); mem[k]=v; return Promise.resolve(); },
        del:function(k){ if(db) return tx("readwrite",function(s){s.delete(k);}); delete mem[k]; return Promise.resolve(); },
        keys:function(){ return db?tx("readonly",function(s){return s.getAllKeys();}):Promise.resolve(Object.keys(mem)); }
      },
      ls:{
        get:function(k){ try{return ls().getItem(k);}catch(e){return null;} },
        set:function(k,v){ try{ls().setItem(k,v);return true;}catch(e){return false;} },
        del:function(k){ try{ls().removeItem(k);}catch(e){} },
        keys:function(){ try{var o=[];for(var i=0;i<ls().length;i++)o.push(ls().key(i));return o;}catch(e){return [];} }
      },
      download:function(name,text){
        var url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
        var a=document.createElement("a");
        a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){URL.revokeObjectURL(url);},4000);
      },
      persist:function(){
        try{ if(navigator.storage&&navigator.storage.persist) return navigator.storage.persist(); }catch(e){}
        return Promise.resolve(false);
      }
    };
  }

  /* ---------- folder helpers ---------- */
  function folderReady(){ return !!S.dir&&S.perm==="granted"; }

  async function queryPerm(){
    if(!S.dir){ S.perm="none"; return S.perm; }
    try{ S.perm=S.dir.queryPermission?await S.dir.queryPermission({mode:"readwrite"}):"granted"; }
    catch(e){ S.perm="prompt"; }
    return S.perm;
  }
  async function readFile(name){
    var fh=await S.dir.getFileHandle(name);
    var f=await fh.getFile(),text=await f.text();
    return {text:text,lastModified:f.lastModified,size:f.size};
  }
  async function writeRaw(name,text){
    var fh=await S.dir.getFileHandle(name,{create:true});
    var w=await fh.createWritable();
    try{ await w.write(text); await w.close(); }
    catch(e){ try{ if(w.abort) await w.abort(); }catch(x){} throw e; }
    var f=await fh.getFile();
    return {lastModified:f.lastModified,size:f.size};
  }
  async function exists(name){
    try{ await S.dir.getFileHandle(name); return true; }
    catch(e){ return false; }
  }

  /* Writes a team's file. Refuses when the file on disk is not the one this
     session last read or wrote, unless told to overwrite. Keeps the previous
     contents as <name>.bak the first time it writes in a session. */
  async function writeTeamFile(name,text,ws,force){
    var have=await exists(name),stamp=S.stamps[name];
    if(have){
      var cur=await readFile(name);
      if(cur.size>0){
        var untouched=stamp&&cyrb53(cur.text)===stamp.hash;
        if(!untouched&&!force){
          var theirs=null;
          try{ theirs=Workspace.parse(cur.text).ws; }catch(e){}
          throw ConflictError(theirs);
        }
        /* once a session, and always when replacing something this session did not write */
        if(!S.backedUp[name]||!untouched){ await writeRaw(name+".bak",cur.text); S.backedUp[name]=1; }
      }
    }
    var st=await writeRaw(name,text);
    S.stamps[name]={lastModified:st.lastModified,size:st.size,hash:cyrb53(text),revision:ws.revision};
    S.backedUp[name]=1;
  }

  /* ---------- drafts (the copy inside the browser) ---------- */
  async function draftGet(teamId){
    try{ return (await P.kv.get("draft:"+teamId))||null; }catch(e){ return null; }
  }
  async function draftList(){
    var out=[];
    try{
      var keys=await P.kv.keys();
      for(var i=0;i<keys.length;i++){
        if(String(keys[i]).indexOf("draft:")!==0) continue;
        var d=await P.kv.get(keys[i]); if(d) out.push(d);
      }
    }catch(e){}
    /* a last-moment copy with no proper draft behind it still counts */
    P.ls.keys().forEach(function(k){
      if(k.indexOf("pr.draft.")!==0) return;
      var id=k.slice(9);
      if(out.some(function(d){return d.teamId===id;})) return;
      try{
        var ws=Workspace.parse(P.ls.get(k)).ws;
        out.push({teamId:id,fileName:Workspace.fileNameFor(ws.team.name),name:ws.team.name,
                  text:P.ls.get(k),revision:ws.revision,savedAt:ws.savedAt});
      }catch(e){}
    });
    return out;
  }
  function tryParse(text){
    try{ return Workspace.parse(text); }catch(e){ return null; }
  }

  var api={
    /* Call once at start-up. Returns the same thing status() does. */
    init:async function(platform){
      P=platform||browserPlatform();
      S={dir:null,perm:"none",device:"",stamps:{},backedUp:{},kvOk:false};
      try{ S.kvOk=await P.kv.ready(); }catch(e){ S.kvOk=false; }
      S.device=P.ls.get("pr.device")||"";
      if(!S.device){ S.device=uid("D"); P.ls.set("pr.device",S.device); }
      if(P.hasFolderApi){
        try{ S.dir=(await P.kv.get("dir"))||null; }catch(e){ S.dir=null; }
        await queryPerm();
      }
      try{ if(P.persist) Promise.resolve(P.persist()).catch(function(){}); }catch(e){}
      return api.status();
    },

    status:function(){
      return {mode:folderReady()?"folder":"browser",
              folderApi:!!(P&&P.hasFolderApi),
              folderName:S.dir?S.dir.name:"",
              perm:S.perm,            // none | prompt | granted | denied
              browserCopy:S.kvOk?"database":"basic",
              device:S.device};
    },

    /* Both of these must be called from a click. */
    chooseFolder:async function(){
      var dir=await P.pickFolder();
      S.dir=dir; S.stamps={}; S.backedUp={};
      try{ await P.kv.put("dir",dir); }catch(e){}
      await queryPerm();
      if(S.perm!=="granted"&&dir.requestPermission) S.perm=await dir.requestPermission({mode:"readwrite"});
      return api.status();
    },
    grantFolder:async function(){
      if(!S.dir) return api.status();
      try{ S.perm=S.dir.requestPermission?await S.dir.requestPermission({mode:"readwrite"}):"granted"; }
      catch(e){ S.perm="denied"; }
      return api.status();
    },
    forgetFolder:async function(){
      S.dir=null; S.perm="none"; S.stamps={}; S.backedUp={};
      try{ await P.kv.del("dir"); }catch(e){}
      return api.status();
    },

    /* Every team that can be opened, newest work first. */
    list:async function(){
      var out=[],seen={};
      if(folderReady()){
        for await (var entry of S.dir.entries()){
          var name=entry[0],h=entry[1];
          if(h.kind&&h.kind!=="file") continue;
          if(name.slice(-WS_EXT.length)!==WS_EXT) continue;
          try{
            var r=await readFile(name),p=Workspace.parse(r.text);
            seen[p.ws.team.id]=1;
            out.push({fileName:name,source:"folder",teamId:p.ws.team.id,summary:Workspace.summary(p.ws)});
          }catch(e){
            var id=null; try{ id=await P.kv.get("name:"+name); }catch(x){}
            if(id) seen[id]=1;
            out.push({fileName:name,source:"folder",teamId:id||"",error:e.message,
                      summary:{name:name.slice(0,-WS_EXT.length),loans:0,asOf:"",lastMeeting:"",savedAt:""}});
          }
        }
      }
      (await draftList()).forEach(function(d){
        if(seen[d.teamId]) return;
        var p=tryParse(d.text); if(!p) return;
        out.push({fileName:d.fileName,source:"browser",teamId:d.teamId,summary:Workspace.summary(p.ws)});
      });
      out.sort(function(a,b){ return (b.summary.savedAt||"")<(a.summary.savedAt||"")?-1:1; });
      return out;
    },

    /* Opens a team from wherever its newest copy is. If the copy inside the
       browser is ahead of the file (a crash, a failed write), that is the one
       returned, flagged as recovered so it gets written to the file again. */
    open:async function(ref,opts){
      opts=opts||{};
      var cands=[],fileErr=null,teamId=ref.teamId||"";
      if(folderReady()&&ref.source!=="browser"&&await exists(ref.fileName)){
        try{
          var r=await readFile(ref.fileName),p=Workspace.parse(r.text);
          S.stamps[ref.fileName]={lastModified:r.lastModified,size:r.size,hash:cyrb53(r.text),revision:p.ws.revision};
          teamId=p.ws.team.id;
          cands.push({from:"file",ws:p.ws,warnings:p.warnings,migratedFrom:p.migratedFrom});
        }catch(e){
          fileErr=e;
          try{ var r2=await readFile(ref.fileName);
               S.stamps[ref.fileName]={lastModified:r2.lastModified,size:r2.size,hash:cyrb53(r2.text),revision:-1}; }catch(x){}
          if(!teamId){ try{ teamId=(await P.kv.get("name:"+ref.fileName))||""; }catch(x){} }
        }
      }
      if(teamId&&!(opts.fileOnly&&cands.length)){
        var d=await draftGet(teamId),pd=d&&tryParse(d.text);
        if(pd) cands.push({from:"browser",ws:pd.ws,warnings:pd.warnings,migratedFrom:pd.migratedFrom});
        var lg=P.ls.get("pr.draft."+teamId),pl=lg&&tryParse(lg);
        if(pl) cands.push({from:"browser",ws:pl.ws,warnings:pl.warnings,migratedFrom:pl.migratedFrom});
      }
      if(!cands.length) throw fileErr||new Error("That team could not be found.");
      var best=cands[0];
      cands.forEach(function(c){ if(c.ws.revision>best.ws.revision) best=c; });
      var warnings=best.warnings.slice();
      if(fileErr) warnings.push("The team's file could not be read ("+fileErr.message+
        ") so the copy kept in this browser was opened instead. It will be written back to the file.");
      return {ws:best.ws,warnings:warnings,from:best.from,migratedFrom:best.migratedFrom,
              recovered:best.from==="browser"&&(folderReady()&&cands.some(function(c){return c.from==="file";})||!!fileErr),
              fileName:ref.fileName};
    },

    /* A file name no other team in the folder or the browser is using. */
    uniqueFileName:async function(teamName){
      var base=Workspace.fileNameFor(teamName).slice(0,-WS_EXT.length),name=base+WS_EXT,n=1,taken={};
      (await draftList()).forEach(function(d){ taken[d.fileName]=1; });
      while(taken[name]||(folderReady()&&await exists(name))){ n++; name=base+" ("+n+")"+WS_EXT; }
      return name;
    },

    /* Saves everywhere it can. Resolves with what happened; rejects only when
       not even the browser copy could be written.
         {revision, where:["browser","folder"], folderError, conflict} */
    save:async function(ws,fileName,opts){
      opts=opts||{};
      ws.revision=(ws.revision||0)+1;
      ws.savedAt=opts.now||new Date().toISOString();
      ws.device=S.device;
      ws.appVersion=APP_VERSION;
      var text=Workspace.serialize(ws);
      var res={revision:ws.revision,where:[],fileName:fileName,text:text};

      try{
        await P.kv.put("draft:"+ws.team.id,{teamId:ws.team.id,fileName:fileName,name:ws.team.name,
          text:text,revision:ws.revision,savedAt:ws.savedAt});
        await P.kv.put("name:"+fileName,ws.team.id);
        P.ls.del("pr.draft."+ws.team.id);
        res.where.push("browser");
      }catch(e){
        res.browserError=e&&e.message||String(e);
        if(P.ls.set("pr.draft."+ws.team.id,text)) res.where.push("browser");
      }

      if(folderReady()){
        try{ await writeTeamFile(fileName,text,ws,!!opts.force); res.where.push("folder"); }
        catch(e){
          if(e.name==="ConflictError") res.conflict=e;
          else res.folderError=e&&e.message||String(e);
        }
      }
      if(!res.where.length)
        throw new Error("Nothing could be saved"+(res.folderError?": "+res.folderError:res.browserError?": "+res.browserError:"."));
      return res;
    },

    /* The last thing run as the page goes away: one synchronous write, which
       is the only kind a closing tab is guaranteed to finish. */
    lastGasp:function(ws){
      var copy=clone(ws);
      copy.revision=(copy.revision||0)+1;
      copy.savedAt=new Date().toISOString();
      copy.device=S.device;
      return P.ls.set("pr.draft."+copy.team.id,Workspace.serialize(copy));
    },

    remove:async function(ref){
      if(folderReady()&&ref.source!=="browser"){
        if(await exists(ref.fileName)) await S.dir.removeEntry(ref.fileName);
        if(await exists(ref.fileName+".bak")) await S.dir.removeEntry(ref.fileName+".bak");
      }
      if(ref.teamId){
        try{ await P.kv.del("draft:"+ref.teamId); }catch(e){}
        P.ls.del("pr.draft."+ref.teamId);
      }
      try{ await P.kv.del("name:"+ref.fileName); }catch(e){}
      delete S.stamps[ref.fileName]; delete S.backedUp[ref.fileName];
    },

    /* ---------- my details ---------- */
    /* The loan officer's own details live beside the teams: one small file in
       the folder, one copy in the browser. Whichever is newer wins, and the
       other is brought up to date, so a folder moved to a new PC brings the
       details with it and a folder chosen later receives them. */
    loadProfile:async function(){
      var cands=[],fileRev=-1,best=null;
      if(folderReady()&&await exists(PROFILE_FILE)){
        try{ var pf=Profile.parse((await readFile(PROFILE_FILE)).text); fileRev=pf.revision; cands.push(pf); }catch(e){}
      }
      try{ var t=await P.kv.get("profile"); if(t) cands.push(Profile.parse(t)); }catch(e){}
      var l=P.ls.get("pr.profile");
      if(l){ try{ cands.push(Profile.parse(l)); }catch(e){} }
      cands.forEach(function(c){ if(!best||c.revision>best.revision) best=c; });
      if(!best) return null;
      var text=Profile.serialize(best);
      if(folderReady()&&best.revision>fileRev){ try{ await writeRaw(PROFILE_FILE,text); }catch(e){} }
      try{ await P.kv.put("profile",text); P.ls.del("pr.profile"); }catch(e){ P.ls.set("pr.profile",text); }
      return best;
    },
    saveProfile:async function(p,opts){
      p.revision=(p.revision||0)+1;
      p.savedAt=opts&&opts.now||new Date().toISOString();
      var text=Profile.serialize(p),res={revision:p.revision,where:[]};
      try{ await P.kv.put("profile",text); P.ls.del("pr.profile"); res.where.push("browser"); }
      catch(e){ if(P.ls.set("pr.profile",text)) res.where.push("browser"); }
      if(folderReady()){
        try{ await writeRaw(PROFILE_FILE,text); res.where.push("folder"); }
        catch(e){ res.folderError=e&&e.message||String(e); }
      }
      if(!res.where.length) throw new Error("Your details could not be saved.");
      return res;
    },
    profileLastGasp:function(p){
      var copy=clone(p);
      copy.revision=(copy.revision||0)+1;
      copy.savedAt=new Date().toISOString();
      return P.ls.set("pr.profile",Profile.serialize(copy));
    },

    download:function(fileName,text){ P.download(fileName,text); },

    /* For tests and the storage panel. */
    _state:function(){ return S; }
  };
  return api;
})();
