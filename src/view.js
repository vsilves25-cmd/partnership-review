/* ============ view ============ */
/* Turns a saved team into the list of files the report draws: the latest
   Encompass facts for each loan, with the loan officer's corrections laid over the top. */

/* Why a loan is not in the newest export, as the loan officer records it. */
var MISSING_REASONS=[
  {k:"",t:"Not sure yet"},
  {k:"active",t:"Still active, the export left it out"},
  {k:"withdrawn",t:"Withdrawn"},
  {k:"denied",t:"Denied"},
  {k:"elsewhere",t:"Went elsewhere"},
  {k:"removed",t:"Not this team's buyer"}
];
var FALLOUT={withdrawn:"Withdrawn",denied:"Denied",elsewhere:"Went elsewhere"};

function buildView(ws){
  var cur=Workspace.currentImport(ws);
  var asOf=ws.settings.asOfOverride||(cur?cur.asOf:"");
  var today=parseDate(asOf)||parseDate(new Date());
  var files=[],byId={};
  ws.loans.forEach(function(L){
    if(L.presence==="removed")return;
    var f=fileFromSource(L.src);
    f.loanId=L.id;
    f.missing=L.presence==="missing";
    f.missingReason=L.missingReason||"";
    f.missingSince=L.missingSince||"";
    files.push(f); byId[L.id]=L;
  });
  var names=assignAgents(files,ws.aliases);

  files.forEach(function(f){
    var L=byId[f.loanId],ov=L.overlay||{};
    f.conflicts=[];
    if(ov.name) f.name=ov.name.v;
    if(ov.agent) f.agent=ov.agent.v||"Unassigned";
    if(ov.milestone){
      var cls=classify(ov.milestone.v);
      f.milestone=cls.raw; f.kind=cls.kind; f.stageIdx=cls.kind==="stage"?cls.idx:-1;
      if(isFunded(f)&&!f._d["Funding"]){
        f._d["Funding"]=parseDate(ov.milestone.at)||today;
        f.fundingSource="manual";      // display only; excluded from medians
      }
    }
    if(ov.pqDate){ f.pqDate=parseDate(ov.pqDate.v); f.pq=!!f.pqDate; }
    Object.keys(ov).forEach(function(k){
      if(ov[k].pending!==undefined) f.conflicts.push({field:k,now:ov[k].pending});
    });
    f.edited=Object.keys(ov).length>0;

    /* A loan that left the export and that the loan officer has marked as fallen out is
       shown as no longer active. A closed loan stays closed whatever happens. */
    if(f.missing&&FALLOUT[f.missingReason]&&!isFunded(f)){
      f.milestone=FALLOUT[f.missingReason]; f.kind="terminal"; f.stageIdx=-1;
    }
    f.hidden=!!L.hidden;
    f.note=L.note||"";
    f.privateNote=L.privateNote||"";
    setClocks(f,today);
  });
  return {files:files,names:names,today:today,asOf:asOf,current:cur};
}

/* A compact record of where every file stood, for comparing later. */
function freezeState(files){
  var out={};
  files.forEach(function(f){
    out[f.loanId]={n:f.name,g:f.agent,m:f.milestone,k:f.kind,s:f.stageIdx,
      q:f.pq?1:0,f:isFunded(f)?1:0,a:f.amount,h:f.hidden?1:0,x:f.missing?1:0};
  });
  return out;
}

/* What changed between a frozen record and now. Each file lands in the one
   list that says the most about it. */
function diffSince(base,files){
  var pi=STAGES.indexOf("Processing");
  var out={added:[],preApproved:[],contract:[],closed:[],dropped:[],moved:[],closedVolume:0,any:false};
  files.forEach(function(f){
    if(f.hidden)return;
    var b=base[f.loanId];
    if(!b){ if(!f.missing){out.added.push(f);} return; }
    if(!b.f&&isFunded(f)){out.closed.push(f);out.closedVolume+=f.amount;return;}
    if(b.k!=="terminal"&&f.kind==="terminal"){out.dropped.push(f);return;}
    if(f.kind==="stage"&&b.s<pi&&f.stageIdx>=pi){out.contract.push(f);return;}
    if(!b.q&&f.pq){out.preApproved.push(f);return;}
    if(b.k==="stage"&&f.kind==="stage"&&b.m!==f.milestone)
      out.moved.push({f:f,from:b.m,to:f.milestone});
  });
  out.any=!!(out.added.length||out.preApproved.length||out.contract.length||
             out.closed.length||out.dropped.length||out.moved.length);
  return out;
}

/* What "since last time" is measured from: the last meeting marked as
   presented, or failing that the export before the current one. */
function baselineFor(ws){
  if(ws.meetings.length){
    var m=ws.meetings[ws.meetings.length-1];
    return {kind:"meeting",label:"Since we last met",date:localDay(m.heldAt),state:m.state};
  }
  var cur=Workspace.currentImport(ws),prev=null;
  ws.imports.forEach(function(i){
    if(i.historical||!i.state||!cur||i.id===cur.id)return;
    if(i.asOf>cur.asOf)return;
    if(!prev||i.asOf>prev.asOf||(i.asOf===prev.asOf&&i.importedAt>prev.importedAt)) prev=i;
  });
  return prev?{kind:"import",label:"Since the last export",date:parseDate(prev.asOf),state:prev.state}:null;
}

/* Things for the loan officer alone: never printed, never shown in presenter view. */
function watchList(files,haveCols){
  var out=[];
  files.forEach(function(f){
    if(!isActive(f))return;
    if(f.missing){
      if(!f.missingReason) out.push({f:f,k:"missing",t:"Not in the latest export. Say what happened to it."});
      return;
    }
    if(f.lockDays!=null&&f.lockDays<0)
      out.push({f:f,k:"lock",t:"Rate lock expired "+Math.abs(f.lockDays)+" day"+(Math.abs(f.lockDays)===1?"":"s")+" ago"});
    else if(f.lockDays!=null&&f.lockDays<=LOCK_WARN_DAYS)
      out.push({f:f,k:"lock",t:"Rate lock expires in "+f.lockDays+" day"+(f.lockDays===1?"":"s")});
    if(f.daysToClose!=null&&f.daysToClose<0)
      out.push({f:f,k:"close",t:"Estimated closing date passed "+Math.abs(f.daysToClose)+" day"+(Math.abs(f.daysToClose)===1?"":"s")+" ago"});
    if(haveCols.apprOrdered&&f.stageIdx>=STAGES.indexOf("Processing")){
      if(!f.apprOrdered) out.push({f:f,k:"appraisal",t:"Under contract with no appraisal ordered"});
      else if(haveCols.apprReceived&&!f.apprReceived&&days(f.apprOrdered,CLOCK.today)>APPRAISAL_WAIT_DAYS)
        out.push({f:f,k:"appraisal",t:"Appraisal ordered "+days(f.apprOrdered,CLOCK.today)+" days ago, not back yet"});
    }
  });
  return out;
}

function closingSoon(files){
  return files.filter(function(f){
    return shown(f)&&isActive(f)&&!f.missing&&f.daysToClose!=null&&
           f.daysToClose>=0&&f.daysToClose<=CLOSING_SOON_DAYS;
  }).sort(function(a,b){return a.estClose-b.estClose;});
}
