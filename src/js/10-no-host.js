/* ======================================================================
   10. РЕЖИМ «БЕЗ ВЕДУЩЕГО»
   Организатор и ведёт комнату (HOST), и играет в ней (PL) с того же устройства.
   Экран не должен гаснуть, иначе игра встанет — для этого Wake Lock.
   ====================================================================== */

// Без ведущего организатор входит в свою комнату как игрок; при возврате к живому ведущему выходит.
function syncSelf() {
  if (!HOST) return;
  if (AUTO() && !PL) joinRoom(HOST.code, hostName(), { silent: true });
  else if (!AUTO() && PL && PL.code === HOST.code) dropSelf(true);
}

// Организатор перестаёт быть игроком (отписка, по желанию удаление из списка).
function dropSelf(remove) {
  if (!PL) return;
  if (PL.connCb) ref(".info/connected").off("value", PL.connCb);
  pRef("state").off();
  pRef("players").off();
  pRef("meta").off();
  pRef("media").off();
  pRef(`players/${PL.pid}/online`).onDisconnect().cancel();
  if (remove) pRef(`players/${PL.pid}`).remove();
  PL = null;
}

// Блокировка выключения экрана (Wake Lock API).
let WAKE = null;

// Просит браузер не гасить экран, пока идёт игра. Работает не во всех браузерах.
async function keepAwake() {
  try {
    if (navigator.wakeLock && !WAKE) {
      WAKE = await navigator.wakeLock.request("screen");
      WAKE.addEventListener("release", () => {
        WAKE = null;
      });
    }
  } catch (e) {}
}

// Когда вкладка снова видна, заново просим не гасить экран (браузер снимает блокировку в фоне).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && HOST && H().phase !== "lobby") keepAwake();
});

