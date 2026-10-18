/* ======================================================================
   9. ВЕДУЩИЙ: ХОД ИГРЫ
   Фазы (H().phase):
     lobby → board → reading → open → answer → reveal → board …
     спецвопросы: cat (кот в мешке), auction; викторина: quiz;
     финал: final-bet → final-answer → final-judge → end.
   Таймеры фаз: later() сбрасывается при смене фазы, а дедлайн кнопки/ответа
   (setDl) защищён ключом dlKey, чтобы ведущий мог добавлять время.
   ====================================================================== */

// Таймер, который работает только в режиме без ведущего (чтобы игра не зависала).
function autoLater(ms, fn) {
  if (AUTO()) later(fn, ms);
}

// Статистика игрока для финального экрана (создаётся при первом обращении).
function stP(id) {
  const st = H().st;
  if (!st.pl[id]) st.pl[id] = { right: 0, wrong: 0, best: null };
  return st.pl[id];
}

// Записывает верный ответ и лучшее время реакции.
function stRight(id, reaction) {
  const p = stP(id);
  p.right++;
  if (reaction != null && (p.best == null || reaction < p.best)) p.best = Math.round(reaction * 100) / 100;
}

// Записывает ошибку.
function stWrong(id) {
  stP(id).wrong++;
}

// Запись текущего вопроса в статистике.
function stQ() {
  const h = H();
  return h.st.qs[h.st.qs.length - 1];
}

// Старт игры: обнуляет очки и статистику, чистит старые нажатия и действия, открывает табло.
function startGame() {
  const ids = online().length ? online() : order();
  if (validate(PACK).some(x => x.lvl === "err")) return;
  clearTimers();
  keepAwake();
  order().forEach(id => {
    HOST.players[id].score = 0;
    hRef(`players/${id}/score`).set(0);
  });
  Object.assign(H(), {
    phase: "board",
    round: 0,
    used: {},
    chooser: ids[0] || null,
    cur: null,
    responder: null,
    tried: {},
    msg: "",
    auc: null,
    fin: null,
    quiz: null,
    st: { pl: {}, qs: [] }
  });
  hRef("buzz").remove();
  hRef("input").remove();
  hRef("media").remove();
  hRef("smedia").remove();
  HOST.seen = {};
  preloadPackImages();
  S.view = "game";
  if (AUTO() && PL) APP.mode = "player";
  armBoard();
  pushState();
}

// Без ведущего: если ходящий отключился, выбирает другого; если 30 с никто
// не выбрал вопрос, открывает случайный.
function armBoard() {
  const h = H();
  if (!AUTO()) return;
  if (!HOST.players[h.chooser] || HOST.players[h.chooser].online === false) {
    const ids = online();
    if (ids.length) h.chooser = ids[Math.floor(Math.random() * ids.length)];
  }
  const n = Object.keys(h.used).length,
    r = h.round;
  later(() => {
    const x = H();
    if (x.phase === "board" && x.round === r && Object.keys(x.used).length === n) {
      const f = [];
      PACK.rounds[r].themes.forEach((t, ti) =>
        t.questions.forEach((_, qi) => {
          if (!x.used[ti + "-" + qi]) f.push([ti, qi]);
        })
      );
      if (f.length) {
        const [a, b] = f[Math.floor(Math.random() * f.length)];
        pick(a, b);
      }
    }
  }, 30000);
}

