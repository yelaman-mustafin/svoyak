const {JSDOM}=require("jsdom");const fs=require("fs");const makeFake=require("./fake-firebase.js");const fb=makeFake();
const html=fs.readFileSync(require("path").join(__dirname,"..","dist","index.html"),"utf8").replace(/<script src="https:\/\/cdn.jsdelivr[^>]+><\/script>/g,"");
const mk=()=>new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.io/s/",beforeParse(w){w.firebase=fb;w.FIREBASE_CONFIG_OVERRIDE={databaseURL:"x"};w.confirm=()=>true;w.prompt=()=>null;}});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const h=mk(),a=mk(); await sl(30); const D=h.window.document,A=a.window.document;
 // pack with url image and local image (stub cache)
 h.window.eval(`IMG.cache["iTEST"]="data:image/png;base64,AAAA"; const p=clone(CATALOG[0]); p.id="t1"; p.title="С картинками"; p.rounds[0].themes[0].questions[0].url="https://ex.com/a.jpg"; p.rounds[0].themes[0].questions[1].img="iTEST"; p.rounds[0].themes[0].questions[1].text=""; MINE=[p]; save("svoya.packs",MINE); choosePack("t1");`);
 console.log("validate errs:", h.window.eval("validate(PACK).filter(x=>x.lvl==='err').length"));
 D.querySelector("[data-act=host]").click(); await sl(80);
 D.querySelector('[data-cfg=phoneImg][data-val=true]').click(); await sl(30);
 const code=h.window.eval("HOST.code"); A.querySelector("[data-home=code]").click(); await sl(10);
 A.querySelector("#code").value=code; A.querySelector("#nm").value="Ела"; A.querySelector("[data-act=join-code]").click(); await sl(80);
 console.log("lobby summary has Картинки:", /на телефонах/.test(A.querySelector(".summary").textContent));
 D.querySelector("[data-act=start]").click(); await sl(60);
 D.querySelector('#tv [data-pick="0-0"]').click(); await sl(60);
 console.log("TV url img:", !!D.querySelector("#tv .qimg"), "| phone url img:", A.querySelector(".pimg")&&A.querySelector(".pimg").src);
 h.window.eval("H().phase='reveal'; toBoard()"); await sl(60);
 D.querySelector('#tv [data-pick="0-1"]').click(); await sl(100);
 console.log("TV local img:", D.querySelector("#tv .qimg")&&D.querySelector("#tv .qimg").src.slice(0,22), "| phone local img:", A.querySelector(".pimg")&&A.querySelector(".pimg").src.slice(0,22), "| media in db:", !!fb.__get(`rooms/${code}/media`));
 h.window.eval("toBoard()"); await sl(60); console.log("media removed:", fb.__get(`rooms/${code}/media`)===null);
 // phoneImg off
 h.window.eval("CFG.phoneImg=false; H().phase='board'"); D.querySelector('#tv [data-pick="0-2"]') ; h.window.eval(`PACK.rounds[0].themes[0].questions[2].url="https://ex.com/b.jpg"`);
 D.querySelector('#tv [data-pick="0-2"]').click(); await sl(80);
 console.log("off -> phone:", A.querySelector(".ph-body").textContent.replace(/\s+/g," ").slice(0,80), "| pimg:", !!A.querySelector(".pimg"));
 // editor url
 h.window.eval("S.view='editor'; openEditor(clone(PACK)); S.edSel=[0,0]; render()"); await sl(20);
 console.log("editor img block:", !!D.querySelector(".ed-img img"), "cell mark:", D.querySelector('[data-edcell="0-0"]').textContent);
 // siq readQ image refs
 const r=h.window.eval(`JSON.stringify(parseSiqXml('<package name="x" version="5"><rounds><round name="r"><themes><theme name="t"><questions><question price="100"><params><param name="question" type="content"><item type="image" isRef="True">кот.jpg</item><item>Кто это?</item></param></params><right><answer>Кот</answer></right></question><question price="200"><scenario><atom type="image">@pic 1.png</atom></scenario><right><answer>A</answer></right></question><question price="300"><scenario><atom type="voice">@s.mp3</atom></scenario><right><answer>B</answer></right></question></questions></theme></themes></round></rounds></package>',"f").rounds[0].themes[0].questions)`);
 console.log("siq:", r);
 process.exit(0);
})().catch(e=>{console.log("ERR",e.stack);process.exit(1)});
