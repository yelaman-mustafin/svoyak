/* ======================================================================
   5. ПАКИ: ПРОВЕРКА И ИМПОРТ
   Внутренний формат пака:
     { title, rounds:[{ name, themes:[{ name, questions:[{ cost, text, answer,
       type: normal|cat|auction|norisk, img?, url?, choices?, wrong? }] }] }],
       final:{ theme, text, answer, choices? } | null }
   Любой импорт (.siq, Excel/CSV, Word, текст, JSON) превращается в этот формат,
   а validate() находит ошибки и предупреждения для экрана редактора.
   ====================================================================== */

// Проверяет пак. Возвращает список {lvl: err|warn, msg, r, ti, qi}.
// С ошибками (err) игру начать нельзя, предупреждения (warn) только подсвечиваются.
function validate(p) {
  const out = [];
  const add = (lvl, msg, r, ti, qi) => out.push({ lvl, msg, r, ti, qi });
  if (!p.title || !p.title.trim()) add("err", "Нет названия пака");
  if (!p.rounds.length || p.rounds.every(r => !r.themes.length)) add("err", "В паке нет ни одной темы");
  p.rounds.forEach((r, ri) => {
    r.themes.forEach((t, ti) => {
      const tn = t.name && t.name.trim() ? "«" + t.name.trim() + "»" : "тема " + (ti + 1);
      if (!t.name || !t.name.trim()) add("err", `${r.name}: у темы ${ti + 1} нет названия`, ri, ti, null);
      if (!t.questions.length) add("err", `${tn}: нет вопросов`, ri, ti, null);
      else if (t.questions.length !== 5)
        add(
          "warn",
          `${tn}: ${t.questions.length} ${plural(t.questions.length, "вопрос", "вопроса", "вопросов")}, обычно 5`,
          ri,
          ti,
          null
        );
      let prev = 0,
        unordered = false;
      t.questions.forEach((q, qi) => {
        const where = `${tn}, ${q.cost || "?"}`;
        if ((!q.text || !q.text.trim()) && !q.img && !q.url)
          add("err", `${where}: нет текста вопроса`, ri, ti, qi);
        if (!q.answer || !q.answer.trim()) add("err", `${where}: нет ответа`, ri, ti, qi);
        if (!(q.cost > 0)) add("err", `${where}: стоимость должна быть больше нуля`, ri, ti, qi);
        if (q.cost <= prev) unordered = true;
        prev = q.cost;
        if (q.media) add("warn", `${where}: аудио и видео пока не поддерживаются`, ri, ti, qi);
        if (q.choices && q.answer && !q.choices.some(x => normA(x) === normA(q.answer)))
          add("warn", `${where}: ответа нет среди вариантов`, ri, ti, qi);
      });
      if (unordered && t.questions.length)
        add("warn", `${tn}: стоимости идут не по возрастанию`, ri, ti, null);
    });
  });
  if (p.final) {
    if (!p.final.text || !p.final.text.trim()) add("err", "Финал: нет текста вопроса");
    if (!p.final.answer || !p.final.answer.trim()) add("err", "Финал: нет ответа");
  }
  (p.notes || []).forEach(n => add("warn", n));
  return out;
}

// Пустой пак с одним раундом.
function blankPack(title) {
  return {
    id: null,
    title: title || "Новый пак",
    author: "Вы",
    rounds: [{ name: "Раунд 1", themes: [] }],
    final: null
  };
}

// Определяет тип вопроса по слову из файла: «кот», «аукцион», «без риска» или SIGame-названия.
function typeFromWord(w) {
  w = (w || "").toLowerCase();
  if (/кот|cat|secret|bagcat/.test(w)) return "cat";
  if (/аукц|ставк|stake|auction/.test(w)) return "auction";
  if (/риск|norisk|sponsor/.test(w)) return "norisk";
  return "normal";
}

