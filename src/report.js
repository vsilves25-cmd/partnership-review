/* ============ report ============ */
/* Draws the Partnership Review as one HTML string. Lifted from Pipeline Report
   V16's render(); what is new is marked. It takes everything it needs in R:

     ws, files (what to show), allFiles, today, basis, showAll, sort, controls,
     edit (false in presenter view and in print), agentFilter, baseline,
     haveCols, pqRule, storage, names

   Nothing here touches the page or the saved team. */

/* Four groups, in the order the loan officer walks the meeting. */
var GROUPS=[
  {k:"contract",cls:"g1",t:"Under contract",      d:"in process with us right now",
   test:function(f){return isActive(f)&&f.stageIdx>=STAGES.indexOf("Processing");}},
  {k:"shopping",cls:"g2",t:"Pre-approved and shopping", d:"letter is out, they are touring homes",
   test:function(f){return isActive(f)&&f.pq&&f.stageIdx<STAGES.indexOf("Processing");}},
  {k:"app",     cls:"g3",t:"In application with us",    d:"gathering documents, not certified yet",
   test:function(f){return isActive(f)&&!f.pq&&(f.daysSinceReferral==null||f.daysSinceReferral>14);}},
  {k:"new",     cls:"g4",t:"Just referred",             d:"first contact underway",
   test:function(f){return isActive(f)&&!f.pq&&f.daysSinceReferral!=null&&f.daysSinceReferral<=14;}},
  {k:"terminal",cls:"g6",t:"No longer active",          d:"did not go to closing",
   test:function(f){return f.kind==="terminal";}},
  {k:"unknown", cls:"g7",t:"Status to confirm",         d:"we are checking where these stand",
   test:function(f){return f.kind==="unknown";}},
  {k:"done",    cls:"g5",t:"Closed",                    d:"funded and done",
   test:isFunded, optional:true}
];

var CLOCK_NOTE={stage:"days in this stage",
  lastMilestone:"days since the last recorded milestone",
  fileStart:"days since the file was created"};
var FIELD_NAME={name:"the name",agent:"the agent",milestone:"the stage",pqDate:"the pre-approval date"};

/* A comparison only appears once it has a source and a period behind it. */
function benchOn(b){ return b.pq!=null && b.close!=null && !!b.source && !!b.period; }

function basisText(b){
  if(b==="all") return "every pre-approved buyer, including brand new ones";
  if(b==="contract") return "buyers who reached processing or later";
  return "buyers pre-approved at least "+MATURITY_DAYS+" days ago, plus anyone already closed";
}
function plural(n,one,many){ return n+" "+(n===1?one:(many||one+"s")); }

/* key says whose photo it is: "photo" for the team lead, "myphoto" for the
   loan officer. */
function avatarSlot(src,hint,pos,edit,key){
  pos=pos||{x:50,y:50,z:100};
  key=key||"photo";
  if(!src&&!edit) return "";
  var size = pos.z<=100 ? "cover" : pos.z+"%";   // cover, never a letterboxed gap
  var style = src
    ? ' style="background-image:url('+esc(src)+');background-size:'+size+';'+
      'background-position:'+pos.x+'% '+pos.y+'%"'
    : '';
  return '<div class="avatar'+(src?" set":"")+(edit?"":" fixed")+'"'+(edit?' data-drop="'+key+'"':'')+style+'>'+
    (src?'':esc(hint))+'</div>'+
    (src&&edit?'<div class="adjust">drag to reframe · scroll to zoom</div>':'');
}
function logoSlot(logo,edit){
  if(!logo&&!edit) return "";
  return '<div class="chip'+(logo?" set":"")+'"'+(edit?' data-drop="logo"':'')+'>'+
    (logo?'<img src="'+esc(logo)+'" alt="">':'Add team logo')+'</div>';
}
/* Editable in the working view, plain text when presenting or printing. */
function ed(attr,val,text,edit){
  return edit?'<span contenteditable '+attr+'="'+esc(val)+'">'+esc(text)+'</span>':esc(text);
}
/* One of the loan officer's own details. Empty ones show a prompt while
   working and nothing at all when presenting or printing. */
function mine(key,text,prompt,edit){
  return edit?'<span contenteditable data-profile="'+key+'" data-ph="'+esc(prompt)+'">'+esc(text)+'</span>':esc(text);
}

function th(key,text,cfg,tbl,cls){
  var on=cfg.k===key;
  return '<th class="sortable '+(cls||"")+(on?" on":"")+'" data-sort="'+tbl+'" data-key="'+key+'">'+
    esc(text)+'<span class="arrow">'+(on?(cfg.dir<0?"▼":"▲"):"▼")+'</span></th>';
}

