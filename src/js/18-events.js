/* ======================================================================
   18. ОБРАБОТЧИКИ СОБЫТИЙ
   Все кнопки размечены data-атрибутами (data-act, data-pick, data-cfg…),
   а обработчики ниже повешены один раз на весь документ.
   ====================================================================== */

// Ввод текста: настройки комнаты, имя, код комнаты, поля редактора.
document.addEventListener("input", e => {
  const t = e.target,
    ds = t.dataset || {};
  if (ds.cfgtext) {
    CFG[ds.cfgtext] = t.value;
    save("svoya.cfg", CFG);
    const b = document.getElementById("acc-badge");
    if (b) b.innerHTML = accBadge();
    clearTimeout(window._sm);
    window._sm = setTimeout(() => {
      syncMeta();
      syncPublic();
    }, 500);
    return;
  }
  if (ds.cfgname) {
    ME_NAME = t.value;
    save("svoya.name", ME_NAME);
    if (PL && HOST && PL.code === HOST.code && t.value.trim()) {
      clearTimeout(window._sn);
      window._sn = setTimeout(() => pRef(`players/${PL.pid}/name`).set(t.value.trim().slice(0, 20)), 600);
    }
    clearTimeout(window._sm);
    window._sm = setTimeout(() => {
      syncMeta();
      pushState();
    }, 600);
    return;
  }
  if (t.id === "code") {
    t.value = t.value.replace(/\D/g, "").slice(0, 4);
    APP.prefill = t.value;
  }
  if (t.id === "nm") {
    ME_NAME = t.value;
    save("svoya.name", ME_NAME);
  }
  if (ds.ed != null && S.draft) edInput(t);
});

// Выбор файла картинки, переключатель финала в редакторе, выбор ходящего у ведущего.
document.addEventListener("change", async e => {
  if (e.target.hasAttribute && e.target.hasAttribute("data-chooser")) {
    setChooser(e.target.value);
    return;
  }
  if (e.target.dataset && e.target.dataset.edimg && S.draft && S.edSel) {
    const f = e.target.files[0];
    if (!f) return;
    const q = S.draft.rounds[S.edRound].themes[S.edSel[0]].questions[S.edSel[1]];
    try {
      const d = await compressImage(f);
      q.img = await imgPut(d);
      delete q.url;
      S.draft.notes = [];
      render();
    } catch (err) {
      alert(err.message || "Не удалось загрузить картинку");
    }
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute("data-edfinal")) {
    S.draft.final = e.target.checked
      ? S.draft._final || { theme: "", text: "", answer: "" }
      : ((S.draft._final = S.draft.final), null);
    render();
  }
});

// Кнопка игрока срабатывает на касание, а не на отпускание пальца: так быстрее.
document.addEventListener("pointerdown", e => {
  const t = e.target.closest('[data-act="buzz"]');
  if (t && APP.mode === "player") {
    e.preventDefault();
    plBuzz();
  }
});

