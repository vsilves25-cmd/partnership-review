group("my details");

test("a new set of details is blank, with the standard title",function(){
  var p=Profile.create();
  eq([p.name,p.nmls,p.photo,p.signature,p.background],["","","","",""]);
  eq(p.title,"Loan Originator, NFM Lending");
  eq(p.pos,{x:50,y:50,z:100});
  no(Profile.complete(p));
  eq(Profile.missing(p),["your name","your NMLS number"]);
});
test("details are complete once there is a name and an NMLS number",function(){
  var p=Profile.create(); p.name="Jamie Rivera";
  eq(Profile.missing(p),["your NMLS number"]);
  p.nmls="123456";
  ok(Profile.complete(p)); eq(Profile.missing(p),[]);
});
test("an NMLS number is kept as digits, whatever is typed around it",function(){
  eq(Profile.cleanNmls(" NMLS #123456 "),"123456");
  eq(Profile.cleanNmls("nmls id 12 34 56"),"123456");
  eq(Profile.cleanNmls("n/a"),"");
});
test("the footer names the team if one is given, else the officer, else just the company",function(){
  eq(Profile.preparedBy({name:"Jamie Rivera",signature:"the Rivera Team"}),"Prepared by the Rivera Team at NFM Lending");
  eq(Profile.preparedBy({name:"Jamie Rivera",signature:" "}),"Prepared by Jamie Rivera at NFM Lending");
  eq(Profile.preparedBy({name:"",signature:""}),"Prepared at NFM Lending");
  eq(Profile.possessive({name:"Jamie Rivera"}),"Jamie Rivera’s"); eq(Profile.possessive({name:""}),"My");
});
test("what is saved is what comes back, and gaps are filled",function(){
  var p=Profile.create(); p.name="Jamie Rivera"; p.nmls="123456"; p.photo="data:image/jpeg;base64,AAAA"; p.revision=3;
  eq(Profile.parse(Profile.serialize(p)),p);
  var thin=Profile.parse(JSON.stringify({format:PROFILE_FORMAT,name:"Jamie Rivera",nmls:"NMLS #123456"}));
  eq([thin.title,thin.nmls,thin.revision,thin.pos.z,thin.photo],["Loan Originator, NFM Lending","123456",0,100,""]);
});
test("a team file, a damaged file or a newer file is not mistaken for details",function(){
  var team=Workspace.serialize(Workspace.create("The Marlow Team"));
  no(Profile.isProfileText(team)); ok(Profile.isProfileText(Profile.serialize(Profile.create())));
  eq(throws(function(){Profile.parse(team);}).code,"not-profile");
  eq(throws(function(){Profile.parse("{oops");}).code,"not-json");
  eq(throws(function(){Profile.parse(JSON.stringify({format:PROFILE_FORMAT,schemaVersion:9}));}).code,"too-new");
});