function buyerRow(f,done,R){
  var edit=R.edit;
  var slow=!done&&f.daysInStage!=null&&f.daysInStage>STALE_DAYS&&isActive(f)&&!f.missing;
  var fellOut=f.missing&&!!FALLOUT[f.missingReason];     // stage comes from the reason, not a correction
  var opts=STAGES.slice();
  if(f.kind!=="stage"&&opts.indexOf(f.milestone)<0)opts.unshift(f.milestone);
  TERMINAL.forEach(function(t){if(opts.indexOf(t)<0)opts.push(t);});

  var fourth = done
    ? '<td class="r">'+fmtDate(f.closedOn)+'</td>'
    : '<td class="r'+(slow?" slow":"")+'" title="'+esc(CLOCK_NOTE[f.clockBasis]||"")+'">'+
      (f.daysInStage!=null?f.daysInStage:"—")+
      (R.controls&&edit&&f.fundingSource==="manual"?'<span class="tagm">entered by hand</span>':'')+
      (f.clockBasis&&f.clockBasis!=="stage"?'<span class="approx" title="No milestone date for this stage, so this is '+
        esc(CLOCK_NOTE[f.clockBasis])+'">~</span>':'')+'</td>';

  var stage = edit&&!fellOut
    ? '<select data-f="milestone">'+opts.map(function(x){
        return '<option value="'+esc(x)+'"'+(x===f.milestone?" selected":"")+'>'+esc(label(x))+'</option>';
      }).join("")+'</select>'
    : esc(label(f.milestone));

  var h='<tr class="buyer '+(f.edited&&edit?"edited ":"")+(done?"done":"")+'" data-id="'+esc(f.loanId)+'">'+
    '<td class="name">'+ed("data-f","name",f.name,edit)+
      (edit&&f.missing&&!fellOut?'<span class="tagm noprint" title="This buyer was in an earlier export but not the latest one">not in latest export</span>':'')+'</td>'+
    '<td>'+ed("data-f","agent",f.agent,edit)+'</td>'+
    '<td>'+stage+'</td>'+
    fourth+
    '<td class="r">'+(edit?'<input type="date" data-f="pqDate" value="'+isoDate(f.pqDate)+'">':(f.pqDate?fmtDate(f.pqDate):(f.pq?"Yes":"—")))+'</td>'+
    '<td class="rowtool">'+(edit?
      (f.edited?'<button class="hidebtn" data-reset="'+esc(f.loanId)+'" title="Put this row back to what Encompass says">↺</button>':'')+
      '<button class="hidebtn" data-hide="'+esc(f.loanId)+'" title="Leave this buyer off the report">⋯</button>':'')+'</td></tr>';

  /* new: the Encompass comment is a suggestion until the loan officer puts it on the report,
     and each buyer has a private line that never leaves this screen */
  var extras="";
  if(edit){
    f.conflicts.forEach(function(c){
      var now=c.field==="milestone"?label(c.now):c.field==="pqDate"?(c.now?fmtDate(parseDate(c.now)):"none"):c.now;
      extras+='<div class="conf noprint">Encompass now has <b>'+esc(now||"nothing")+'</b> for '+FIELD_NAME[c.field]+
        ', and you corrected it by hand. <button class="mini" data-accept="'+c.field+'">Use Encompass</button>'+
        '<button class="mini ghost" data-keep="'+c.field+'">Keep mine</button></div>';
    });
    if(f.encNote&&f.encNote!==f.note)
      extras+='<div class="sug noprint"><span class="lab">From Encompass, not on the report:</span> '+esc(f.encNote)+
        ' <button class="mini ghost" data-use-enc="1">Put on report</button></div>';
    extras+='<div class="pnote noprint" contenteditable data-f="privateNote" data-ph="Private note, never printed">'+
      esc(f.privateNote||"")+'</div>';
  }
  if(edit||f.note)
    h+='<tr class="noteline'+(f.edited&&edit?" edited":"")+'" data-id="'+esc(f.loanId)+'">'+
      '<td colspan="6"><div class="note"'+(edit?' contenteditable data-f="note"':'')+'>'+
      esc(f.note||"")+'</div>'+extras+'</td></tr>';
  return h;
}

function activeBuyers(R){
  var files=R.files;
  var h='<div class="sec"><h2>Active buyers</h2>';
  var groupsShown=0;
  GROUPS.forEach(function(g){
    if(g.optional&&!R.showAll)return;
    var isDone=(g.k==="done");
    var sortCfg=R.sort.file;
    if(isDone&&sortCfg.k==="daysInStage")sortCfg={k:"closedOn",dir:sortCfg.dir};
    var list=sortRows(files.filter(function(f){return g.test(f)&&shown(f);}),sortCfg);
    if(!list.length)return;              // an empty group is not worth a heading
    groupsShown++;
    h+='<div class="grp '+g.cls+'"><div class="grphead">'+
       '<span class="t">'+esc(g.t)+'</span><span class="c">'+list.length+
       (list.length===1?" buyer":" buyers")+'</span><span class="d">'+esc(g.d)+'</span></div>'+
       '<table><thead><tr>'+
       th("name","Buyer",R.sort.file,"file")+
       th("agent","Agent",R.sort.file,"file")+
       th("milestone","Stage",R.sort.file,"file")+
       (isDone?th("closedOn","Closed",sortCfg,"file","r")
              :th("daysInStage","Days in stage",sortCfg,"file","r"))+
       th("pqDate","Pre-approved",R.sort.file,"file","r")+
       '<th class="rowtool"></th></tr></thead><tbody>';
    list.forEach(function(f){h+=buyerRow(f,isDone,R);});
    h+='</tbody></table></div>';
  });
  if(!groupsShown)h+='<p class="hint">No active buyers in this export.</p>';
  return h+'</div>';
}

