// Окно игрока: панель всех игроков (кто отвечает, кто ошибся и сколько потерял),
// строка состояния, правильный ответ; а также перенос старой настройки картинок.
const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const html=fs.readFileSync(require("path").join(__dirname,"..","dist","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const cl=(fb,cfg)=>new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};w.INTRO_MS_OVERRIDE=0;if(cfg)w.localStorage.setItem("svoya.cfg",JSON.stringify(cfg));w.confirm=()=>true;w.prompt=()=>null;}});
const T=(c,s)=>{const e=c.window.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim().slice(0,200):"<none>"};
const Q=(c,s)=>c.window.document.querySelector(s);
async function join(c,code,name){ Q(c,"[data-home=code]").click(); await sl(10); Q(c,"#code").value=code; Q(c,"#nm").value=name; Q(c,"[data-act=join-code]").click(); await sl(100); }
(async()=>{
 const fb=makeFake();
 // ведущий, у которого в браузере сохранено старое «картинки только на экране»
 const h=cl(fb,{phoneImg:false,window:5000}), a=cl(fb), b=cl(fb); await sl(30);
 console.log("old cfg migrated:", h.window.eval("CFG.phoneImg"), h.window.eval("CFG.window"));
 console.log("home:", T(a,".hero small"), "| entries:", a.window.document.querySelectorAll(".entry .ei").length);
 Q(h,"[data-act=host]").click(); await sl(80);
 const code=h.window.eval("HOST.code"); await join(a,code,"Аня"); await join(b,code,"Бек");
 Q(h,"[data-act=start]").click(); await sl(80);
 console.log("bar players:", a.window.document.querySelectorAll(".pbar .pc").length, "| me marked:", T(a,".pbar .pc.me .pn"));
 console.log("board line:", T(a,".pline"), "| mini board:", a.window.document.querySelectorAll(".mini button").length>0);
 h.window.eval("pick(0,0); openBuzz()"); await sl(60);
 a.window.eval("plBuzz()"); await sl(400);
 console.log("answer chip:", T(b,".pbar .pc.resp"), "| line:", T(b,".pline"));
 Q(h,"[data-act=bad]").click(); await sl(80);
 console.log("wrong chip:", T(b,".pbar .pc.out"), "| line:", T(b,".pline"));
 b.window.eval("plBuzz()"); await sl(400); Q(h,"[data-act=ok]").click(); await sl(80);
 console.log("reveal:", T(a,".pline.ok"), "| win chip:", T(a,".pbar .pc.win"), "| answer card:", T(a,".ans-card"));
 console.log("close label:", T(h,'[data-act="close-room"]'));
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
