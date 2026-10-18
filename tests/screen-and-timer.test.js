// Новые функции: таймер продолжается после ошибки, заставка «тема и стоимость»,
// экран для зрителей, номинации на финальном экране, телефон без прокрутки.
const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const html=fs.readFileSync(require("path").join(__dirname,"..","dist","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const cl=(fb,url,intro)=>new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:url||"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};if(intro!=null)w.INTRO_MS_OVERRIDE=intro;w.confirm=()=>true;w.prompt=()=>null;}});
const T=(c,s)=>{const e=c.window.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim().slice(0,200):"<none>"};
const Q=(c,s)=>c.window.document.querySelector(s);
async function join(c,code,name){ Q(c,"[data-home=code]").click(); await sl(10); Q(c,"#code").value=code; Q(c,"#nm").value=name; Q(c,"[data-act=join-code]").click(); await sl(100); }
(async()=>{
 // ===== Таймер после неверного ответа =====
 const fb=makeFake(), h=cl(fb,null,0), a=cl(fb,null,0), b=cl(fb,null,0); await sl(30);
 Q(h,"[data-act=host]").click(); await sl(80);
 const code=h.window.eval("HOST.code");
 await join(a,code,"Аня"); await join(b,code,"Бек");
 Q(h,"[data-act=start]").click(); await sl(60);
 h.window.eval("pick(0,0)"); h.window.eval("openBuzz()"); await sl(30);
 // как будто с открытия прошло время: осталось 3 секунды
 h.window.eval("H().dl=now()+3000"); a.window.eval("plBuzz()"); await sl(400);
 Q(h,"[data-act=bad]").click(); await sl(60);
 const left=h.window.eval("H().dl-now()"), total=h.window.eval("H().dlTotal"), win=h.window.eval("CFG.window");
 console.log("resume after wrong:", h.window.eval("H().phase"), "left ok:", left>2000&&left<=3000, "bar total = window:", total===win);
 // ===== Заставка «тема и стоимость» =====
 const fb2=makeFake(), h2=cl(fb2,null,300), p2=cl(fb2,null,300); await sl(30);
 Q(h2,"[data-act=host]").click(); await sl(80);
 await join(p2,h2.window.eval("HOST.code"),"Вика");
 Q(h2,"[data-act=start]").click(); await sl(60);
 Q(h2,'#tv [data-pick="0-0"]').click(); await sl(80);
 const code2=h2.window.eval("HOST.code");
 console.log("intro:", h2.window.eval("H().phase"), "| tv:", T(h2,"#tv .q.intro"), "| phone:", T(p2,".intro-ph"), "| text hidden:", fb2.__get(`rooms/${code2}/state/cur/text`)===null);
 await sl(400);
 console.log("after intro:", h2.window.eval("H().phase"), "| text shown:", !!fb2.__get(`rooms/${code2}/state/cur/text`));
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