/* new: what moved since the last meeting, or the last export */
function sinceSection(R){
  var b=R.baseline; if(!b)return "";
  var d=diffSince(b.state,R.files); if(!d.any)return "";
  function who(list){ return list.map(function(f){return esc(f.name)+' <span class="who">'+esc(f.agent)+'</span>';}).join(", "); }
  var tiles=[
    [d.added.length,"new "+(d.added.length===1?"buyer":"buyers")+" referred"],
    [d.preApproved.length,"reached pre-approval"],
    [d.contract.length,"went under contract"],
    [d.closed.length,"closed"+(d.closedVolume?", "+money(d.closedVolume):"")]
  ].filter(function(t){return t[0];});
  var h='<div class="sec since"><h2>'+esc(b.label)+'</h2>'+
    '<p class="hint">What has changed since '+esc(fmtLong(b.date))+'.</p>';
  if(tiles.length){
    h+='<div class="aggrid">';
    tiles.forEach(function(t){h+='<div class="agg"><span class="v">'+t[0]+'</span><div class="k">'+esc(t[1])+'</div></div>';});
    h+='</div>';
  }
  h+='<ul class="sincelist">';
  if(d.closed.length)      h+='<li><b>Closed:</b> '+who(d.closed)+'</li>';
  if(d.contract.length)    h+='<li><b>Under contract:</b> '+who(d.contract)+'</li>';
  if(d.preApproved.length) h+='<li><b>Pre-approved:</b> '+who(d.preApproved)+'</li>';
  if(d.added.length)       h+='<li><b>New:</b> '+who(d.added)+'</li>';
  if(d.moved.length)       h+='<li><b>Moved on:</b> '+d.moved.map(function(m){
      return esc(m.f.name)+' <span class="who">'+esc(label(m.from))+' → '+esc(label(m.to))+'</span>';}).join(", ")+'</li>';
  if(d.dropped.length)     h+='<li><b>No longer active:</b> '+who(d.dropped)+'</li>';
  return h+'</ul></div>';
}

/* new: uses Est Closing Date, which V16 ignored */
function closingSection(R){
  var list=closingSoon(R.files); if(!list.length)return "";
  var h='<div class="sec"><h2>Closing in the next '+CLOSING_SOON_DAYS+' days</h2>'+
    '<p class="hint">Estimated closing dates from Encompass. They move; treat them as targets.</p>'+
    '<table><thead><tr><th>Buyer</th><th>Agent</th><th>Stage</th><th class="r">Estimated closing</th></tr></thead><tbody>';
  list.forEach(function(f){
    h+='<tr><td class="name">'+esc(f.name)+'</td><td>'+esc(f.agent)+'</td><td>'+esc(label(f.milestone))+'</td>'+
       '<td class="r">'+fmtDate(f.estClose)+' <span class="who">'+(f.daysToClose===0?"today":"in "+plural(f.daysToClose,"day"))+'</span></td></tr>';
  });
  return h+'</tbody></table></div>';
}

function metricCard(val,bm,key,caption,note,R){
  var v=val==null?0:val,on=benchOn(R.ws.settings.bench)&&bm!=null;
  var h='<div class="metriccard"><div class="top">'+
    '<span class="lab">'+esc(caption)+'</span>'+
    (R.edit?'<span class="live noprint" title="Recalculates as you edit the buyer list">'+
      '<span class="dot"></span>Live</span>':'')+'</div>'+
    '<div class="val">'+(val==null?"—":val+"%")+'</div>'+
    '<div class="track"><div class="fill" style="width:'+Math.min(100,v)+'%"></div>'+
    (on?'<div class="mark" style="left:'+Math.min(100,bm)+'%"></div>':'')+'</div>';
  if(on){
    h+='<div class="tracklabels"><span class="bm" style="left:'+Math.min(88,Math.max(18,bm))+'%">'+
       'Our average <b>'+bm+'</b>%</span></div>';
  }
  return h+'<div class="note">'+esc(note)+'</div></div>';
}

