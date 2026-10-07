/* ============ config ============ */
/* Reading and measuring an Encompass export. Lifted from Pipeline Report V16;
   the only structural change is that a row is first reduced to a small source
   record (sourceFromRow) so it can be stored and compared between exports. */
var APP_VERSION="18.0.0";

var STAGES=["Started","Ready for Pack Out","Processing","Approval","Resubmittal",
            "CTC","Rec'd by Closer","Funding"];
var STAGE_DATE={
  "Started":["Date File Started"],
  "Ready for Pack Out":["Milestone Date - Ready for Pack Out"],
  "Processing":["Milestone Date - Processing"],
  "Approval":["Milestone Date/Time - Approval","Milestone Date - Approval"],
  "CTC":["Milestone Date/Time - CTC","Milestone Date - CTC"],
  "Funding":["Milestone Date/Time - Funding","Milestone Date - Funding"]
};
/* Comment columns vary between exports. Prefer the one for the file's current
   milestone, then work back from the latest stage, then anything generic. */
var NOTE_ORDER=["Funding","Rec'd by Closer","Docs Signing","CTC","Resubmittal",
  "Approval","Submittal","Scheduled","Processing","Ready for Pack Out","Started"];
var NOTE_GENERIC=["Comments","Loan Comments","Conversation Log","Processor Notes Field"];
var NOTE_COLS=[];                       // filled in at load time from the headers

/* Columns the report can use beyond the required ones. Each lists the header
   spellings seen in real exports; the first one present wins. */
var COLS={
  loanNumber:["Loan Number","Loan #","Loan No","Loan No.","Loan Num"],
  estClose:["Est Closing Date","Estimated Closing Date"],
  lockDays:["# Days to Lock Expiration"],
  lockStatus:["Lock & Request Status"],
  apprOrdered:["Appraisal Ordered Date","Appraisal Date Ordered"],
  apprReceived:["Appraisal Recieved Date","Appraisal Received Date"],
  loanType:["Loan Type"]
};
/* What the export checklist asks for, most useful first. */
var RECOMMENDED=[
  {key:"loanNumber",label:"Loan Number",why:"lets the tool follow a file from one export to the next without relying on the borrower's name"},
  {key:"pqFlag",label:"PreQualified Client",why:"the clearest marker of a pre-approval",cols:["PreQualified Client"]},
  {key:"estClose",label:"Est Closing Date",why:"drives the Closing soon list"},
  {key:"lockDays",label:"# Days to Lock Expiration",why:"drives the lock warnings on your private watch list"},
  {key:"apprOrdered",label:"Appraisal Date Ordered",why:"drives the appraisal warnings on your private watch list"},
  {key:"comments",label:"Milestone Comments",why:"prefills a suggested note for each buyer",test:function(h){
    return h.some(function(x){return /^Milestone Comments\s*-\s*/i.test(x);});}}
];

function discoverNoteColumns(headers){
  var found=[];
  headers.forEach(function(h){
    if(/^Milestone Comments\s*-\s*/i.test(h)) found.push(h);
  });
  NOTE_GENERIC.forEach(function(g){ if(headers.indexOf(g)>=0) found.push(g); });
  NOTE_COLS=found;
  return found;
}

function noteColumnsFor(milestone){
  var pref=[], m=clean(milestone);
  if(m) NOTE_COLS.forEach(function(c){
    if(c.replace(/^Milestone Comments\s*-\s*/i,"").toLowerCase()===m.toLowerCase()) pref.push(c);
  });
  NOTE_ORDER.forEach(function(stage){
    NOTE_COLS.forEach(function(c){
      if(c.replace(/^Milestone Comments\s*-\s*/i,"").toLowerCase()===stage.toLowerCase()
         && pref.indexOf(c)<0) pref.push(c);
    });
  });
  NOTE_COLS.forEach(function(c){ if(pref.indexOf(c)<0) pref.push(c); });
  return pref;
}

/* Two shapes turn up:
     RC 1/14 - Sent the pre-approval letter          (initials, date, text)
     6/8/2026 5:08 PM(EST) Karl Swank > Foundation   (stamped processor note)
   Keep the newest line. Strip the stamp only on the second kind. */
function latestNote(raw){
  var t=clean(raw);
  if(!t)return "";
  var first=t.split(/\r?\n/)[0];
  if(/\(EST\)|\(EDT\)|\(CST\)/i.test(first)){
    var m=first.match(/>\s*(.+)$/);
    if(m) first=m[1];
  }
  return clean(first);
}