// Открывает вопрос с табло и направляет его по типу:
// викторина → startQuiz, кот → выбор игрока, аукцион → торги,
// без риска → сразу ответ ходящего, обычный → чтение вопроса.
function pick(ti, qi) {
  const h = H(),
    key = ti + "-" + qi,
    th = PACK.rounds[h.round].themes[ti],
    item = th && th.questions[qi];
  if (h.phase !== "board" || !item || h.used[key]) return;
  clearTimers();
  h.used[key] = true;
  if (!h.st) h.st = { pl: {}, qs: [] };
  let sp = item.type || "normal";
  if (sp === "cat" && !CFG.cat) sp = "normal";
  if (sp === "auction" && !CFG.auction) sp = "normal";
  if (QUIZ()) sp = "normal";
  if (!HOST.players[h.chooser]) h.chooser = online()[0] || null;
  h.cur = {
    ti,
    qi,
    theme: th.name,
    cost: item.cost,
    text: item.text,
    answer: item.answer,
    sp,
    direct: false,
    noPenalty: false,
    img: item.img || null,
    url: item.url || null,
    wrong: item.wrong || null,
    choices: item.choices || null
  };
  h.st.qs.push({
    theme: th.name,
    cost: item.cost,
    len: (item.text || "").length,
    answer: item.answer,
    res: null,
    by: null,
    tries: []
  });
  sendMedia(h.cur);
  h.left = null;
  h.tried = {};
  h.responder = null;
  h.reaction = null;
  h.msg = "";
  h.said = null;
  h.quiz = null;
  if (QUIZ()) {
    showIntro("quiz");
    return;
  }
  if (sp === "cat") {
    h.phase = "cat";
    autoLater(20000, () => {
      const x = H();
      if (x.phase === "cat" && x.cur === h.cur) {
        const o = online().filter(i => i !== x.chooser);
        catGive(o.length ? o[Math.floor(Math.random() * o.length)] : x.chooser);
      }
    });
    pushState();
    return;
  }
  if (sp === "auction") {
    startAuction();
    return;
  }
  if (sp === "norisk" && h.chooser) {
    h.cur.direct = true;
    h.cur.noPenalty = true;
    h.responder = h.chooser;
    showIntro("answer");
    return;
  }
  showIntro("reading");
}

// Сколько длится заставка «тема и стоимость» перед вопросом. 0 — без заставки
// (так делают тесты через window.INTRO_MS_OVERRIDE).
const INTRO_MS = window.INTRO_MS_OVERRIDE != null ? window.INTRO_MS_OVERRIDE : 2500;

// Заставка перед вопросом: на всех экранах крупно тема и стоимость, текст вопроса пока скрыт.
// to — что будет после неё: reading (чтение), quiz (викторина) или answer (вопрос без риска).
function showIntro(to) {
  const h = H();
  h.introTo = to;
  if (!INTRO_MS) return introDone(true);
  h.phase = "intro";
  pushState();
  later(introDone, INTRO_MS);
}

// Конец заставки (по таймеру или кнопкой «Показать вопрос» у ведущего).
function introDone(force) {
  const h = H();
  if (h.phase !== "intro" && force !== true) return;
  clearTimers();
  if (h.introTo === "quiz") startQuiz();
  else if (h.introTo === "answer") {
    h.phase = "answer";
    armAnswer();
    pushState();
  } else startReading();
}

// Отправляет картинку вопроса: на телефоны (media), если это включено в настройках,
// иначе только на общие экраны (smedia), если они открыты. Иначе ничего не отправляет.
function sendMedia(c) {
  const path = CFG.phoneImg ? "media" : HOST.screens ? "smedia" : null;
  if (!path || !c.img) return;
  imgGet(c.img).then(d => {
    if (d && HOST && H().cur === c) hRef(path).set({ id: c.img, data: d });
  });
}

// Заранее загружает все картинки пака в память ведущего.
function preloadPackImages() {
  PACK.rounds.forEach(r =>
    r.themes.forEach(t =>
      t.questions.forEach(q => {
        if (q.img) imgGet(q.img);
      })
    )
  );
}

// Фаза чтения: кнопки заблокированы, время зависит от длины вопроса.
function startReading() {
  const h = H();
  h.phase = "reading";
  h.readMs = Math.min(5000, 1500 + (h.cur.text || "").length * 30);
  h.readAt = now();
  pushState();
  later(openBuzz, h.readMs);
}

// Сколько секунд минимум получают остальные игроки после неверного ответа,
// даже если до нажатия время почти вышло.
const BUZZ_MIN_LEFT = 2000;

// Запоминает, сколько времени оставалось на кнопку в момент нажатия.
// После неверного ответа кнопки откроются с этим остатком (0 — без лимита).
function rememberLeft() {
  const h = H();
  h.left = h.dl ? Math.max(BUZZ_MIN_LEFT, h.dl - now()) : 0;
}