/* new: for the loan officer only. Never printed, never in presenter view. */
function internalPanel(R){
  if(!R.edit)return "";
  var watch=watchList(R.allFiles,R.haveCols);
  var missing=R.allFiles.filter(function(f){return f.missing;});
  var removed=R.ws.loans.filter(function(L){return L.presence==="removed";});
  if(!watch.length&&!missing.length&&!removed.length)return "";
  var h='<div class="sec internal noprint"><div class="inthead"><h2>For you only</h2>'+
    '<span class="tagm">never printed, never in presenter view</span></div>';
  if(watch.length){
    h+='<h3>Watch list</h3><ul class="watchint">';
    watch.forEach(function(w){h+='<li class="w-'+w.k+'"><b>'+esc(w.f.name)+'</b> <span class="who">'+esc(w.f.agent)+
      '</span><br>'+esc(w.t)+'</li>';});
    h+='</ul>';
  }
  if(missing.length){
    h+='<h3>Not in the latest export</h3><p class="hint">These buyers were in an earlier export and are missing '+
       'from the newest one. They stay on the report and in the totals until you say what happened.</p>'+
       '<table><thead><tr><th>Buyer</th><th>Agent</th><th>Last known stage</th><th>What happened</th></tr></thead><tbody>';
    missing.forEach(function(f){
      var L=Workspace.loanById(R.ws,f.loanId);
      var last=classify(L.overlay.milestone?L.overlay.milestone.v:L.src.milestone).raw;
      var funded=isFunded(f);
      h+='<tr data-id="'+esc(f.loanId)+'"><td class="name">'+esc(f.name)+'</td><td>'+esc(f.agent)+'</td>'+
         '<td>'+esc(label(last))+'</td><td>'+
         (funded?'<span class="who">Closed. Stays in your closed totals.</span> <button class="mini ghost" data-remove="1">Not this team’s buyer</button>'
           :'<select data-missing="1">'+MISSING_REASONS.map(function(m){
               return '<option value="'+m.k+'"'+(m.k===f.missingReason?" selected":"")+'>'+esc(m.t)+'</option>';}).join("")+'</select>')+
         '</td></tr>';
    });
    h+='</tbody></table>';
  }
  if(removed.length){
    h+='<h3>Taken off this team</h3><p class="hint">Left out of everything. Put one back if it was a mistake.</p><ul class="watchint">';
    removed.forEach(function(L){h+='<li data-id="'+esc(L.id)+'"><b>'+esc(L.overlay.name?L.overlay.name.v:L.src.name)+
      '</b> <button class="mini ghost" data-restore="1">Put back</button></li>';});
    h+='</ul>';
  }
  return h+'</div>';
}

/* Everything that speaks to the loan officer rather than the team lives here, collapsed,
   at the very foot of the page. */
