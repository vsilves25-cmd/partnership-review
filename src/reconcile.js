/* ============ reconcile ============ */
/* Matching a new export against what the team file already knows. plan() only
   looks; apply() works on a copy and hands it back, so a failure part-way
   leaves the saved team exactly as it was. */

var DIFF_FIELDS=["milestone","pq","pqDate","amount","agentRaw","name","estClose"];

var Recon={
  normName:function(s){
    return clean(s).toLowerCase().replace(/[.,'’`]/g,"").replace(/[-_]/g," ").replace(/\s+/g," ").trim();
  },

  /* Loan Number when Encompass sends it. Otherwise the borrower's name plus
     the date the file was started, which no later edit changes. */
  keysFor:function(src){
    var ln=clean(src.loanNumber).toUpperCase().replace(/\s+/g,"");
    return {ln:ln?"ln:"+ln:"",ns:"ns:"+Recon.normName(src.name)+"|"+(src.started||"")};
  },

  fieldDiff:function(a,b){
    var out=[];
    DIFF_FIELDS.forEach(function(k){
      var x=a[k]==null?"":a[k], y=b[k]==null?"":b[k];
      if(x!==y) out.push({f:k,from:x,to:y});
    });
    return out;
  },

  agentKeys:function(list){
    var s={};
    list.forEach(function(x){var k=agentKey(x.agentRaw);if(k)s[k]=1;});
    return s;
  },

  /* How many of the export's agents this team already knows. Zero, on a team
     that has loans, usually means the wrong file. */
  agentOverlap:function(ws,sources){
    var have=Recon.agentKeys(ws.loans.map(function(L){return L.src;}));
    var got=Recon.agentKeys(sources),n=0;
    Object.keys(got).forEach(function(k){if(have[k])n++;});
    return {shared:n,inExport:Object.keys(got).length,known:Object.keys(have).length};
  },

  /* meta: {fileName,fileHash,size,asOf,importedAt,headers,pqRule} */
  plan:function(ws,sources,meta){
    var cur=Workspace.currentImport(ws);
    var p={meta:meta,rows:[],missing:[],newlyMissing:[],suggestions:[],warnings:[],
           duplicateOf:null,older:!!(cur&&meta.asOf<cur.asOf),
           keyMode:sources.some(function(s){return clean(s.loanNumber);})?"loanNumber":"nameStarted",
           firstImport:!ws.imports.length,
           counts:{rows:sources.length,matched:0,added:0,changed:0,missing:0,upgraded:0,dupInFile:0}};

    ws.imports.forEach(function(i){
      if(i.fileHash===meta.fileHash&&i.size===meta.size) p.duplicateOf=i;
    });

    var index={};
    ws.loans.forEach(function(L){ L.keys.forEach(function(k){ if(!(k in index)) index[k]=L; }); });

    var seenLn={},seenNs={},claimed={};
    sources.forEach(function(src,i){
      var k=Recon.keysFor(src),dup=false;
      if(k.ln){ seenLn[k.ln]=(seenLn[k.ln]||0)+1; if(seenLn[k.ln]>1){k.ln+="#"+seenLn[k.ln];dup=true;} }
      seenNs[k.ns]=(seenNs[k.ns]||0)+1;
      if(seenNs[k.ns]>1){ k.ns+="#"+seenNs[k.ns]; if(!k.ln)dup=true; }
      if(dup)p.counts.dupInFile++;

      var L=(k.ln&&index[k.ln])||index[k.ns]||null;
      if(L&&claimed[L.id]) L=null;          // one saved loan never takes two rows
      var row={i:i,src:src,keys:[k.ln,k.ns].filter(Boolean),loanId:L?L.id:null,
               status:L?"matched":"new",changes:[],dupInFile:dup,upgraded:false};
      if(L){
        claimed[L.id]=1;
        row.changes=Recon.fieldDiff(L.src,src);
        row.upgraded=!!(k.ln&&L.keys.indexOf(k.ln)<0);
        row.wasRemoved=L.presence==="removed";
        p.counts.matched++;
        if(row.changes.length)p.counts.changed++;
        if(row.upgraded)p.counts.upgraded++;
      } else p.counts.added++;
      p.rows.push(row);
    });

    if(!p.older){
      ws.loans.forEach(function(L){
        if(L.presence==="removed"||claimed[L.id])return;
        p.missing.push(L.id);
        if(L.presence==="present")p.newlyMissing.push(L.id);
      });
      p.counts.missing=p.missing.length;
    }

    /* A new row and an unmatched saved loan that started the same day with a
       similar name are probably one file whose name was corrected. Offer the
       link; never make it silently. */
    var used={};
    p.rows.forEach(function(row){
      if(row.status!=="new"||!row.src.started)return;
      var a=Recon.normName(row.src.name),best=null,bestD=99;
      ws.loans.forEach(function(L){
        if(claimed[L.id]||used[L.id]||L.presence==="removed")return;
        if((L.src.started||"")!==row.src.started)return;
        var b=Recon.normName(L.src.name),d=lev(a,b);
        var pa=a.split(" "),pb=b.split(" ");
        var near=d<=3||pa[0]===pb[0]||pa[pa.length-1]===pb[pb.length-1];
        if(near&&d<bestD){best=L;bestD=d;}
      });
      if(best){used[best.id]=1;p.suggestions.push({i:row.i,loanId:best.id,
        newName:row.src.name,oldName:best.src.name,started:row.src.started});}
    });

    if(p.duplicateOf) p.warnings.push({k:"duplicate",t:"This exact file was already added on "+
      fmtLong(localDay(p.duplicateOf.importedAt))+". Nothing new to bring in."});
    if(p.older) p.warnings.push({k:"older",t:"This export ("+fmtLong(parseDate(meta.asOf))+
      ") is older than the one already loaded ("+fmtLong(parseDate(cur.asOf))+
      "). It will be kept as history and will not change the current report."});
    if(ws.loans.length){
      var ov=Recon.agentOverlap(ws,sources);
      if(ov.inExport&&!ov.shared) p.warnings.push({k:"wrong-team",t:"None of the agents in this export "+
        "appear in this team's earlier exports. Check it is the right file for this team."});
    }
    if(p.counts.dupInFile) p.warnings.push({k:"dup-in-file",t:p.counts.dupInFile+" row"+
      (p.counts.dupInFile>1?"s share":" shares")+" an identifier with another row in this file, "+
      "so they were matched in file order. Adding Loan Number to the export removes the guesswork."});
    p.missingColumns=missingRecommended(meta.headers||[]);
    return p;
  },

  /* When Encompass and the loan officer disagree about a field they corrected. */
  reconcileOverlay:function(ws,L,next,at){
    var ov=L.overlay||{};
    var srcVal={name:next.name,agent:next.agentRaw,milestone:classify(next.milestone).raw,pqDate:next.pqDate||""};
    Object.keys(ov).forEach(function(k){
      if(!(k in srcVal))return;
      var o=ov[k],now=srcVal[k];
      if(now===o.base){ delete o.pending; return; }
      var mine=k==="agent"?agentKey(o.v):o.v;
      var theirs=k==="agent"?agentKey(now):now;
      if(mine===theirs){            // Encompass caught up with the correction
        delete ov[k];
        Workspace.log(ws,{at:at,t:"caught-up",loan:L.id,f:k,to:now});
      } else o.pending=now;
    });
  },

  /* opts: {links:{rowIndex:loanId}, now:ISO datetime} */
  apply:function(ws0,p,opts){
    opts=opts||{};
    if(p.duplicateOf) throw new Error("This exact file was already added. Nothing was changed.");
    var ws=clone(ws0),at=opts.now||new Date().toISOString(),meta=p.meta;
    var cur=Workspace.currentImport(ws);
    var id="I"+pad(ws.nextImport++,4);
    var stamp={importId:id,asOf:meta.asOf};
    var links=opts.links||{},claimed={},counts={matched:0,added:0,changed:0,missing:0,upgraded:0};

    p.rows.forEach(function(row){
      var L=null,linked=false;
      if(row.loanId) L=Workspace.loanById(ws,row.loanId);
      else if(links[row.i]){ L=Workspace.loanById(ws,links[row.i]); linked=!!L; }
      if(L&&claimed[L.id]) L=null;

      if(!L){
        L={id:"L"+pad(ws.nextLoan++,4),keys:row.keys.slice(),src:row.src,overlay:{},
           hidden:false,note:"",privateNote:"",firstSeen:stamp,lastSeen:stamp,
           presence:p.older?"missing":"present"};
        if(p.older) L.missingSince=cur?cur.asOf:meta.asOf;
        ws.loans.push(L); claimed[L.id]=1; counts.added++;
        Workspace.log(ws,{at:at,t:"new",loan:L.id,to:row.src.milestone});
        return;
      }

      claimed[L.id]=1; counts.matched++;
      row.keys.forEach(function(k){ if(L.keys.indexOf(k)<0){ L.keys.push(k); if(k.indexOf("ln:")===0)counts.upgraded++; } });
      if(linked) Workspace.log(ws,{at:at,t:"linked",loan:L.id,from:L.src.name,to:row.src.name});

      if(p.older){
        if(!L.firstSeen||meta.asOf<L.firstSeen.asOf) L.firstSeen=stamp;
        return;
      }
      var changes=Recon.fieldDiff(L.src,row.src);
      if(changes.length){
        counts.changed++;
        changes.forEach(function(c){ Workspace.log(ws,{at:at,t:"import",loan:L.id,f:c.f,from:c.from,to:c.to}); });
      }
      Recon.reconcileOverlay(ws,L,row.src,at);
      L.src=row.src;
      L.lastSeen=stamp;
      if(L.presence==="missing"){
        L.presence="present"; delete L.missingSince; delete L.missingReason;
        Workspace.log(ws,{at:at,t:"returned",loan:L.id});
      }
    });

    if(!p.older){
      ws.loans.forEach(function(L){
        if(claimed[L.id]||L.presence==="removed")return;
        counts.missing++;
        if(L.presence==="present"){
          L.presence="missing"; L.missingSince=meta.asOf;
          Workspace.log(ws,{at:at,t:"missing",loan:L.id,from:L.src.milestone});
        }
      });
    }

    var rec={id:id,fileName:meta.fileName,fileHash:meta.fileHash,size:meta.size,asOf:meta.asOf,
      importedAt:at,historical:p.older,keyMode:p.keyMode,pqRule:meta.pqRule||"",
      headers:(meta.headers||[]).slice(),rowCount:p.rows.length,counts:counts};
    ws.imports.push(rec);

    if(!p.older){
      var prev=CLOCK.today;
      var v=buildView(ws); CLOCK.today=v.today;
      rec.state=freezeState(v.files);
      CLOCK.today=prev;
      var withState=ws.imports.filter(function(i){return i.state;});
      withState.slice(0,Math.max(0,withState.length-STATE_KEEP)).forEach(function(i){delete i.state;});
    }
    return ws;
  },

  /* Records exactly what was on the report when it was presented. */
  markPresented:function(ws,view,basis,at){
    at=at||new Date().toISOString();
    var prev=CLOCK.today; CLOCK.today=view.today;
    var s=summarize(view.files,basis||"mature");
    CLOCK.today=prev;
    var m={id:"M"+pad(ws.nextMeeting++,4),heldAt:at,
      importId:view.current?view.current.id:"",asOf:view.asOf,
      stats:{n:s.n,pq:s.pq,funded:s.funded,volume:s.volume,pqRate:s.pqRate,closeRate:s.closeRate},
      state:freezeState(view.files)};
    ws.meetings.push(m);
    Workspace.log(ws,{at:at,t:"presented",to:m.id});
    return m;
  }
};
