/* ======================================================================
   14. ЭКРАН: ВЕДУЩИЙ
   Настройка комнаты (лобби) и экран игры с табло и пультом.
   ====================================================================== */

// Экран ведущего: библиотека, редактор, лобби или игра.
function renderHost() {
  if (S.view === "library") return renderLibrary();
  if (S.view === "editor") return renderEditor();
  if (!HOST) return;
  if (H().phase === "lobby") return renderSetup();
  renderHostGame();
}

// Переключатель из нескольких кнопок для настройки CFG[key] (например, «5 с / 7 с / 10 с»).
function seg(key, opts) {
  return (
    `<div class="seg" role="group">` +
    opts
      .map(
        ([v, l]) =>
          `<button data-cfg="${key}" data-val="${v}" aria-pressed="${String(CFG[key]) === String(v)}">${l}</button>`
      )
      .join("") +
    `</div>`
  );
}

// Пояснение к настройке «Кто выбирает вопросы».
function cfgNoteHTML() {
  return CFG.picker === "host"
    ? "Игрок называет тему и стоимость вслух, вы открываете вопрос на табло. Телефон остаётся пультом."
    : "Игрок выбирает вопрос сам на телефоне. Удобнее, когда играют удалённо.";
}

// Лобби ведущего: настройки комнаты слева, код, QR и список игроков справа.
function renderSetup() {
  const errs = validate(PACK).filter(x => x.lvl === "err").length;
  preserve(
    document.getElementById("tv"),
    `
    <div class="tv-head"><span class="tv-title">Комната ${HOST.code} · настройка</span><button class="ghost" data-act="close-room">Закрыть комнату</button></div>
    <div class="setup">
      <div class="set-col">
        <div class="opt"><div class="pack"><div><b>${esc(PACK.title)}</b><span>${stats(PACK)}</span></div><button class="sb gold" data-act="lib">Сменить вопросы</button></div>${errs ? `<p style="color:#FFB3AE;opacity:1">В паке ${errs} ${plural(errs, "ошибка", "ошибки", "ошибок")}, откройте его в редакторе.</p>` : ""}</div>
        <div class="opt"><h3>Формат игры</h3>${seg("format", [
          ["classic", "Своя игра"],
          ["quiz", "Викторина"]
        ])}<p>${QUIZ() ? "Все отвечают одновременно, выбирая один из 4 вариантов. Кнопок нет. Если у вопроса нет своих вариантов, неверные подбираются из других ответов пака." : "Кто первым нажал кнопку, тот и отвечает. Классические правила."}</p></div>
        <div class="opt"><h3>Ведущий</h3>${seg("host", [
          ["live", "Я веду игру"],
          ["auto", "Без ведущего"]
        ])}<p>${AUTO() ? "Вы играете вместе со всеми со своего телефона. Ответы проверяются автоматически: игрок пишет ответ, небольшие опечатки прощаются. Экран этого устройства не гасите до конца игры." : "Вы читаете вопросы и засчитываете ответы, игроки отвечают вслух."}</p>
          <input class="tin" id="hostname" data-cfgname="1" value="${esc(ME_NAME)}" maxlength="20" placeholder="${AUTO() ? "Ваше имя в игре" : "Имя ведущего"}" aria-label="Ваше имя"></div>
        <div class="opt"><h3>Доступ к комнате</h3>${seg("access", [
          ["private", "Приватная"],
          ["public", "Открытая"]
        ])}
          <p>${CFG.access === "private" ? "Войти можно только по коду, ссылке или QR. Комнаты нет в общем списке." : "Комната видна в «Открытых играх», зайти может любой, пока есть места."}</p>
          ${
            CFG.access === "public"
              ? `<input class="tin" id="roomname" data-cfgtext="roomName" value="${esc(CFG.roomName)}" maxlength="40" aria-label="Название комнаты" placeholder="Название комнаты"><div style="margin-top:10px">${seg(
                  "max",
                  [
                    [4, "до 4"],
                    [6, "до 6"],
                    [8, "до 8"],
                    [12, "до 12"]
                  ]
                )}</div>`
              : ""
          }</div>
        ${
          !AUTO() && !QUIZ()
            ? `<div class="opt"><h3>Кто выбирает вопросы</h3>${seg("picker", [
                ["host", "Ведущий"],
                ["player", "Игрок с телефона"]
              ])}<p>${cfgNoteHTML()}</p></div>`
            : ""
        }
        <div class="opt"><h3>Картинки в вопросах</h3>${seg("phoneImg", [
          [false, "Только на экране"],
          [true, "И на телефонах"]
        ])}<p>${CFG.phoneImg ? "Для игры на расстоянии: каждый телефон загружает картинку вопроса, около 150 КБ. Это расходует бесплатный лимит Firebase." : "Игроки смотрят картинку на общем экране, телефоны остаются кнопками. Трафика нет."}</p></div>
        ${
          QUIZ()
            ? `<div class="opt"><h3>Время на ответ</h3>${seg("quizTime", [
                [15000, "15 с"],
                [20000, "20 с"],
                [30000, "30 с"],
                [0, "Без лимита"]
              ])}<p>Быстрее всех ответивший верно выбирает следующий вопрос.</p></div>`
            : `
        <div class="opt"><h3>Время на нажатие кнопки</h3>${seg("window", [
          [5000, "5 с"],
          [7000, "7 с"],
          [10000, "10 с"],
          [0, "Без лимита"]
        ])}</div>
        ${
          AUTO()
            ? `<div class="opt"><h3>Время на ввод ответа</h3>${seg("ansTime", [
                [15000, "15 с"],
                [25000, "25 с"],
                [40000, "40 с"],
                [0, "Без лимита"]
              ])}</div>`
            : ""
        }
        <div class="opt"><h3>Неверный ответ</h3>${seg("minus", [
          [true, "Снимает очки"],
          [false, "Без штрафа"]
        ])}</div>
        <div class="opt"><h3>Нажатие до конца вопроса</h3>${seg("early", [
          [true, "Блок на 0,5 с"],
          [false, "Без блока"]
        ])}</div>`
        }
        <div class="opt"><h3>Спецвопросы и финал</h3><div class="chips">
          ${
            QUIZ()
              ? ""
              : `<button data-tog="cat" aria-pressed="${CFG.cat}">Кот в мешке</button>
          <button data-tog="auction" aria-pressed="${CFG.auction}">Аукцион</button>`
          }
          <button data-tog="final" aria-pressed="${CFG.final}">Финал со ставками</button></div>${CFG.final && !PACK.final ? `<p>В этом паке нет финала.</p>` : ""}</div>
      </div>
      <div class="lobby">
        <div><span class="access-badge ${CFG.access === "public" ? "pub" : ""}" id="acc-badge">${accBadge()}</span></div>
        <div class="code"><div id="qr" class="qrbox" aria-label="QR-код для входа"></div><div><div class="k">Код комнаты</div><div class="v">${HOST.code}</div><button class="sb" data-act="copy-link" style="margin-top:6px">Скопировать ссылку</button> <button class="sb" data-act="copy-screen-link" style="margin-top:6px" title="Откройте её на телевизоре или проекторе: там будет табло без ответов и кнопок ведущего">Ссылка для экрана</button></div></div>
        <div class="k" style="font-size:13px;opacity:.75;word-break:break-all">${esc(joinURL(HOST.code))}</div>
        <div class="joined" id="lobby-players"></div>
        <button class="start" data-act="start" id="start-btn">Начать игру</button>
      </div>
    </div>`
  );
  updateLobby();
  drawQR(HOST.code);
}

