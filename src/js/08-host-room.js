/* ======================================================================
   8. ВЕДУЩИЙ: КОМНАТА И СИНХРОНИЗАЦИЯ
   Устройство ведущего — главное: оно хранит полное состояние игры (H),
   публикует в базу только то, что можно видеть игрокам (pushState),
   и обрабатывает действия игроков из rooms/{код}/input (onInput).
   ====================================================================== */

// Путь внутри комнаты, которую ведёт это устройство.
const hRef = p => ref(`rooms/${HOST.code}/${p}`);

// Полное состояние игры у ведущего, включая правильные ответы.
const H = () => HOST.H;

// Имя ведущего для игроков.
const hostName = () => ME_NAME.trim() || "Ведущий";

// id игроков в порядке входа в комнату.
function order() {
  return Object.entries(HOST.players)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
    .map(e => e[0]);
}

// id игроков, которые сейчас на связи (зелёный индикатор).
function online() {
  return order().filter(id => HOST.players[id].online !== false);
}

// Имя игрока по id.
function pname(id) {
  return (HOST.players[id] || {}).name || "Игрок";
}

// Добавляет очки игроку (можно отрицательные) и сразу пишет в базу.
function addScore(id, d) {
  const p = HOST.players[id];
  if (!p) return;
  p.score = (p.score || 0) + d;
  hRef(`players/${id}/score`).set(p.score);
}

// Создаёт комнату со свободным 4-значным кодом и подключает ведущего.
async function createRoom() {
  APP.busy = true;
  render();
  try {
    let code;
    for (let i = 0; i < 15; i++) {
      code = String(1000 + Math.floor(Math.random() * 9000));
      const m = (await ref(`rooms/${code}/meta`).once("value")).val();
      if (!m || m.closed) break;
    }
    await ref(`rooms/${code}`).set({
      meta: {
        created: TS(),
        hostOnline: true,
        closed: false,
        name: CFG.roomName || "Моя игра",
        access: CFG.access,
        max: CFG.max,
        host: hostName()
      }
    });
    HOST = { code, players: {}, seen: {}, H: { phase: "lobby", round: 0, used: {}, qn: 0 } };
    attachHost();
    APP.mode = "host";
    S.view = "setup";
    pushState();
    syncSelf();
  } catch (e) {
    console.error(e);
    alert("Не удалось создать комнату. Проверьте интернет и настройки базы.");
  }
  APP.busy = false;
  render();
}

// Подписывает ведущего на игроков и их действия, включает метку «ведущий в сети».
function attachHost() {
  HOST.connCb = presence(hRef("meta/hostOnline"));
  hRef("players").on("value", s => {
    HOST.players = Object.fromEntries(Object.entries(s.val() || {}).filter(([k, p]) => p && p.name));
    onPlayers();
  });
  hRef("input").on("child_added", s => onInput(s.key, s.val()));
  hRef("input").on("child_changed", s => onInput(s.key, s.val()));
}

// Отписывает ведущего от комнаты и останавливает таймеры.
function detachHost() {
  if (!HOST) return;
  if (HOST.connCb) ref(".info/connected").off("value", HOST.connCb);
  hRef("meta/hostOnline").onDisconnect().cancel();
  hRef("players").off();
  hRef("input").off();
  if (HOST.buzzRef) HOST.buzzRef.off();
  clearTimers();
}

// Возвращает ведущего в комнату после перезагрузки страницы (состояние берётся из localStorage).
async function resumeHost(saved) {
  APP.busy = true;
  render();
  try {
    const m = (await ref(`rooms/${saved.code}/meta`).once("value")).val();
    if (!m || m.closed) {
      save("svoya.hosting", null);
      alert("Эта комната уже закрыта.");
      APP.busy = false;
      render();
      return;
    }
    HOST = { code: saved.code, players: {}, seen: {}, H: saved.H };
    PACK_ID = saved.packId;
    PACK = clone(findPack(PACK_ID));
    attachHost();
    APP.mode = "host";
    S.view = "setup";
    if (HOST.H.phase === "intro") introDone();
    else if (["reading", "open"].includes(HOST.H.phase)) openBuzz();
    else pushState();
    if (AUTO()) {
      await joinRoom(HOST.code, hostName(), { silent: true });
      if (HOST.H.phase !== "lobby") APP.mode = "player";
    }
  } catch (e) {
    alert("Не удалось подключиться");
  }
  APP.busy = false;
  render();
}

