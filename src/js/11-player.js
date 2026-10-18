/* ======================================================================
   11. ИГРОК
   Игрок ничего не решает сам: он только читает rooms/{код}/state
   и отправляет свои действия через send() в rooms/{код}/input.
   ====================================================================== */

// Путь внутри комнаты, в которой играет это устройство.
const pRef = p => ref(`rooms/${PL.code}/${p}`);

// Вход в комнату по коду. Если игрок уже был в этой комнате (id сохранён в браузере),
// он возвращается со своим счётом. opt.silent — вход организатора без смены экрана.
async function joinRoom(code, name, opt) {
  opt = opt || {};
  APP.busy = true;
  APP.joinErr = "";
  render();
  try {
    if (!/^\d{4}$/.test(code)) throw "Код состоит из 4 цифр";
    const m = (await ref(`rooms/${code}/meta`).once("value")).val();
    if (!m || m.closed) throw "Комната с таким кодом не найдена";
    const key = "svoya.pid." + code;
    let pid = load(key, null);
    const ps = (await ref(`rooms/${code}/players`).once("value")).val() || {};
    if (!(pid && ps[pid])) {
      const cnt = Object.values(ps).filter(p => p.online !== false).length;
      if (m.access === "public" && m.max && cnt >= m.max) throw "В комнате нет свободных мест";
      pid = uid();
      save(key, pid);
      await ref(`rooms/${code}/players/${pid}`).set({ name, score: 0, online: true, joined: TS() });
    } else await ref(`rooms/${code}/players/${pid}`).update({ name, online: true });
    PL = {
      code,
      pid,
      name,
      state: null,
      players: {},
      meta: m,
      lock: 0,
      pressedQn: null,
      sent: {},
      seenSelf: false,
      kicked: false
    };
    PL.connCb = presence(pRef(`players/${pid}/online`));
    pRef("state").on("value", s => {
      const prev = PL && PL.state;
      PL.state = s.val();
      if (prev && PL.state && prev.qn !== PL.state.qn) PL.pressedQn = null;
      if (PL.state && PL.state.phase === "lobby") PL.sent = {};
      render();
    });
    pRef("players").on("value", s => {
      PL.players = Object.fromEntries(Object.entries(s.val() || {}).filter(([k, p]) => p && p.name));
      if (PL.players[pid] && PL.players[pid].name !== PL.name) {
        PL.name = PL.players[pid].name;
        ME_NAME = PL.name;
        save("svoya.name", PL.name);
      }
      if (PL.players[pid]) PL.seenSelf = true;
      else if (PL.seenSelf && !PL.kicked) {
        PL.kicked = true;
        if (PL.connCb) ref(".info/connected").off("value", PL.connCb);
        pRef(`players/${pid}/online`).onDisconnect().cancel();
      }
      render();
    });
    pRef("meta").on("value", s => {
      PL.meta = s.val() || {};
      render();
    });
    pRef("media").on("value", s => {
      PL.media = s.val();
      render();
    });
    if (!opt.silent) {
      save("svoya.lastRoom", code);
      APP.mode = "player";
      history.replaceState(null, "", location.pathname + "?room=" + code);
    }
  } catch (e) {
    console.error(e);
    APP.joinErr = typeof e === "string" ? e : "Не удалось подключиться. Проверьте интернет.";
  }
  APP.busy = false;
  render();
}

// Выход игрока из комнаты (счёт остаётся, можно вернуться по коду).
function leaveRoom() {
  if (PL) {
    if (PL.connCb) ref(".info/connected").off("value", PL.connCb);
    pRef("state").off();
    pRef("players").off();
    pRef("meta").off();
    pRef("media").off();
    pRef(`players/${PL.pid}/online`).onDisconnect().cancel();
    if (!PL.kicked && PL.players[PL.pid]) pRef(`players/${PL.pid}/online`).set(false);
  }
  PL = null;
  save("svoya.lastRoom", null);
  history.replaceState(null, "", location.pathname);
  goHome();
}

// Если метка «в сети» почему-то осталась серой, любое действие игрока её исправляет.
function healOnline() {
  if (PL && !PL.kicked && PL.players[PL.pid] && PL.players[PL.pid].online === false)
    pRef(`players/${PL.pid}/online`).set(true);
}

// Игрок вернулся на вкладку — подтверждаем, что он в сети.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") healOnline();
});

// Отправляет действие игрока ведущему.
function send(kind, data) {
  healOnline();
  pRef(`input/${PL.pid}`).set(
    Object.assign({ kind, n: Date.now() + "-" + Math.random().toString(36).slice(2, 6) }, data || {})
  );
}

// Нажатие кнопки. До конца чтения — штрафная блокировка на 0,5 с (если включена).
function plBuzz() {
  const st = PL && PL.state;
  if (!st) return;
  const t = Date.now();
  if (st.phase === "reading") {
    if (st.cfg.early) {
      PL.lock = t + 500;
      PL.early = true;
      render();
      setTimeout(() => {
        if (PL) {
          PL.early = false;
          render();
        }
      }, 400);
    }
    return;
  }
  if (st.phase !== "open" || (st.tried || {})[PL.pid] || PL.pressedQn === st.qn || t < PL.lock) return;
  PL.pressedQn = st.qn;
  healOnline();
  pRef(`buzz/${st.qn}/${PL.pid}`).set(TS());
  if (navigator.vibrate) navigator.vibrate(40);
  render();
}

// Отправка письменного ответа в режиме без ведущего.
function submitPA() {
  const st = PL && PL.state;
  if (!st || st.phase !== "answer" || st.responder !== PL.pid) return;
  const f = document.getElementById("pa");
  const v = (f && f.value.trim()) || "";
  if (!v) return;
  PL.sent.pa = st.qn + ":" + st.ansDeadline;
  send("ans", { text: v });
  render();
}

// Отправка ответа в финале.
function submitFA() {
  const f = document.getElementById("fa");
  const v = (f && f.value.trim()) || "";
  if (!v) return;
  PL.sent.fa = true;
  send("fa", { text: v });
  render();
}

