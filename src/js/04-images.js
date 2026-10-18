/* ======================================================================
   4. КАРТИНКИ
   Картинки вопросов хранятся на устройстве ведущего в IndexedDB (там сотни МБ,
   в отличие от 5 МБ localStorage). В пак записывается только id картинки.
   ====================================================================== */

// Кэш картинок в памяти (id → data-URL) и подключение к IndexedDB.
const IMG = { cache: {}, db: null };

// Открывает (или создаёт) базу картинок в браузере.
function idb() {
  if (!IMG.db)
    IMG.db = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open("svoya-media", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("img");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return IMG.db;
}

// Сохраняет картинку и возвращает её новый id.
async function imgPut(data) {
  const id = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  IMG.cache[id] = data;
  try {
    const d = await idb();
    await new Promise((res, rej) => {
      const tx = d.transaction("img", "readwrite");
      tx.objectStore("img").put(data, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn(e);
  }
  return id;
}

// Достаёт картинку по id: сначала из кэша, потом из IndexedDB.
async function imgGet(id) {
  if (!id) return null;
  if (IMG.cache[id]) return IMG.cache[id];
  try {
    const d = await idb();
    const v = await new Promise((res, rej) => {
      const r = d.transaction("img").objectStore("img").get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (v) IMG.cache[id] = v;
    return v || null;
  } catch (e) {
    return null;
  }
}

// Картинки, которые сейчас загружаются, чтобы не запрашивать их повторно.
const IMG_PENDING = {};

// Адрес картинки вопроса для <img>. Если картинки ещё нет в кэше,
// запускает загрузку и перерисовывает экран, когда она придёт.
function imgSrc(q) {
  if (!q) return null;
  if (q.url) return q.url;
  if (q.img) {
    if (IMG.cache[q.img]) return IMG.cache[q.img];
    if (!IMG_PENDING[q.img]) {
      IMG_PENDING[q.img] = 1;
      imgGet(q.img).then(v => {
        if (v) render();
      });
    }
  }
  return null;
}

// Уменьшает картинку до 1280 px и сжимает в WebP или JPEG (~100–200 КБ).
async function compressImage(blob, max = 1280) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Не удалось открыть картинку"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)),
      w = Math.max(1, Math.round(im.naturalWidth * k)),
      h = Math.max(1, Math.round(im.naturalHeight * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, w, h);
    x.drawImage(im, 0, 0, w, h);
    let d = c.toDataURL("image/webp", 0.78);
    if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", 0.8);
    if (d.length > 400000) d = c.toDataURL("image/jpeg", 0.6);
    return d;
  } finally {
    URL.revokeObjectURL(url);
  }
}

