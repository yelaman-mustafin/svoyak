/* ======================================================================
   16. ЭКРАН: ТЕЛЕФОН ИГРОКА
   Один большой switch по фазе игры: что показать и какие кнопки дать.
   ====================================================================== */

// Сводка правил комнаты на телефоне игрока в лобби.
function plSummary(st) {
  const c = st.cfg || {};
  return [
    ["Вопросы", esc((st.pack || {}).title)],
    ["Ведущий", esc(st.host)],
    ["Доступ", c.access === "public" ? "открытая" : "приватная"],
    ["Выбор вопросов", c.picker === "host" ? "ведущий" : "игрок"],
    ["На кнопку", c.window ? c.window / 1000 + " с" : "без лимита"],
    ["Ошибка", c.minus ? "минус очки" : "без штрафа"],
    ["Финал", c.final ? "есть" : "нет"],
    ["Картинки", c.phoneImg ? "на телефонах" : "на общем экране"]
  ]
    .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
    .join("");
}

// Плашка над вопросом на телефоне: раунд, тема, стоимость.
function qHead(st, c) {
  if (!c) return "";
  return `<div class="qhead"><span>${esc(st.roundName || "")}</span><b>${esc(c.theme)}</b><em>${fmt(c.cost)}</em></div>`;
}

// Картинка вопроса на телефоне (или подсказка, что она на общем экране).
// Если картинки на телефоны выключены, адрес мог прийти только ради общих экранов — не показываем.
function plImg(c, st) {
  if (!c) return "";
  if (st && st.cfg && !st.cfg.phoneImg) return c.hasImg ? `<div class="hint">🖼 Картинка на общем экране</div>` : "";
  if (c.url) return `<img class="pimg" src="${esc(c.url)}" alt="Картинка вопроса">`;
  if (c.img)
    return PL.media && PL.media.id === c.img
      ? `<img class="pimg" src="${esc(PL.media.data)}" alt="Картинка вопроса">`
      : `<div class="hint">Загружаем картинку…</div>`;
  if (c.hasImg) return `<div class="hint">🖼 Картинка на общем экране</div>`;
  return "";
}

// Вопрос на телефоне: шапка, картинка, текст и варианты (если их не нужно нажимать).
// Лежит в прокручиваемой зоне, чтобы кнопка под ней всегда оставалась на экране.
function qZone(st, c, noChoices, top) {
  return `<div class="qzone">${top || ""}${qHead(st, c)}${plImg(c, st)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && !noChoices ? optsHTML(c.choices, null, null) : ""}</div>`;
}

// Строка состояния на телефоне: коротко и в одну строку.
// kind: go — пора действовать, ok — удача, bad — ошибка, пусто — просто ждём.
function pline(text, kind) {
  return `<div class="pline ${kind || ""}">${text}</div>`;
}

// Табло раунда на телефоне. clickable — ход этого игрока, вопрос можно выбрать.
function miniBoard(st, clickable) {
  const BD = arr(st.board),
    N = Math.max(1, ...BD.map(t => arr(t.q).length));
  return (
    `<div class="mini" style="grid-template-columns:repeat(${N},1fr)">` +
    BD.map(
      (t, ti) =>
        `<div class="t">${esc(t.n)}</div>` +
        Array.from({ length: N }, (_, qi) => {
          const q = arr(t.q)[qi];
          if (!q || q.u || !clickable) return `<button disabled>${q && !q.u ? q.c : ""}</button>`;
          return `<button data-ppick="${ti}-${qi}" aria-label="${esc(t.n)} за ${q.c}">${q.c}</button>`;
        }).join("")
    ).join("") +
    `</div>`
  );
}

// Правильный ответ в цветах игры. Если у вопроса были варианты, верный ещё и подсвечивается.
function ansCard(c) {
  const i = c.choices ? arr(c.choices).findIndex(x => normA(x) === normA(c.answer)) : -1;
  return `<div class="ans-card"><div class="k">Правильный ответ</div><div class="v">${esc(c.answer || "")}</div></div>${i >= 0 ? optsHTML(c.choices, i, null) : ""}`;
}

