let lastTimestamp = 0;
let accumulator = 0;
let resizePending = true;
const TICK = 1 / 60;

function init() {
  const canvas = document.getElementById('game-canvas');
  Renderer.init(canvas);

  const loaded = loadGame();

  Ui.init();

  document.getElementById('menu-continue').classList.toggle('hidden', !saveExists());

  document.getElementById('menu-new-game').addEventListener('click', () => {
    if (saveExists()) {
      Ui.showNewGameConfirm();
    } else {
      startNewGame();
    }
  });

  document.getElementById('confirm-yes').addEventListener('click', () => {
    deleteSave();
    Ui.hideNewGameConfirm();
    startNewGame();
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    Ui.hideNewGameConfirm();
  });

  document.getElementById('menu-continue').addEventListener('click', () => {
    Ui.startBuild();
    Renderer.centerCamera();
    MenuDecor.stop();
    Ui.hideMenu();
  });

  document.getElementById('menu-tutorial').addEventListener('click', () => {
    Ui.flashMessage('教程尚未开放');
  });

  document.getElementById('menu-settings').addEventListener('click', () => {
    window.open('https://github.com/cxxy161/Rail-Network-Dispatch', '_blank');
  });

  MenuDecor.init();

  Renderer.resize();
  Renderer.centerCamera();

  Input.init(canvas);
  window.addEventListener('resize', () => {
    Renderer.resize();
    Renderer.centerCamera();
  });

  lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
}

function startNewGame() {
  resetGame();
  Ui.startBuild();
  Renderer.centerCamera();
  MenuDecor.stop();
  Ui.hideMenu();
}

function gameLoop(ts) {
  let dt = (ts - lastTimestamp) / 1000;
  lastTimestamp = ts;
  if (dt > 0.1) dt = 0.1;

  if (resizePending) {
    Renderer.resize();
    Renderer.centerCamera();
    resizePending = false;
  }

  accumulator += dt;
  while (accumulator >= TICK) {
    update(TICK);
    accumulator -= TICK;
  }

  Renderer.render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  Ui.updateTopBar();
  Ui.updateShopDisplay();
  if (G.infoTarget) updateInfoPopup();
  if (G.phase === 'operate') updateOperate(dt);
}

function updateOperate(dt) {
  if (G.paused) return;
  const realDt = dt * G.speedMultiplier;
  G.dayTime -= realDt;
  Station.tickPassengers(realDt);
  if (G.dayTime <= 0) {
    G.dayTime = 0;
    endDay();
    return;
  }
  for (const train of G.activeTrains) {
    Train.update(train, realDt);
  }
}

function endDay() {
  G.phase = 'settlement';
  for (const train of [...G.activeTrains]) {
    Train.recall(train);
  }
  Ui.showSettlement();
}

init();
