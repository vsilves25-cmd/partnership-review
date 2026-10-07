/* ============ edits ============ */
/* Every change the loan officer can make to a team, as plain functions on the team file.
   Each returns true when something actually changed, so the caller knows
   whether there is anything to save. */
var Edit={
  /* What Encompass says for a field the loan officer can correct. */
  baseOf:function(L,field){
    if(field==="name") return L.src.name||"";
    if(field==="agent") return L.src.agentRaw||"";
    if(field==="milestone") return classify(L.src.milestone).raw;
    if(field==="pqDate") return L.src.pqDate||"";
    return "";
  },

  /* shownBase is what the report shows before any correction; for an agent
     that is the merged or renamed label, not the raw Encompass spelling. */
  setField:function(ws,loanId,field,value,shownBase,at){
    var L=Workspace.loanById(ws,loanId); if(!L)return false;
    at=at||new Date().toISOString();
    var base=Edit.baseOf(L,field);
    var shown=shownBase==null?base:shownBase;
    var had=L.overlay[field],before=had?had.v:shown;
    if(field==="milestone") value=classify(value).raw;
    if(field==="name"&&!clean(value)) value=before;   // a blanked name keeps the name it had
    if(field==="agent"&&!clean(value)) value="Unassigned";
    value=clean(value);
    if(value===before)return false;
    if(value===shown) delete L.overlay[field];
    else L.overlay[field]={v:value,base:base,at:at};
    Workspace.log(ws,{at:at,t:"edit",loan:loanId,f:field,from:before,to:value});
    return true;
  },

  setNote:function(ws,loanId,text,priv,at){
    var L=Workspace.loanById(ws,loanId); if(!L)return false;
    var k=priv?"privateNote":"note";
    text=clean(text);
    if((L[k]||"")===text)return false;
    at=at||new Date().toISOString();
    Workspace.log(ws,{at:at,t:"note",loan:loanId,f:k,from:L[k]||"",to:text});
    L[k]=text; L.noteAt=at;
    return true;
  },

  /* Puts the Encompass comment on the report. Until the loan officer does this it is only
     a suggestion they can see; it never prints. */
  useEncNote:function(ws,loanId,at){
    var L=Workspace.loanById(ws,loanId); if(!L||!L.src.encNote)return false;
    return Edit.setNote(ws,loanId,L.src.encNote,false,at);
  },

  hide:function(ws,loanId,hidden,at){
    var L=Workspace.loanById(ws,loanId); if(!L||!!L.hidden===!!hidden)return false;
    L.hidden=!!hidden;
    Workspace.log(ws,{at:at||new Date().toISOString(),t:hidden?"hide":"unhide",loan:loanId});
    return true;
  },
  unhideAll:function(ws){
    var n=0;
    ws.loans.forEach(function(L){if(L.hidden){L.hidden=false;n++;}});
    return n>0;
  },

  /* Renaming an agent in the By agent table moves every one of their files.
     The rename is stored against the Encompass spellings, so next week's
     export lands under the same name without being told again. */
  renameAgent:function(ws,files,from,to,at){
    to=clean(to); if(!to||to===from)return false;
    at=at||new Date().toISOString();
    files.forEach(function(f){
      var L=Workspace.loanById(ws,f.loanId); if(!L)return;
      if(L.overlay.agent){
        if(L.overlay.agent.v===from) L.overlay.agent.v=to;
        return;
      }
      if(f.agentBase!==from)return;
      var k=agentKey(L.src.agentRaw);
      if(k) ws.aliases[k]=to;
      else L.overlay.agent={v:to,base:"",at:at};
    });
    Workspace.log(ws,{at:at,t:"rename-agent",from:from,to:to});
    return true;
  },

  resetLoan:function(ws,loanId,at){
    var L=Workspace.loanById(ws,loanId); if(!L||!Object.keys(L.overlay).length)return false;
    L.overlay={};
    Workspace.log(ws,{at:at||new Date().toISOString(),t:"reset",loan:loanId});
    return true;
  },
  /* Drops every correction and un-hides every row. Notes are kept. */
  clearAll:function(ws,at){
    var n=0;
    ws.loans.forEach(function(L){
      if(Object.keys(L.overlay).length||L.hidden){L.overlay={};L.hidden=false;n++;}
    });
    if(Object.keys(ws.aliases).length){ws.aliases={};n++;}
    if(n) Workspace.log(ws,{at:at||new Date().toISOString(),t:"clear-all"});
    return n>0;
  },

  acceptEncompass:function(ws,loanId,field,at){
    var L=Workspace.loanById(ws,loanId); if(!L||!L.overlay[field])return false;
    Workspace.log(ws,{at:at||new Date().toISOString(),t:"accept",loan:loanId,f:field,
      from:L.overlay[field].v,to:L.overlay[field].pending});
    delete L.overlay[field];
    return true;
  },
  keepMine:function(ws,loanId,field){
    var L=Workspace.loanById(ws,loanId),o=L&&L.overlay[field];
    if(!o||o.pending===undefined)return false;
    o.base=o.pending; delete o.pending;
    return true;
  },

  setMissingReason:function(ws,loanId,reason,at){
    var L=Workspace.loanById(ws,loanId); if(!L)return false;
    at=at||new Date().toISOString();
    if(reason==="removed"){
      if(L.presence==="removed")return false;
      L.presenceBefore=L.presence; L.presence="removed";
    } else {
      if((L.missingReason||"")===reason)return false;
      L.missingReason=reason;
    }
    Workspace.log(ws,{at:at,t:"missing-reason",loan:loanId,to:reason});
    return true;
  },
  restoreRemoved:function(ws,loanId){
    var L=Workspace.loanById(ws,loanId); if(!L||L.presence!=="removed")return false;
    var cur=Workspace.currentImport(ws);
    L.presence=cur&&L.lastSeen&&L.lastSeen.importId===cur.id?"present":"missing";
    if(L.presence==="missing"&&!L.missingSince&&cur) L.missingSince=cur.asOf;
    delete L.presenceBefore;
    return true;
  }
};