// Все игроки с очками сверху телефона, порядок постоянный (по времени входа).
// Подсвечивает, кто отвечает или выбирает, кто уже ошибся и сколько очков
// каждый получил или потерял на текущем вопросе.
function playersBar(st) {
  const ids = Object.keys(PL.players).sort((a, b) => (PL.players[a].joined || 0) - (PL.players[b].joined || 0));
  if (!ids.length) return "";
  const sp = st ? st.phase : "",
    inQ = ["reading", "open", "answer", "quiz", "reveal", "cat", "auction"].includes(sp),
    tried = (st && st.tried) || {},
    delta = (st && st.delta) || {},
    best = Math.max(...ids.map(id => PL.players[id].score || 0));
  const chips = ids
    .map(id => {
      const p = PL.players[id],
        cls = ["pc"],
        d = inQ ? delta[id] : undefined;
      let tag = "";
      if (id === PL.pid) cls.push("me");
      if (p.online === false) cls.push("off");
      if (sp === "answer" && st.responder === id) {
        cls.push("resp");
        tag = "отвечает";
      } else if ((sp === "board" || sp === "cat") && st.chooser === id) {
        cls.push("act");
        tag = sp === "cat" ? "отдаёт кота" : "выбирает";
      } else if (sp === "auction" && st.auc && arr(st.auc.queue)[0] === id) {
        cls.push("act");
        tag = "ходит";
      } else if (sp === "quiz" && st.quiz && (st.quiz.picked || {})[id]) tag = "ответ есть";
      if (d > 0) {
        cls.push("win");
        tag = `<b class="plus">+${fmt(d)}</b>`;
      } else if (inQ && (tried[id] || d < 0 || d === 0)) {
        cls.push("out");
        tag = d < 0 ? `<b class="minus">−${fmt(-d)}</b>` : "мимо";
      }
      const crown = best > 0 && (p.score || 0) === best ? "👑 " : "";
      return `<div class="${cls.join(" ")}"><div class="pn"><i class="on-dot ${p.online === false ? "off" : ""}"></i>${crown}${esc(p.name)}</div><div class="ps ${(p.score || 0) < 0 ? "neg" : ""}">${fmt(p.score || 0)}</div><div class="pt">${tag || "&nbsp;"}</div></div>`;
    })
    .join("");
  return `<div class="pbar" style="grid-template-columns:repeat(${Math.min(ids.length, 4)},minmax(0,1fr))">${chips}</div>`;
}

// Фазы вопроса: экран телефона делится на вопрос сверху и кнопку снизу без общей прокрутки.
const Q_PHASES = ["reading", "open", "answer", "quiz"];