// Открывает кнопки. Каждое открытие получает свой номер qn,
// нажатия пишутся в rooms/{код}/buzz/{qn}, старые нажатия не мешают.
// Первое открытие даёт полное время, повторное (после ошибки) — то, что оставалось.
function openBuzz() {
  const h = H();
  clearTimers();
  const ms = h.left != null ? h.left : CFG.window;
  h.left = null;
  h.qn = (h.qn || 0) + 1;
  h.phase = "open";
  h.openAt = now();
  h.buzzLock = false;
  const qn = h.qn;
  if (HOST.buzzRef) HOST.buzzRef.off();
  HOST.buzzRef = hRef(`buzz/${qn}`);
  HOST.buzzRef.on("child_added", () => {
    const x = H();
    if (x.phase !== "open" || x.qn !== qn || x.buzzLock) return;
    x.buzzLock = true;
    setTimeout(() => resolveBuzz(qn), 180);
  });
  setDl(ms, CFG.window || ms);
  pushState();
}

// Через 180 мс после первого нажатия выбирает самое раннее по времени сервера.
// Пауза нужна, чтобы почти одновременные нажатия успели дойти до базы.
async function resolveBuzz(qn) {
  const h = H();
  if (h.phase !== "open" || h.qn !== qn) return;
  const all = (await hRef(`buzz/${qn}`).once("value")).val() || {};
  const cand = Object.entries(all)
    .filter(([id, ts]) => !h.tried[id] && HOST.players[id] && typeof ts === "number")
    .sort((a, b) => a[1] - b[1]);
  if (!cand.length) {
    h.buzzLock = false;
    if (h.dl && now() >= h.dl) onExpire();
    return;
  }
  rememberLeft();
  clearTimers();
  const [id, ts] = cand[0];
  h.responder = id;
  h.reaction = Math.max(0, (ts - h.openAt) / 1000);
  h.phase = "answer";
  armAnswer();
  pushState();
}

// Ставит дедлайн текущей фазы (кнопка, викторина, ввод ответа). 0 — без лимита.
// total — полная длина полоски таймера (если время продолжается после паузы, полоска не полная).
// Старые таймеры не срабатывают благодаря ключу dlKey.
function setDl(ms, total) {
  const h = H();
  h.dlKey = (h.dlKey || 0) + 1;
  const k = h.dlKey;
  if (ms > 0) {
    h.dl = now() + ms;
    h.dlTotal = Math.max(total || ms, ms);
    setTimeout(() => {
      if (HOST && H().dlKey === k) onExpire();
    }, ms);
  } else {
    h.dl = 0;
    h.dlTotal = 0;
  }
}

// Что делать, когда время вышло, в зависимости от фазы.
function onExpire() {
  const h = H();
  if (h.phase === "open" && !h.buzzLock) {
    const q = stQ();
    if (q) q.res = "nobody";
    reveal("Никто не ответил", null);
  } else if (h.phase === "quiz") quizReveal();
  else if (h.phase === "answer" && AUTO()) {
    h.said = "— (время вышло)";
    judge(false);
  }
}

// Кнопки «+10 с», «+30 с» у ведущего: продлевают или запускают таймер.
function addTime(ms) {
  const h = H();
  const left = h.dl > 0 ? Math.max(0, h.dl - now()) : 0;
  setDl(left + ms);
  pushState();
}

// Кнопка «Без лимита»: останавливает таймер.
function stopTime() {
  setDl(0);
  pushState();
}

// Начало ответа игрока. Без ведущего запускает таймер на ввод ответа.
function armAnswer() {
  const h = H();
  h.said = null;
  h.ansDeadline = 0;
  if (AUTO()) {
    setDl(CFG.ansTime);
    h.ansDeadline = h.dl || 1;
  } else setDl(0);
}

