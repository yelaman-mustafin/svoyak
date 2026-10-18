const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");
const html=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const cl=(fb)=>new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};w.confirm=()=>true;w.prompt=()=>"777";}});
const T=(c,s)=>{const e=c.window.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim().slice(0,200):"<none>"};
const Q=(c,s)=>c.window.document.querySelector(s);
(async()=>{
 const fb=makeFake(), h=cl(fb), a=cl(fb), b=cl(fb); await sl(30);
 const xml=`<package name="Еда" version="5"><rounds><round name="1"><themes><theme name="🍕 Еда и напитки"><questions><question price="50" type="simple"><params><param name="question" type="content"><item>Какое из этих блюд не является японским?</item></param><param name="answerOptions" type="group"><param name="A" type="content"><item>Суши</item></param><param name="B" type="content"><item>Рамен</item></param><param name="C" type="content"><item>Темпура</item></param><param name="D" type="content"><item>Пицца</item></param></param></params><right><answer>D</answer></right></question><question price="100"><params><param name="question" type="content"><item>Столица Италии?</item></param></params><right><answer>Рим</answer></right></question></questions></theme></themes></round></rounds></package>`;
 h.window.eval(`const pk=parseSiqXml(${JSON.stringify(xml)},"Еда"); pk.id="sq"; MINE=[pk]; save("svoya.packs",MINE); choosePack("sq");`);
 console.log("parsed:", h.window.eval("JSON.stringify(PACK.rounds[0].themes[0].questions[0])"));
 console.log("validate:", h.window.eval("JSON.stringify(validate(PACK).map(x=>x.msg))"));
 Q(h,"[data-act=host]").click(); await sl(80);
 Q(h,'[data-cfg=window][data-val="0"]').click(); await sl(30);
 const code=h.window.eval("HOST.code");
 for(const [c,n] of [[a,"Аня"],[b,"Бек"]]){ Q(c,"[data-home=code]").click(); await sl(10); Q(c,"#code").value=code; Q(c,"#nm").value=n; Q(c,"[data-act=join-code]").click(); await sl(80); }
 console.log("no rename on phone:", !Q(a,"[data-act=rename]"), T(a,".ph-top"));
 Q(h,"[data-act=start]").click(); await sl(60);
 // host chooser select
 const sel=Q(h,"[data-chooser]"); console.log("select opts:", sel.options.length);
 sel.value=h.window.eval("online()[1]"); sel.dispatchEvent(new h.window.Event("change",{bubbles:true})); await sl(40);
 console.log("chooser now:", h.window.eval("pname(H().chooser)"));
 Q(h,'#tv [data-pick="0-0"]').click(); await sl(60);
 console.log("TV options shown:", T(h,"#tv .opts"), "| strip:", T(h,"#tv .host .ans"));
 console.log("phone options:", T(a,".opts"));
 h.window.eval("openBuzz()"); await sl(40);
 console.log("no limit:", h.window.eval("H().dl"), T(a,".nolimit"));
 Q(h,'[data-act=t-add10]').click(); await sl(40); console.log("after +10:", h.window.eval("Math.round((H().dl-now())/1000)"), !!Q(a,".timer"));
 Q(h,'[data-act=t-stop]').click(); await sl(40); console.log("stopped:", h.window.eval("H().dl"));
 // menu: give answer to Бек
 const bid=h.window.eval("online().find(x=>pname(x)==='Бек')");
 Q(h,`[data-menu="${bid}"]`).click(); await sl(10);
 console.log("menu:", T(h,".hmenu"));
 Q(h,'[data-mact=give]').click(); await sl(60); console.log("responder:", h.window.eval("pname(H().responder)"), h.window.eval("H().phase"));
 Q(h,"[data-act=ok]").click(); await sl(60); console.log("score Бек:", h.window.eval(`HOST.players["${bid}"].score`));
 Q(h,"[data-act=next]").click(); await sl(40);
 // undo
 Q(h,'#tv [data-pick="0-1"]').click(); await sl(40); Q(h,"[data-act=undo-q]").click(); await sl(40);
 console.log("undo -> phase:", h.window.eval("H().phase"), "used:", h.window.eval("JSON.stringify(H().used)"), "qs:", h.window.eval("H().st.qs.length"));
 Q(h,'#tv [data-pick="0-1"]').click(); await sl(40); Q(h,"[data-act=skip-q]").click(); await sl(40);
 console.log("skip -> ", h.window.eval("H().phase"), h.window.eval("H().msg"));
 // menu plus/minus
 Q(h,"[data-act=next]").click(); await sl(40);
 // quiz with choices order kept
 h.window.eval("CFG.format='quiz'"); console.log("quiz opts from choices:", h.window.eval('JSON.stringify(makeOptions("Пицца",null,"x",["Суши","Рамен","Темпура","Пицца"]))'));
 // auto classic answer via option
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
