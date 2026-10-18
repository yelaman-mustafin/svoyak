const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const html=fs.readFileSync(require("path").join(__dirname,"..","dist","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function client(fb,name){ return new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};w.confirm=()=>true;w.prompt=()=>null;w.alert=m=>console.log("ALERT",m);}}); }
const T=(c,s)=>{const e=c.window.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim().slice(0,170):"<none>"};
const Q=(c,s)=>c.window.document.querySelector(s);
async function join(c,code,name){ Q(c,"[data-home=code]").click(); await sl(10); Q(c,"#code").value=code; Q(c,"#nm").value=name; Q(c,"[data-act=join-code]").click(); await sl(100); }
(async()=>{
 // ===== AUTO classic =====
 let fb=makeFake(); let o=client(fb), a=client(fb); await sl(30);
 o.window.eval('ME_NAME="Орг"');
 Q(o,"[data-act=host]").click(); await sl(80);
 Q(o,'[data-cfg=host][data-val=auto]').click(); await sl(150);
 const code=o.window.eval("HOST.code");
 await join(a,code,"Айгерим");
 console.log("AUTO lobby:", T(o,"#lobby-players"));
 Q(o,"[data-act=start]").click(); await sl(100);
 console.log("org mode:", o.window.eval("APP.mode"), "| org phone:", T(o,"#phone .orgbar"), "|", T(o,".ph-body").slice(0,80));
 // organizer is chooser? picks on phone
 const ch=o.window.eval("pname(H().chooser)"); console.log("chooser", ch);
 const chC= ch==="Орг"?o:a;
 Q(chC,'[data-ppick="0-0"]').click(); await sl(80);
 console.log("phase", o.window.eval("H().phase"));
 o.window.eval("openBuzz()"); await sl(50);
 a.window.eval("plBuzz()"); await sl(400);
 console.log("A answer UI:", T(a,".ph-body").slice(0,120));
 Q(a,"#pa").value="астанa"; Q(a,"[data-act=pa]").click(); await sl(120);
 console.log("judged:", o.window.eval("H().msg"));
 // wrong path: next question, typed wrong, then organizer buzzes, then timeout
 o.window.eval("toBoard()"); await sl(50);
 o.window.eval('pick(1,0)'); o.window.eval("openBuzz()"); await sl(30);
 a.window.eval("plBuzz()"); await sl(400); Q(a,"#pa").value="Венера"; Q(a,"[data-act=pa]").click(); await sl(120);
 console.log("after wrong:", o.window.eval("H().phase"), o.window.eval("H().msg"));
 o.window.eval("plBuzz()"); await sl(400); Q(o,"#pa").value="меркури"; Q(o,"[data-act=pa]").click(); await sl(120);
 console.log("typo ok:", o.window.eval("H().msg"));
 // skip to final: auto judge
 o.window.eval("startFinal()"); await sl(80);
 for(const c of [o,a]){ if(Q(c,"[data-act=bet]")){ Q(c,"[data-act=bet]").click(); } } await sl(120);
 console.log("final phase:", o.window.eval("H().phase"));
 for(const c of [o,a]){ if(Q(c,"#fa")){ Q(c,"#fa").value="алматы"; Q(c,"[data-act=fa]").click(); } } await sl(3500);
 console.log("final end:", o.window.eval("H().phase"));
 console.log("org end phone:", T(o,".ph-body"));
 console.log("A end:", T(a,".endscreen .noms"), "|", T(a,".places"));
 // ===== QUIZ =====
 fb=makeFake(); const h=client(fb), b=client(fb), c2=client(fb); await sl(30);
 Q(h,"[data-act=host]").click(); await sl(80);
 Q(h,'[data-cfg=format][data-val=quiz]').click(); await sl(30);
 const code2=h.window.eval("HOST.code"); await join(b,code2,"Бота"); await join(c2,code2,"Вика");
 Q(h,"[data-act=start]").click(); await sl(80);
 console.log("QUIZ chooser:", h.window.eval("pname(H().chooser)"), "| B board:", T(b,".ph-body").slice(0,40));
 const chooser=h.window.eval("pname(H().chooser)")==="Бота"?b:c2;
 Q(chooser,'[data-ppick="3-2"]').click(); await sl(80);
 console.log("quiz opts:", h.window.eval("JSON.stringify(H().quiz.opts)"), "correct", h.window.eval("H().quiz.correct"));
 console.log("B quiz:", T(b,".ph-body").slice(0,140));
 const corr=h.window.eval("H().quiz.correct");
 Q(b,`[data-opt="${corr}"]`).click(); await sl(60);
 Q(c2,`[data-opt="${(corr+1)%4}"]`).click(); await sl(150);
 console.log("quiz reveal host:", T(h,"#tv .q .sub"));
 console.log("B reveal:", T(b,".ph-body").slice(0,60), "| C reveal:", T(c2,".ph-body").slice(0,40));
 // year distractors / text distractors
 console.log("year opts:", h.window.eval('JSON.stringify(makeOptions("1998",null,"Технологии"))'), "text:", h.window.eval('JSON.stringify(makeOptions("Юпитер",null,"Космос"))'));
 h.window.eval("toBoard(); startFinal()"); await sl(80);
 for(const c of [b,c2]) if(Q(c,"[data-act=bet]")) Q(c,"[data-act=bet]").click(); await sl(120);
 console.log("final opts on phone:", T(b,".ph-body").slice(0,120));
 const fo=b.window.eval('arr(PL.state.fin.opts).indexOf("Алматы")'); if(Q(b,`[data-fopt="${fo}"]`)) Q(b,`[data-fopt="${fo}"]`).click(); await sl(3000);
 console.log("quiz end host:", h.window.eval("H().phase"), T(h,"#tv .noms"));
 // parser options
 console.log("parse opts:", h.window.eval('JSON.stringify(parseText("# Т\\n100 Столица Франции? = Париж\\nВарианты: Париж; Лион; Марсель; Ницца").rounds[0].themes[0].questions[0].wrong)'));
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