// Разбирает текстовую разметку:
//   # Тема            — новая тема
//   100 Вопрос = Ответ — вопрос (ответ можно дать следующей строкой «Ответ: …»)
//   [кот] [аукцион] [без риска] — тип вопроса
//   Варианты: a; b; c — варианты ответа к последнему вопросу
//   Раунд 2 / Финал: Тема — новый раунд и финал.
// Нераспознанные строки попадают в предупреждения.
function parseText(txt, title) {
  const p = blankPack(title);
  p.notes = [];
  let round = p.rounds[0],
    theme = null,
    inFinal = false,
    pending = null;
  const ensureTheme = () => {
    if (!theme) {
      theme = { name: "Без названия", questions: [] };
      round.themes.push(theme);
    }
    return theme;
  };
  const pushQ = (cost, text, answer, type) => {
    if (inFinal) {
      p.final.text = text;
      p.final.answer = answer;
      return;
    }
    const t = ensureTheme();
    const c = cost || (t.questions.length ? t.questions[t.questions.length - 1].cost + 100 : 100);
    t.questions.push({ cost: c, text, answer, type });
  };
  txt
    .replace(/\r/g, "")
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      let m;
      if ((m = line.match(/^(?:неверные\s+)?варианты\s*[:\-–—]\s*(.+)$/i))) {
        const list = m[1]
          .split(/[;|]/)
          .map(x => x.trim())
          .filter(Boolean);
        const tgt = inFinal ? p.final : theme && theme.questions[theme.questions.length - 1];
        if (tgt) {
          const ans = normA(tgt.answer || "");
          if (list.some(x => normA(x) === ans) && list.length >= 2) tgt.choices = list.slice(0, 6);
          else tgt.wrong = list.filter(x => normA(x) !== ans).slice(0, 5);
        }
        return;
      }
      if (pending && (m = line.match(/^ответ\s*[:\-–—]\s*(.+)$/i))) {
        pushQ(pending.cost, pending.text, m[1].trim(), pending.type);
        pending = null;
        return;
      }
      if (pending) {
        p.notes.push(`Строка ${i}: у вопроса «${pending.text.slice(0, 30)}…» нет ответа`);
        pushQ(pending.cost, pending.text, "", pending.type);
        pending = null;
      }
      if ((m = line.match(/^#*\s*финал\s*[:\-–—]?\s*(.*)$/i))) {
        inFinal = true;
        p.final = { theme: m[1].trim() || "Финал", text: "", answer: "" };
        return;
      }
      if ((m = line.match(/^(?:раунд|round)\s*[:\-–—]?\s*(.*)$/i)) && !line.includes("=")) {
        if (round.themes.length) {
          round = {
            name: m[1].trim()
              ? ("Раунд " + m[1].trim()).replace(/^Раунд\s+Раунд/i, "Раунд")
              : "Раунд " + (p.rounds.length + 1),
            themes: []
          };
          p.rounds.push(round);
        }
        theme = null;
        inFinal = false;
        return;
      }
      if ((m = line.match(/^#+\s*(.+)$/)) || (m = line.match(/^тема\s*[:\-–—]\s*(.+)$/i))) {
        inFinal = false;
        theme = { name: m[1].trim(), questions: [] };
        round.themes.push(theme);
        return;
      }
      m = line.match(/^(?:[-*•]\s*)?(?:(\d{2,5})\s*[.):\-–—]?\s*)?(?:\[([^\]]+)\]\s*)?(.+)$/);
      let cost = m[1] ? +m[1] : null,
        type = m[2] ? typeFromWord(m[2]) : "normal",
        body = m[3];
      if (!cost && !inFinal) body = body.replace(/^\d{1,2}[.)]\s+/, "");
      const sep = body.match(/^(.+?)\s*(?:=|\|\s*|—\s*ответ\s*:|ответ\s*:)\s*(.+)$/i);
      if (sep) {
        pushQ(cost, sep[1].trim(), sep[2].trim(), type);
        return;
      }
      if (inFinal) {
        if (!p.final.text) p.final.text = body.trim();
        else if (!p.final.answer) p.final.answer = body.replace(/^ответ\s*[:\-–—]\s*/i, "").trim();
        return;
      }
      if (!cost) body = body.replace(/^\d{1,2}[.)]\s+/, "");
      if (cost || /\?$/.test(body)) {
        pending = { cost, text: body.trim(), type };
        return;
      }
      p.notes.push(`Строка ${i + 1} не распознана: «${line.slice(0, 40)}»`);
    });
  if (pending) {
    p.notes.push(`У вопроса «${pending.text.slice(0, 30)}…» нет ответа`);
    pushQ(pending.cost, pending.text, "", pending.type);
  }
  p.rounds = p.rounds.filter(r => r.themes.length || p.rounds.length === 1);
  return p;
}

