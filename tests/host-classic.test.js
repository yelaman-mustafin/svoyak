const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const fb=makeFake();
const html=fs.readFileSync(require("path").join(__dirname,"..","dist","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
function client(name){ const d=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/svoya/",beforeParse(w){ w.firebase=fb; w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"}; w.confirm=()=>true; w.alert=m=>console.log("ALERT",name,m); w.prompt=()=>null; }}); d.name=name; return d; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=(c,s)=>c.window.document.querySelector(s);
const txt=(c,s)=>(q(c,s)||{textContent:"<none>"}).textContent.replace(/\s+/g," ").trim().slice(0,160);
(async()=>{
 const h=client("host"), a=client("A"), b=client("B");
 await sleep(50);
 console.log("home:", txt(h,"#phone"));
 q(h,'[data-act=host]').click(); await sleep(100);
 const code=h.window.eval("HOST.code"); console.log("code", code, "tv:", txt(h,"#tv").slice(0,80));
 // player A join by code
 q(a,'[data-home=code]').click(); await sleep(10);
 q(a,'#code').value=code; q(a,'#nm').value="Айгерим"; q(a,'[data-act=join-code]').click(); await sleep(100);
 // player B via rooms list? make public first
 q(h,'[data-cfg=access][data-val=public]').click(); await sleep(50);
 q(b,'[data-home=rooms]').click(); await sleep(60);
 console.log("B rooms:", txt(b,"#phone"));
 q(b,'#nm').value="Данияр"; q(b,`[data-joinroom="${code}"]`).click(); await sleep(100);
 console.log("lobby:", txt(h,"#lobby-players"), "|", txt(h,"#start-btn"));
 console.log("A phone:", txt(a,"#phone"));
 q(h,'[data-act=start]').click(); await sleep(80);
 console.log("host board cells:", h.window.document.querySelectorAll("#tv .cell").length, "chooser", h.window.eval("pname(H().chooser)"));
 console.log("A sees:", txt(a,".ph-body"));
 // host picks
 q(h,'#tv [data-pick="0-0"]').click(); await sleep(60);
 console.log("A reading:", txt(a,".ph-body"));
 h.window.eval("openBuzz()"); await sleep(60);
 // both press; B first
 b.window.eval("plBuzz()"); await sleep(5); a.window.eval("plBuzz()"); await sleep(400);
 console.log("host answer:", txt(h,"#tv .q .sub"));
 console.log("B phone:", txt(b,".ph-body"));
 q(h,'[data-act=bad]').click(); await sleep(80);
 console.log("after wrong host:", h.window.eval("H().phase"), "A phone:", txt(a,".ph-body"));
 a.window.eval("plBuzz()"); await sleep(400);
 q(h,'[data-act=ok]').click(); await sleep(80);
 console.log("reveal A:", txt(a,".ph-body"), "| scores", JSON.stringify(Object.values(fb.__get(`rooms/${code}/players`)).map(p=>p.name+":"+p.score)));
 q(h,'[data-act=next]').click(); await sleep(60);
 // set picker player: A chooses via phone? (chooser=A now). host picker mode default host
 console.log("A board:", txt(a,".ph-body"));
 // cat question: Кино 300 (2-2)
 q(h,'#tv [data-pick="2-2"]').click(); await sleep(80);
 console.log("A cat:", txt(a,".ph-body"));
 q(a,'[data-catto]').click(); await sleep(150);
 console.log("host after cat:", h.window.eval("H().phase"), h.window.eval("pname(H().responder)"));
 q(h,'[data-act=ok]').click(); await sleep(60); q(h,'[data-act=next]').click(); await sleep(60);
 // auction Телеком 400 (3-3)
 q(h,'#tv [data-pick="3-3"]').click(); await sleep(80);
 console.log("auction host:", txt(h,"#tv .q"));
 const turn=h.window.eval("H().auc.queue[0]"); console.log("turn", h.window.eval("pname(H().auc.queue[0])"));
 const tc = h.window.eval("pname(H().auc.queue[0])")==="Айгерим"?a:b;
 console.log("turn phone:", txt(tc,".ph-body"));
 q(tc,'[data-pauc=pass]').click(); await sleep(150);
 console.log("after pass:", h.window.eval("H().phase"), h.window.eval("H().responder&&pname(H().responder)"));
 q(h,'[data-act=ok]').click(); await sleep(60);
 // skip to final
 q(h,'[data-act=next]').click(); await sleep(60);
 q(h,'[data-act=skip]').click(); await sleep(100);
 console.log("final phase:", h.window.eval("H().phase"), h.window.eval("JSON.stringify(H().fin&&H().fin.ids.map(pname))"));
 for(const c of [a,b]){ if(q(c,'[data-act=bet]')){ q(c,'#bet').value="100"; q(c,'[data-act=bet]').click(); } }
 await sleep(150); console.log("after bets:", h.window.eval("H().phase"));
 for(const c of [a,b]){ if(q(c,'#fa')){ q(c,'#fa').value= c===a?"Алматы":"Астана"; q(c,'[data-act=fa]').click(); } }
 await sleep(150); console.log("after answers:", h.window.eval("H().phase"), "A:", txt(a,".ph-body"));
 h.window.document.querySelectorAll('[data-fj$=":1"]').forEach(x=>x.click()); await sleep(150);
 console.log("end:", txt(h,"#tv .q"), "| A:", txt(a,".ph-body"));
 // kick + close
 q(h,'[data-act=lobby]').click(); await sleep(80);
 q(h,'[data-kick]').click(); await sleep(150);
 console.log("kicked phone:", txt(a,".ph-body").slice(0,60), txt(b,".ph-body").slice(0,60));
 q(h,'[data-act=close-room]').click(); await sleep(150);
 console.log("closed:", txt(b,".ph-body").slice(0,60), "| host home:", txt(h,"#phone").slice(0,40));
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