// Засчитывает или не засчитывает ответ. При ошибке снимает очки (если включено)
// и снова открывает кнопки для тех, кто ещё не отвечал.
function judge(ok) {
  const h = H();
  if (h.phase !== "answer") return;
  const id = h.responder,
    c = h.cur.cost,
    nm = pname(id),
    said = h.said ? ` «${h.said}»` : "";
  const q = stQ();
  if (q) q.tries.push({ id, ok: !!ok });
  if (ok) {
    addScore(id, c);
    stRight(id, h.reaction);
    if (q) {
      q.res = "right";
      q.by = id;
    }
    h.chooser = id;
    reveal(nm + said + ": верно, +" + fmt(c), true);
    return;
  }
  stWrong(id);
  const fine = CFG.minus && !h.cur.noPenalty ? c : 0;
  if (fine) addScore(id, -fine);
  h.tried[id] = true;
  const tail = fine ? ", −" + fmt(fine) : "";
  if (h.cur.direct || !online().some(x => !h.tried[x])) {
    if (q) q.res = "wrong";
    reveal(nm + said + ": неверно" + tail, false);
    return;
  }
  h.msg = nm + said + " — неверно" + tail;
  h.responder = null;
  openBuzz();
}

// Показывает правильный ответ и через несколько секунд возвращает к табло.
function reveal(msg, ok) {
  clearTimers();
  const h = H();
  h.dlKey = (h.dlKey || 0) + 1;
  h.dl = 0;
  h.phase = "reveal";
  h.msg = msg;
  h.msgOk = ok;
  h.responder = null;
  pushState();
  later(toBoard, QUIZ() ? 6000 : 5000);
}

// Возврат к табло. Если вопросы раунда кончились, переходит к следующему раунду.
function toBoard() {
  clearTimers();
  const h = H();
  h.msg = "";
  h.quiz = null;
  hRef("media").remove();
  hRef("smedia").remove();
  const total = PACK.rounds[h.round].themes.reduce((a, t) => a + t.questions.length, 0);
  if (Object.keys(h.used).length >= total) {
    endRound();
    return;
  }
  h.phase = "board";
  armBoard();
  pushState();
}

// Следующий раунд (ходит отстающий) или финал после последнего раунда.
function endRound() {
  clearTimers();
  const h = H();
  if (h.round < PACK.rounds.length - 1) {
    h.round++;
    h.used = {};
    h.phase = "board";
    const ids = online();
    if (ids.length)
      h.chooser = ids.slice().sort((a, b) => (HOST.players[a].score || 0) - (HOST.players[b].score || 0))[0];
    armBoard();
    pushState();
  } else startFinal();
}

// Кот в мешке: вопрос получает выбранный игрок и отвечает без кнопки.
function catGive(to) {
  const h = H();
  if (h.phase !== "cat") return;
  clearTimers();
  h.responder = to;
  h.cur.direct = true;
  h.phase = "answer";
  h.reaction = null;
  armAnswer();
  pushState();
}

// Аукцион: торги начинает ходящий со ставкой, равной стоимости вопроса.
function startAuction() {
  const h = H(),
    ids = online();
  let i = ids.indexOf(h.chooser);
  if (i < 0) {
    h.chooser = ids[0];
    i = 0;
  }
  const q = [...ids.slice(i + 1), ...ids.slice(0, i)];
  h.auc = {
    bid: h.cur.cost,
    leader: h.chooser,
    queue: q,
    log: [pname(h.chooser) + " открывает торги: " + fmt(h.cur.cost)]
  };
  h.phase = "auction";
  if (!q.length) aucFinish();
  else {
    armAuc();
    pushState();
  }
}

// Без ведущего: автопас, если игрок 15 с не делает ход в торгах.
function armAuc() {
  const a = H().auc,
    k = a.log.length + ":" + a.queue[0];
  autoLater(15000, () => {
    const x = H();
    if (x.phase === "auction" && x.auc.log.length + ":" + x.auc.queue[0] === k)
      aucAct(x.auc.queue[0], "pass");
  });
}

// Ход в торгах: пас, повышение на 100 или ва-банк (весь счёт).
function aucAct(id, act) {
  const h = H(),
    a = h.auc;
  if (h.phase !== "auction" || a.queue[0] !== id) return;
  const sc = (HOST.players[id] || {}).score || 0;
  if (act === "raise" && sc < a.bid + 100) return;
  if (act === "all" && sc <= a.bid) return;
  a.queue.shift();
  if (act === "pass") a.log.push(pname(id) + ": пас");
  else {
    const bid = act === "all" ? sc : a.bid + 100;
    a.queue.push(a.leader);
    a.leader = id;
    a.bid = bid;
    a.log.push(pname(id) + (act === "all" ? ": ва-банк, " : ": ") + fmt(bid));
  }
  if (!a.queue.length) aucFinish();
  else {
    armAuc();
    pushState();
  }
}

