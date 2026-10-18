/* ======================================================================
   6. БАЗА ДАННЫХ
   Структура в Firebase Realtime Database:
     rooms/{код}/meta     — название, доступ, онлайн ли ведущий, закрыта ли комната
     rooms/{код}/state    — всё, что видят игроки (пишет только ведущий)
     rooms/{код}/players  — {id: {name, score, online, joined}}
     rooms/{код}/input    — последнее действие каждого игрока (выбор, ставка, ответ)
     rooms/{код}/buzz/{n} — нажатия кнопки на n-м открытии, время ставит сервер
     rooms/{код}/media    — картинка текущего вопроса (если включено на телефонах)
     rooms/{код}/smedia   — картинка только для общих экранов (когда на телефоны не отправляем)
     rooms/{код}/screens  — {id: время} открытые общие экраны; запись пропадает при отключении
     public/{код}         — карточка открытой комнаты для списка «Открытые игры»
   ====================================================================== */

// Подключение к базе и разница часов устройства и сервера Firebase.
let db = null,
  serverOffset = 0;

// Конфиг Firebase. В тестах его можно подменить через window.FIREBASE_CONFIG_OVERRIDE.
const CONF = window.FIREBASE_CONFIG_OVERRIDE || FIREBASE_CONFIG;

// Вписан ли конфиг. Без него показывается подсказка вместо игры.
const configured = !!(CONF && CONF.databaseURL);

// Метка «время сервера»: Firebase сам подставит время при записи. Так нажатия честно сравниваются.
const TS = () => firebase.database.ServerValue.TIMESTAMP;

// Текущее время по часам сервера (с поправкой serverOffset).
const now = () => Date.now() + serverOffset;

// Ссылка на путь в базе.
const ref = p => db.ref(p);

// Подключается к Firebase и начинает следить за разницей часов.
function dbInit() {
  if (!configured || typeof firebase === "undefined") return false;
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONF);
    db = firebase.database();
    ref(".info/serverTimeOffset").on("value", s => {
      serverOffset = s.val() || 0;
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// Метка «в сети» для пути r (игрок или ведущий).
// При каждом (пере)подключении заново ставит online=true и просит сервер
// поставить false, если связь оборвётся. Возвращает обработчик, чтобы потом отписаться.
function presence(r) {
  const cb = s => {
    if (s.val() === true) {
      const d = r.onDisconnect().set(false);
      (d && d.then ? d : Promise.resolve()).then(() => r.set(true));
    }
  };
  ref(".info/connected").on("value", cb);
  r.set(true);
  return cb;
}