// Телефон игрока. Сверху имя, счёт и соперники, ниже экран текущей фазы.
function renderPlayer() {
  const el = document.getElementById("phone");
  if (!PL) return;
  const st = PL.state,
    me = PL.players[PL.pid] || { name: PL.name, score: 0 },
    pn = id => (PL.players[id] || {}).name || "Игрок";
  let body = "";
  if (PL.kicked)
    body = `<div class="status">Ведущий удалил вас из комнаты</div><button class="pbtn" data-act="leave"><span>На главную</span><span></span></button>`;
  else if (PL.meta && PL.meta.closed)
    body = `<div class="status">Ведущий завершил игру</div><div class="hint">Спасибо за игру!</div><button class="pbtn" data-act="leave"><span>На главную</span><span></span></button>`;
  else if (!st)
    body = `<div class="status">Игра создаётся…</div><div class="hint">${PL.meta && PL.meta.hostOnline === false ? "Ведущий ещё не вошёл в комнату." : "Ведущий готовит комнату, подождите немного."}</div>`;
  else {
    const c = st.cur,
      tried = st.tried || {};
    switch (st.phase) {
      case "lobby":
        {
          const hostAway = PL.meta && PL.meta.hostOnline === false,
            auto = st.cfg && st.cfg.host === "auto";
          body = `<div class="status">${hostAway ? (auto ? "Организатор ещё не вошёл" : "Ведущий ещё не вошёл") : "Игра создаётся"}</div><div class="hint">${hostAway ? "Как только он вернётся, игра продолжится. Ничего нажимать не нужно." : auto ? "Организатор настраивает игру и нажмёт «Начать», когда все соберутся." : "Ведущий выбирает вопросы и правила. Игра начнётся, когда он нажмёт «Начать»."}</div><div class="card summary">${plSummary(st)}</div>`;
        }
        break;
      case "board": {
        const mine = st.chooser === PL.pid,
          byPhone = mine && st.cfg.picker !== "host";
        body =
          pline(
            mine
              ? byPhone
                ? "Ваш ход: выберите вопрос"
                : "Ваш ход: назовите тему и стоимость вслух"
              : st.chooser && PL.players[st.chooser]
                ? `Выбирает ${esc(pn(st.chooser))}`
                : "Ждём выбора вопроса",
            mine ? "go" : ""
          ) + miniBoard(st, byPhone);
        break;
      }
      case "intro":
        body = `<div class="intro-ph"><div class="k">${esc(st.roundName || "")}</div><div class="intro-theme">${esc(c.theme)}</div><div class="intro-cost">${fmt(c.cost)}</div>${c.sp === "norisk" ? `<div class="hint">Вопрос без риска${st.responder === PL.pid ? ": отвечаете вы" : ""}</div>` : ""}</div>`;
        break;
      case "reading":
        body = `${pline(PL.early ? "Рано! Кнопка откроется после вопроса" : "Читаем вопрос…", PL.early ? "bad" : "")}${qZone(st, c)}<div class="buzz-wrap"><button class="buzzer locked ${PL.early ? "early" : ""}" data-act="buzz">${PL.early ? "Рано!" : "Ждите"}</button></div>`;
        break;
      case "open":
        if (tried[PL.pid])
          body = `${pline("Вы уже отвечали на этот вопрос", "bad")}${qZone(st, c)}<div class="buzz-wrap"><button class="buzzer" disabled>Ждите</button></div>`;
        else if (PL.pressedQn === st.qn)
          body = `${pline("Нажато! Определяем, кто был первым…", "ok")}${qZone(st, c)}<div class="buzz-wrap"><button class="buzzer pressed" disabled style="background:radial-gradient(circle at 38% 32%,#FFD27A 0%,var(--gold) 55%,#A87A00 100%);box-shadow:0 2px 0 #A87A00">✓</button></div>`;
        else
          body = `${pline(st.msg ? esc(st.msg) + " · жмите!" : "Кнопки открыты — жмите!", "go")}${qZone(st, c)}<div class="buzz-wrap"><button class="buzzer live" data-act="buzz">Жми!</button>${dlBar(st.dl, st.dlTotal)}</div>`;
        break;
      case "answer": {
        const react = st.reaction != null ? " · " + Number(st.reaction).toFixed(2).replace(".", ",") + " с" : "",
          norisk = c.sp === "norisk" ? "Без риска · " : "";
        if (st.responder === PL.pid && st.cfg.host === "auto")
          body = `${pline(norisk + (c.choices ? "Ваш ответ! Выберите вариант" : "Ваш ответ! Напишите его, опечатки не страшны"), "go")}${qZone(st, c, true)}<div class="qbottom">${c.choices ? (PL.sent.pa === st.qn + ":" + st.ansDeadline ? `<div class="hint">Ответ отправлен</div>` : optsHTML(c.choices, null, null, null, "aopt")) : `<input class="field" id="pa" placeholder="Ваш ответ" autocomplete="off" maxlength="80" enterkeyhint="send"><button class="pbtn hot" data-act="pa" ${PL.sent.pa === st.qn + ":" + st.ansDeadline ? "disabled" : ""}><span>Ответить</span><span></span></button>`}${dlBar(st.dl, st.dlTotal)}</div>`;
        else if (st.responder === PL.pid) body = `${pline(norisk + "Ваш ответ! Говорите вслух" + react, "ok")}${qZone(st, c)}`;
        else body = `${pline(`Отвечает ${esc(pn(st.responder))}${st.cfg.host === "auto" ? " (пишет ответ)" : ""}${react}`)}${qZone(st, c)}`;
        break;
      }
      case "quiz": {
        const z = st.quiz,
          done = (z.picked || {})[PL.pid],
          mine = PL.qpick && PL.qpick.id === z.id ? PL.qpick.i : null;
        body = `${pline(done ? "Ответ принят, ждём остальных…" : "Выберите вариант", done ? "ok" : "go")}${qZone(st, c, true)}<div class="qbottom">${optsHTML(z.opts, null, mine, null, done ? null : "opt")}${dlBar(st.dl, st.dlTotal)}</div>`;
        break;
      }
      case "reveal":
        if (st.quiz && st.quiz.done) {
          const mine = st.quiz.picks ? st.quiz.picks[PL.pid] : null,
            ok = mine != null && mine === st.quiz.correct;
          body = `${pline(mine == null ? "Вы не ответили" : ok ? "Верно! +" + fmt(c.cost) : "Неверно", ok ? "ok" : mine == null ? "" : "bad")}${qHead(st, c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${optsHTML(st.quiz.opts, st.quiz.correct, mine == null ? null : mine)}<div class="hint">${esc(st.msg)}</div>`;
        } else body = `${pline(esc(st.msg), st.msgOk === true ? "ok" : st.msgOk === false ? "bad" : "")}${qHead(st, c)}${ansCard(c)}`;
        break;
      case "cat":
        if (st.chooser === PL.pid)
          body =
            `${pline("Кот в мешке! Отдайте вопрос сопернику", "go")}${qHead(st, c)}<div class="hint">Он ответит без кнопки.</div><div class="choices">` +
            Object.entries(PL.players)
              .filter(([id, p]) => id !== PL.pid && p.online !== false)
              .map(
                ([id, p]) =>
                  `<button class="pbtn" data-catto="${id}"><span>${esc(p.name)}</span><span>${fmt(p.score)}</span></button>`
              )
              .join("") +
            `</div>`;
        else body = `${pline(`Кот в мешке: ${esc(pn(st.chooser))} выбирает, кому отдать. Возможно, вам`)}${qHead(st, c)}`;
        break;
      case "auction": {
        const a = st.auc,
          aq = arr(a.queue),
          my = aq[0] === PL.pid,
          sc = me.score || 0;
        body = `${pline(my ? "Аукцион: ваш ход" : aq[0] ? "Аукцион: ходит " + esc(pn(aq[0])) : "Аукцион: торги закрыты", my ? "go" : "")}${qHead(st, c)}<div class="card"><div class="k">Ставка · ${esc(pn(a.leader))}</div><div class="v">${fmt(a.bid)}</div></div>`;
        if (my) {
          const r = sc >= a.bid + 100,
            all = sc > a.bid;
          body += `<div class="hint">У вас ${fmt(sc)}.</div><div class="choices"><button class="pbtn" data-pauc="raise" ${r ? "" : "disabled"}><span>Поднять</span><span>${fmt(a.bid + 100)}</span></button><button class="pbtn hot" data-pauc="all" ${all ? "" : "disabled"}><span>Ва-банк</span><span>${fmt(sc)}</span></button><button class="pbtn alt" data-pauc="pass"><span>Пас</span><span></span></button></div>`;
        }
        break;
      }
      case "final-bet": {
        const f = st.fin;
        if (!arr(f.ids).includes(PL.pid))
          body = `<div class="status">Вы не прошли в финал</div><div class="hint">В финал проходят игроки с положительным счётом.</div>`;
        else if ((f.betDone || {})[PL.pid] || PL.sent.bet)
          body = `<div class="status">Ставка принята</div><div class="hint">Ждём остальных.</div>`;
        else {
          const mx = Math.max(1, me.score || 0),
            v = Math.min(100, mx);
          body = `<div class="status">Финал: «${esc(f.theme)}»</div><div class="hint">Сделайте ставку. Соперники её не увидят.</div><div class="card"><div class="k">Ставка</div><div class="v" id="betv">${fmt(v)}</div></div><input type="range" id="bet" data-keep="1" min="1" max="${mx}" step="1" value="${v}" aria-label="Ставка"><button class="pbtn hot" data-act="bet"><span>Поставить</span><span></span></button>`;
        }
        break;
      }
      case "final-answer": {
        const f = st.fin;
        if (!arr(f.ids).includes(PL.pid))
          body = `<div class="status">Идёт финал</div><div class="card qtext">${esc(f.text)}</div>`;
        else if ((f.ansDone || {})[PL.pid] || PL.sent.fa)
          body = `<div class="status">Ответ отправлен</div><div class="card qtext">${esc(f.text)}</div>`;
        else if (!f.opts && f.choices)
          body = `<div class="status">Финал: «${esc(f.theme)}»</div><div class="card qtext">${esc(f.text)}</div>${optsHTML(f.choices, null, null, null, "fcho")}`;
        else if (f.opts)
          body = `<div class="status">Финал: «${esc(f.theme)}»</div><div class="card qtext">${esc(f.text)}</div>${optsHTML(f.opts, null, null, null, "fopt")}`;
        else
          body = `<div class="status">Финал: «${esc(f.theme)}»</div><div class="card qtext">${esc(f.text)}</div><input class="field" id="fa" placeholder="Ваш ответ" autocomplete="off" maxlength="120"><button class="pbtn hot" data-act="fa"><span>Отправить ответ</span><span></span></button>`;
        break;
      }
      case "final-judge": {
        const f = st.fin,
          v = (f.verdict || {})[PL.pid];
        body =
          `<div class="status">${st.cfg.host === "auto" || st.cfg.format === "quiz" ? "Проверяем ответы…" : "Ведущий проверяет ответы"}</div><div class="card"><div class="k">Правильный ответ</div><div class="v" style="font-size:22px">${esc(f.answer)}</div></div>` +
          (v != null && f.bets
            ? `<span class="pill ${v ? "ok" : "bad"}">${v ? "Верно, +" : "Неверно, −"}${fmt(f.bets[PL.pid])}</span>`
            : "");
        break;
      }
      case "end": {
        body =
          statsHTML(st.stats, true, (PL.players[PL.pid] || {}).name) +
          (HOST
            ? `<button class="pbtn" data-act="lobby"><span>Новая игра с теми же игроками</span><span></span></button>`
            : `<div class="hint">Организатор может начать новую игру в этой же комнате.</div>`);
        break;
      }
    }
  }
  const ranked = Object.entries(PL.players).sort((a, b) => (b[1].score || 0) - (a[1].score || 0)),
    place = ranked.findIndex(e => e[0] === PL.pid) + 1;
  const sp = st ? st.phase : "";
  const isOrg = HOST && HOST.code === PL.code;
  const banner = isOrg
    ? `<div class="orgbar"><span>Вы организатор</span><button data-act="to-board">Табло</button><button data-act="close-room">Завершить игру</button></div>`
    : PL.meta && PL.meta.hostOnline === false && !PL.meta.closed && st && st.phase !== "lobby"
      ? `<div class="banner">${st && st.cfg && st.cfg.host === "auto" ? "Организатор отключился. Ждём, когда он вернётся…" : "Ведущий отключился. Ждём, когда он вернётся…"}</div>`
      : "";
  const qmode = !!(st && Q_PHASES.includes(sp) && !PL.kicked && !(PL.meta && PL.meta.closed));
  el.classList.toggle("qmode", qmode);
  preserve(
    el,
    `<div class="ph-top"><span>Комната ${PL.code}${st && st.roundName && sp !== "lobby" ? " · " + esc(st.roundName) : ""}</span><span>${sp && sp !== "lobby" && place ? place + "-е место" : ""}</span></div>${banner}${PL.kicked || (PL.meta && PL.meta.closed) ? "" : playersBar(st)}<div class="ph-body">${body}${PL.kicked || (PL.meta && PL.meta.closed) || isOrg || qmode ? "" : `<button class="back" data-act="leave" style="margin-top:auto">Выйти из комнаты</button>`}</div>`
  );
  const bet = document.getElementById("bet");
  if (bet) {
    document.getElementById("betv").textContent = fmt(+bet.value);
    bet.oninput = () => {
      document.getElementById("betv").textContent = fmt(+bet.value);
    };
  }
}

