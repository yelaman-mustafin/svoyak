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
function plImg(c) {
  if (!c) return "";
  if (c.url) return `<img class="pimg" src="${esc(c.url)}" alt="Картинка вопроса">`;
  if (c.img)
    return PL.media && PL.media.id === c.img
      ? `<img class="pimg" src="${esc(PL.media.data)}" alt="Картинка вопроса">`
      : `<div class="hint">Загружаем картинку…</div>`;
  if (c.hasImg) return `<div class="hint">🖼 Картинка на общем экране</div>`;
  return "";
}

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
    body = `<div class="status">Ведущий закрыл комнату</div><div class="hint">Спасибо за игру!</div><button class="pbtn" data-act="leave"><span>На главную</span><span></span></button>`;
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
      case "board":
        if (st.chooser === PL.pid && st.cfg.picker === "host")
          body = `<div class="status">Ваш выбор</div><div class="hint">Назовите тему и стоимость вслух, ведущий откроет вопрос.</div><div class="buzz-wrap"><button class="buzzer" disabled>Ваш ход</button></div>`;
        else if (st.chooser === PL.pid) {
          const BD = arr(st.board),
            N = Math.max(1, ...BD.map(t => arr(t.q).length));
          body =
            `<div class="status">Ваш выбор</div><div class="mini" style="grid-template-columns:repeat(${N},1fr)">` +
            BD.map(
              (t, ti) =>
                `<div class="t">${esc(t.n)}</div>` +
                Array.from({ length: N }, (_, qi) => {
                  const q = arr(t.q)[qi];
                  if (!q) return `<button disabled></button>`;
                  return `<button data-ppick="${ti}-${qi}" ${q.u ? "disabled" : ""} aria-label="${esc(t.n)} за ${q.c}">${q.u ? "" : q.c}</button>`;
                }).join("")
            ).join("") +
            `</div>`;
        } else
          body = `<div class="status">${esc(pn(st.chooser))} выбирает вопрос</div><div class="hint">${esc(st.roundName || "")}</div><div class="buzz-wrap"><button class="buzzer" disabled>Ждите</button></div>`;
        break;
      case "reading":
        body = `<div class="status">Ведущий читает вопрос</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}<div class="buzz-wrap"><button class="buzzer locked ${PL.early ? "early" : ""}" data-act="buzz">${PL.early ? "Рано!" : "Ждите"}</button><span class="kbd">${st.cfg.early ? "Раннее нажатие блокирует кнопку на 0,5 с" : "Кнопка откроется после вопроса"}</span></div>`;
        break;
      case "open": {
        if (tried[PL.pid])
          body = `<div class="status">Вы уже отвечали</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}<div class="buzz-wrap"><button class="buzzer" disabled>Ждите</button></div>`;
        else if (PL.pressedQn === st.qn)
          body = `<div class="status">Нажато!</div><div class="hint">Ведущий определяет, кто был первым…</div><div class="buzz-wrap"><button class="buzzer pressed" disabled style="background:radial-gradient(circle at 38% 32%,#FFD27A 0%,var(--gold) 55%,#A87A00 100%);box-shadow:0 2px 0 #A87A00">✓</button></div>`;
        else {
          const elp = Math.max(0, now() - st.openAt);
          body = `<div class="status">${st.msg ? esc(st.msg) : "Кнопки открыты"}</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}<div class="buzz-wrap"><button class="buzzer live" data-act="buzz">Жми!</button>${dlBar(st.dl, st.dlTotal)}</div>`;
        }
        break;
      }
      case "answer":
        if (st.responder === PL.pid && st.cfg.host === "auto") {
          const left = Math.max(0, st.ansDeadline - now());
          body = `<div class="status">Ваш ответ!</div><div class="hint">${c.sp === "norisk" ? "Вопрос без риска: за ошибку очки не снимаются. " : ""}${c.choices ? "Выберите вариант." : "Напишите ответ, небольшие опечатки не страшны."}</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices ? (PL.sent.pa === st.qn + ":" + st.ansDeadline ? `<div class="hint">Ответ отправлен</div>` : optsHTML(c.choices, null, null, null, "aopt")) : `<input class="field" id="pa" placeholder="Ваш ответ" autocomplete="off" maxlength="80" enterkeyhint="send"><button class="pbtn hot" data-act="pa" ${PL.sent.pa === st.qn + ":" + st.ansDeadline ? "disabled" : ""}><span>Ответить</span><span></span></button>`}${dlBar(st.dl, st.dlTotal)}`;
        } else if (st.responder === PL.pid)
          body = `<div class="status">Ваш ответ!</div><div class="hint">${c.sp === "norisk" ? "Вопрос без риска: за ошибку очки не снимаются. " : ""}Говорите вслух, ведущий засчитает.</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}<div class="buzz-wrap"><button class="buzzer pressed" disabled style="background:radial-gradient(circle at 38% 32%,#5FE0A8 0%,var(--ok) 55%,#0C6B46 100%);box-shadow:0 2px 0 #0C6B46">Вы!</button>${st.reaction != null ? `<div class="kbd">Время реакции ${Number(st.reaction).toFixed(2).replace(".", ",")} с</div>` : ""}</div>`;
        else
          body = `<div class="status">Отвечает ${esc(pn(st.responder))}${st.cfg.host === "auto" ? " (пишет ответ)" : ""}</div>${st.reaction != null ? `<div class="hint">Нажал за ${Number(st.reaction).toFixed(2).replace(".", ",")} с</div>` : ""}${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}`;
        break;
      case "quiz": {
        const z = st.quiz,
          done = (z.picked || {})[PL.pid],
          mine = PL.qpick && PL.qpick.id === z.id ? PL.qpick.i : null;
        body = `<div class="status">Выберите ответ</div>${qHead(st, c)}${plImg(c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${c.choices && st.phase !== "quiz" && !(st.phase === "answer" && st.responder === PL.pid && st.cfg.host === "auto") ? optsHTML(c.choices, null, null) : ""}${optsHTML(z.opts, null, mine, null, done ? null : "opt")}<div class="hint">${done ? "Ответ принят. Ждём остальных…" : "Выберите вариант"}</div>${dlBar(st.dl, st.dlTotal)}`;
        break;
      }
      case "reveal":
        if (st.quiz && st.quiz.done) {
          const mine = st.quiz.picks ? st.quiz.picks[PL.pid] : null,
            ok = mine != null && mine === st.quiz.correct;
          body = `<div class="status">${mine == null ? "Вы не ответили" : ok ? "Верно! +" + fmt(c.cost) : "Неверно"}</div>${qHead(st, c)}${c.text ? `<div class="card qtext">${esc(c.text)}</div>` : ""}${optsHTML(st.quiz.opts, st.quiz.correct, mine == null ? null : mine)}<div class="hint">${esc(st.msg)}</div>`;
        } else
          body = `<div class="status">${esc(st.msg)}</div>${qHead(st, c)}<div class="card"><div class="k">Правильный ответ</div><div class="v" style="font-size:22px">${esc(c.answer)}</div></div>`;
        break;
      case "cat":
        if (st.chooser === PL.pid)
          body =
            `<div class="status">Кот в мешке!</div>${qHead(st, c)}<div class="hint">Отдайте вопрос сопернику. Тема «${esc(c.theme)}», ${c.cost}. Он ответит без кнопки.</div><div class="choices">` +
            Object.entries(PL.players)
              .filter(([id, p]) => id !== PL.pid && p.online !== false)
              .map(
                ([id, p]) =>
                  `<button class="pbtn" data-catto="${id}"><span>${esc(p.name)}</span><span>${fmt(p.score)}</span></button>`
              )
              .join("") +
            `</div>`;
        else
          body = `<div class="status">${esc(pn(st.chooser))} выбирает, кому отдать кота в мешке</div><div class="hint">Возможно, вам.</div>`;
        break;
      case "auction": {
        const a = st.auc,
          aq = arr(a.queue),
          my = aq[0] === PL.pid,
          sc = me.score || 0;
        body = `<div class="status">Аукцион</div>${qHead(st, c)}<div class="card"><div class="k">Ставка · ${esc(pn(a.leader))}</div><div class="v">${fmt(a.bid)}</div></div>`;
        if (my) {
          const r = sc >= a.bid + 100,
            all = sc > a.bid;
          body += `<div class="hint">Ваш ход. У вас ${fmt(sc)}.</div><div class="choices"><button class="pbtn" data-pauc="raise" ${r ? "" : "disabled"}><span>Поднять</span><span>${fmt(a.bid + 100)}</span></button><button class="pbtn hot" data-pauc="all" ${all ? "" : "disabled"}><span>Ва-банк</span><span>${fmt(sc)}</span></button><button class="pbtn alt" data-pauc="pass"><span>Пас</span><span></span></button></div>`;
        } else body += `<div class="hint">${aq[0] ? "Ходит " + esc(pn(aq[0])) : "Торги закрыты"}</div>`;
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
  const rivals = Object.entries(PL.players)
    .filter(([id]) => id !== PL.pid)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
    .map(([id, p]) => {
      const act =
        st &&
        ((sp === "answer" && st.responder === id) ||
          (sp === "board" && st.chooser === id) ||
          (sp === "auction" && st.auc && arr(st.auc.queue)[0] === id));
      const lead = ranked[0] && ranked[0][0] === id && (p.score || 0) > 0;
      return `<div class="rv ${act ? "act" : ""} ${p.online === false ? "off" : ""}"><div class="n"><span>${esc(p.name)}</span>${lead ? "<i>1-й</i>" : ""}</div><div class="s ${(p.score || 0) < 0 ? "neg" : ""}">${fmt(p.score || 0)}</div></div>`;
    })
    .join("");
  const isOrg = HOST && HOST.code === PL.code;
  const banner = isOrg
    ? `<div class="orgbar"><span>Вы организатор</span><button data-act="to-board">Табло</button><button data-act="close-room">Закрыть комнату</button></div>`
    : PL.meta && PL.meta.hostOnline === false && !PL.meta.closed && st && st.phase !== "lobby"
      ? `<div class="banner">${st && st.cfg && st.cfg.host === "auto" ? "Организатор отключился. Ждём, когда он вернётся…" : "Ведущий отключился. Ждём, когда он вернётся…"}</div>`
      : "";
  preserve(
    el,
    `<div class="ph-top"><div class="me">Комната ${PL.code}${sp && sp !== "lobby" ? " · " + place + "-е место" : ""}<b>${esc(me.name)}</b></div><div class="sc">${fmt(me.score || 0)}</div></div>${banner}${rivals ? `<div class="ph-rivals">${rivals}</div>` : ""}<div class="ph-body">${body}${PL.kicked || (PL.meta && PL.meta.closed) || isOrg ? "" : `<button class="back" data-act="leave" style="margin-top:auto">Выйти из комнаты</button>`}</div>`
  );
  const bet = document.getElementById("bet");
  if (bet) {
    document.getElementById("betv").textContent = fmt(+bet.value);
    bet.oninput = () => {
      document.getElementById("betv").textContent = fmt(+bet.value);
    };
  }
}

