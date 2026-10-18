/* ======================================================================
   17. БИБЛИОТЕКА ПАКОВ И РЕДАКТОР
   Вкладки «Мои паки», «Каталог», «Загрузить» и редактор с подсветкой ошибок.
   Редактор работает с копией пака (S.draft) и сохраняет её в MINE.
   ====================================================================== */

// Карточка пака в библиотеке.
function packCard(p, mine) {
  const sel = p.id === PACK_ID;
  return `<div class="pk ${sel ? "sel" : ""}"><b>${esc(p.title)}</b><span class="st">${stats(p)}${p.author ? " · " + esc(p.author) : ""}</span>
    <div class="row">${sel ? `<button class="sb" disabled>Выбран</button>` : `<button class="sb gold" data-choose="${p.id}">Выбрать</button>`}
    <button class="sb" data-edit="${p.id}">${mine ? "Изменить" : "Копировать и изменить"}</button>${mine ? `<button class="sb red" data-del="${p.id}">Удалить</button>` : ""}</div></div>`;
}

// Библиотека: «Мои паки», «Каталог», «Загрузить».
function renderLibrary() {
  const t = S.libTab;
  let body = "";
  if (t === "mine")
    body = MINE.length
      ? `<div class="packs">${MINE.map(p => packCard(p, true)).join("")}</div>`
      : `<div class="empty">Здесь будут ваши паки: созданные с нуля, загруженные и скопированные из каталога.</div>`;
  if (t === "catalog")
    body = `<div class="packs">${CATALOG.map(p => packCard(p, false)).join("")}</div><p class="fmt" style="margin-top:10px">В приложении здесь будут паки, которые опубликовали пользователи, с поиском и рейтингом.</p>`;
  if (t === "upload")
    body = `<div class="up-grid">
    <label class="drop" id="drop"><input type="file" id="file" accept=".siq,.zip,.json,.csv,.tsv,.xlsx,.xls,.docx,.txt,.md,.pdf,.jpg,.jpeg,.png">
      <b>${S.upBusy ? "Разбираем файл…" : "Перетащите файл или нажмите, чтобы выбрать"}</b><span>.siq (SIGame), Excel, CSV, JSON, Word, TXT</span></label>
    ${S.upMsg ? `<div class="msg ${S.upMsg.err ? "err" : "info"}">${esc(S.upMsg.text)}</div>` : ""}
    <div class="fmt">Или вставьте текст из заметок, Word или Google Docs: <code># Тема</code> начинает тему, строка вопроса: <code>100 Вопрос = Ответ</code>. Ответ можно писать на следующей строке после <code>Ответ:</code>. Метки <code>[кот]</code>, <code>[аукцион]</code>, <code>[без риска]</code>, финал: <code>Финал: Тема</code>, новый раунд: <code>Раунд 2</code>.</div>
    <textarea class="ta" id="paste" placeholder="# Космос&#10;100 Ближайшая к Солнцу планета? = Меркурий"></textarea>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="sb gold" data-act="parse">Разобрать текст</button><button class="sb" data-act="sample">Вставить пример</button><button class="sb" data-act="new">Создать пустой пак</button></div>
    <p class="fmt">Для Excel и CSV колонки: Тема, Стоимость, Вопрос, Ответ, Тип (необязательно), Раунд (необязательно). Тема «Финал» становится финалом.</p>
  </div>`;
  document.getElementById("tv").innerHTML = `
    <div class="tv-head"><span class="tv-title">Вопросы</span><button class="ghost" data-act="back-setup">← К настройке</button></div>
    <div class="lib-top"><div class="ltabs" role="tablist">
      <button role="tab" data-lib="mine" aria-selected="${t === "mine"}">Мои паки${MINE.length ? " · " + MINE.length : ""}</button>
      <button role="tab" data-lib="catalog" aria-selected="${t === "catalog"}">Каталог</button>
      <button role="tab" data-lib="upload" aria-selected="${t === "upload"}">Загрузить</button></div>
      ${t !== "upload" ? `<button class="sb gold" data-act="new">+ Новый пак</button>` : ""}</div>${body}`;
  if (t === "upload") wireUpload();
}

// Подключает выбор файла и перетаскивание на вкладке «Загрузить».
function wireUpload() {
  const drop = document.getElementById("drop"),
    inp = document.getElementById("file");
  inp.addEventListener("change", () => {
    if (inp.files[0]) handleFile(inp.files[0]);
  });
  ["dragenter", "dragover"].forEach(ev =>
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add("over");
    })
  );
  ["dragleave", "drop"].forEach(ev =>
    drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.remove("over");
    })
  );
  drop.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
}

// Импортирует выбранный файл и открывает результат в редакторе.
async function handleFile(f) {
  S.upBusy = true;
  S.upMsg = null;
  render();
  try {
    const p = await importFile(f);
    S.upBusy = false;
    openEditor(p);
  } catch (e) {
    S.upBusy = false;
    S.upMsg = { err: true, text: e.message || "Не удалось прочитать файл" };
    render();
  }
}

