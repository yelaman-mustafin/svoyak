/* ======================================================================
   19. ЗАПУСК
   Подключаемся к базе, читаем ?room=КОД из ссылки и показываем главную.
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
  if (APP.dbOk && q && lr === q && ME_NAME.trim()) joinRoom(q, ME_NAME.trim());
})();
