/* ======================================================================
   17. ЭКРАН ДЛЯ ЗРИТЕЛЕЙ
   Телевизор или проектор открывает ссылку ?screen=КОД (или «Большой экран»
   на главной) и показывает табло, вопрос, очки и итоги.
   Он ничего не нажимает и не считается игроком: только читает
   rooms/{код}/state — ту же безопасную часть игры, что видят телефоны,
   поэтому правильный ответ появляется только после того, как его открыли.
   О себе экран сообщает записью rooms/{код}/screens/{id}: по ней ведущий
   понимает, что картинки вопросов нужно отправлять и сюда.
   ====================================================================== */

// Путь внутри комнаты, которую показывает этот экран.
const sRef = p => ref(`rooms/${SCR.code}/${p}`);

// Подключает это устройство к комнате как общий экран.
async function joinScreen(code) {
  APP.busy = true;
  APP.joinErr = "";
  render();
  try {
    if (!/^\d{4}$/.test(code)) throw "Код состоит из 4 цифр";
    const m = (await ref(`rooms/${code}/meta`).once("value")).val();
    if (!m || m.closed) throw "Комната с таким кодом не найдена";
    SCR = { code, sid: uid(), state: null, players: {}, meta: m, media: null, smedia: null };
    // Отметка «экран открыт»: при обрыве связи сервер сам её удалит, при переподключении ставим снова.
    SCR.connCb = s => {
      if (s.val() === true && SCR) {
        const r = sRef(`screens/${SCR.sid}`);
        r.onDisconnect().remove();
        r.set(TS());
      }
    };
    ref(".info/connected").on("value", SCR.connCb);
    sRef("state").on("value", s => {
      SCR.state = s.val();
      render();
    });
    sRef("players").on("value", s => {
      SCR.players = Object.fromEntries(Object.entries(s.val() || {}).filter(([, p]) => p && p.name));
      render();
    });
    sRef("meta").on("value", s => {
      SCR.meta = s.val() || {};
      render();
    });
    ["media", "smedia"].forEach(k =>
      sRef(k).on("value", s => {
        SCR[k] = s.val();
        render();
      })
    );
    keepAwake();
    APP.mode = "screen";
    history.replaceState(null, "", location.pathname + "?screen=" + code);
  } catch (e) {
    console.error(e);
    APP.joinErr = typeof e === "string" ? e : "Не удалось подключиться. Проверьте интернет.";
  }
  APP.busy = false;
  render();
}

// Закрывает общий экран и возвращает на главную.
function leaveScreen() {
  if (SCR) {
    ref(".info/connected").off("value", SCR.connCb);
    ["state", "players", "meta", "media", "smedia"].forEach(k => sRef(k).off());
    const r = sRef(`screens/${SCR.sid}`);
    r.onDisconnect().cancel();
    r.remove();
  }
  SCR = null;
  history.replaceState(null, "", location.pathname);
  goHome();
}

// Картинка вопроса на общем экране: по ссылке или из media/smedia, которые прислал ведущий.
function scrImg(c) {
  if (!c) return "";
  if (c.url) return `<img class="qimg" src="${esc(c.url)}" alt="">`;
  const m = [SCR.media, SCR.smedia].find(x => x && c.img && x.id === c.img);
  if (m) return `<img class="qimg" src="${esc(m.data)}" alt="">`;
  return c.hasImg ? `<div class="sub">Загружаем картинку…</div>` : "";
}

// Полоска времени на кнопку или ответ, как у ведущего.
function scrBar(st) {
  if (!st.dl) return "";
  const total = Math.max(st.dlTotal || 1, 1),
    left = Math.max(0, st.dl - now());
  return `<div class="bar" style="animation-duration:${total}ms;animation-delay:-${Math.max(0, total - left)}ms"></div>`;
}

// Карточка вопроса: тема и стоимость, картинка, текст, варианты и строка состояния.
function scrQuestion(st, c, sub, extra) {
  return `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div>${scrImg(c)}<div class="text">${esc(c.text || "")}</div>${extra || ""}${sub ? `<div class="sub">${sub}</div>` : ""}${scrBar(st)}</div>`;
}