// Разбирает таблицу (Excel или CSV). Колонки ищутся по заголовкам:
// Тема, Стоимость, Вопрос, Ответ, Тип, Раунд, Варианты. Тема «Финал» становится финалом.
// Если заголовков нет, порядок такой: тема, стоимость, вопрос, ответ, тип.
function parseRows(rows, title) {
  const p = blankPack(title);
  p.notes = [];
  rows = rows.filter(r => r && r.some(c => String(c ?? "").trim()));
  if (!rows.length) return p;
  const h = rows[0].map(c => String(c ?? "").toLowerCase());
  const find = re => h.findIndex(c => re.test(c));
  let col = {
    opts: find(/вариант|неверн|option|wrong/),
    round: find(/раунд|round/),
    theme: find(/тем|theme|topic/),
    cost: find(/стоим|цен|cost|price|балл|очк/),
    q: find(/вопрос|question/),
    a: find(/ответ|answer/),
    type: find(/тип|type/)
  };
  if (col.q < 0 || col.a < 0) {
    col = { round: -1, theme: 0, cost: 1, q: 2, a: 3, type: 4 };
  } else rows = rows.slice(1);
  const rmap = {};
  rows.forEach((r, i) => {
    const g = k => (col[k] >= 0 ? String(r[col[k]] ?? "").trim() : "");
    const th = g("theme") || "Без названия",
      text = g("q"),
      ans = g("a");
    if (/^финал/i.test(th) || /^финал/i.test(g("round"))) {
      p.final = { theme: th.replace(/^финал\s*[:\-–—]?\s*/i, "") || "Финал", text, answer: ans };
      return;
    }
    const rn = g("round") || "Раунд 1";
    if (!rmap[rn]) {
      rmap[rn] =
        rn === "Раунд 1" && !p.rounds[0].themes.length && !Object.keys(rmap).length
          ? p.rounds[0]
          : (p.rounds.push({ name: rn, themes: [] }), p.rounds[p.rounds.length - 1]);
      rmap[rn].name = rn;
    }
    const R = rmap[rn];
    let t = R.themes.find(x => x.name === th);
    if (!t) {
      t = { name: th, questions: [] };
      R.themes.push(t);
    }
    const c = parseInt(g("cost").replace(/\s/g, ""), 10);
    const nq = {
      cost: c > 0 ? c : (t.questions.length + 1) * 100,
      text,
      answer: ans,
      type: typeFromWord(g("type"))
    };
    const ol = g("opts");
    if (ol) {
      const na = normA(ans),
        l = ol
          .split(/[;|]/)
          .map(x => x.trim())
          .filter(Boolean);
      if (l.some(x => normA(x) === na) && l.length >= 2) nq.choices = l.slice(0, 6);
      else nq.wrong = l.filter(x => normA(x) !== na).slice(0, 5);
    }
    t.questions.push(nq);
  });
  return p;
}