// Закрывает комнату: игроки видят «Ведущий закрыл комнату», карточка пропадает из списка.
function closeRoom() {
  if (!HOST) return;
  if (!confirm("Закрыть комнату? Игроки увидят, что игра завершена.")) return;
  hRef("meta").update({ closed: true, hostOnline: false });
  ref(`public/${HOST.code}`).remove();
  detachHost();
  dropSelf(false);
  HOST = null;
  save("svoya.hosting", null);
  goHome();
}

// Сохраняет состояние игры ведущего локально, чтобы можно было вернуться после перезагрузки.
function saveHosting() {
  if (HOST) save("svoya.hosting", { code: HOST.code, H: HOST.H, packId: PACK_ID });
}

// Публикует или убирает карточку комнаты в «Открытых играх» в зависимости от доступа.
function syncPublic() {
  if (!HOST) return;
  const r = ref(`public/${HOST.code}`);
  if (CFG.access === "public" && H().phase !== "end") {
    r.set({
      name: CFG.roomName || "Моя игра",
      host: hostName(),
      pack: PACK.title,
      count: online().length,
      max: CFG.max,
      status: H().phase === "lobby" ? "wait" : "play",
      ts: TS()
    });
    r.onDisconnect().remove();
  } else r.remove();
}

// Обновляет название, доступ и лимит игроков комнаты.
function syncMeta() {
  if (HOST)
    hRef("meta").update({
      name: CFG.roomName || "Моя игра",
      access: CFG.access,
      max: CFG.max,
      host: hostName()
    });
}

// Табло текущего раунда для игроков: темы, стоимости и какие вопросы уже сыграны (без текстов).
function boardOf() {
  const h = H(),
    r = PACK.rounds[h.round];
  if (!r) return null;
  return r.themes.map((t, ti) => ({
    n: t.name,
    q: t.questions.map((q, qi) => ({ c: q.cost, u: !!h.used[ti + "-" + qi] }))
  }));
}

// Главная функция синхронизации: собирает из H всё, что можно показать игрокам,
// и пишет в rooms/{код}/state. Правильный ответ попадает туда только на фазе reveal,
// ставки и ответы финала — только после проверки. После записи перерисовывает экран ведущего.
function pushState() {
  if (!HOST) return;
  const h = H(),
    f = h.fin,
    ph = h.phase;
  const st = {
    phase: ph,
    qn: h.qn || 0,
    round: h.round || 0,
    roundName: ph !== "lobby" && PACK.rounds[h.round] ? PACK.rounds[h.round].name : "",
    board: ph === "lobby" ? null : boardOf(),
    chooser: h.chooser || null,
    cur: h.cur
      ? {
          theme: h.cur.theme,
          cost: h.cur.cost,
          text: ph === "intro" ? null : h.cur.text,
          sp: h.cur.sp,
          choices: ph === "intro" ? null : h.cur.choices || null,
          answer: ph === "reveal" ? h.cur.answer : null,
          hasImg: !!(h.cur.img || h.cur.url),
          img: CFG.phoneImg && h.cur.img ? h.cur.img : null,
          url: CFG.phoneImg && h.cur.url ? h.cur.url : null
        }
      : null,
    responder: h.responder || null,
    tried: h.tried || {},
    openAt: h.openAt || 0,
    readMs: h.readMs || 0,
    readAt: h.readAt || 0,
    reaction: h.reaction == null ? null : h.reaction,
    msg: h.msg || "",
    msgOk: h.msgOk == null ? null : h.msgOk,
    auc: h.auc || null,
    ansDeadline: ph === "answer" ? h.ansDeadline || 0 : 0,
    dl: ["open", "quiz", "answer"].includes(ph) ? h.dl || 0 : 0,
    dlTotal: h.dlTotal || 0,
    quiz: h.quiz
      ? {
          id: h.quiz.id,
          opts: h.quiz.opts,
          deadline: h.quiz.deadline,
          done: !!h.quiz.done,
          correct: h.quiz.done ? h.quiz.correct : null,
          picked: Object.fromEntries(Object.keys(h.quiz.picks).map(k => [k, true])),
          picks: h.quiz.done
            ? Object.fromEntries(Object.entries(h.quiz.picks).map(([k, v]) => [k, v.i]))
            : null
        }
      : null,
    stats: ph === "end" ? statsOut() : null,
    fin: f
      ? {
          opts: f.opts || null,
          choices:
            ["final-answer", "final-judge", "end"].includes(ph) && !f.opts && PACK.final.choices
              ? PACK.final.choices
              : null,
          theme: PACK.final.theme,
          ids: f.ids,
          text: ["final-answer", "final-judge", "end"].includes(ph) ? PACK.final.text : null,
          answer: ["final-judge", "end"].includes(ph) ? PACK.final.answer : null,
          betDone: Object.fromEntries(Object.keys(f.bets).map(k => [k, true])),
          ansDone: Object.fromEntries(Object.keys(f.answers).map(k => [k, true])),
          bets: ["final-judge", "end"].includes(ph) ? f.bets : null,
          answers: ["final-judge", "end"].includes(ph) ? f.answers : null,
          verdict: f.verdict
        }
      : null,
    cfg: {
      phoneImg: !!CFG.phoneImg,
      host: CFG.host,
      format: CFG.format,
      ansTime: CFG.ansTime,
      picker: picker(),
      window: CFG.window,
      minus: CFG.minus,
      early: CFG.early,
      cat: CFG.cat,
      auction: CFG.auction,
      final: !!(CFG.final && PACK.final),
      access: CFG.access
    },
    pack: { title: PACK.title, stats: stats(PACK) },
    host: hostName(),
    ts: TS()
  };
  hRef("state").set(JSON.parse(JSON.stringify(st)));
  saveHosting();
  syncPublic();
  render();
}