// Торги закончены: отвечает лидер, стоимость вопроса равна его ставке.
function aucFinish() {
  const h = H();
  clearTimers();
  h.responder = h.auc.leader;
  h.cur.cost = h.auc.bid;
  h.cur.direct = true;
  h.reaction = null;
  h.phase = "answer";
  armAnswer();
  pushState();
}

// Варианты для викторины. Порядок источников:
// 1) варианты из пака (choices) — как есть;
// 2) неверные варианты автора (wrong);
// 3) для чисел и годов — близкие значения;
// 4) ответы других вопросов той же темы, затем всего пака.
function makeOptions(answer, wrong, theme, choices) {
  if (choices && choices.length >= 2) {
    const ci = choices.findIndex(x => normA(x) === normA(answer));
    if (ci >= 0) return { opts: choices.slice(), correct: ci };
  }
  const A = String(answer || "").trim(),
    na = normA(A),
    seen = new Set([na]),
    out = [];
  const add = x => {
    x = String(x || "").trim();
    const n = normA(x);
    if (x && n && !seen.has(n) && out.length < 3) {
      seen.add(n);
      out.push(x);
    }
  };
  (wrong || []).forEach(add);
  if (out.length < 3 && /^-?\d+([.,]\d+)?$/.test(A)) {
    const v = parseFloat(A.replace(",", ".")),
      int = Number.isInteger(v),
      isYear = int && v > 1000 && v < 2100;
    const deltas = shuffle(
      isYear
        ? [1, 2, 3, 5, 7, 10, -1, -2, -3, -5, -7, -10]
        : int && Math.abs(v) < 20
          ? [1, 2, 3, -1, -2, 4, -3]
          : [0.1, 0.2, 0.25, 0.4, -0.1, -0.2, -0.3, 0.5]
    );
    for (const d of deltas) {
      let n = isYear || (int && Math.abs(v) < 20) ? v + d : v * (1 + d);
      n = int ? Math.round(n) : Math.round(n * 10) / 10;
      if (n > 0 || v <= 0) add(String(n));
    }
  }
  if (out.length < 3) {
    const same = [],
      other = [];
    PACK.rounds.forEach(r =>
      r.themes.forEach(t => t.questions.forEach(q => (t.name === theme ? same : other).push(q.answer)))
    );
    if (PACK.final) other.push(PACK.final.answer);
    const sim = x => Math.abs(String(x).length - A.length);
    shuffle(same).forEach(add);
    other
      .sort((a, b) => sim(a) - sim(b))
      .slice(0, 12)
      .forEach(x => {
        if (Math.random() < 0.7) add(x);
      });
    other.forEach(add);
  }
  const opts = shuffle([A, ...out]);
  return { opts, correct: opts.indexOf(A) };
}

// Викторина: все отвечают одновременно, выбирая вариант.
function startQuiz() {
  const h = H(),
    o = makeOptions(h.cur.answer, h.cur.wrong, h.cur.theme, h.cur.choices);
  h.qn = (h.qn || 0) + 1;
  h.quiz = { id: h.qn, opts: o.opts, correct: o.correct, picks: {}, start: now() };
  h.phase = "quiz";
  setDl(CFG.quizTime);
  pushState();
}

// Принимает выбор игрока. Когда ответили все, кто в сети, сразу показывает итог.
function quizPick(pid, v) {
  const h = H(),
    z = h.quiz;
  if (h.phase !== "quiz" || !z || +v.qid !== z.id || z.picks[pid] || !HOST.players[pid]) return;
  const i = +v.i;
  if (!(i >= 0 && i < z.opts.length)) return;
  z.picks[pid] = { i, t: Math.max(0, (now() - z.start) / 1000) };
  if (online().every(id => z.picks[id])) quizReveal();
  else pushState();
}

