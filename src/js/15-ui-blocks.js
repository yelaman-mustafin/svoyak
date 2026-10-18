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

// Финальный экран: победитель, пьедестал, итоги, таблица игроков и статистика по вопросам.
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
  const hl = [
    `Сыграно вопросов: <b>${S2.total}</b>, отвечено верно: <b>${S2.ok}</b>${S2.total ? ` (${Math.round((S2.ok / S2.total) * 100)}%)` : ""}`
  ];
  if (S2.fast)
    hl.push(
      `Самая быстрая реакция: <b>${esc(S2.fast.name)}</b>, ${String(S2.fast.best).replace(".", ",")} с`
    );
  if (S2.hard) hl.push(`Самая сложная тема: <b>${esc(S2.hard.t)}</b>, верно ${S2.hard.ok} из ${S2.hard.n}`);
  const table = `<div class="st-wrap"><table class="st"><thead><tr><th>#</th><th>Игрок</th><th>Очки</th><th>Верно</th><th>Ошибки</th><th>Реакция</th></tr></thead><tbody>${P.map((p, i) => `<tr${meName && p.name === meName ? ' class="me-row"' : ""}><td>${i + 1}</td><td>${esc(p.name)}${p.fin === true ? " ✓ф" : p.fin === false ? " ✗ф" : ""}</td><td>${fmt(p.score)}</td><td>${p.right}</td><td>${p.wrong}</td><td>${p.best != null ? String(p.best).replace(".", ",") + " с" : "—"}</td></tr>`).join("")}</tbody></table></div>`;
  const qs = arr(S2.qs)
    .map(
      q =>
        `<li class="${q.r === "right" ? "r" : q.r === "wrong" ? "w" : "n"}"><div><b>${esc(q.t)} · ${q.c}</b> ${esc(q.x)}</div><div class="qa">Ответ: ${esc(q.a)} · ${q.r === "right" ? (q.n ? `верно ${arr(q.n)[0]} из ${arr(q.n)[1]}, первым ` : "ответил ") + esc(q.by) : q.r === "wrong" ? "никто не ответил верно" : "никто не отвечал"}${arr(q.w).length && !q.n ? ` · ошиблись: ${arr(q.w).map(esc).join(", ")}` : ""}</div></li>`
    )
    .join("");
  return `<div class="endscreen ${phone ? "ph" : ""}"><div class="meta">Игра окончена</div><div class="big">${win ? esc(win.name) + (phone && win.name === meName ? ", вы победили!" : " побеждает!") : "Победителя нет"}</div>${pod}<div class="hl">${hl.map(x => `<div>${x}</div>`).join("")}</div>${table}${qs ? `<details class="qst" ${phone ? "" : "open"}><summary>Статистика по вопросам</summary><ol>${qs}</ol></details>` : ""}</div>`;
}

