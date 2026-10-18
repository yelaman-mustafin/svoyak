/* ======================================================================
   20. ЗАПУСК
   Подключаемся к базе, читаем ?room=КОД (игрок) или ?screen=КОД (общий экран)
   из ссылки и показываем главную.
   ====================================================================== */

// Запуск приложения.
(function boot() {
  APP.dbOk = dbInit();
  const q = new URLSearchParams(location.search).get("room");
  if (q && /^\d{4}$/.test(q)) {
    APP.prefill = q;
  }
  const lr = load("svoya.lastRoom", null);
  goHome();
  const sc = new URLSearchParams(location.search).get("screen");
  if (APP.dbOk && sc && /^\d{4}$/.test(sc)) {
    joinScreen(sc);
    return;
  }
  if (APP.dbOk && q && lr === q && ME_NAME.trim()) joinRoom(q, ME_NAME.trim());
})();