// Все нажатия. Сначала кнопки с особыми data-атрибутами, потом switch по data-act.
document.addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  const ds = t.dataset,
    a = ds.act;
  // home
  if (ds.home) {
    setHomeView(ds.home);
    return;
  }
  if (ds.joinroom) {
    const n = (document.getElementById("nm") || {}).value || "";
    if (!n.trim()) {
      APP.joinErr = "Введите имя, чтобы войти";
      render();
      return;
    }
    joinRoom(ds.joinroom, n.trim());
    return;
  }
  // player
  if (ds.aopt != null && PL && PL.state && PL.state.cur && PL.state.cur.choices) {
    const st = PL.state;
    PL.sent.pa = st.qn + ":" + st.ansDeadline;
    send("ans", { text: arr(st.cur.choices)[+ds.aopt] });
    render();
    return;
  }
  if (ds.opt != null && PL && PL.state && PL.state.quiz) {
    PL.qpick = { id: PL.state.quiz.id, i: +ds.opt };
    send("opt", { qid: PL.state.quiz.id, i: +ds.opt });
    render();
    return;
  }
  if (ds.fcho != null && PL && PL.state && PL.state.fin) {
    PL.sent.fa = true;
    send("fa", { text: arr(PL.state.fin.choices)[+ds.fcho] });
    render();
    return;
  }
  if (ds.fopt != null && PL && PL.state && PL.state.fin) {
    PL.sent.fa = true;
    send("fa", { text: arr(PL.state.fin.opts)[+ds.fopt] });
    render();
    return;
  }
  if (ds.ppick) {
    const [ti, qi] = ds.ppick.split("-");
    send("pick", { ti, qi });
    return;
  }
  if (ds.pauc) {
    send("auc", { act: ds.pauc });
    return;
  }
  if (ds.catto) {
    if (APP.mode === "player") send("cat", { to: ds.catto });
    else catGive(ds.catto);
    return;
  }
  // host
  if (ds.pick) {
    const [x, y] = ds.pick.split("-").map(Number);
    pick(x, y);
    return;
  }
  if (ds.fj) {
    const [id, v] = ds.fj.split(":");
    finalJudge(id, v === "1");
    return;
  }
  if (ds.kick) {
    const p = HOST.players[ds.kick];
    if (p && confirm(`Удалить ${p.name} из комнаты?`)) hRef(`players/${ds.kick}`).remove();
    return;
  }
  if (ds.menu) {
    S.menu = ds.menu;
    render();
    return;
  }
  if (ds.mact) {
    const id = S.menu,
      p = HOST.players[id];
    S.menu = null;
    if (!p) {
      render();
      return;
    }
    const h = H(),
      cost = h.cur ? h.cur.cost : 100;
    switch (ds.mact) {
      case "chooser":
        setChooser(id);
        break;
      case "give":
        giveAnswer(id);
        break;
      case "plus":
        addScore(id, cost);
        render();
        break;
      case "minus":
        addScore(id, -cost);
        render();
        break;
      case "score": {
        const v = prompt(`Счёт игрока ${p.name}`, p.score || 0);
        if (v != null && v.trim() !== "" && !isNaN(+v)) {
          p.score = Math.round(+v);
          hRef(`players/${id}/score`).set(p.score);
        }
        render();
        break;
      }
      case "rename": {
        const v = prompt(`Новое имя для «${p.name}»`, p.name);
        const n = v == null ? "" : v.trim().slice(0, 20);
        if (n && n !== p.name) {
          p.name = n;
          hRef(`players/${id}/name`).set(n);
        }
        render();
        break;
      }
      case "kick":
        if (confirm(`Удалить ${p.name} из комнаты?`)) {
          hRef(`players/${id}`).remove();
          if (h.chooser === id) {
            const o = online().filter(x => x !== id);
            h.chooser = o[0] || null;
            pushState();
          }
        }
        render();
        break;
    }
    return;
  }
  if (ds.hrename) {
    const p = HOST.players[ds.hrename];
    if (!p) return;
    const v = prompt(`Новое имя для «${p.name}»`, p.name);
    if (v == null) return;
    const n = v.trim().slice(0, 20);
    if (!n || n === p.name) return;
    p.name = n;
    hRef(`players/${ds.hrename}/name`).set(n);
    if (H().phase === "lobby") updateLobby();
    else render();
    return;
  }
  if (ds.cfg) {
    const v = ds.val;
    CFG[ds.cfg] = v === "true" ? true : v === "false" ? false : isNaN(+v) ? v : +v;
    save("svoya.cfg", CFG);
    syncMeta();
    pushState();
    if (ds.cfg === "host") syncSelf();
    return;
  }
  if (ds.tog) {
    CFG[ds.tog] = !CFG[ds.tog];
    save("svoya.cfg", CFG);
    pushState();
    return;
  }
  // library / editor
  if (ds.lib) {
    S.libTab = ds.lib;
    S.upMsg = null;
    render();
    return;
  }
  if (ds.choose) {
    choosePack(ds.choose);
    S.view = "setup";
    hostPackChanged();
    render();
    return;
  }
  if (ds.edit) {
    const src = findPack(ds.edit),
      mine = MINE.some(p => p.id === ds.edit);
    const d = clone(src);
    if (!mine) {
      d.id = null;
      d.title = src.title + " (копия)";
      d.author = "Вы";
    }
    openEditor(d);
    return;
  }
  if (ds.del) {
    const p = MINE.find(x => x.id === ds.del);
    if (p && confirm(`Удалить «${p.title}»?`)) {
      MINE = MINE.filter(x => x.id !== ds.del);
      save("svoya.packs", MINE);
      if (PACK_ID === ds.del) {
        choosePack("demo");
        hostPackChanged();
      }
      render();
    }
    return;
  }
  if (ds.edimgdel && S.edSel) {
    const q = S.draft.rounds[S.edRound].themes[S.edSel[0]].questions[S.edSel[1]];
    delete q.img;
    delete q.url;
    render();
    return;
  }
  if (ds.edcell) {
    S.edSel = ds.edcell.split("-").map(Number);
    render();
    return;
  }
  if (ds.edround) {
    S.edRound = +ds.edround;
    S.edSel = null;
    render();
    return;
  }
  if (ds.edtype && S.edSel) {
    S.draft.rounds[S.edRound].themes[S.edSel[0]].questions[S.edSel[1]].type = ds.edtype;
    render();
    return;
  }
  if (ds.edadd) {
    const d = S.draft,
      r = d.rounds[S.edRound];
    if (ds.edadd === "theme") {
      r.themes.push({ name: "", questions: [] });
      S.edSel = null;
    } else if (ds.edadd === "round") {
      d.rounds.push({ name: "Раунд " + (d.rounds.length + 1), themes: [] });
      S.edRound = d.rounds.length - 1;
      S.edSel = null;
    } else {
      const ti = +ds.edadd.slice(2),
        qs = r.themes[ti].questions;
      qs.push({ cost: qs.length ? qs[qs.length - 1].cost + 100 : 100, text: "", answer: "", type: "normal" });
      S.edSel = [ti, qs.length - 1];
    }
    d.notes = [];
    render();
    return;
  }
  if (ds.eddel) {
    const r = S.draft.rounds[S.edRound];
    if (ds.eddel === "q" && S.edSel) {
      r.themes[S.edSel[0]].questions.splice(S.edSel[1], 1);
      S.edSel = null;
    } else if (ds.eddel.startsWith("theme:")) {
      const ti = +ds.eddel.slice(6);
      if (!r.themes[ti].questions.length || confirm("Удалить тему вместе с вопросами?")) {
        r.themes.splice(ti, 1);
        S.edSel = null;
      }
    }
    S.draft.notes = [];
    render();
    return;
  }
  if (ds.issue != null) {
    const x = validate(S.draft)[+ds.issue];
    if (x) {
      S.edRound = x.r ?? S.edRound;
      S.edSel = x.qi != null ? [x.ti, x.qi] : null;
      render();
    }
    return;
  }
  if (!a) return;
  switch (a) {
    case "host":
      if (APP.dbOk) createRoom();
      break;
    case "resume-host":
      resumeHost(load("svoya.hosting", null));
      break;
    case "rejoin": {
      const c = load("svoya.lastRoom", null);
      if (c) joinRoom(c, ME_NAME.trim() || "Игрок");
      break;
    }
    case "join-code": {
      const c = (document.getElementById("code").value || "").trim(),
        n = (document.getElementById("nm").value || "").trim();
      if (!n) {
        APP.joinErr = "Введите имя, чтобы войти";
        render();
        break;
      }
      ME_NAME = n;
      save("svoya.name", n);
      joinRoom(c, n);
      break;
    }
    case "leave":
      if (
        !PL ||
        PL.kicked ||
        (PL.meta && PL.meta.closed) ||
        confirm("Выйти из комнаты? Вернуться можно по тому же коду, счёт сохранится.")
      )
        leaveRoom();
      break;
    case "buzz":
      if (e.detail === 0) plBuzz();
      break;
    case "bet": {
      const v = +document.getElementById("bet").value;
      PL.sent.bet = true;
      send("bet", { v });
      render();
      break;
    }
    case "fa":
      submitFA();
      break;
    case "pa":
      submitPA();
      break;
    case "to-phone":
      APP.mode = "player";
      render();
      break;
    case "to-board":
      APP.mode = "host";
      render();
      break;
    case "quiz-end":
      quizReveal();
      break;
    case "menu-close":
      S.menu = null;
      render();
      break;
    case "t-add10":
      addTime(10000);
      break;
    case "t-add30":
      addTime(30000);
      break;
    case "t-stop":
      stopTime();
      break;
    case "skip-q":
      skipQuestion();
      break;
    case "undo-q":
      undoQuestion();
      break;
    case "rand-turn": {
      const o = online();
      if (o.length) setChooser(o[Math.floor(Math.random() * o.length)]);
      break;
    }
    case "low-turn": {
      const o = online()
        .slice()
        .sort((a, b) => (HOST.players[a].score || 0) - (HOST.players[b].score || 0));
      if (o.length) setChooser(o[0]);
      break;
    }
    case "ok":
      judge(true);
      break;
    case "bad":
      judge(false);
      break;
    case "next":
      toBoard();
      break;
    case "open-now":
      openBuzz();
      break;
    case "nobody":
      reveal("Никто не ответил", null);
      break;
    case "skip":
      clearTimers();
      endRound();
      break;
    case "pass-turn": {
      const ids = online();
      if (ids.length) {
        const i = ids.indexOf(H().chooser);
        H().chooser = ids[(i + 1) % ids.length];
        pushState();
      }
      break;
    }
    case "auc-skip": {
      const q = H().auc && H().auc.queue[0];
      if (q) aucAct(q, "pass");
      break;
    }
    case "auc-end":
      aucFinish();
      break;
    case "force-bets":
      checkBets(true);
      break;
    case "force-answers":
      checkAnswers(true);
      break;
    case "lobby":
      if (H().phase === "end" || confirm("Вернуться в лобби? Текущая игра прервётся.")) backToLobby();
      break;
    case "close-room":
      closeRoom();
      break;
    case "start":
      startGame();
      break;
    case "copy-link": {
      const u = joinURL(HOST.code);
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject())
        .then(() => {
          t.textContent = "Скопировано";
          setTimeout(() => {
            t.textContent = "Скопировать ссылку";
          }, 1500);
        })
        .catch(() => prompt("Ссылка для входа", u));
      break;
    }
    case "lib":
      S.view = "library";
      S.libTab = MINE.length ? "mine" : "catalog";
      render();
      break;
    case "back-setup":
      S.view = "setup";
      render();
      break;
    case "new":
      openEditor(
        Object.assign(blankPack(), {
          rounds: [
            {
              name: "Раунд 1",
              themes: [{ name: "", questions: [{ cost: 100, text: "", answer: "", type: "normal" }] }]
            }
          ]
        })
      );
      break;
    case "sample":
      document.getElementById("paste").value = SAMPLE;
      break;
    case "parse": {
      const v = document.getElementById("paste").value.trim();
      if (!v) {
        S.upMsg = { err: true, text: "Вставьте текст с вопросами" };
        render();
        break;
      }
      openEditor(parseText(v, "Вставленный пак"));
      break;
    }
    case "ed-cancel":
      S.view = "library";
      S.draft = null;
      render();
      break;
    case "ed-save":
      saveDraft();
      S.view = "library";
      S.libTab = "mine";
      S.draft = null;
      hostPackChanged();
      render();
      break;
    case "ed-play": {
      const id = saveDraft();
      choosePack(id);
      S.view = "setup";
      S.draft = null;
      hostPackChanged();
      render();
      break;
    }
  }
});

// Enter отправляет ответы и код, пробел на компьютере — кнопка игрока.
document.addEventListener("keydown", e => {
  const id = e.target.id;
  if (id === "fa" && e.key === "Enter") {
    submitFA();
    return;
  }
  if (id === "pa" && e.key === "Enter") {
    submitPA();
    return;
  }
  if ((id === "code" || id === "nm") && e.key === "Enter" && APP.homeView === "code") {
    document.querySelector('[data-act="join-code"]').click();
    return;
  }
  if (
    e.code === "Space" &&
    APP.mode === "player" &&
    !["INPUT", "TEXTAREA", "BUTTON"].includes(e.target.tagName)
  ) {
    e.preventDefault();
    plBuzz();
  }
});