function noteFrom(row,milestone){
  var cols=noteColumnsFor(milestone);
  for(var i=0;i<cols.length;i++){
    var v=latestNote(row[cols[i]]);
    if(v) return {text:v, source:cols[i]};
  }
  return {text:"", source:""};
}

var TERMINAL=["Adverse","Adverse Action","Denied","Denial","Withdrawn","Cancelled",
              "Canceled","Suspended","Archived","Declined","Turned Down"];

function classify(raw){
  var s=clean(raw);
  if(!s)return{kind:"unknown",raw:"No milestone recorded"};
  var i=STAGES.indexOf(s);
  if(i>=0)return{kind:"stage",idx:i,raw:s};
  for(var t=0;t<TERMINAL.length;t++)
    if(TERMINAL[t].toLowerCase()===s.toLowerCase())return{kind:"terminal",raw:s};
  return{kind:"unknown",raw:s};
}

var MIN_N=8;            // below this, per-agent percentages are noise
var MATURITY_DAYS=120;  // days post-PA before a file counts against the close rate
var STALE_DAYS=45;
var CLOSING_SOON_DAYS=30;
var LOCK_WARN_DAYS=10;
var APPRAISAL_WAIT_DAYS=14;

/* ============ helpers ============ */
function clean(v){return v==null?"":String(v).replace(/ /g," ").trim();}
function atNoon(y,m,d){return new Date(y,m,d,12,0,0,0);}
function parseDate(v){
  if(v==null||v==="")return null;
  if(v instanceof Date){return isNaN(v)?null:atNoon(v.getFullYear(),v.getMonth(),v.getDate());}
  if(typeof v==="number"&&isFinite(v)){
    var x=new Date(Date.UTC(1899,11,30+Math.floor(v)));
    return isNaN(x)?null:atNoon(x.getUTCFullYear(),x.getUTCMonth(),x.getUTCDate());
  }
  var s=clean(v);
  if(!s)return null;
  var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);              if(m)return atNoon(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);       if(m)return atNoon(+m[3],+m[1]-1,+m[2]);
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/); if(m)return atNoon(2000+ +m[3],+m[1]-1,+m[2]);
  return null;
}
function parseMoney(v){
  if(v==null||v==="")return 0;
  if(typeof v==="number")return isFinite(v)?v:0;
  var s=clean(v); if(!s)return 0;
  var neg=/^\(.*\)$/.test(s);
  s=s.replace(/[()$,\s]/g,"");
  var n=Number(s);
  return isFinite(n)?(neg?-n:n):0;
}
function days(a,b){return Math.round((b-a)/86400000);}
function fmtDate(d){return d?(d.getMonth()+1)+"/"+d.getDate()+"/"+String(d.getFullYear()).slice(2):"—";}
function fmtLong(d){
  if(!d)return "—";
  var M=["January","February","March","April","May","June","July",
         "August","September","October","November","December"];
  return M[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();
}
/* The local calendar day a saved moment (ISO date-time) fell on. */
function localDay(s){var d=new Date(s);return isNaN(d)?null:parseDate(d);}
function isoDate(d){
  if(!d)return"";
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function label(s){
  if(s==="CTC") return "Clear to close";
  if(s==="Funding") return "Closed";        // Encompass calls it Funding; a closed loan is closed
  return s;
}
function money(v){
  if(v>=1e6)return "$"+(v/1e6).toFixed(1)+"M";
  if(v>=1e3)return "$"+Math.round(v/1e3)+"K";
  return "$"+Math.round(v);
}

var NICK={tom:"thomas",tommy:"thomas",bella:"isabella",nick:"nicholas",mike:"michael",
  matt:"matthew",chris:"christopher",dan:"daniel",dave:"david",rob:"robert",bob:"robert",
  jim:"james",bill:"william",liz:"elizabeth",kate:"katherine",katie:"katherine",jen:"jennifer",
  /* common ones V16 missed */
  will:"william",billy:"william",bobby:"robert",robbie:"robert",jimmy:"james",jamie:"james",
  mikey:"michael",mick:"michael",danny:"daniel",davey:"david",joe:"joseph",joey:"joseph",
  tony:"anthony",andy:"andrew",drew:"andrew",steve:"steven",stephen:"steven",ben:"benjamin",
  sam:"samuel",alex:"alexander",greg:"gregory",jeff:"jeffrey",geoff:"jeffrey",ken:"kenneth",
  kenny:"kenneth",ron:"ronald",don:"donald",ed:"edward",eddie:"edward",ted:"edward",
  rick:"richard",rich:"richard",dick:"richard",chuck:"charles",charlie:"charles",
  pat:"patrick",pete:"peter",phil:"philip",ray:"raymond",tim:"timothy",josh:"joshua",
  jon:"jonathan",nate:"nathan",zach:"zachary",zack:"zachary",
  beth:"elizabeth",betsy:"elizabeth",lizzie:"elizabeth",eliza:"elizabeth",
  kathy:"katherine",cathy:"katherine",kat:"katherine",katherine:"katherine",catherine:"katherine",
  jenny:"jennifer",jenn:"jennifer",sue:"susan",susie:"susan",deb:"deborah",debbie:"deborah",
  barb:"barbara",pam:"pamela",patty:"patricia",trish:"patricia",peggy:"margaret",
  maggie:"margaret",meg:"margaret",becky:"rebecca",becca:"rebecca",steph:"stephanie",
  chrissy:"christine",tina:"christina",cindy:"cynthia",mandy:"amanda",abby:"abigail",
  vicky:"victoria",vicki:"victoria",sandy:"sandra",terri:"theresa",terry:"theresa",
  nikki:"nicole",jess:"jessica",jessie:"jessica",angie:"angela",kim:"kimberly",
  val:"valerie",gabby:"gabrielle",ally:"allison",allie:"allison"};

function canonFirst(f){return NICK[f]||f;}
function nameParts(raw){
  var s=clean(raw).toLowerCase().replace(/[.,]/g,"");
  var p=s.split(/\s+/).filter(Boolean);
  return p.length?{first:p[0],last:p[p.length-1],full:p.join(" ")}:null;
}
function agentKey(raw){var p=nameParts(raw);return p?p.full:"";}

function lev(a,b){
  if(a===b)return 0;
  var m=a.length,n=b.length;
  if(!m)return n; if(!n)return m;
  var prev=[],cur=[],i,j;
  for(j=0;j<=n;j++)prev[j]=j;
  for(i=1;i<=m;i++){
    cur[0]=i;
    for(j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(j=0;j<=n;j++)prev[j]=cur[j];
  }
  return prev[n];
}

/* Same surname plus a first name that matches, is a known nickname, or is an
   initial. Tom and Tim Marlow are different people and never merge. */
function sameAgent(a,b){
  var fa=canonFirst(a.first),fb=canonFirst(b.first);
  var firstOk = fa===fb ||
    (fa.length===1&&fb.indexOf(fa)===0) ||
    (fb.length===1&&fa.indexOf(fb)===0);
  if(!firstOk)return false;
  if(a.last===b.last)return true;
  // absorb a surname typo only when the first name is an exact match
  return fa===fb && Math.abs(a.last.length-b.last.length)<=1 && lev(a.last,b.last)<=2;
}

function resolveNames(rows,col){
  var b={};
  rows.forEach(function(r){
    var raw=clean(r[col]); if(!raw)return;
    var k=agentKey(raw); if(!k)return;
    if(!b[k])b[k]={parts:nameParts(raw),variants:{},n:0};
    b[k].variants[raw]=(b[k].variants[raw]||0)+1;
    b[k].n++;
  });
  var keys=Object.keys(b),parent={};
  keys.forEach(function(k){parent[k]=k;});
  function find(k){while(parent[k]!==k)k=parent[k]=parent[parent[k]];return k;}
  function union(x,y){
    var rx=find(x),ry=find(y); if(rx===ry)return;
    var keepX=b[rx].n>=b[ry].n;
    parent[keepX?ry:rx]=keepX?rx:ry;
  }
  /* Full first names first. A bare initial is settled afterwards and only
     joins a group when exactly one fits: "T Marlow" must not become the bridge
     that merges Tom with Tim. (V16 merged all three.) */
  var full=keys.filter(function(k){return b[k].parts.first.length>1;});
  var initials=keys.filter(function(k){return b[k].parts.first.length===1;});
  for(var i=0;i<full.length;i++)
    for(var j=i+1;j<full.length;j++)
      if(sameAgent(b[full[i]].parts,b[full[j]].parts))union(full[i],full[j]);
  initials.forEach(function(k){
    var roots={};
    full.forEach(function(g){ if(sameAgent(b[k].parts,b[g].parts)) roots[find(g)]=1; });
    var r=Object.keys(roots);
    if(r.length===1) union(k,r[0]);
  });

  var groups={};
  keys.forEach(function(k){
    var root=find(k);
    if(!groups[root])groups[root]={variants:{},n:0};
    Object.keys(b[k].variants).forEach(function(v){
      groups[root].variants[v]=(groups[root].variants[v]||0)+b[k].variants[v];
    });
    groups[root].n+=b[k].n;
  });
  var out={};
  Object.keys(groups).forEach(function(root){
    var v=groups[root].variants;
    var best=Object.keys(v).sort(function(x,y){return v[y]-v[x]||y.length-x.length;})[0];
    out[root]={label:best,variants:Object.keys(v)};
  });
  Object.defineProperty(out,"__find",{value:find,enumerable:false});  // never show up in Object.keys
  return out;
}

/* ============ parse ============ */
var PQ_RULE="flag";   // how pre-approval was determined for this export

function pick(row,names){
  for(var i=0;i<names.length;i++) if(clean(row[names[i]])) return row[names[i]];
  return "";
}

/* Reads the workbook and says what it found. Throws, with a message the loan officer can
   act on, when a column the report cannot work without is missing. */
function parseWorkbook(wb){
  var sheet=wb.SheetNames.indexOf("Data")>=0?"Data":wb.SheetNames[0];
  var aoa=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:true,defval:""});
  if(!aoa.length)throw new Error("That sheet is empty.");
  var headers=aoa[0].map(clean);

  if(headers.indexOf("Borrower Name")<0)
    throw new Error("This export has no Borrower Name column. Re-run it from Encompass with that column included.");
  if(headers.indexOf("Current Milestone")<0 && headers.indexOf("Last Finished Milestone")<0)
    throw new Error("This export has no milestone column. Add Current Milestone to the Encompass export.");
  if(headers.indexOf("Buyers Agent Contact Name")<0)
    throw new Error("This export has no Buyers Agent Contact Name column, so nothing can be grouped by agent.");

  // Pre-approval: the flag if it is there, otherwise the timestamp
  if(headers.indexOf("PreQualified Client")>=0) PQ_RULE="flag";
  else if(headers.indexOf("PreQualified Client DateTime")>=0) PQ_RULE="date";
  else if(headers.indexOf("Milestone Date - Pre-Qualification")>=0) PQ_RULE="milestone";
  else throw new Error("This export has nothing that identifies a pre-approval. "+
    "Add PreQualified Client or PreQualified Client DateTime to the Encompass export.");

  discoverNoteColumns(headers);

  var rows=aoa.slice(1).map(function(a){
    var o={};headers.forEach(function(h,i){if(h&&!(h in o))o[h]=a[i];});return o;
  }).filter(function(o){return clean(o["Borrower Name"]);});
  if(!rows.length)throw new Error("No borrower rows found in that file.");
  return {rows:rows,headers:headers.filter(Boolean),pqRule:PQ_RULE,noteCols:NOTE_COLS.slice(),sheet:sheet};
}
function load(wb){return parseWorkbook(wb).rows;}

function hasColumn(headers,names){
  for(var i=0;i<names.length;i++) if(headers.indexOf(names[i])>=0) return true;
  return false;
}
function missingRecommended(headers){
  return RECOMMENDED.filter(function(r){
    if(r.test) return !r.test(headers);
    return !hasColumn(headers,r.cols||COLS[r.key]);
  }).map(function(r){return {key:r.key,label:r.label,why:r.why};});
}

function stageDate(row,stage){
  var cols=STAGE_DATE[stage]||[];
  for(var i=0;i<cols.length;i++){
    if(!clean(row[cols[i]]))continue;          // blank cells come through as a single space
    var d=parseDate(row[cols[i]]);
    if(d)return d;
  }
  return null;
}
function isPreApproved(r){
  if(PQ_RULE==="flag") return clean(r["PreQualified Client"]).toUpperCase()==="X";
  if(PQ_RULE==="date") return !!parseDate(r["PreQualified Client DateTime"]);
  return !!parseDate(r["Milestone Date - Pre-Qualification"]);
}

/* One export row, reduced to what the report needs and nothing else. Dates are
   kept as YYYY-MM-DD text so the saved file reads the same in any time zone. */
function sourceFromRow(r){
  var msRaw=r["Current Milestone"]||r["Last Finished Milestone"];
  var nt=noteFrom(r,classify(msRaw).raw);
  var d={};
  STAGES.forEach(function(s){var x=stageDate(r,s);if(x)d[s]=isoDate(x);});
  var lock=clean(pick(r,COLS.lockDays)), lockN=lock===""?NaN:Number(lock);
  return {
    loanNumber:clean(pick(r,COLS.loanNumber)),
    name:clean(r["Borrower Name"]),
    agentRaw:clean(r["Buyers Agent Contact Name"]),
    milestone:clean(msRaw),
    pq:isPreApproved(r),
    pqDate:isoDate(parseDate(r["PreQualified Client DateTime"])||parseDate(r["Milestone Date - Pre-Qualification"])),
    started:isoDate(parseDate(r["Date File Started"])),
    lastMs:isoDate(parseDate(r["Last Finished Milestone Date"])),
    d:d,
    amount:parseMoney(r["Total Loan Amount"]),
    encNote:nt.text,
    encNoteSource:nt.source,
    estClose:isoDate(parseDate(pick(r,COLS.estClose))),
    lockDays:isFinite(lockN)?lockN:null,
    lockStatus:clean(pick(r,COLS.lockStatus)),
    apprOrdered:isoDate(parseDate(pick(r,COLS.apprOrdered))),
    apprReceived:isoDate(parseDate(pick(r,COLS.apprReceived))),
    loanType:clean(pick(r,COLS.loanType))
  };
}

/* A source record turned back into the working object the report draws from. */
function fileFromSource(src){
  var cls=classify(src.milestone);
  var d={};STAGES.forEach(function(s){d[s]=parseDate(src.d&&src.d[s]);});
  return {
    name:src.name,
    agentRaw:src.agentRaw,
    agent:"Unassigned",
    milestone:cls.raw,
    kind:cls.kind,
    stageIdx:cls.kind==="stage"?cls.idx:-1,
    pq:!!src.pq,
    pqDate:parseDate(src.pqDate),
    started:parseDate(src.started),
    lastMs:parseDate(src.lastMs),
    _d:d,
    fundingSource:d["Funding"]?"export":null,
    amount:src.amount||0,
    note:"",
    noteSource:"",
    edited:false,
    loanNumber:src.loanNumber||"",
    encNote:src.encNote||"",
    encNoteSource:src.encNoteSource||"",
    estClose:parseDate(src.estClose),
    lockDays:src.lockDays==null?null:src.lockDays,
    lockStatus:src.lockStatus||"",
    apprOrdered:parseDate(src.apprOrdered),
    apprReceived:parseDate(src.apprReceived),
    loanType:src.loanType||""
  };
}

/* Gives every file its agent label: spellings merged, then any rename the loan officer
   made (aliases, keyed by the spelling as it appears in Encompass). */
function assignAgents(files,aliases){
  var names=resolveNames(files,"agentRaw");
  var find=names.__find;
  files.forEach(function(f){
    var raw=clean(f.agentRaw);
    var k=raw?find(agentKey(raw)):"";
    var lab=k&&names[k]?names[k].label:"Unassigned";
    var ak=agentKey(raw);
    if(aliases&&ak&&aliases[ak]) lab=aliases[ak];
    f.agent=lab;
    f.agentBase=lab;
  });
  return names;
}

/* The V16 entry point, kept so its behaviour stays pinned by tests: rows in,
   working files out, with the Encompass comment as the note. */
function build(rows,today){
  today=today||parseDate(new Date());
  var files=rows.map(function(r){
    var f=fileFromSource(sourceFromRow(r));
    f.note=f.encNote; f.noteSource=f.encNoteSource;
    return f;
  });
  var names=assignAgents(files,null);
  files.forEach(function(f){setClocks(f,today);});
  return {files:files,names:names,today:today};
}

/* Days in the current stage, using the real milestone date for that stage when
   the export has one. The fallbacks are marked so the number is never oversold. */
function setClocks(f,today){
  var entry=null,basis=null;
  if(f.kind==="stage"&&f._d[f.milestone]){entry=f._d[f.milestone];basis="stage";}
  else if(f.lastMs){entry=f.lastMs;basis="lastMilestone";}
  else if(f.started){entry=f.started;basis="fileStart";}
  f.stageEntry=entry;
  f.clockBasis=basis;
  f.daysInStage=entry?days(entry,today):null;
  f.daysSinceReferral=f.started?days(f.started,today):null;
  f.closedOn=f._d["Funding"]||null;
  f.daysToClose=f.estClose?days(today,f.estClose):null;
}

/* ============ derived ============ */
var CLOCK={today:null};   // the "as of" date every day count is measured against

function stageIdx(f){return f.stageIdx;}
function isFunded(f){return f.kind==="stage"&&f.milestone==="Funding";}
function isActive(f){return f.kind==="stage"&&!isFunded(f);}
function shown(f){return !f.hidden;}
function isMature(f){return f.pq&&f.pqDate?days(f.pqDate,CLOCK.today)>=MATURITY_DAYS:false;}
function rate(n,d){return d?Math.round(n/d*100):null;}

function closeDen(list,basis){
  if(basis==="all")return list.filter(function(f){return f.pq;});
  if(basis==="contract")return list.filter(function(f){return f.pq&&stageIdx(f)>=STAGES.indexOf("Processing");});
  return list.filter(function(f){return f.pq&&(isFunded(f)||isMature(f));});
}
function summarize(list,basis){
  var pq=list.filter(function(f){return f.pq;});
  var fn=list.filter(isFunded);
  var den=closeDen(list,basis);
  var fid=den.filter(isFunded);
  return {n:list.length,pq:pq.length,pqRate:rate(pq.length,list.length),
    funded:fn.length,closeDen:den.length,closeRate:rate(fid.length,den.length),
    volume:fn.reduce(function(s,f){return s+f.amount;},0)};
}
function medians(list){
  var out={};
  for(var i=0;i<STAGES.length-1;i++){
    var a=STAGES[i],b=STAGES[i+1],v=[];
    list.forEach(function(f){
      if(f.fundingSource==="manual"&&b==="Funding")return;   // never let a meeting edit move a median
      var da=f._d[a],db=f._d[b];
      if(da&&db&&db>=da)v.push(days(da,db));
    });
    v.sort(function(x,y){return x-y;});
    out[a]=v.length?v[Math.floor(v.length/2)]:null;
  }
  return out;
}
function commonSurname(list){
  var c={};
  list.forEach(function(n){var p=n.trim().split(/\s+/),l=p[p.length-1];if(l)c[l]=(c[l]||0)+1;});
  var best=Object.keys(c).sort(function(a,b){return c[b]-c[a];})[0];
  return best&&c[best]>1?"The "+best+" Team":(list[0]||"Team");
}

var MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthly(files){
  var m={},order=[];
  files.forEach(function(f){
    if(!f.started)return;
    var k=f.started.getFullYear()+"-"+String(f.started.getMonth()).padStart(2,"0");
    if(!(k in m)){m[k]=0;order.push(k);}
    m[k]++;
  });
  order.sort();
  if(!order.length)return [];
  // fill gaps so an empty month reads as empty, not as absent
  var a=order[0].split("-"),b=order[order.length-1].split("-");
  var y=+a[0],mo=+a[1],ey=+b[0],em=+b[1],out=[];
  while(y<ey||(y===ey&&mo<=em)){
    var k=y+"-"+String(mo).padStart(2,"0");
    out.push({label:MONTHS[mo],year:y,n:m[k]||0});
    mo++; if(mo>11){mo=0;y++;}
    if(out.length>36)break;
  }
  return out;
}

function sortRows(rows,cfg){
  var k=cfg.k,dir=cfg.dir;
  return rows.slice().sort(function(a,b){
    var x=a[k],y=b[k];
    if(x==null)x=dir<0?-Infinity:Infinity;
    if(y==null)y=dir<0?-Infinity:Infinity;
    if(typeof x==="string"||typeof y==="string"){
      x=String(x).toLowerCase();y=String(y).toLowerCase();
      return x<y?-dir:x>y?dir:0;
    }
    return (x-y)*dir;
  });
}

/* A sourced "our average": the same two rates the report shows a team, worked
   out over a whole pipeline export instead of one team's buyers. */
function benchmarkFrom(files,today){
  var prev=CLOCK.today; CLOCK.today=today;
  var s=summarize(files,"mature");
  CLOCK.today=prev;
  var ds=files.map(function(f){return f.started;}).filter(Boolean).sort(function(a,b){return a-b;});
  return {pq:s.pqRate,close:s.closeRate,population:s.n,
    period:ds.length?"files started "+fmtDate(ds[0])+" – "+fmtDate(ds[ds.length-1]):""};
}
