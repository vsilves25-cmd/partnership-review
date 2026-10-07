/* ============ my details ============ */
/* Who the report is from: the loan officer's name, title, NMLS number and
   photo. Set once, used on every team's report. It belongs to the person using
   the tool, not to a team, so it is kept in its own small file and a team file
   opened by a different loan officer shows that officer's details. */
var COMPANY="NFM Lending";
var PROFILE_FORMAT="partnership-review-profile";
var PROFILE_SCHEMA=1;
var PROFILE_FILE="My details.partnership-profile.json";

var Profile={
  create:function(){
    return {format:PROFILE_FORMAT,schemaVersion:PROFILE_SCHEMA,revision:0,savedAt:"",
      name:"",title:"Loan Originator, "+COMPANY,nmls:"",signature:"",
      photo:"",pos:{x:50,y:50,z:100},background:""};
  },

  isProfileText:function(text){
    return typeof text==="string"&&text.indexOf('"'+PROFILE_FORMAT+'"')>=0&&text.indexOf('"'+WS_FORMAT+'"')<0;
  },

  parse:function(text){
    var p;
    try{ p=JSON.parse(text); }
    catch(e){ throw WorkspaceError("not-json","This file is damaged or incomplete and cannot be read."); }
    if(!p||typeof p!=="object"||p.format!==PROFILE_FORMAT)
      throw WorkspaceError("not-profile","This is not a Partnership Review details file.");
    if(typeof p.schemaVersion==="number"&&p.schemaVersion>PROFILE_SCHEMA)
      throw WorkspaceError("too-new","This details file was saved by a newer version of the tool.");
    var blank=Profile.create();
    Object.keys(blank).forEach(function(k){ if(p[k]===undefined||p[k]===null) p[k]=blank[k]; });
    ["name","title","nmls","signature","photo","background"].forEach(function(k){ if(typeof p[k]!=="string") p[k]=""; });
    if(!p.pos||typeof p.pos!=="object") p.pos={x:50,y:50,z:100};
    if(typeof p.revision!=="number") p.revision=0;
    p.nmls=Profile.cleanNmls(p.nmls);
    return p;
  },
  serialize:function(p){ return JSON.stringify(p,null,1); },

  /* An NMLS ID is digits. Whatever is typed around them ("NMLS #", spaces) goes. */
  cleanNmls:function(s){ return clean(s).replace(/[^0-9]/g,""); },

  /* A report sent to a referral partner should carry the officer's name and NMLS ID. */
  complete:function(p){ return !!(clean(p.name)&&clean(p.nmls)); },
  missing:function(p){
    var m=[];
    if(!clean(p.name)) m.push("your name");
    if(!clean(p.nmls)) m.push("your NMLS number");
    return m;
  },

  /* The footer line. "the Smith Team" if one is given, else the officer's name. */
  preparedBy:function(p){
    var who=clean(p.signature)||clean(p.name);
    return who?"Prepared by "+who+" at "+COMPANY:"Prepared at "+COMPANY;
  },
  possessive:function(p){ var n=clean(p.name); return n?n+"’s":"My"; }
};