// Общий экран: очки игроков сверху, в центре то, что сейчас происходит в игре.
function renderScreen() {
  const tv = document.getElementById("tv");
  if (!SCR) return;
  const st = SCR.state,
    pn = id => (SCR.players[id] || {}).name || "Игрок",
    ids = Object.keys(SCR.players).sort((a, b) => (SCR.players[a].joined || 0) - (SCR.players[b].joined || 0));
  const head = `<div class="tv-head"><span class="tv-title">${st && st.roundName && st.phase !== "end" ? esc(st.roundName) + " · " : ""}комната ${SCR.code}</span><button class="ghost" data-act="screen-leave">Выйти</button></div>`;
  if (SCR.meta && SCR.meta.closed) {
    tv.innerHTML = head + `<div class="q"><div class="big">Игра окончена</div><div class="sub">Ведущий завершил игру. Спасибо, что играли!</div></div>`;
    return;
  }
  if (!st) {
    tv.innerHTML = head + `<div class="q"><div class="big">Подключаемся…</div></div>`;
    return;
  }
  const c = st.cur,
    ph = st.phase;
  const scores = ids
    .map(id => {
      const p = SCR.players[id],
        cls = ["pl"];
      let tag = "";
      if (ph === "board" && st.chooser === id) {
        cls.push("choose");
        tag = "выбирает";
      }
      if (ph === "answer" && st.responder === id) {
        cls.push("resp");
        tag = "отвечает";
      }
      if (ph === "auction" && st.auc && st.auc.leader === id) {
        cls.push("choose");
        tag = "лидер";
      }
      return `<div class="${cls.join(" ")}"><div class="nm"><span><i class="on-dot ${p.online !== false ? "" : "off"}"></i>${esc(p.name)}</span><em>${tag}</em></div><div class="sc ${(p.score || 0) < 0 ? "neg" : ""}">${fmt(p.score || 0)}</div></div>`;
    })
    .join("");
  let main = "";
  switch (ph) {
    case "lobby":
      main = `<div class="q scr-lobby"><div class="code"><div id="qr" class="qrbox" aria-label="QR-код для входа"></div><div><div class="k">Код комнаты</div><div class="v">${SCR.code}</div></div></div><div class="sub">Отсканируйте QR-код или откройте сайт и введите код. Игра скоро начнётся.</div><div class="scr-names">${ids.map(id => `<span>${esc(SCR.players[id].name)}</span>`).join("")}</div></div>`;
      break;
    case "board": {
      const BD = arr(st.board),
        N = Math.max(1, ...BD.map(t => arr(t.q).length));
      main =
        `<div class="board" style="grid-template-columns:minmax(110px,1.6fr) repeat(${N},minmax(52px,1fr))">` +
        BD.map(
          t =>
            `<div class="theme">${esc(t.n)}</div>` +
            Array.from({ length: N }, (_, qi) => {
              const q = arr(t.q)[qi];
              return `<div class="cell ${!q || q.u ? "used" : ""}">${q && !q.u ? q.c : ""}</div>`;
            }).join("")
        ).join("") +
        `</div>` +
        (st.chooser && SCR.players[st.chooser] ? `<div class="scr-turn">Выбирает ${esc(pn(st.chooser))}</div>` : "");
      break;
    }
    case "intro":
      main = introHTML(c, st.roundName);
      break;
    case "reading": {
      const el = Math.max(0, now() - st.readAt);
      main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div>${scrImg(c)}<div class="text">${esc(c.text || "")}</div>${c.choices ? optsHTML(c.choices, null, null) : ""}<div class="sub">Слушаем вопрос, кнопки скоро откроются</div><div class="bar read" style="animation-duration:${st.readMs}ms;animation-delay:-${el}ms"></div></div>`;
      break;
    }
    case "open":
      main = scrQuestion(st, c, (st.msg ? esc(st.msg) + ". " : "") + "Кнопки открыты!", c.choices ? optsHTML(c.choices, null, null) : "");
      break;
    case "answer": {
      const how =
        c.sp === "cat" ? "кот в мешке" : c.sp === "auction" ? "аукцион" : c.sp === "norisk" ? "вопрос без риска" : st.reaction != null ? "реакция " + Number(st.reaction).toFixed(2).replace(".", ",") + " с" : "";
      main = scrQuestion(st, c, `Отвечает ${esc(pn(st.responder))}${how ? " · " + how : ""}`, c.choices ? optsHTML(c.choices, null, null) : "");
      break;
    }
    case "quiz": {
      const z = st.quiz,
        n = Object.keys(z.picked || {}).length,
        all = ids.filter(id => SCR.players[id].online !== false).length;
      main = scrQuestion(st, c, `Ответили ${n} из ${all}`, optsHTML(z.opts, null, null));
      break;
    }
    case "reveal":
      if (st.quiz && st.quiz.done) {
        const picks = Object.values(st.quiz.picks || {}),
          cnt = arr(st.quiz.opts).map((_, i) => picks.filter(v => v === i).length);
        main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div><div class="text">${esc(c.text || "")}</div>${optsHTML(st.quiz.opts, st.quiz.correct, null, cnt)}<div class="sub">${esc(st.msg)}</div></div>`;
      } else
        main = `<div class="q"><div class="meta">${esc(c.theme)} · ${fmt(c.cost)}</div><div class="k scr-k">Правильный ответ</div><div class="big">${esc(c.answer || "")}</div><div class="sub">${esc(st.msg)}</div></div>`;
      break;
    case "cat":
      main = `<div class="q"><div class="big">Кот в мешке</div><div class="sub">${esc(pn(st.chooser))} отдаёт вопрос сопернику. Тема «${esc(c.theme)}», ${fmt(c.cost)}. Отвечают без кнопки.</div></div>`;
      break;
    case "auction": {
      const a = st.auc || {},
        turn = arr(a.queue)[0];
      main = `<div class="q"><div class="big">Аукцион</div><div class="meta" style="margin-top:12px">${esc(c.theme)} · ставка ${fmt(a.bid || 0)} · лидер ${esc(pn(a.leader))}</div><div class="sub">${arr(a.log).map(esc).join("<br>")}${turn ? `<br><b>Ход: ${esc(pn(turn))}</b>` : ""}</div></div>`;
      break;
    }
    case "final-bet": {
      const f = st.fin;
      main = `<div class="q"><div class="meta">Финал</div><div class="big">${esc(f.theme)}</div><div class="sub">Игроки делают ставки на телефонах: ${Object.keys(f.betDone || {}).length} из ${arr(f.ids).length}</div></div>`;
      break;
    }
    case "final-answer": {
      const f = st.fin;
      main = `<div class="q"><div class="meta">Финал · ${esc(f.theme)}</div><div class="text">${esc(f.text || "")}</div>${f.opts ? optsHTML(f.opts, null, null) : f.choices ? optsHTML(f.choices, null, null) : ""}<div class="sub">Ответы пишут на телефонах: ${Object.keys(f.ansDone || {}).length} из ${arr(f.ids).length}</div></div>`;
      break;
    }
    case "final-judge": {
      const f = st.fin,
        v = f.verdict || {};
      main = `<div class="q"><div class="meta">Финал · ${esc(f.theme)}</div><div class="text">${esc(f.text || "")}</div><div class="k scr-k">Правильный ответ</div><div class="big">${esc(f.answer || "")}</div><div class="sub">${arr(f.ids)
        .map(id => `${esc(pn(id))}: ${v[id] == null ? "проверяем…" : (v[id] ? "верно, +" : "неверно, −") + fmt((f.bets || {})[id] || 0)}`)
        .join("<br>")}</div></div>`;
      break;
    }
    case "end":
      main = statsHTML(st.stats, false);
      break;
  }
  tv.innerHTML = `${head}${ph === "lobby" || ph === "end" ? "" : `<div class="scores" style="grid-template-columns:repeat(${Math.min(Math.max(ids.length, 1), 6)},1fr)">${scores || `<div class="pl">Игроков нет</div>`}</div>`}${main}`;
  if (ph === "lobby") drawQR(SCR.code);
}
