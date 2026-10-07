/* Made-up buyers and agents, in the exact column layouts of the two real
   Encompass exports this tool was built against. No real person appears here. */

/* 49 columns: has the PreQualified Client flag, no comment columns. */
var HEADERS_A=["Date File Started","Last Finished Milestone","Borrower Name","Loan Purpose","Loan Type",
 "PreQualified Client","PreQualified Client DateTime","Total Loan Amount","Lead Gen Source",
 "Referral Source Name","Buyers Agent Contact Name","Sellers Agent Contact Name","Processor Notes Field",
 "Lock & Request Status","Est Closing Date","Appraisal Ordered Date","Subject Property Address",
 "Subject Property State","Funding Funds Released","# Days to Lock Expiration","Alert - eFolder Update",
 "Alert - Milestone Expected","Alert - Milestone Finished","Application Date","Application Date",
 "Appraisal Approved Date","Appraisal Contingency Date","Appraisal Date Ordered","Appraisal Date Scheduled",
 "Appraisal Due Date","Appraisal Recieved Date","Appraisal Scheduled Date","Approval Milestone Duration to CTC",
 "Current Milestone","Current Milestone Duration","Current Milestone Duration","Estimated Closing Date at CTC",
 "Last Finished Milestone","Last Finished Milestone Date","Last Rate Set Date","Milestone Date - Credit Inquiry",
 "Milestone Date - CTC","Milestone Date - Funding","Milestone Date - Pre-Qualification",
 "Milestone Date - Processing","Milestone Date - Ready for Pack Out","Milestone Date/Time - Approval",
 "Milestone Date/Time - CTC","Milestone Date/Time - Funding"];

/* 44 columns: no flag (pre-approval comes from the timestamp), comment columns added. */
var HEADERS_B=["Date File Started","Last Finished Milestone","Borrower Name","Loan Purpose","Loan Type",
 "PreQualified Client DateTime","Total Loan Amount","Referral Source Name","Buyers Agent Contact Name",
 "Processor Notes Field","Lock & Request Status","Est Closing Date","Funding Funds Released",
 "# Days to Lock Expiration","Alert - eFolder Update","Alert - Milestone Expected","Alert - Milestone Finished",
 "Application Date","Appraisal Date Ordered","Appraisal Recieved Date","Approval Milestone Duration to CTC",
 "Current Milestone","Current Milestone Duration","Current Milestone Duration","Estimated Closing Date at CTC",
 "Last Finished Milestone","Last Finished Milestone Date","Last Rate Set Date","Milestone Date - Credit Inquiry",
 "Milestone Date - CTC","Milestone Date - Funding","Milestone Date - Pre-Qualification",
 "Milestone Date - Processing","Milestone Date - Ready for Pack Out","Milestone Date/Time - Approval",
 "Milestone Date/Time - CTC","Milestone Date/Time - Funding","Comments","Milestone Comments - Docs Signing",
 "Milestone Comments - Processing","Milestone Comments - Ready for Pack Out","Milestone Comments - Scheduled",
 "Milestone Comments - Started","Milestone Comments - Submittal"];

var DATE_COLS={"Date File Started":1,"Est Closing Date":1,"Appraisal Date Ordered":1,"Appraisal Ordered Date":1,
 "Appraisal Recieved Date":1,"Last Finished Milestone Date":1,"Milestone Date - CTC":1,"Milestone Date - Funding":1,
 "Milestone Date - Pre-Qualification":1,"Milestone Date - Processing":1,"Milestone Date - Ready for Pack Out":1,
 "Milestone Date/Time - Approval":1,"Milestone Date/Time - CTC":1,"Milestone Date/Time - Funding":1};

/* Excel's day number for a calendar date, the way Encompass writes dates. */
function serial(iso){
  var p=iso.split("-");
  return Math.round(Date.UTC(+p[0],+p[1]-1,+p[2])/86400000)+25569;
}

/* One export row from a short description. Dates are YYYY-MM-DD. */
function fx(o){
  var r={"Borrower Name":o.name,"Buyers Agent Contact Name":o.agent==null?"Tom Marlow":o.agent,
    "Current Milestone":o.ms==null?"Started":o.ms,"Last Finished Milestone":o.ms==null?"Started":o.ms,
    "Date File Started":o.started||"2026-06-01","Total Loan Amount":o.amount==null?300000:o.amount,
    "Loan Purpose":"Purchase","Loan Type":o.type||"Conventional"};
  if(o.pq){ r["PreQualified Client"]="X"; r["PreQualified Client DateTime"]=o.pqAt||"6/10/2026 3:15:07 PM"; }
  if(o.pqAt) r["PreQualified Client DateTime"]=o.pqAt;
  if(o.ln) r["Loan Number"]=o.ln;
  if(o.lastMs) r["Last Finished Milestone Date"]=o.lastMs;
  if(o.proc) r["Milestone Date - Processing"]=o.proc;
  if(o.rfpo) r["Milestone Date - Ready for Pack Out"]=o.rfpo;
  if(o.approval) r["Milestone Date/Time - Approval"]=o.approval;
  if(o.ctc) r["Milestone Date/Time - CTC"]=o.ctc;
  if(o.funded) r["Milestone Date/Time - Funding"]=o.funded;
  if(o.estClose) r["Est Closing Date"]=o.estClose;
  if(o.lock!=null) r["# Days to Lock Expiration"]=o.lock;
  if(o.apprOrdered) r["Appraisal Date Ordered"]=o.apprOrdered;
  if(o.apprReceived) r["Appraisal Recieved Date"]=o.apprReceived;
  if(o.procNote) r["Processor Notes Field"]=o.procNote;
  if(o.comments) Object.keys(o.comments).forEach(function(k){ r[k]=o.comments[k]; });
  return r;
}