// Плашка доступа: приватная или открытая комната.
function accBadge() {
  return CFG.access === "public"
    ? "Открытая · «" + esc(CFG.roomName || "Моя игра") + "» · до " + CFG.max
    : "Приватная · вход только по коду";
}

// Обновляет только список игроков и кнопку старта, не трогая поля ввода.
function updateLobby() {
  const box = document.getElementById("lobby-players");
  if (!box) return;
  const ids = order();
  box.innerHTML = ids.length
    ? ids
        .map(id => {
          const p = HOST.players[id],
            on = p.online !== false;
          return `<div><button class="pl-name hren" data-hrename="${id}" title="Переименовать"><i class="on-dot ${on ? "" : "off"}"></i>${esc(p.name)} <span>✎</span></button><button class="ed-x" data-kick="${id}" aria-label="Удалить игрока ${esc(p.name)}">×</button></div>`;
        })
        .join("")
    : `<div class="wait">Ждём игроков: пусть отсканируют QR или введут код</div>`;
  const btn = document.getElementById("start-btn"),
    errs = validate(PACK).some(x => x.lvl === "err");
  const n = online().length,
    all = ids.length;
  if (btn) {
    btn.disabled = errs;
    btn.textContent = all
      ? `Начать игру · ${all} ${plural(all, "игрок", "игрока", "игроков")}${n < all ? ` (на связи ${n})` : ""}`
      : "Начать без игроков";
  }
}