// Открывает пак в редакторе и сразу выделяет первый вопрос с ошибкой.
function openEditor(p) {
  S.draft = p;
  S.edRound = 0;
  S.edSel = null;
  S.view = "editor";
  const firstErr = validate(p).find(x => x.lvl === "err" && x.qi != null);
  if (firstErr) {
    S.edRound = firstErr.r;
    S.edSel = [firstErr.ti, firstErr.qi];
  }
  render();
}

// Блок ошибок и предупреждений над табло редактора.
function issuesHTML(list) {
  const e = list.filter(x => x.lvl === "err").length,
    w = list.length - e;
  const cls = e ? "has-err" : w ? "has-warn" : "";
  const head = !list.length
    ? "Ошибок нет, пак готов к игре"
    : `${e ? `Ошибок: ${e}. ` : ""}${w ? `Предупреждений: ${w}. ` : ""}${e ? "С ошибками пак нельзя запустить." : "Можно играть."}`;
  const items = list
    .slice(0, 8)
    .map(
      (x, i) =>
        `<li class="${x.lvl === "err" ? "e" : "w"}">${x.qi != null || x.ti != null ? `<button data-issue="${i}">${esc(x.msg)}</button>` : esc(x.msg)}</li>`
    )
    .join("");
  return {
    cls,
    html: `<b>${head}</b>${list.length ? `<ul>${items}${list.length > 8 ? `<li>…и ещё ${list.length - 8}</li>` : ""}</ul>` : ""}`
  };
}

// Подпись ячейки в редакторе: стоимость и пометки (кот, картинка, варианты).
function cellInner(q) {
  const m = [TMARK[q.type], (q.img || q.url) && "🖼", q.choices && "АБВ"].filter(Boolean).join(" ");
  return `${q.cost || "?"}${m ? `<sup>${m}</sup>` : ""}`;
}

// Редактор пака: название, раунды, табло тем и вопросов, панель выбранного вопроса, финал.
function renderEditor() {
  const d = S.draft,
    r = d.rounds[S.edRound],
    list = validate(d),
    iss = issuesHTML(list);
  const lvl = {};
  list.forEach(x => {
    if (x.qi != null && x.r === S.edRound) {
      const k = x.ti + "-" + x.qi;
      if (lvl[k] !== "err") lvl[k] = x.lvl;
    }
  });
  const rows = r.themes
    .map(
      (t, ti) =>
        `<div class="ed-row"><div class="ed-theme"><input data-ed="theme:${ti}" value="${esc(t.name)}" placeholder="Название темы" aria-label="Название темы"><button class="ed-x" data-eddel="theme:${ti}" aria-label="Удалить тему">×</button></div>` +
        t.questions
          .map((q, qi) => {
            const on = S.edSel && S.edSel[0] === ti && S.edSel[1] === qi;
            return `<button class="ed-cell ${lvl[ti + "-" + qi] || ""} ${on ? "on" : ""}" data-edcell="${ti}-${qi}">${cellInner(q)}</button>`;
          })
          .join("") +
        `<button class="ed-add" data-edadd="q:${ti}" aria-label="Добавить вопрос">+</button></div>`
    )
    .join("");
  let panel = "";
  if (S.edSel && r.themes[S.edSel[0]] && r.themes[S.edSel[0]].questions[S.edSel[1]]) {
    const q = r.themes[S.edSel[0]].questions[S.edSel[1]];
    panel = `<div class="ed-panel"><b>${esc(r.themes[S.edSel[0]].name || "Тема")} · вопрос ${S.edSel[1] + 1}</b>
      <label>Вопрос<textarea data-ed="q:text">${esc(q.text)}</textarea></label>
      <div class="ed-img">${q.img || q.url ? `<img id="ed-imgprev" src="${esc(imgSrc(q) || "")}" alt="Картинка вопроса">` : ""}
        <div class="row"><label class="sb">${q.img || q.url ? "Заменить картинку" : "Добавить картинку"}<input type="file" accept="image/*" data-edimg="1" hidden></label>
        <input class="ed-url" data-ed="q:url" placeholder="или ссылка https://…" value="${esc(q.url || "")}" aria-label="Ссылка на картинку">
        ${q.img || q.url ? `<button class="sb red" data-edimgdel="1">Убрать</button>` : ""}</div></div>
      <div class="ed-two"><label>Ответ<input data-ed="q:answer" value="${esc(q.answer)}"></label><label>Стоимость<input data-ed="q:cost" type="number" inputmode="numeric" min="1" step="100" value="${q.cost || ""}"></label></div>
      <label>Варианты ответа <small style="opacity:.7">(через точку с запятой, вместе с правильным; показываются игрокам)</small><input data-ed="q:choices" value="${esc((q.choices || []).join("; "))}" placeholder="Пусто — вопрос без вариантов"></label>
      ${q.choices && q.choices.length ? "" : `<label>Неверные варианты только для режима «Викторина» <small style="opacity:.7">(можно оставить пустым)</small><input data-ed="q:wrong" value="${esc((q.wrong || []).join("; "))}" placeholder="Подберутся автоматически из других ответов"></label>`}
      <div>${
        `<div class="seg" role="group">` +
        Object.entries(TYPES)
          .map(
            ([k, l]) =>
              `<button data-edtype="${k}" aria-pressed="${(q.type || "normal") === k}">${l}</button>`
          )
          .join("") +
        `</div>`
      }</div>
      <div><button class="sb red" data-eddel="q">Удалить вопрос</button></div></div>`;
  }
  const f = d.final;
  document.getElementById("tv").innerHTML = `
    <div class="tv-head"><span class="tv-title">Редактор пака</span><button class="ghost" data-act="ed-cancel">← Без сохранения</button></div>
    <div class="ed-top"><input class="ed-title" data-ed="title" value="${esc(d.title)}" aria-label="Название пака"><button class="sb gold" data-act="ed-save">Сохранить</button><button class="sb" data-act="ed-play">Сохранить и выбрать</button></div>
    <div class="issues ${iss.cls}" id="ed-issues">${iss.html}</div>
    <div class="rtabs">${d.rounds.map((x, i) => `<button data-edround="${i}" aria-pressed="${i === S.edRound}">${esc(x.name)}</button>`).join("")}<button data-edadd="round">+ раунд</button></div>
    <div class="ed-board">${rows || `<div class="empty">В раунде пока нет тем</div>`}</div>
    <div class="ed-foot"><button class="sb" data-edadd="theme">+ Тема</button></div>
    ${panel}
    <div class="ed-panel"><label class="fin-toggle"><input type="checkbox" data-edfinal ${f ? "checked" : ""}> Финал со ставками</label>
      ${f ? `<div class="ed-two"><label>Тема финала<input data-ed="final:theme" value="${esc(f.theme)}"></label><span></span></div><label>Вопрос<textarea data-ed="final:text">${esc(f.text)}</textarea></label><label>Ответ<input data-ed="final:answer" value="${esc(f.answer)}"></label>` : ""}</div>`;
}