// Итог вопроса викторины: очки за верный ответ, быстрейший верный выбирает следующий вопрос.
function quizReveal() {
  const h = H(),
    z = h.quiz,
    c = h.cur.cost,
    q = stQ();
  if (h.phase !== "quiz") return;
  clearTimers();
  const right = [];
  Object.entries(z.picks).forEach(([pid, p]) => {
    const ok = p.i === z.correct;
    if (q) q.tries.push({ id: pid, ok });
    if (ok) {
      addScore(pid, c);
      stRight(pid, p.t);
      right.push([pid, p.t]);
    } else {
      stWrong(pid);
      if (CFG.minus && CFG.quizMinus) addScore(pid, -c);
    }
  });
  right.sort((a, b) => a[1] - b[1]);
  if (right.length) {
    h.chooser = right[0][0];
    if (q) {
      q.res = "right";
      q.by = right[0][0];
      q.quiz = [right.length, online().length];
    }
  } else if (q) {
    q.res = Object.keys(z.picks).length ? "wrong" : "nobody";
    q.quiz = [0, online().length];
  }
  z.done = true;
  reveal(
    right.length
      ? `Верно ответили ${right.length} из ${online().length}. Быстрее всех: ${pname(right[0][0])}`
      : "Никто не ответил верно",
    right.length > 0
  );
}

// Финал: участвуют игроки на связи с положительным счётом.
function startFinal() {
  clearTimers();
  const h = H();
  if (!CFG.final || !PACK.final) {
    h.phase = "end";
    pushState();
    return;
  }
  const ids = online().filter(id => (HOST.players[id].score || 0) > 0);
  if (!ids.length) {
    h.phase = "end";
    pushState();
    return;
  }
  h.fin = { ids, bets: {}, answers: {}, verdict: {} };
  if (QUIZ()) {
    const o = makeOptions(PACK.final.answer, PACK.final.wrong, "", PACK.final.choices);
    h.fin.opts = o.opts;
  }
  h.phase = "final-bet";
  autoLater(30000, () => checkBets(true));
  pushState();
}

// Переход от ставок к вопросу финала, когда все поставили (или ведущий нажал «Не ждать»).
function checkBets(force) {
  const h = H();
  if (h.phase !== "final-bet") return;
  if (force || h.fin.ids.every(id => h.fin.bets[id] != null)) {
    h.fin.ids.forEach(id => {
      if (h.fin.bets[id] == null) h.fin.bets[id] = 1;
    });
    h.phase = "final-answer";
    clearTimers();
    autoLater(45000, () => checkAnswers(true));
  }
  pushState();
}

// Переход к проверке финала. Без ведущего и в викторине ответы проверяются автоматически.
function checkAnswers(force) {
  const h = H();
  if (h.phase !== "final-answer") return;
  if (force || h.fin.ids.every(id => h.fin.answers[id] != null)) {
    clearTimers();
    h.fin.ids.forEach(id => {
      if (h.fin.answers[id] == null) h.fin.answers[id] = "—";
    });
    h.phase = "final-judge";
    if (AUTO() || QUIZ())
      h.fin.ids.forEach((id, i) =>
        later(
          () =>
            finalJudge(
              id,
              QUIZ()
                ? normA(h.fin.answers[id]) === normA(PACK.final.answer)
                : matchAnswer(h.fin.answers[id], PACK.final.answer)
            ),
          1300 * (i + 1)
        )
      );
  }
  pushState();
}

// Проверка ответа в финале: плюс или минус ставка.
function finalJudge(id, ok) {
  const h = H();
  if (h.phase !== "final-judge" || h.fin.verdict[id] != null) return;
  h.fin.verdict[id] = ok;
  addScore(id, ok ? h.fin.bets[id] : -h.fin.bets[id]);
  if (ok) stP(id).finalOk = true;
  else stP(id).finalOk = false;
  if (h.fin.ids.every(i => h.fin.verdict[i] != null)) h.phase = "end";
  pushState();
}

