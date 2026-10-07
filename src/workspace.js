/* ============ workspace file ============ */
/* One of these per realtor team. It is the only place the loan officer's own work lives:
   corrections, notes, hidden rows, the team's branding, and the history of
   exports and meetings. Plain JSON so it can be read, copied and backed up
   like any other document. */
var WS_FORMAT="partnership-review-workspace";
var WS_SCHEMA=1;
var WS_EXT=".partnership.json";
var LOG_MAX=1500;      // change-log entries kept
var STATE_KEEP=12;     // exports that keep a full "where everything stood" record

/* A fast, well-spread hash. Used to spot the same export dropped twice and a
   file changed outside the tool; it is not a security measure. */
function cyrb53(str){
  var h1=0xdeadbeef,h2=0x41c6ce57;
  for(var i=0;i<str.length;i++){
    var ch=str.charCodeAt(i);
    h1=Math.imul(h1^ch,2654435761);
    h2=Math.imul(h2^ch,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16);
}
function hashBytes(u8){
  var h1=0xdeadbeef,h2=0x41c6ce57;
  for(var i=0;i<u8.length;i++){
    h1=Math.imul(h1^u8[i],2654435761);
    h2=Math.imul(h2^u8[i],1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16)+"-"+u8.length;
}
function uid(prefix){
  return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}
function pad(n,w){return String(n).padStart(w,"0");}
function clone(o){return JSON.parse(JSON.stringify(o));}

function WorkspaceError(code,message){
  var e=new Error(message); e.name="WorkspaceError"; e.code=code; return e;
}

var Workspace={
  /* Each entry upgrades a workspace from schema n to n+1, in place. */
  MIGRATIONS:{},

  create:function(teamName){
    var name=clean(teamName)||"New team";
    return {
      format:WS_FORMAT, schemaVersion:WS_SCHEMA, appVersion:APP_VERSION,
      revision:0, savedAt:"", device:"", checksum:"",
      team:{id:uid("T"),name:name,leadName:"Team lead name",leadRole:"Team lead",
            photo:"",logo:"",pos:{x:50,y:50,z:100}},
      settings:{basis:"mature",showClosed:false,asOfOverride:"",
                bench:{pq:null,close:null,source:"",period:"",population:null,validated:""}},
      aliases:{},
      nextLoan:1,nextImport:1,nextMeeting:1,
      loans:[],imports:[],meetings:[],log:[]
    };
  },

  fileNameFor:function(teamName){
    var s=clean(teamName).replace(/[\\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").replace(/[. ]+$/,"").trim();
    if(!s) s="Team";
    if(s.length>60) s=s.slice(0,60).trim();
    return s+WS_EXT;
  },

  checksum:function(ws){
    var copy={};
    Object.keys(ws).forEach(function(k){ if(k!=="checksum") copy[k]=ws[k]; });
    return cyrb53(JSON.stringify(copy));
  },

  /* Text for the file. Stamps the checksum last so it covers everything else. */
  serialize:function(ws){
    ws.checksum="";
    ws.checksum=Workspace.checksum(ws);
    return JSON.stringify(ws,null,1);
  },

  migrate:function(ws,target,migrations){
    target=target||WS_SCHEMA; migrations=migrations||Workspace.MIGRATIONS;
    var from=ws.schemaVersion;
    while(ws.schemaVersion<target){
      var step=migrations[ws.schemaVersion];
      if(!step) throw WorkspaceError("no-migration",
        "This team file is from an older version (format "+ws.schemaVersion+") and this copy of the tool has no upgrade path for it.");
      var before=ws.schemaVersion;
      step(ws);
      if(ws.schemaVersion!==before+1) ws.schemaVersion=before+1;
    }
    return from;
  },

  /* Reads a team file. Throws a WorkspaceError when it cannot be used; returns
     warnings for things worth telling the loan officer about but safe to carry on from. */
  parse:function(text,target,migrations){
    target=target||WS_SCHEMA;
    var ws;
    try{ ws=JSON.parse(text); }
    catch(e){ throw WorkspaceError("not-json","This file is damaged or incomplete and cannot be read as a team file."); }
    if(!ws||typeof ws!=="object"||ws.format!==WS_FORMAT)
      throw WorkspaceError("not-workspace","This is not a Partnership Review team file.");
    if(typeof ws.schemaVersion!=="number")
      throw WorkspaceError("not-workspace","This team file has no format version, so it cannot be opened safely.");
    if(ws.schemaVersion>target)
      throw WorkspaceError("too-new","This team file was saved by a newer version of the tool. Open it with the newest Partnership Review file.");

    var warnings=[];
    if(ws.checksum){
      var want=ws.checksum;
      if(Workspace.checksum(ws)!==want)
        warnings.push("This team file was changed outside the tool since it was last saved. Check that it looks right.");
    }
    var from=ws.schemaVersion;
    if(ws.schemaVersion<target) Workspace.migrate(ws,target,migrations);
    Workspace.repair(ws);
    return {ws:ws,warnings:warnings,migratedFrom:from<target?from:null};
  },

  /* Fills in anything a hand-edited or older file left out, so the rest of the
     code can rely on the shape. */
  repair:function(ws){
    var blank=Workspace.create(ws.team&&ws.team.name);
    ["team","settings"].forEach(function(k){
      if(!ws[k]||typeof ws[k]!=="object") ws[k]=blank[k];
      Object.keys(blank[k]).forEach(function(j){ if(ws[k][j]===undefined) ws[k][j]=blank[k][j]; });
    });
    if(!ws.settings.bench||typeof ws.settings.bench!=="object") ws.settings.bench=blank.settings.bench;
    if(!ws.team.pos) ws.team.pos={x:50,y:50,z:100};
    if(!ws.aliases||typeof ws.aliases!=="object") ws.aliases={};
    ["loans","imports","meetings","log"].forEach(function(k){ if(!Array.isArray(ws[k])) ws[k]=[]; });
    ["nextLoan","nextImport","nextMeeting"].forEach(function(k){ if(typeof ws[k]!=="number") ws[k]=1; });
    ws.loans.forEach(function(L){
      if(!Array.isArray(L.keys)) L.keys=[];
      if(!L.overlay||typeof L.overlay!=="object") L.overlay={};
      if(!L.src||typeof L.src!=="object") L.src={name:"",agentRaw:"",milestone:"",d:{}};
      if(!L.src.d) L.src.d={};
      if(typeof L.note!=="string") L.note="";
      if(typeof L.privateNote!=="string") L.privateNote="";
      if(!L.presence) L.presence="present";
      var n=+String(L.id||"").replace(/\D/g,"");
      if(n>=ws.nextLoan) ws.nextLoan=n+1;
    });
    if(typeof ws.revision!=="number") ws.revision=0;
    return ws;
  },

  loanById:function(ws,id){
    for(var i=0;i<ws.loans.length;i++) if(ws.loans[i].id===id) return ws.loans[i];
    return null;
  },

  /* The export the report is drawn from: the newest by its own date, and the
     one added last when two share a date. */
  currentImport:function(ws){
    var best=null;
    ws.imports.forEach(function(i){
      if(i.historical) return;
      if(!best||i.asOf>best.asOf||(i.asOf===best.asOf&&i.importedAt>=best.importedAt)) best=i;
    });
    return best;
  },

  log:function(ws,entry){
    ws.log.push(entry);
    if(ws.log.length>LOG_MAX) ws.log.splice(0,ws.log.length-LOG_MAX);
  },

  /* A one-line description for the home screen, without loading the report. */
  summary:function(ws){
    var cur=Workspace.currentImport(ws);
    var last=ws.meetings.length?ws.meetings[ws.meetings.length-1]:null;
    return {id:ws.team.id,name:ws.team.name,leadName:ws.team.leadName,
      loans:ws.loans.filter(function(L){return L.presence!=="removed";}).length,
      asOf:cur?cur.asOf:"",lastMeeting:last?last.heldAt:"",
      savedAt:ws.savedAt,revision:ws.revision,photo:ws.team.photo||""};
  }
};