// Простой разбор CSV: сам определяет разделитель (; , или табуляция), понимает кавычки.
function parseCSV(txt) {
  txt = txt.replace(/^\uFEFF/, "");
  const first = txt.split("\n")[0];
  const counts = {
    ";": first.split(";").length,
    ",": first.split(",").length,
    "\t": first.split("\t").length
  };
  const d = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const rows = [];
  let row = [],
    cell = "",
    q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') {
        if (txt[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Разбирает content.xml из пака SIGame (старый формат 4 и новый 5).
// Текст, картинки (пока как ссылки на файлы), варианты ответов (answerOptions),
// типы вопросов и финальный раунд. Аудио и видео помечаются как неподдерживаемые.
function parseSiqXml(xml, title) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const pk = doc.getElementsByTagName("package")[0];
  const p = blankPack((pk && pk.getAttribute("name")) || title);
  p.rounds = [];
  p.notes = [];
  const kids = (el, tag) => Array.from(el.children).filter(c => c.localName === tag);
  const one = (el, tag) => kids(el, tag)[0];
  function readQ(q) {
    let text = "",
      media = null,
      imgRef = null,
      url = null;
    const takeImg = v => {
      v = (v || "").trim();
      if (!v) return;
      if (/^https?:\/\//i.test(v)) url = v;
      else imgRef = v.replace(/^@/, "");
    };
    const params = one(q, "params");
    let choices = null,
      letters = null;
    if (params) {
      const ao = kids(params, "param").find(x => x.getAttribute("name") === "answerOptions");
      if (ao) {
        const ops = kids(ao, "param");
        if (ops.length >= 2) {
          letters = ops.map(o => (o.getAttribute("name") || "").trim());
          choices = ops.map(o =>
            kids(o, "item")
              .map(it => {
                const t = it.getAttribute("type");
                return !t || t === "text"
                  ? it.textContent.trim()
                  : "[" + (t === "image" ? "картинка" : "медиа") + "]";
              })
              .join(" ")
              .trim()
          );
        }
      }
      const qp = kids(params, "param").find(x => x.getAttribute("name") === "question");
      if (qp)
        kids(qp, "item").forEach(it => {
          const t = it.getAttribute("type");
          if (!t || t === "text") text += (text ? " " : "") + it.textContent.trim();
          else if (t === "image") takeImg(it.textContent);
          else media = t;
        });
    }
    const sc = one(q, "scenario");
    if (sc)
      kids(sc, "atom").forEach(a => {
        const t = a.getAttribute("type");
        if (!t || t === "text" || t === "say") text += (text ? " " : "") + a.textContent.trim();
        else if (t === "image") takeImg(a.textContent);
        else if (t !== "marker") media = t;
      });
    const right = one(q, "right");
    const ans = right
      ? kids(right, "answer")
          .map(a => a.textContent.trim())
          .filter(Boolean)[0] || ""
      : "";
    let type = q.getAttribute("type") || "";
    const tEl = one(q, "type");
    if (tEl) type = tEl.getAttribute("name") || type;
    if (!text && media)
      text = `[${media === "image" ? "картинка" : media === "voice" || media === "audio" ? "аудио" : media === "video" ? "видео" : "медиа"}]`;
    let answer = ans;
    if (choices) {
      const li = letters.findIndex(l => l.toLowerCase() === ans.trim().toLowerCase());
      if (li >= 0) answer = choices[li];
    }
    const o = { cost: +q.getAttribute("price") || 0, text, answer, type: typeFromWord(type), media };
    if (choices) o.choices = choices;
    if (imgRef) o._imgRef = imgRef;
    if (url) o.url = url;
    if (!media) delete o.media;
    return o;
  }
  const roundsEl = pk ? one(pk, "rounds") : null;
  (roundsEl ? kids(roundsEl, "round") : []).forEach((r, ri) => {
    const themesEl = one(r, "themes");
    const themes = themesEl ? kids(themesEl, "theme") : [];
    if (r.getAttribute("type") === "final") {
      const t = themes[0];
      if (!t) return;
      const qs = one(t, "questions");
      const q = qs && kids(qs, "question")[0];
      if (q) {
        const x = readQ(q);
        p.final = { theme: t.getAttribute("name") || "Финал", text: x.text, answer: x.answer };
        if (x.choices) p.final.choices = x.choices;
        if (x.media) p.notes.push("Финал содержит медиа, оно пока не переносится");
      }
      return;
    }
    p.rounds.push({
      name: r.getAttribute("name") || "Раунд " + (ri + 1),
      themes: themes.map(t => {
        const qs = one(t, "questions");
        return { name: t.getAttribute("name") || "", questions: (qs ? kids(qs, "question") : []).map(readQ) };
      })
    });
  });
  if (!p.rounds.length) p.rounds = [{ name: "Раунд 1", themes: [] }];
  return p;
}

// Импорт файла любого поддерживаемого формата в пак.
// Для .siq ещё извлекает картинки из архива, сжимает и кладёт в IndexedDB.
async function importFile(file) {
  const name = file.name,
    ext = (name.split(".").pop() || "").toLowerCase(),
    base = name.replace(/\.[^.]+$/, "");
  if (ext === "siq" || ext === "zip") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    const zip = await JSZip.loadAsync(file);
    const f = zip.file("content.xml");
    if (!f) throw new Error("В архиве нет content.xml. Это точно пак SIGame?");
    const p = parseSiqXml(await f.async("string"), base);
    const names = Object.keys(zip.files);
    const findImg = name => {
      for (const c of [name, encodeURIComponent(name), encodeURI(name)]) {
        const z = zip.file("Images/" + c);
        if (z) return z;
      }
      const low = name.toLowerCase();
      const k = names.find(fn => {
        const b = fn.split("/").pop();
        let d = b;
        try {
          d = decodeURIComponent(b);
        } catch (e) {}
        return d.toLowerCase() === low || b.toLowerCase() === low;
      });
      return k ? zip.file(k) : null;
    };
    const qs = [];
    p.rounds.forEach(r =>
      r.themes.forEach(t =>
        t.questions.forEach(q => {
          if (q._imgRef) qs.push(q);
        })
      )
    );
    let miss = 0;
    for (const q of qs) {
      const z = findImg(q._imgRef);
      delete q._imgRef;
      if (!z) {
        miss++;
        continue;
      }
      try {
        q.img = await imgPut(await compressImage(await z.async("blob")));
      } catch (e) {
        miss++;
      }
    }
    if (miss)
      p.notes.push(
        `${miss} ${plural(miss, "картинку", "картинки", "картинок")} не удалось извлечь из архива`
      );
    return p;
  }
  if (ext === "json") {
    const j = JSON.parse(await file.text());
    if (!j.rounds) throw new Error("В JSON нет поля rounds: это не пак в формате приложения");
    return Object.assign(blankPack(base), j, { id: null });
  }
  if (ext === "csv" || ext === "tsv") return parseRows(parseCSV(await file.text()), base);
  if (ext === "xlsx" || ext === "xls") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const wb = XLSX.read(await file.arrayBuffer());
    const sh = wb.Sheets[wb.SheetNames[0]];
    return parseRows(XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" }), base);
  }
  if (ext === "docx") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseText(r.value, base);
  }
  if (ext === "txt" || ext === "md") return parseText(await file.text(), base);
  if (ext === "pdf" || ["jpg", "jpeg", "png", "heic", "webp"].includes(ext))
    throw new Error("PDF и фото будут через распознавание текста в приложении. Пока вставьте текст вручную.");
  throw new Error(`Формат .${ext} не поддерживается`);
}