// Реакция ведущего на изменение списка игроков (вход, выход, связь, очки).
function onPlayers() {
  if (!HOST) return;
  syncPublic();
  const h = H();
  if (h.phase === "final-bet" || h.phase === "final-answer") {
    /* ignore */
  }
  if (APP.mode !== "host" || S.view === "library" || S.view === "editor") return;
  if (h.phase === "lobby") updateLobby();
  else render();
}

// Обрабатывает действие игрока из rooms/{код}/input.
// Каждое действие проверяется: подходит ли фаза и имеет ли этот игрок право на него.
// Поле n — уникальный номер действия, чтобы одно действие не обработать дважды.
function onInput(pid, v) {
  if (!v || !HOST || HOST.seen[pid] === v.n) return;
  HOST.seen[pid] = v.n;
  if (HOST.players[pid] && HOST.players[pid].online === false) {
    HOST.players[pid].online = true;
    hRef(`players/${pid}/online`).set(true);
  }
  const h = H();
  switch (v.kind) {
    case "pick":
      if (h.phase === "board" && picker() === "player" && h.chooser === pid) pick(+v.ti, +v.qi);
      break;
    case "ans":
      if (h.phase === "answer" && h.responder === pid && AUTO()) {
        h.said =
          String(v.text || "")
            .trim()
            .slice(0, 80) || "—";
        judge(h.cur.choices ? normA(h.said) === normA(h.cur.answer) : matchAnswer(h.said, h.cur.answer));
      }
      break;
    case "opt":
      quizPick(pid, v);
      break;
    case "cat":
      if (h.phase === "cat" && h.chooser === pid && v.to !== pid && HOST.players[v.to]) catGive(v.to);
      break;
    case "auc":
      if (h.phase === "auction" && h.auc.queue[0] === pid) aucAct(pid, v.act);
      break;
    case "bet":
      if (h.phase === "final-bet" && h.fin.ids.includes(pid) && h.fin.bets[pid] == null) {
        const max = Math.max(1, (HOST.players[pid] || {}).score || 0);
        h.fin.bets[pid] = Math.max(1, Math.min(max, Math.round(+v.v || 1)));
        checkBets();
      }
      break;
    case "fa":
      if (h.phase === "final-answer" && h.fin.ids.includes(pid) && h.fin.answers[pid] == null) {
        h.fin.answers[pid] =
          String(v.text || "")
            .trim()
            .slice(0, 120) || "—";
        checkAnswers();
      }
      break;
  }
}

// Сообщает игрокам о смене пака, пока игра ещё в лобби.
function hostPackChanged() {
  if (HOST && H().phase === "lobby") pushState();
}