/* A real .xlsx in memory, built and read back through SheetJS so tests go
   down the same path a dropped file does. Blank cells are a single space and
   dates are day-number cells, both as in the real exports. */
function workbook(headers,rows,opts){
  opts=opts||{};
  var seen={};
  var aoa=[headers.slice()];
  rows.forEach(function(r){
    var used={};
    aoa.push(headers.map(function(h){
      if(used[h]) return " ";              // second copy of a duplicated header stays blank
      used[h]=1;
      var v=r[h];
      if(v==null||v==="") return " ";
      if(DATE_COLS[h]&&/^\d{4}-\d{2}-\d{2}$/.test(v)) return {t:"n",v:serial(v),z:"m/d/yyyy"};
      return v;
    }));
  });
  var wb=XLSX.utils.book_new();
  if(!opts.noTable) XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(opts.tableAoa||aoa),"Table");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),opts.sheetName||"Data");
  var bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"});
  return {bytes:new Uint8Array(bytes),wb:XLSX.read(new Uint8Array(bytes),{type:"array",cellDates:true})};
}
function withLoanNumber(headers){ return ["Loan Number"].concat(headers); }

/* Parses an export the way the app does and returns what reconcile needs. */
function sourcesOf(headers,rows){
  var w=workbook(headers,rows),parsed=parseWorkbook(w.wb);
  return {sources:parsed.rows.map(sourceFromRow),headers:parsed.headers,pqRule:parsed.pqRule,bytes:w.bytes};
}
function metaFor(x,asOf,name){
  return {fileName:name||("export-"+asOf+".xlsx"),fileHash:hashBytes(x.bytes),size:x.bytes.length,
    asOf:asOf,importedAt:asOf+"T15:00:00.000Z",headers:x.headers,pqRule:x.pqRule};
}
/* Adds an export to a team in one step; returns the new team. */
function importInto(ws,headers,rows,asOf,opts){
  var x=sourcesOf(headers,rows),m=metaFor(x,asOf,opts&&opts.fileName);
  var p=Recon.plan(ws,x.sources,m);
  return Recon.apply(ws,p,{links:opts&&opts.links,now:m.importedAt});
}
function viewOf(ws){ var v=buildView(ws); CLOCK.today=v.today; return v; }
function loanNamed(ws,name){ return ws.loans.filter(function(L){return L.src.name===name;})[0]; }
function fileNamed(view,name){ return view.files.filter(function(f){return f.name===name;})[0]; }

/* A small team, week one. */
var WEEK1=[
  {name:"Avery Stone",  agent:"Tom Marlow",   ms:"Funding",  started:"2026-02-02",pq:true,pqAt:"2/10/2026 9:00:00 AM",proc:"2026-03-01",approval:"2026-03-15",ctc:"2026-03-25",funded:"2026-04-01",amount:410000},
  {name:"Jordan Pike",  agent:"Thomas Marlow",ms:"Approval", started:"2026-06-01",pq:true,pqAt:"6/10/2026 3:15:07 PM",proc:"2026-07-20",approval:"2026-08-10",amount:325000,estClose:"2026-09-18",lock:12},
  {name:"Riley Chen",   agent:"Dana Marlow",  ms:"Started",  started:"2026-07-15",pq:true,pqAt:"7/20/2026 1:00:00 PM",amount:280000},
  {name:"Casey Nguyen", agent:"Dana Marlow",  ms:"Started",  started:"2026-08-20",amount:0},
  {name:"Morgan Bell",  agent:"Chris Vale",   ms:"Ready for Pack Out",started:"2026-05-05",pq:true,pqAt:"5/12/2026 10:00:00 AM",rfpo:"2026-08-01",amount:350000},
  {name:"Avery Stone",  agent:"Tom Marlow",   ms:"Started",  started:"2026-08-11",amount:0}
];
/* The same team a week later: one moved, one new, two gone. */
var WEEK2=[
  {name:"Avery Stone",  agent:"Tom Marlow",   ms:"Funding",  started:"2026-02-02",pq:true,pqAt:"2/10/2026 9:00:00 AM",proc:"2026-03-01",approval:"2026-03-15",ctc:"2026-03-25",funded:"2026-04-01",amount:410000},
  {name:"Jordan Pike",  agent:"Thomas Marlow",ms:"CTC",      started:"2026-06-01",pq:true,pqAt:"6/10/2026 3:15:07 PM",proc:"2026-07-20",approval:"2026-08-10",ctc:"2026-09-02",amount:325000,estClose:"2026-09-18",lock:5},
  {name:"Riley Chen",   agent:"Dana Marlow",  ms:"Processing",started:"2026-07-15",pq:true,pqAt:"7/20/2026 1:00:00 PM",proc:"2026-09-01",amount:280000},
  {name:"Avery Stone",  agent:"Tom Marlow",   ms:"Started",  started:"2026-08-11",pqAt:"9/1/2026 2:00:00 PM",amount:0},
  {name:"Sky Okafor",   agent:"Chris Vale",   ms:"Started",  started:"2026-09-01",amount:0}
];
