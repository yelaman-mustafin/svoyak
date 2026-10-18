/* ======================================================================
   13. ЭКРАН: ГЛАВНАЯ
   Выбор роли: провести игру, войти по коду, открытые игры.
   ====================================================================== */

// Главная: выбор роли, вход по коду, список открытых игр, возврат в незаконченную игру.
function renderHome() {
  const el = document.getElementById("phone");
  el.classList.remove("qmode");
  const v = APP.homeView;
  let b = "";
  if (!configured || !APP.dbOk) {
    b = `<div class="brand">Своя игра<small>Викторина с кнопками на телефонах</small></div>
      <div class="card"><div class="status" style="font-size:16px">${configured ? "Не удалось подключиться к базе" : "Подключите базу данных"}</div>
      <div class="hint" style="margin-top:6px">${configured ? "Проверьте интернет и настройки Firebase в файле." : "Чтобы игроки могли заходить с разных телефонов, нужна бесплатная база Firebase. Вставьте её настройки в начало файла index.html (блок FIREBASE_CONFIG) и обновите страницу."}</div></div>`;
    el.innerHTML = `<div class="ph-body" style="padding-top:28px"><div class="home">${b}</div></div>`;
    return;
  }
  if (v === "main") {
    const hs = load("svoya.hosting", null),
      lr = load("svoya.lastRoom", null);
    b = `<div class="brand">Своя игра<small>Викторина с кнопками на телефонах</small></div>
    ${hs ? `<button class="entry resume" data-act="resume-host"><b>Вернуться в свою комнату ${esc(hs.code)}</b><span>Вы ведущий этой игры</span></button>` : ""}
    ${lr && !hs ? `<button class="entry resume" data-act="rejoin"><b>Вернуться в комнату ${esc(lr)}</b><span>Счёт сохранится</span></button>` : ""}
    <button class="entry main" data-act="host" ${APP.busy ? "disabled" : ""}><b>${APP.busy ? "Создаём комнату…" : "Провести игру"}</b><span>Вы ведущий: выбираете вопросы, показываете табло на экране и засчитываете ответы</span></button>
    <button class="entry" data-home="code"><b>Войти по коду</b><span>Ведущий покажет код или QR на своём экране</span></button>
    <button class="entry" data-home="rooms"><b>Открытые игры</b><span>Присоединиться к игре, которую ведёт кто-то другой</span></button>`;
  }
  if (v === "code")
    b = `<button class="back" data-home="main">← Назад</button><div class="status">Войти по коду</div>
    <input class="field codein" id="code" inputmode="numeric" maxlength="4" placeholder="0000" autocomplete="off" aria-label="Код комнаты" value="${esc(APP.prefill)}">
    <input class="field" id="nm" placeholder="Как вас называть" value="${esc(ME_NAME)}" maxlength="20" aria-label="Ваше имя" autocomplete="nickname">
    ${APP.joinErr ? `<div class="err-t">${esc(APP.joinErr)}</div>` : ""}
    <button class="pbtn hot" data-act="join-code" ${APP.busy ? "disabled" : ""}><span>${APP.busy ? "Подключаемся…" : "Войти"}</span><span></span></button>`;
  if (v === "rooms") {
    const t = now(),
      list = Object.entries(APP.publicRooms)
        .filter(([c, r]) => r && (!r.ts || t - r.ts < 6 * 3600e3))
        .sort((a, b) => (a[1].status === "wait" ? 0 : 1) - (b[1].status === "wait" ? 0 : 1));
    b = `<button class="back" data-home="main">← Назад</button><div class="status">Открытые игры</div>
    <input class="field" id="nm" placeholder="Как вас называть" value="${esc(ME_NAME)}" maxlength="20" aria-label="Ваше имя" autocomplete="nickname">
    ${APP.joinErr ? `<div class="err-t">${esc(APP.joinErr)}</div>` : ""}
    ${
      list.length
        ? list
            .map(([code, r]) => {
              const full = r.count >= r.max,
                play = r.status === "play";
              return `<div class="room"><div class="r1"><b>${esc(r.name)}</b><span class="pill ${play ? "play" : "wait"}">${play ? "идёт игра" : "ждут игроков"}</span></div>
        <div class="meta2">Ведёт ${esc(r.host)} · ${esc(r.pack)} · ${r.count || 0} из ${r.max}</div>
        <button class="pbtn ${full ? "alt" : ""}" data-joinroom="${esc(code)}" ${full || APP.busy ? "disabled" : ""}><span>${full ? "Мест нет" : play ? "Войти в идущую игру" : "Войти"}</span><span></span></button></div>`;
            })
            .join("")
        : `<div class="card"><div class="hint">Сейчас открытых игр нет. Создайте свою: «Провести игру», доступ «Открытая».</div></div>`
    }`;
  }
  preserve(el, `<div class="ph-body" style="padding-top:28px"><div class="home">${b}</div></div>`);
}

