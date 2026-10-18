/* ======================================================================
   15. ОБЩИЕ БЛОКИ ИНТЕРФЕЙСА
   Используются и на экране ведущего, и на телефоне игрока.
   ====================================================================== */

// Полоска оставшегося времени или надпись «без лимита».
function dlBar(dl, total, cls) {
  if (!dl) return `<div class="nolimit">⏱ без лимита времени</div>`;
  const left = Math.max(0, dl - now()),
    T = Math.max(total || left, 1);
  return `<div class="${cls || "timer"}"><i style="animation-duration:${T}ms;animation-delay:-${Math.max(0, T - left)}ms"></i></div>`;
}

// Заставка перед вопросом: раунд, тема и стоимость крупно. Общая для экрана ведущего и «Экрана».
function introHTML(c, roundName) {
  const sp = c.sp === "norisk" ? "Вопрос без риска" : "";
  return `<div class="q intro"><div class="meta">${esc(roundName || "")}</div><div class="intro-theme">${esc(c.theme)}</div><div class="intro-cost">${fmt(c.cost)}</div>${sp ? `<div class="sub">${sp}</div>` : ""}</div>`;
}

// Варианты ответа. correct — правильный (подсвечивается после ответа),
// mine — выбор игрока, counts — сколько человек выбрали, clickable — имя data-атрибута для кнопок.
function optsHTML(opts, correct, mine, counts, clickable) {
  return (
    `<div class="opts">` +
    arr(opts)
      .map((o, i) => {
        const cls = ["opt-b"];
        if (correct != null) {
          if (i === correct) cls.push("ok");
          else if (i === mine) cls.push("bad");
          else cls.push("dim");
        } else if (i === mine) cls.push("sel");
        const inner = `<b>${LET[i]}</b><span>${esc(o)}</span>${counts ? `<em>${counts[i]}</em>` : ""}`;
        return clickable
          ? `<button class="${cls.join(" ")}" data-${clickable}="${i}">${inner}</button>`
          : `<div class="${cls.join(" ")}">${inner}</div>`;
      })
      .join("") +
    `</div>`
  );
}

// Финальный экран: победитель, пьедестал, все игроки по местам и номинации.
function statsHTML(S2, phone, meName) {
  if (!S2) return `<div class="q"><div class="big">Игра окончена</div></div>`;
  const P = arr(S2.players),
    top = P.slice(0, 3),
    medal = ["🥇", "🥈", "🥉"];
  const win = P[0] && P[0].score > 0 ? P[0] : null;
  const pod = `<div class="podium">${[1, 0, 2]
    .filter(i => top[i])
    .map(
      i =>
        `<div class="pod p${i + 1}"><div class="pm">${medal[i]}</div><div class="pn">${esc(top[i].name)}</div><div class="ps">${fmt(top[i].score)}</div><div class="pb">${i + 1}</div></div>`
    )
    .join("")}</div>`;
  const places = P.length
    ? `<div class="places">${P.map((p, i) => `<div class="${meName && p.name === meName ? "me" : ""}"><i>${i + 1}</i><span>${esc(p.name)}</span><b>${fmt(p.score)}</b></div>`).join("")}</div>`
    : "";
  const noms = arr(S2.noms).length
    ? `<div class="noms">${arr(S2.noms)
        .map(
          x =>
            `<div class="nom"><div class="ni">${x.i}</div><div class="nt">${esc(x.t)}</div><div class="nn">${esc(x.n)}</div><div class="nd">${esc(x.d)}</div></div>`
        )
        .join("")}</div>`
    : "";
  return `<div class="endscreen ${phone ? "ph" : ""}"><div class="meta">Игра окончена</div><div class="big">${win ? esc(win.name) + (phone && win.name === meName ? ", вы победили!" : " побеждает!") : "Победителя нет"}</div>${pod}${noms}${places}</div>`;
}

