/* ======================================================================
   2. УТИЛИТЫ
   Мелкие помощники без привязки к игре: хранилище браузера, форматирование,
   таймеры, загрузка библиотек, сравнение ответов.
   ====================================================================== */

// Читает значение из localStorage. Если его нет или браузер запретил доступ, возвращает d.
function load(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch (e) {
    return d;
  }
}

// Сохраняет значение в localStorage. Ошибки (переполнение, приватный режим) молча игнорируются.
function save(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}

// Глубокая копия объекта через JSON. Подходит для паков и состояния: в них нет функций и дат.
const clone = o => JSON.parse(JSON.stringify(o));

// Короткий уникальный id для паков и игроков.
const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Русское склонение по числу: plural(5,"вопрос","вопроса","вопросов") → «вопросов».
function plural(n, a, b, c) {
  const m = n % 10,
    h = n % 100;
  return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c;
}

// Число с пробелами между разрядами и настоящим минусом: −1 200.
const fmt = n => (n < 0 ? "−" : "") + Math.abs(n || 0).toLocaleString("ru-RU");

// Экранирует текст перед вставкой в HTML. Обязательно для всего, что ввёл человек.
const esc = s =>
  String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Firebase иногда возвращает массив как объект {0:…,1:…}. arr() всегда даёт массив.
const arr = x =>
  Array.isArray(x)
    ? x
    : Object.keys(x || {})
        .sort((a, b) => a - b)
        .map(k => x[k]);

// Перемешивает массив на месте (алгоритм Фишера — Йетса).
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Список активных таймеров текущей фазы игры у ведущего.
const T = [];

// setTimeout, который запоминается в T, чтобы его можно было отменить при смене фазы.
function later(fn, ms) {
  T.push(setTimeout(fn, ms));
}

// Отменяет все таймеры фазы. Вызывается почти при каждом переходе.
function clearTimers() {
  T.splice(0).forEach(clearTimeout);
}

// Кэш загруженных внешних библиотек.
const libs = {};

// Подгружает библиотеку с CDN только когда она нужна (JSZip для .siq, SheetJS для Excel…).
function loadScript(url) {
  if (!libs[url])
    libs[url] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = res;
      s.onerror = () => rej(new Error("Не удалось загрузить библиотеку"));
      document.head.appendChild(s);
    });
  return libs[url];
}

// Ссылка для входа в комнату, она же зашита в QR-код.
function joinURL(code) {
  return location.origin + location.pathname + "?room=" + code;
}

// Ссылка, по которой телевизор или проектор открывает комнату как общий экран.
function screenURL(code) {
  return location.origin + location.pathname + "?screen=" + code;
}

// Нормализует ответ для сравнения: нижний регистр, ё→е, без кавычек и знаков препинания.
function normA(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”„.,!?()\[\]\-–—:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Расстояние Левенштейна: сколько букв нужно поправить, чтобы получить одно слово из другого.
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Автопроверка ответа в режиме без ведущего.
// Засчитывает точное совпадение, один из вариантов через «,», «;», «или»,
// ответ внутри фразы и 1–2 опечатки в длинных словах.
function matchAnswer(said, ans) {
  const s = normA(said);
  if (!s) return false;
  const vs = [
    normA(ans),
    ...String(ans || "")
      .split(/[,;\/]|\sили\s|\(/i)
      .map(normA)
  ].filter(Boolean);
  return vs.some(
    v =>
      s === v ||
      (s.length >= 3 && s.includes(v) && v.length >= 3) ||
      (s.length >= 4 && v.includes(s) && s.length >= v.length * 0.6) ||
      (v.length >= 5 && lev(s, v) <= (v.length >= 9 ? 2 : 1))
  );
}

