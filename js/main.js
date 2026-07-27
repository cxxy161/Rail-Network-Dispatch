let lastTimestamp = 0;
let accumulator = 0;
let resizePending = true;
const TICK = 1 / 60;

function init() {
  const canvas = document.getElementById('game-canvas');
  Renderer.init(canvas);

  Ui.init();
  Ui.updateToolButtons();
  Ui.startBuild();

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