// «Пропустить вопрос»: показать ответ без начисления очков.
function skipQuestion() {
  const h = H();
  if (!h.cur || ["board", "end", "lobby"].includes(h.phase)) return;
  const q = stQ();
  if (q) q.res = "nobody";
  if (h.quiz) h.quiz.done = false;
  h.quiz = null;
  reveal("Вопрос пропущен", null);
}

// «Вернуть на табло»: вопрос снова доступен, статистика не портится.
function undoQuestion() {
  const h = H();
  if (!h.cur || ["board", "end", "lobby", "reveal"].includes(h.phase) || h.phase.startsWith("final")) return;
  clearTimers();
  h.dlKey = (h.dlKey || 0) + 1;
  h.dl = 0;
  delete h.used[h.cur.ti + "-" + h.cur.qi];
  if (h.st && h.st.qs.length) h.st.qs.pop();
  h.cur = null;
  h.quiz = null;
  h.responder = null;
  h.msg = "";
  hRef("media").remove();
  hRef("smedia").remove();
  h.phase = "board";
  armBoard();
  pushState();
}

// «Дать ответить»: ведущий сам назначает отвечающего (например, кто-то выкрикнул ответ).
function giveAnswer(pid) {
  const h = H();
  if (!h.cur || !["reading", "open", "answer"].includes(h.phase) || QUIZ()) return;
  if (h.phase === "open") rememberLeft();
  clearTimers();
  h.responder = pid;
  h.reaction = null;
  h.phase = "answer";
  armAnswer();
  pushState();
}

// Передать ход выбранному игроку.
function setChooser(pid) {
  const h = H();
  h.chooser = pid;
  if (h.phase === "board") {
    clearTimers();
    armBoard();
  }
  pushState();
}

// Вернуться в лобби с теми же игроками (новая игра).
function backToLobby() {
  clearTimers();
  Object.assign(H(), {
    phase: "lobby",
    cur: null,
    responder: null,
    fin: null,
    auc: null,
    quiz: null,
    used: {},
    round: 0
  });
  S.view = "setup";
  APP.mode = "host";
  pushState();
}

// Данные для финального экрана: игроки по местам и шуточные номинации.
// Номинация попадает в список, только если для неё есть данные.
function statsOut() {
  const h = H();
  if (!h.st) return null;
  const players = order()
    .map(id => {
      const s = h.st.pl[id] || {};
      return {
        id,
        name: pname(id),
        score: HOST.players[id].score || 0,
        right: s.right || 0,
        wrong: s.wrong || 0,
        best: s.best == null ? null : s.best
      };
    })
    .sort((a, b) => b.score - a.score);
  const sec = x => String(x).replace(".", ",") + " с";
  const top = (list, key) => list.filter(x => x[key] > 0).sort((a, b) => b[key] - a[key])[0];
  const won = h.st.qs.filter(q => q.res === "right" && q.by && HOST.players[q.by]);
  const noms = [];
  const fast = players.filter(p => p.best != null).sort((a, b) => a.best - b.best)[0];
  if (fast) noms.push({ i: "⚡", t: "Самый быстрый клик", n: fast.name, d: sec(fast.best) });
  const smart = top(players, "right");
  if (smart) noms.push({ i: "🧠", t: "Больше всех верных ответов", n: smart.name, d: smart.right + " " + plural(smart.right, "ответ", "ответа", "ответов") });
  const long = won.slice().sort((a, b) => (b.len || 0) - (a.len || 0))[0];
  if (long && long.len) noms.push({ i: "📜", t: "Самый длинный вопрос", n: pname(long.by), d: long.len + " " + plural(long.len, "символ", "символа", "символов") });
  const rich = won.slice().sort((a, b) => b.cost - a.cost)[0];
  if (rich) noms.push({ i: "💎", t: "Самый дорогой ответ", n: pname(rich.by), d: fmt(rich.cost) + " · " + rich.theme });
  const brave = top(players, "wrong");
  if (brave) noms.push({ i: "🎲", t: "Самый смелый игрок", n: brave.name, d: brave.wrong + " " + plural(brave.wrong, "ошибка", "ошибки", "ошибок") });
  return { players: players.map(p => ({ name: p.name, score: p.score })), noms };
}

