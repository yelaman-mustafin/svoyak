/* ======================================================================
   12. НАВИГАЦИЯ И ОТРИСОВКА
   render() перерисовывает текущий экран целиком. preserve() при этом
   сохраняет введённый текст и фокус, чтобы набор не сбивался.
   ====================================================================== */

// Главный экран.
function goHome() {
  APP.mode = "home";
  APP.homeView = APP.prefill ? "code" : "main";
  APP.joinErr = "";
  PACK = clone(findPack(PACK_ID));
  render();
}

// Переключение вкладок главной. На «Открытых играх» подписывается на список комнат.
function setHomeView(v) {
  APP.homeView = v;
  APP.joinErr = "";
  if (APP.pubRef) {
    APP.pubRef.off();
    APP.pubRef = null;
  }
  if (v === "rooms" && APP.dbOk) {
    APP.pubRef = ref("public");
    APP.pubRef.on("value", s => {
      APP.publicRooms = s.val() || {};
      render();
    });
  }
  render();
}

// Заменяет HTML контейнера, сохраняя введённый текст, фокус и позицию курсора.
function preserve(el, html) {
  const vals = {},
    act = document.activeElement,
    fid = act && el.contains(act) ? act.id : null;
  el.querySelectorAll("input[id],textarea[id]").forEach(i => {
    if (i.type !== "range" || i.dataset.keep) vals[i.id] = { v: i.value, s: i.selectionStart };
  });
  el.innerHTML = html;
  Object.entries(vals).forEach(([id, o]) => {
    const i = document.getElementById(id);
    if (i && i.dataset.fresh !== "1") {
      i.value = o.v;
    }
  });
  if (fid) {
    const i = document.getElementById(fid);
    if (i) {
      i.focus();
      try {
        if (vals[fid] && vals[fid].s != null) i.setSelectionRange(vals[fid].s, vals[fid].s);
      } catch (e) {}
    }
  }
}

// Перерисовывает текущий экран: ведущий или общий экран (#tv) либо телефон (#phone).
function render() {
  const tv = document.getElementById("tv"),
    ps = document.getElementById("pshell");
  const big = APP.mode === "host" || APP.mode === "screen";
  tv.hidden = !big;
  ps.hidden = big;
  document.body.dataset.mode = APP.mode;
  if (APP.mode === "host") renderHost();
  else if (APP.mode === "screen") renderScreen();
  else if (APP.mode === "player") renderPlayer();
  else renderHome();
}