// Обновляет подсветку ошибок без полной перерисовки, чтобы не сбивать ввод.
function refreshEditor() {
  const d = S.draft,
    list = validate(d),
    iss = issuesHTML(list),
    box = document.getElementById("ed-issues");
  if (box) {
    box.className = "issues " + iss.cls;
    box.innerHTML = iss.html;
  }
  const lvl = {};
  list.forEach(x => {
    if (x.qi != null && x.r === S.edRound) {
      const k = x.ti + "-" + x.qi;
      if (lvl[k] !== "err") lvl[k] = x.lvl;
    }
  });
  document.querySelectorAll("[data-edcell]").forEach(b => {
    const [ti, qi] = b.dataset.edcell.split("-").map(Number),
      q = d.rounds[S.edRound].themes[ti].questions[qi];
    b.classList.remove("err", "warn");
    if (lvl[ti + "-" + qi]) b.classList.add(lvl[ti + "-" + qi]);
    b.innerHTML = cellInner(q);
  });
}

// Сохраняет то, что ввели в поле редактора, в черновик пака.
function edInput(el) {
  const d = S.draft,
    k = el.dataset.ed,
    v = el.value;
  if (k === "title") d.title = v;
  else if (k.startsWith("theme:")) d.rounds[S.edRound].themes[+k.slice(6)].name = v;
  else if (k.startsWith("final:")) d.final[k.slice(6)] = v;
  else if (k.startsWith("q:") && S.edSel) {
    const q = d.rounds[S.edRound].themes[S.edSel[0]].questions[S.edSel[1]],
      f = k.slice(2);
    if (f === "choices") {
      const l = v
        .split(";")
        .map(x => x.trim())
        .filter(Boolean);
      if (l.length >= 2) q.choices = l.slice(0, 6);
      else delete q.choices;
      d.notes = [];
      refreshEditor();
      return;
    }
    if (f === "wrong") {
      const l = v
        .split(";")
        .map(x => x.trim())
        .filter(Boolean);
      if (l.length) q.wrong = l.slice(0, 5);
      else delete q.wrong;
      return;
    }
    if (f === "url") {
      const u = v.trim();
      if (u) {
        q.url = u;
        delete q.img;
      } else delete q.url;
      const im = document.getElementById("ed-imgprev");
      if (im && u) im.src = u;
      d.notes = [];
      refreshEditor();
      return;
    }
    q[f] = f === "cost" ? parseInt(v, 10) || 0 : v;
    if (f === "text" || f === "answer") delete q.media;
  }
  d.notes = [];
  refreshEditor();
}

// Сохраняет черновик в «Мои паки».
function saveDraft() {
  const d = S.draft;
  delete d.notes;
  if (!d.id || !MINE.some(p => p.id === d.id)) d.id = uid();
  const i = MINE.findIndex(p => p.id === d.id);
  if (i >= 0) MINE[i] = clone(d);
  else MINE.unshift(clone(d));
  save("svoya.packs", MINE);
  if (PACK_ID === d.id) PACK = clone(d);
  return d.id;
}

// Выбирает пак для игры.
function choosePack(id) {
  PACK_ID = id;
  PACK = clone(findPack(id));
  save("svoya.pack", id);
}