function drawer(R){
  if(!R.edit)return "";
  var ws=R.ws,files=R.allFiles,bench=ws.settings.bench;
  var h='<div class="drawer noprint"><button class="handle" id="drawerToggle">'+
        (R.controls?"Hide controls":"· · · controls")+'</button>';
  if(!R.controls) return h+'</div>';

  function opt(v,text,cur){return '<option value="'+esc(v)+'"'+(v===cur?" selected":"")+'>'+esc(text)+'</option>';}
  h+='<div class="panel"><h3>Report controls</h3><div class="rowc">'+
     '<label><input type="checkbox" id="showall"'+(R.showAll?" checked":"")+'> Show closed buyers</label>'+
     '<span>Closed rate basis <select id="basis">'+
       opt("mature",basisText("mature"),R.basis)+
       opt("contract",basisText("contract"),R.basis)+
       opt("all",basisText("all"),R.basis)+
     '</select></span>'+
     '<button id="clearall">Clear all my corrections</button>'+
     '</div>';

  var hidden=files.filter(function(f){return f.hidden;}).length;
  if(hidden) h+='<div class="rowc" style="margin-top:12px">'+
    '<span>'+hidden+' buyer'+(hidden>1?"s are":" is")+' left off the report.</span>'+
    '<button data-unhide="1">Put '+(hidden>1?"them":"it")+' back</button></div>';

  var agents={};
  files.forEach(function(f){agents[f.agent]=1;});
  h+='<div class="rowc" style="margin-top:12px"><span>Show the report for <select id="agentfilter">'+
     opt("","the whole team",R.agentFilter)+
     Object.keys(agents).sort().map(function(a){return opt(a,a+" only",R.agentFilter);}).join("")+
     '</select></span><span style="color:var(--ink-3)">A single-agent report lists only that agent’s buyers.</span></div>';

  h+='<div class="rowc" style="margin-top:12px"><span>Encompass data as of <input type="date" id="asof" value="'+esc(R.asOf)+'"></span>'+
     (ws.settings.asOfOverride?'<button id="asofreset">Use the export’s own date</button>':
       '<span style="color:var(--ink-3)">Taken from the export file. Day counts are measured to this date.</span>')+'</div>';

  /* benchmark: off until it has a source */
  h+='<h3 style="margin-top:20px">Our averages</h3><div class="rowc">'+
     '<span>Pre-approval <b contenteditable data-bench="pq">'+(bench.pq==null?"":bench.pq)+'</b>%</span>'+
     '<span>Close <b contenteditable data-bench="close">'+(bench.close==null?"":bench.close)+'</b>%</span>'+
     '<span>Source <b contenteditable data-bench="source">'+esc(bench.source)+'</b></span>'+
     '<span>Period <b contenteditable data-bench="period">'+esc(bench.period)+'</b></span>'+
     '</div><div class="rowc" style="margin-top:10px">'+
     '<button id="benchfile">Work them out from a full pipeline export</button>'+
     (bench.pq!=null||bench.close!=null||bench.source?'<button id="benchclear">Turn the comparison off</button>':'')+
     '<span style="color:var(--ink-3)">'+(benchOn(bench)
       ? "Showing on the report: "+esc(bench.source+", "+bench.period)+(bench.population?", "+bench.population+" buyers":"")
       : "Nothing prints until both numbers, a source and a period are filled in.")+'</span></div>';

  /* export checklist */
  var cur=Workspace.currentImport(ws);
  if(cur){
    var miss=missingRecommended(cur.headers||[]);
    var everTerminal=ws.loans.some(function(L){return classify(L.src.milestone).kind==="terminal";});
    h+='<h3 style="margin-top:20px">Encompass export checklist</h3><div class="notes" style="border:0;margin:0;padding:0">';
    if(!miss.length) h+='The latest export has every column this report can use.';
    else h+='Columns the latest export does not have:<br>'+miss.map(function(m){
      return '• <b>'+esc(m.label)+'</b>: '+esc(m.why)+'.';}).join("<br>");
    if(!everTerminal) h+='<br>No withdrawn or denied file has ever appeared in an export for this team. '+
      'If the Encompass view filters them out, fall-out only shows up as buyers going missing.';
    if(cur.keyMode!=="loanNumber") h+='<br>Buyers are being matched between exports by name and file start date.';
    h+='</div>';
  }

  /* history */
  if(ws.imports.length||ws.meetings.length){
    h+='<h3 style="margin-top:20px">History</h3><div class="notes" style="border:0;margin:0;padding:0">';
    ws.meetings.slice().reverse().slice(0,6).forEach(function(m){
      h+='Presented '+esc(fmtLong(localDay(m.heldAt)))+': '+m.stats.n+' buyers, '+m.stats.pq+
         ' pre-approved, '+m.stats.funded+' closed.<br>';
    });
    ws.imports.slice().reverse().slice(0,8).forEach(function(i){
      h+='Export of '+esc(fmtLong(parseDate(i.asOf)))+(i.historical?" (kept as history)":"")+': '+i.rowCount+' rows, '+
         i.counts.added+' new, '+i.counts.changed+' changed, '+i.counts.missing+' not in it. <span style="color:var(--ink-3)">'+esc(i.fileName)+'</span><br>';
    });
    h+='</div>';
  }

  /* the loan officer's own details: the same on every team's report */
  var mine0=R.profile||Profile.create(),lack=Profile.missing(mine0);
  h+='<h3 style="margin-top:20px">Your details</h3><div class="rowc"><span>'+
     (mine0.name?esc(mine0.name)+(mine0.nmls?', NMLS #'+esc(mine0.nmls):''):'Not set up yet')+
     '. Footer: “'+esc(Profile.preparedBy(mine0))+'”.'+
     (lack.length?' <b>Missing: '+esc(lack.join(" and "))+'.</b>':'')+'</span>'+
     '<button id="mydetails">Edit my details</button></div>';

  /* storage */
  var st=R.storage||{};
  h+='<h3 style="margin-top:20px">Where this team is saved</h3><div class="rowc">'+
     '<span>'+(st.mode==="folder"
        ? 'File <b>'+esc(R.fileName||"")+'</b> in the folder <b>'+esc(st.folderName||"")+'</b>, with a second copy in this browser.'
        : 'In this browser only. Choose a folder on the Teams page to keep it as a file as well.')+'</span></div>'+
     '<div class="rowc" style="margin-top:10px"><button id="savecopy">Save a copy</button>'+
     '<button id="deleteteam">Delete this team</button></div>';

  var notes=[];
  notes.push("Click any name, agent, stage, date or note in the tables to correct it. Every change saves itself. "+
             "The dots at the end of a row leave that buyer off the report. "+
             "Click a photo circle or the logo chip to swap the team's images. Encompass is never changed.");
  if(hidden) notes.push("Buyers left off the report are still counted in the totals and the funnel; "+
             "they are only missing from the lists.");
  var nEdited=files.filter(function(f){return f.edited;}).length;
  if(nEdited) notes.push(plural(nEdited,"row")+" corrected by hand.");
  var manualFund=files.filter(function(f){return f.fundingSource==="manual";}).length;
  if(manualFund) notes.push(manualFund+" funding date"+(manualFund>1?"s were":" was")+
    " entered here and "+(manualFund>1?"are":"is")+" left out of the timing medians.");
  if(R.pqRule&&R.pqRule!=="flag") notes.push("This export has no PreQualified Client flag, so pre-approval is "+
    "taken from the "+(R.pqRule==="date"?"pre-approval timestamp":"pre-qualification milestone date")+".");
  var withEnc=files.filter(function(f){return f.encNote;}).length;
  if(withEnc) notes.push("Encompass comments came in for "+plural(withEnc,"buyer")+". They are suggestions under "+
    "each buyer and stay off the report until you put them on it.");
  else notes.push("The export carried no comments. Adding a Milestone Comments column to the Encompass export would suggest a note for each buyer.");
  var merged=Object.keys(R.names).filter(function(k){return R.names[k].variants.length>1;});
  if(merged.length) notes.push("Agent spellings merged: "+merged.map(function(k){
    return R.names[k].variants.join(" / "); }).join("; ")+".");
  var noAgent=files.filter(function(f){return f.agent==="Unassigned";}).length;
  if(noAgent) notes.push(noAgent+" file"+(noAgent>1?"s have":" has")+
    " no buyer agent in Encompass. Type a name into the Agent column to place "+(noAgent>1?"them":"it")+".");
  var unknown=files.filter(function(f){return f.kind==="unknown";}).length;
  if(unknown) notes.push(unknown+" file"+(unknown>1?"s have":" has")+
    " a milestone this report does not recognise, so "+(unknown>1?"they are":"it is")+" left off the funnel.");
  notes.push("Partnership Review "+APP_VERSION+".");

  h+='<div class="notes">'+notes.map(function(n){return esc(n);}).join("<br>")+'</div></div>';
  return h+'</div>';
}