// Готовые картинки QR-кодов по ссылке, чтобы не рисовать заново при каждой перерисовке.
const QR_CACHE = {};

// Рисует QR-код ссылки на комнату в блок #qr (ведущий в лобби или общий экран).
function drawQR(code) {
  const box = document.getElementById("qr");
  if (!box) return;
  const url = joinURL(code);
  if (QR_CACHE[url]) {
    box.innerHTML = `<img src="${QR_CACHE[url]}" alt="">`;
    return;
  }
  loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js")
    .then(() => {
      const b = document.getElementById("qr");
      if (!b) return;
      b.innerHTML = "";
      new QRCode(b, {
        text: url,
        width: 180,
        height: 180,
        colorDark: "#121760",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      setTimeout(() => {
        const c = b.querySelector("canvas");
        if (c) QR_CACHE[url] = c.toDataURL();
      }, 50);
    })
    .catch(() => {
      box.innerHTML = `<div style="color:#121760;font-size:12px;padding:8px">QR не загрузился</div>`;
    });
}

// Заголовок над табло: раунд и сколько вопросов осталось.
function roundLabel(h) {
  if (["final-bet", "final-answer", "final-judge"].includes(h.phase)) return "Финал";
  if (h.phase === "end") return "Итоги";
  const r = PACK.rounds[h.round],
    total = r.themes.reduce((a, t) => a + t.questions.length, 0);
  return esc(r.name) + " · осталось " + (total - Object.keys(h.used).length);
}

// Картинка вопроса на экране ведущего.
function tvImg(c) {
  const src = imgSrc(c);
  return c.img || c.url
    ? src
      ? `<img class="qimg" src="${esc(src)}" alt="">`
      : `<div class="sub">Загружаем картинку…</div>`
    : "";
}

// Кнопки управления временем у ведущего.
function timeBtns() {
  const h = H();
  return `<button class="hb neutral" data-act="t-add10">+10 с</button><button class="hb neutral" data-act="t-add30">+30 с</button>${h.dl ? `<button class="hb neutral" data-act="t-stop">Без лимита</button>` : ""}`;
}

// Меню действий с игроком: передать ход, дать ответить, очки, имя, удалить.
function hostMenuHTML() {
  const id = S.menu,
    p = HOST && HOST.players[id];
  if (!p) return "";
  const h = H(),
    c = h.cur,
    cost = c ? c.cost : 100,
    inQ = c && ["reading", "open", "answer"].includes(h.phase) && !QUIZ();
  return `<div class="hmenu-bg" data-act="menu-close"></div><div class="hmenu" role="dialog" aria-label="Действия с игроком"><b>${esc(p.name)} · ${fmt(p.score || 0)}</b>
    ${h.phase !== "lobby" && h.chooser !== id ? `<button data-mact="chooser">Передать ход этому игроку</button>` : ""}
    ${inQ && h.responder !== id ? `<button data-mact="give">Дать ответить на вопрос</button>` : ""}
    <div class="hm-row"><button data-mact="plus">+${fmt(cost)}</button><button data-mact="minus">−${fmt(cost)}</button></div>
    <button data-mact="score">Изменить счёт…</button><button data-mact="rename">Переименовать…</button>
    <button data-mact="kick" class="danger">Удалить из комнаты</button><button data-act="menu-close" class="ghost2">Отмена</button></div>`;
}

// Экран игры у ведущего: карточки игроков, табло или вопрос, пульт снизу.
// Для каждой фазы задаются main (центр экрана) и host (пульт).
function renderHostGame() {
  const h = H(),
    c = h.cur,
    ids = order();
  const scores = ids
    .map(id => {
      const p = HOST.players[id],
        cls = ["pl"];
      let tag = "";
      if (h.phase === "board" && h.chooser === id) {
        cls.push("choose");
        tag = "выбирает";
      }
      if (h.responder === id && h.phase === "answer") {
        cls.push("resp");
        tag = "отвечает";
      }
      if (h.phase === "auction" && h.auc && h.auc.leader === id) {
        cls.push("choose");
        tag = "лидер";
      }
      return `<button class="${cls.join(" ")}" data-menu="${id}" title="Действия с игроком"><div class="nm"><span><i class="on-dot ${p.online !== false ? "" : "off"}"></i>${esc(p.name)}</span><em>${tag}</em></div><div class="sc ${(p.score || 0) < 0 ? "neg" : ""}">${fmt(p.score || 0)}</div></button>`;
    })
    .join("");
  let main = "",
    host = "";
  const ansLabel =
    c && c.choices
      ? (() => {
          const i = c.choices.findIndex(x => normA(x) === normA(c.answer));
          return (i >= 0 ? LET[i] + ") " : "") + c.answer;
        })()
      : c
        ? c.answer
        : "";
  const ansStrip = (active, extra) =>
    `<span class="lbl">Ответ</span><span class="ans">${esc(ansLabel)}</span><div class="btns">${extra || ""}<button class="hb ok" data-act="ok" ${active ? "" : "disabled"}>Верно</button><button class="hb bad" data-act="bad" ${active ? "" : "disabled"}>Неверно</button></div>`;
  switch (h.phase) {
    case "intro":
      main = introHTML(c, PACK.rounds[h.round] ? PACK.rounds[h.round].name : "");
      host = `<span class="lbl">Заставка</span><span class="ans" style="color:#fff;font-weight:600">Сейчас покажется вопрос</span><div class="btns"><button class="hb neutral" data-act="intro-skip">Показать вопрос</button></div>`;
      break;
    case "board": {
      const R = PACK.rounds[h.round],
        N = Math.max(1, ...R.themes.map(t => t.questions.length));
      main =
        `<div class="board" style="grid-template-columns:minmax(110px,1.6fr) repeat(${N},minmax(52px,1fr))">` +
        R.themes
          .map(
            (t, ti) =>
              `<div class="theme">${esc(t.name)}</div>` +
              Array.from({ length: N }, (_, qi) => {
                const q = t.questions[qi];
                if (!q) return `<button class="cell" disabled></button>`;
                const used = h.used[ti + "-" + qi];
                return `<button class="cell" ${used ? "disabled" : ""} data-pick="${ti}-${qi}" aria-label="${esc(t.name)} за ${q.cost}">${used ? "" : q.cost}</button>`;
              }).join("")
          )
          .join("") +
        `</div>`;
      const ch = h.chooser && HOST.players[h.chooser] ? pname(h.chooser) : "—";
      host = `<span class="lbl">Ход</span><span class="ans" style="color:#fff;font-weight:600">${picker() === "host" ? `${esc(ch)} называет вопрос, откройте его на табло` : `${esc(ch)} выбирает вопрос на телефоне (можно открыть и отсюда)`}</span><div class="btns"><select class="hsel" data-chooser aria-label="Кто ходит">${online()
        .map(
          x => `<option value="${x}" ${x === h.chooser ? "selected" : ""}>Ходит: ${esc(pname(x))}</option>`
        )
        .join(
          ""
        )}</select><button class="hb neutral" data-act="rand-turn">Случайно</button><button class="hb neutral" data-act="low-turn">Отстающему</button></div>`;
      break;
    }
    case "reading": {
      const el = Math.max(0, now() - h.readAt);
      main = `<div class="q"><div class="meta">${esc(c.theme)} · ${c.cost}</div>${tvImg(c)}<div class="text">${esc(c.text)}</div>${c.choices && h.phase !== "quiz" ? optsHTML(c.choices, null, null) : ""}<div class="sub">Прочитайте вопрос вслух, кнопки пока заблокированы</div><div class="bar read" style="animation-duration:${h.readMs}ms;animation-delay:-${el}ms"></div></div>`;
      host = ansStrip(false, `<button class="hb neutral" data-act="open-now">Открыть кнопки</button>`);
      break;
    }
    case "open": {
      const el = Math.max(0, now() - h.openAt);
      main = `<div class="q"><div class="meta">${esc(c.theme)} · ${c.cost}</div>${tvImg(c)}<div class="text">${esc(c.text)}</div>${c.choices && h.phase !== "quiz" ? optsHTML(c.choices, null, null) : ""}<div class="sub">${h.msg ? esc(h.msg) + ". " : ""}Кнопки открыты${h.dl ? "" : " · без лимита времени"}</div>${h.dl ? `<div class="bar" style="animation-duration:${h.dlTotal}ms;animation-delay:-${Math.max(0, h.dlTotal - (h.dl - now()))}ms"></div>` : ""}</div>`;
      host = ansStrip(false, timeBtns() + `<button class="hb neutral" data-act="nobody">Никто</button>`);
      break;
    }
    case "answer": {
      const how =
        c.sp === "cat"
          ? "Кот в мешке"
          : c.sp === "auction"
            ? "Аукцион"
            : c.sp === "norisk"
              ? "Вопрос без риска"
              : h.reaction != null
                ? `нажал первым за ${h.reaction.toFixed(2).replace(".", ",")} с`
                : "";
      main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div>${tvImg(c)}<div class="text">${esc(c.text)}</div>${c.choices && h.phase !== "quiz" ? optsHTML(c.choices, null, null) : ""}<div class="sub">Отвечает ${esc(pname(h.responder))}${how ? " · " + how : ""}</div></div>`;
      host = AUTO()
        ? `<span class="lbl">Автопроверка</span><span class="ans" style="color:#fff;font-weight:600">${esc(pname(h.responder))} отвечает на телефоне · ${esc(ansLabel)}</span><div class="btns">${timeBtns()}<button class="hb ok" data-act="ok">Засчитать</button><button class="hb bad" data-act="bad">Не засчитать</button></div>`
        : ansStrip(true);
      break;
    }
    case "quiz": {
      const z = h.quiz,
        el = Math.max(0, now() - z.start),
        n = Object.keys(z.picks).length;
      main = `<div class="q"><div class="meta">${esc(c.theme)} · ${c.cost}</div>${tvImg(c)}<div class="text">${esc(c.text)}</div>${c.choices && h.phase !== "quiz" ? optsHTML(c.choices, null, null) : ""}${optsHTML(z.opts, null, null)}<div class="sub">Ответили ${n} из ${online().length}${h.dl ? "" : " · без лимита времени"}</div>${h.dl ? `<div class="bar" style="animation-duration:${h.dlTotal}ms;animation-delay:-${Math.max(0, h.dlTotal - (h.dl - now()))}ms"></div>` : ""}</div>`;
      host = `<span class="lbl">Ответ</span><span class="ans">${esc(ansLabel)}</span><div class="btns">${timeBtns()}<button class="hb neutral" data-act="quiz-end">Показать ответ</button></div>`;
      break;
    }
    case "reveal":
      if (h.quiz && h.quiz.done) {
        const cnt = h.quiz.opts.map((_, i) => Object.values(h.quiz.picks).filter(p => p.i === i).length);
        main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div><div class="text">${esc(c.text)}</div>${optsHTML(h.quiz.opts, h.quiz.correct, null, cnt)}<div class="sub">${esc(h.msg)}</div></div>`;
      } else
        main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div><div class="big">${esc(c.answer)}</div><div class="sub">${esc(h.msg)}</div></div>`;
      host = `<span class="lbl">Пульт</span><span class="ans"></span><div class="btns"><button class="hb neutral" data-act="next">Дальше</button></div>`;
      break;
    case "cat":
      main = `<div class="q"><div class="big">Кот в мешке</div><div class="sub">${esc(pname(h.chooser))} отдаёт вопрос сопернику с телефона. Тема «${esc(c.theme)}», ${c.cost}. Отвечают без кнопки.</div></div>`;
      host = `<span class="lbl">Отдать за игрока</span><div class="btns" style="flex-wrap:wrap">${online()
        .filter(x => x !== h.chooser)
        .map(x => `<button class="hb neutral" data-catto="${x}">${esc(pname(x))}</button>`)
        .join("")}</div>`;
      break;
    case "auction": {
      const a = h.auc,
        turn = a.queue[0];
      main = `<div class="q"><div class="big">Аукцион</div><div class="meta" style="margin-top:12px">${esc(c.theme)} · ставка ${fmt(a.bid)} · лидер ${esc(pname(a.leader))}</div><div class="sub">${a.log.map(esc).join("<br>")}${turn ? `<br><b>Ход: ${esc(pname(turn))}</b>` : ""}</div></div>`;
      host = `<span class="lbl">Торги</span><span class="ans" style="color:#fff;font-weight:600">${turn ? "Ходит " + esc(pname(turn)) : ""}</span><div class="btns"><button class="hb neutral" data-act="auc-skip">Пас за игрока</button><button class="hb neutral" data-act="auc-end">Завершить торги</button></div>`;
      break;
    }
    case "final-bet":
      main = `<div class="q"><div class="meta">Финал</div><div class="big">${esc(PACK.final.theme)}</div><div class="sub">Игроки делают ставки на телефонах. Сделано: ${Object.keys(h.fin.bets).length} из ${h.fin.ids.length}</div></div>`;
      host = `<span class="lbl">Финал</span><span class="ans" style="color:#fff;font-weight:600">${h.fin.ids.map(esc2 => esc(pname(esc2))).join(", ")}</span><div class="btns"><button class="hb neutral" data-act="force-bets">Не ждать</button></div>`;
      break;
    case "final-answer":
      main = `<div class="q"><div class="meta">Финал · ${esc(PACK.final.theme)}</div><div class="text">${esc(PACK.final.text)}</div><div class="sub">Ответы пишут на телефонах. Получено: ${Object.keys(h.fin.answers).length} из ${h.fin.ids.length}</div></div>`;
      host = `<span class="lbl">Ответ</span><span class="ans">${esc(PACK.final.answer)}</span><div class="btns"><button class="hb neutral" data-act="force-answers">Не ждать</button></div>`;
      break;
    case "final-judge":
      main = `<div class="q"><div class="meta">Финал · ${esc(PACK.final.theme)}</div><div class="text">${esc(PACK.final.text)}</div><div class="sub">Проверьте ответы</div></div>`;
      host =
        `<div class="judge-list"><div><span class="lbl">Правильный ответ:</span> <b style="color:var(--gold)">${esc(PACK.final.answer)}</b></div>` +
        h.fin.ids
          .map(id => {
            const v = h.fin.verdict[id];
            return `<div class="judge-row"><span class="who">${esc(pname(id))}</span><span class="said">«${esc(h.fin.answers[id] || "—")}» · ставка ${fmt(h.fin.bets[id])}</span>${v == null ? `<button class="hb ok" data-fj="${id}:1">Верно</button><button class="hb bad" data-fj="${id}:0">Неверно</button>` : `<span class="done">${v ? "✓" : "✗"}</span>`}</div>`;
          })
          .join("") +
        `</div>`;
      break;
    case "end": {
      main = statsHTML(statsOut(), false);
      host = `<span class="lbl">Пульт</span><span class="ans"></span><div class="btns"><button class="hb neutral" data-act="lobby">Новая игра с теми же игроками</button></div>`;
      break;
    }
  }
  const qtools =
    c && ["intro", "reading", "open", "answer", "quiz", "cat", "auction"].includes(h.phase)
      ? `<div class="qtools"><button class="hb neutral" data-act="skip-q">Пропустить вопрос</button><button class="hb neutral" data-act="undo-q">Вернуть на табло</button><span class="lbl">Нажмите на игрока, чтобы дать ему ответить, передать ход или изменить очки</span></div>`
      : `<div class="qtools"><span class="lbl">Нажмите на игрока: ход, очки, имя</span></div>`;
  let skip = "";
  if (h.phase === "board")
    skip =
      h.round < PACK.rounds.length - 1
        ? "Следующий раунд"
        : CFG.final && PACK.final
          ? "К финалу"
          : "Завершить игру";
  document.getElementById("tv").innerHTML = `
    <div class="tv-head"><span class="tv-title">${roundLabel(h)} · комната ${HOST.code}</span><div style="display:flex;gap:8px;flex-wrap:wrap">${skip ? `<button class="ghost" data-act="skip">${skip}</button>` : ""}${PL ? `<button class="ghost" data-act="to-phone">Мой телефон</button>` : ""}<button class="ghost" data-act="lobby">В лобби</button><button class="ghost" data-act="close-room">Закрыть</button></div></div>
    <div class="scores" style="grid-template-columns:repeat(${Math.min(Math.max(ids.length, 1), 6)},1fr)">${scores || `<div class="pl">Игроков нет</div>`}</div>${main}<div class="host">${host}</div>${h.phase === "end" ? "" : qtools}${S.menu ? hostMenuHTML() : ""}`;
}

