const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const html=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const cl=(fb)=>new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};w.confirm=()=>true;w.prompt=()=>null;}});
const T=(c,s)=>{const e=c.window.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim().slice(0,160):"<none>"};
const Q=(c,s)=>c.window.document.querySelector(s);
(async()=>{
 const fb=makeFake(), h=cl(fb), a=cl(fb); await sl(30);
 Q(h,"[data-act=host]").click(); await sl(80);
 console.log("start btn:", T(h,"#start-btn"), Q(h,"#start-btn").disabled);
 const code=h.window.eval("HOST.code");
 Q(a,"[data-home=code]").click(); await sl(10); Q(a,"#code").value=code; Q(a,"#nm").value="Аня"; Q(a,"[data-act=join-code]").click(); await sl(100);
 console.log("lobby phone:", T(a,".ph-body").slice(0,120));
 fb.__set(`rooms/${code}/meta/hostOnline`, false); await sl(30); console.log("host away phone:", T(a,".ph-body .status"));
 fb.__set(`rooms/${code}/meta/hostOnline`, true); await sl(30);
 // simulate stale onDisconnect: online=false then reconnect
 const pid=a.window.eval("PL.pid"); fb.__set(`rooms/${code}/players/${pid}/online`, false); await sl(30);
 console.log("grey:", fb.__get(`rooms/${code}/players/${pid}/online`));
 fb.__reconnect(); await sl(100); console.log("after reconnect online:", fb.__get(`rooms/${code}/players/${pid}/online`));
 fb.__set(`rooms/${code}/players/${pid}/online`, false); await sl(30);
 Q(h,"[data-act=start]").click(); await sl(60);
 h.window.eval("pick(0,0)"); h.window.eval("openBuzz()"); await sl(30);
 a.window.eval("plBuzz()"); await sl(400);
 console.log("buzz heals online:", fb.__get(`rooms/${code}/players/${pid}/online`), "responder:", h.window.eval("H().responder&&pname(H().responder)"));
 console.log("phone header:", T(a,".qhead"));
 // start without players
 const fb2=makeFake(), h2=cl(fb2); await sl(30); Q(h2,"[data-act=host]").click(); await sl(80);
 console.log("empty start:", T(h2,"#start-btn"), Q(h2,"#start-btn").disabled); Q(h2,"[data-act=start]").click(); await sl(50);
 console.log("phase:", h2.window.eval("H().phase"), "| cells:", h2.window.document.querySelectorAll("#tv .cell").length);
 Q(h2,'#tv [data-pick="0-0"]').click(); await sl(50); console.log("q phase:", h2.window.eval("H().phase"));
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