function reportHTML(R){
  var ws=R.ws,files=R.files,today=R.today,edit=R.edit,team=ws.team,bench=ws.settings.bench;
  var sum=summarize(files,R.basis);

  var byAgent={};
  files.forEach(function(f){(byAgent[f.agent]=byAgent[f.agent]||[]).push(f);});
  var agents=Object.keys(byAgent).map(function(a){
    var s=summarize(byAgent[a],R.basis);s.agent=a;return s;});
  agents=sortRows(agents,R.sort.agent);

  var ds=files.map(function(f){return f.started;}).filter(Boolean).sort(function(a,b){return a-b;});
  var range=ds.length?fmtDate(ds[0])+" – "+fmtDate(ds[ds.length-1]):"";

  var med=medians(files);
  var on=benchOn(bench);
  var lift=(on&&sum.pqRate!=null?sum.pqRate-bench.pq:0);
  var extra=Math.round(files.length*lift/100);
  var whose=R.agentFilter?"you":"your team";

  var me=R.profile||Profile.create();
  var h="";
  h+='<div class="hero">'+
     '<div class="bg" style="background-image:url('+(me.background?esc(me.background):HERO_BG)+')"></div>'+
     '<div class="veil"></div><div class="pattern"></div><div class="glow"></div><div class="inner">'+
       '<div class="herotop">'+
         '<img class="wordmark" src="'+NFM_LOGO+'" alt="NFM Lending">'+
         '<div class="eyebrow">Partnership Review</div>'+
       '</div>'+
       '<div class="pair">'+
         /* the loan officer's side; left off a presented or printed report
            only when there is neither a name nor a photo to put there */
         (edit||me.name||me.photo?
         '<div class="person">'+
           avatarSlot(me.photo,"Add your photo",me.pos,edit,"myphoto")+
           '<div class="nm">'+mine("name",me.name,"Your name",edit)+'</div>'+
           '<div class="rl">'+mine("title",me.title,"Your title",edit)+
             (me.nmls||edit?'<br>NMLS #'+mine("nmls",me.nmls,"your number",edit):'')+'</div>'+
         '</div>'+
         '<div class="amp">WITH</div>':'')+
         '<div class="person">'+
           avatarSlot(team.photo,"Add their photo",team.pos,edit)+
           '<div class="nm">'+ed("data-team","leadName",team.leadName,edit)+'</div>'+
           '<div class="rl">'+ed("data-team","leadRole",team.leadRole,edit)+'</div>'+
           logoSlot(team.logo,edit)+
         '</div>'+
       '</div>'+
       '<div class="heroname">'+
         '<span class="eyebrow">'+(R.agentFilter?"Buyers referred by":"Buyer pipeline")+'</span>'+
         '<h1>'+(R.agentFilter?esc(R.agentFilter):ed("data-team","name",team.name,edit))+'</h1>'+
         '<p class="dates">'+esc(range)+'</p>'+
       '</div>'+
     '</div></div>'+
     '<div class="statcards">'+
       '<div class="statcard"><span class="v">'+files.length+'</span>'+
         '<div class="k">buyers you sent us</div></div>'+
       '<div class="statcard"><span class="v">'+sum.funded+'</span>'+
         '<div class="k">closed and funded</div></div>'+
       '<div class="statcard"><span class="v">'+money(sum.volume)+'</span>'+
         '<div class="k">in closed volume</div></div>'+
     '</div>';

  h+=sinceSection(R);
  h+=activeBuyers(R);
  h+=closingSection(R);

  h+='<div class="saycard"><div class="bg" style="background-image:url('+SAY_BG+')"></div>'+
     '<div class="veil"></div><div class="pattern"></div><div class="inner">'+
     '<span class="eyebrow">How your buyers do with us</span>';
  if(on && sum.pqRate!=null && lift>0){
    h+='<p class="statement">'+sum.pqRate+'% of your buyers reach pre-approval, against our '+
       'average of '+bench.pq+'%. On the '+files.length+' you sent, that is '+
       '<em>about '+Math.abs(extra)+' more people</em> who got to a letter.</p>';
  } else if(on && sum.pqRate!=null){
    h+='<p class="statement">'+sum.pqRate+'% of your buyers reach pre-approval, against our '+
       'average of '+bench.pq+'%.</p>';
  } else if(sum.pq){
    h+='<p class="statement"><em>'+sum.pq+' of the '+sum.n+'</em> buyers you sent us reached '+
       'pre-approval, and <em>'+sum.funded+'</em> '+(sum.funded===1?"has":"have")+' closed for '+money(sum.volume)+
       ' in funded volume.</p>';
  } else {
    h+='<p class="statement">None of the buyers you sent have reached pre-approval yet.</p>';
  }
  if(on){
    h+='<p class="sub">'+esc("Our average: "+bench.source+", "+bench.period+
       (bench.population?", "+bench.population+" buyers":"")+
       (bench.validated?". Last checked "+bench.validated:"")+'.')+'</p>';
  }
  h+='</div></div>';

  h+='<div class="metricgrid">'+
      metricCard(sum.pqRate,bench.pq,"pq","Buyers who reach pre-approval",
        sum.pq+" of "+sum.n+" buyers you sent us got all the way to a pre-approval letter.",R)+
      metricCard(sum.closeRate,bench.close,"close","Pre-approved buyers who close",
        sum.funded+" funded, "+money(sum.volume)+" in closed volume.",R)+
     '</div>';

  h+='<div class="sec"><p class="basis" style="margin:0">The closed rate counts '+
     esc(basisText(R.basis))+'. Buyers still early in the process are left out, so recent '+
     'referrals do not drag the number down.</p></div>';

  var pi=STAGES.indexOf("Processing");
  var nRef=files.length,
      nPq=files.filter(function(f){return f.pq;}).length,
      nProc=files.filter(function(f){return f.stageIdx>=pi;}).length,
      nFund=files.filter(isFunded).length;
  var steps=[
    {lb:"Buyers "+whose+" referred", n:nRef, rest:null},
    {lb:"Reached pre-approval",      n:nPq,  rest:"still in application with us"},
    {lb:"Under contract, in process",n:nProc,rest:"pre-approved and out shopping"},
    {lb:"Closed and funded",         n:nFund,rest:"in process right now",end:true}
  ];

  h+='<div class="sec"><h2>Where every referred buyer stands today</h2>'+
     '<p class="hint">Each bar is all '+nRef+' buyers. The dark part reached that point; the rest are still moving.</p><div class="fn">';
  steps.forEach(function(st,i){
    var prev=i?steps[i-1].n:nRef;
    var carried=prev?Math.round(st.n/prev*100):null;
    var gotPct=nRef?st.n/nRef*100:0;
    var restN=Math.max(0,prev-st.n);
    var restPct=nRef?restN/nRef*100:0;
    var m=i===1?med["Started"]:i===2?med["Processing"]:i===3?med["CTC"]:null;
    h+='<div class="fnrow"><div class="fnhead"><span class="lb">'+esc(st.lb)+'</span>'+
       '<span class="rt"><b>'+st.n+'</b>'+(carried!=null&&i?carried+'% of the step before':'')+'</span></div>'+
       '<div class="fnbar">'+
       '<div class="seg got'+(st.end?" end":"")+'" style="width:'+gotPct.toFixed(1)+'%"></div>'+
       (restN?'<div class="seg rest" style="width:'+restPct.toFixed(1)+'%">'+restN+' '+esc(st.rest)+'</div>':'')+
       '</div>'+
       (m!=null?'<div class="fnmed">Typically '+m+' days to get here.</div>':'')+
     '</div>';
  });
  h+='</div>';
  var off=files.filter(function(f){return f.kind!=="stage";}).length;
  if(off)h+='<p class="hint" style="margin:16px 0 0">'+off+' file'+(off===1?" is":"s are")+
    ' counted in your total but not shown on this chart.</p>';
  h+='</div>';

  var mo=monthly(files);
  if(mo.length>1){
    var maxM=Math.max.apply(null,mo.map(function(x){return x.n;}))||1;
    var avg=files.filter(function(f){return f.started;}).length/mo.length;
    var W=900,H=170,padT=26,bw=(W-padT)/mo.length;
    h+='<div class="sec"><h2>Buyers referred each month</h2>'+
       '<p class="hint">Volume over '+mo.length+' months, not a snapshot.</p><div class="trend">'+
       '<svg viewBox="0 0 '+W+' '+(H+30)+'" preserveAspectRatio="none" role="img" '+
       'aria-label="Column chart of buyers referred each month">';
    var ay=H-(avg/maxM)*(H-padT);
    h+='<line x1="0" y1="'+ay.toFixed(1)+'" x2="'+W+'" y2="'+ay.toFixed(1)+'" stroke="#C9C3B6" stroke-dasharray="4 4"/>';
    mo.forEach(function(x,i){
      var bh=(x.n/maxM)*(H-padT);
      var bx=i*bw+bw*0.18, w=bw*0.64;
      h+='<rect x="'+bx.toFixed(1)+'" y="'+(H-bh).toFixed(1)+'" width="'+w.toFixed(1)+
         '" height="'+Math.max(bh,1).toFixed(1)+'" fill="#152033"/>';
      if(x.n) h+='<text x="'+(bx+w/2).toFixed(1)+'" y="'+(H-bh-6).toFixed(1)+
         '" text-anchor="middle" font-size="13" fill="#4A5768" font-family="Inter,sans-serif">'+x.n+'</text>';
      h+='<text x="'+(bx+w/2).toFixed(1)+'" y="'+(H+18)+'" text-anchor="middle" font-size="13" '+
         'fill="#4A5768" font-family="Inter,sans-serif">'+x.label+'</text>';
    });
    h+='<line x1="0" y1="'+H+'" x2="'+W+'" y2="'+H+'" stroke="#152033"/></svg>'+
       '<p class="avg">'+avg.toFixed(1)+' buyers a month on average, shown by the dashed line.</p></div></div>';
  }

  if(!R.agentFilter){
    h+='<div class="sec"><h2>By agent</h2><p class="hint">Percentages are held back below '+MIN_N+
       ' buyers, where a single file swings the number too far to mean anything.'+
       (edit?' <span class="noprint">Rename an agent here and every one of their files follows.</span>':'')+'</p>';
    h+='<table><thead><tr>'+
       th("agent","Agent",R.sort.agent,"agent")+
       th("n","Referred",R.sort.agent,"agent","r")+
       th("pq","Pre-approved",R.sort.agent,"agent","r")+
       th("funded","Closed",R.sort.agent,"agent","r")+
       th("pqRate","Reached PA",R.sort.agent,"agent","r")+
       th("closeRate","PA to close",R.sort.agent,"agent","r")+
       '</tr></thead><tbody>';
    agents.forEach(function(a){
      var thin=a.n<MIN_N;
      h+='<tr><td class="name">'+ed("data-rename",a.agent,a.agent,edit)+'</td>'+
         '<td class="r">'+a.n+'</td><td class="r">'+a.pq+'</td><td class="r">'+a.funded+'</td>'+
         '<td class="r">'+(thin?'<span class="thin">too few</span>':a.pqRate+"%")+'</td>'+
         '<td class="r">'+(thin||a.closeRate==null?'<span class="thin">too few</span>':a.closeRate+"%")+'</td></tr>';
    });
    h+='<tr class="total"><td class="name">Team</td><td class="r">'+sum.n+'</td><td class="r">'+sum.pq+'</td>'+
       '<td class="r">'+sum.funded+'</td><td class="r">'+(sum.pqRate!=null?sum.pqRate+"%":"—")+'</td>'+
       '<td class="r">'+(sum.closeRate!=null?sum.closeRate+"%":"—")+'</td></tr></tbody></table></div>';
  }

  /* a buyer missing from the latest export is left out of these: the day counts
     behind them cannot be trusted until the loan officer says what happened */
  var watch=[];
  var stuck=files.filter(function(f){return shown(f)&&isActive(f)&&!f.missing&&!f.pq&&f.daysSinceReferral>21;});
  if(stuck.length) watch.push('<b>'+stuck.length+' of your buyers</b> '+(stuck.length===1?"has":"have")+' been with us over three weeks '+
    'without getting to a pre-approval letter. A nudge from your side usually moves these.');
  var slowLive=files.filter(function(f){return shown(f)&&isActive(f)&&!f.missing&&f.daysInStage>STALE_DAYS;});
  if(slowLive.length) watch.push('<b>'+slowLive.length+' file'+(slowLive.length>1?"s have":" has")+
    '</b> not moved in over '+STALE_DAYS+' days. Worth walking through '+
    (slowLive.length>1?'them':'it')+' together.');
  if(!R.agentFilter) agents.filter(function(a){return a.n>=MIN_N&&a.agent!=="Unassigned";}).forEach(function(a){
    if(sum.pqRate!=null&&a.pqRate!=null&&a.pqRate<sum.pqRate-15)
      watch.push('<b>'+esc(a.agent)+'</b> is at '+a.pqRate+'% to pre-approval where the team is at '+
        sum.pqRate+'%. Worth talking through what is different about those handoffs.');
  });
  if(watch.length){
    h+='<div class="sec"><h2>Worth talking about</h2><ul id="watch">';
    watch.forEach(function(w){h+='<li>'+w+'</li>';});
    h+='</ul></div>';
  }

  /* new: two dates, so a fresh note never makes old Encompass data look current */
  var noteAt="";
  ws.loans.forEach(function(L){ if(L.noteAt&&L.noteAt>noteAt) noteAt=L.noteAt; });
  h+='<div class="foot"><div>'+esc(Profile.preparedBy(me))+' from Encompass records as of '+
     esc(fmtLong(today))+'.'+(noteAt?' Notes last updated '+esc(fmtLong(localDay(noteAt)))+'.':'')+'</div>'+
     (edit?'<button class="print noprint" id="printbtn">Save as PDF</button>':'')+'</div>';

  h+=internalPanel(R);
  h+=drawer(R);
  return h;
}
