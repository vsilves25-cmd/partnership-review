/* A test runner small enough to read in one sitting. No install: open
   tests.html in a browser, or run run-tests.ps1 to do it headless. */
var TESTS=[],GROUP="";
function group(name){GROUP=name;}
function test(name,fn){TESTS.push({name:(GROUP?GROUP+": ":"")+name,fn:fn});}

function show(v){
  if(v instanceof Date) return "Date("+(isNaN(v)?"invalid":v.toISOString())+")";
  try{ return JSON.stringify(v); }catch(e){ return String(v); }
}
function same(a,b){
  if(a===b) return true;
  if(a instanceof Date&&b instanceof Date) return a.getTime()===b.getTime();
  if(a&&b&&typeof a==="object"&&typeof b==="object"){
    if(Array.isArray(a)!==Array.isArray(b)) return false;
    var ka=Object.keys(a),kb=Object.keys(b);
    if(ka.length!==kb.length) return false;
    return ka.every(function(k){return same(a[k],b[k]);});
  }
  return false;
}
function eq(got,want,msg){
  if(!same(got,want)) throw new Error((msg?msg+": ":"")+"expected "+show(want)+" but got "+show(got));
}
function ok(v,msg){ if(!v) throw new Error(msg||"expected a truthy value, got "+show(v)); }
function no(v,msg){ if(v) throw new Error(msg||"expected a falsy value, got "+show(v)); }
function throws(fn,re,msg){
  var err=null;
  try{ fn(); }catch(e){ err=e; }
  if(!err) throw new Error((msg||"")+" expected an error, none was thrown");
  if(re&&!re.test(err.message)) throw new Error((msg||"")+" error message "+show(err.message)+" does not match "+re);
  return err;
}
async function rejects(promise,re){
  var err=null;
  try{ await promise; }catch(e){ err=e; }
  if(!err) throw new Error("expected a rejection, the promise resolved");
  if(re&&!re.test(err.message)) throw new Error("rejection "+show(err.message)+" does not match "+re);
  return err;
}

async function runAll(){
  var out=[],failed=0;
  for(var i=0;i<TESTS.length;i++){
    var t=TESTS[i];
    try{ await t.fn(); out.push("ok   - "+t.name); }
    catch(e){ failed++; out.push("FAIL - "+t.name+"\n       "+(e&&e.message||e)); }
  }
  var line="RESULT: "+(failed?"FAIL "+failed+" of "+TESTS.length:"PASS "+TESTS.length+"/"+TESTS.length);
  out.push("",line);
  var pre=document.getElementById("out");
  pre.textContent=out.join("\n");
  pre.className=failed?"fail":"pass";
  document.title=line;
  document.getElementById("summary").textContent=line;
}
