let lastTimestamp = 0;
let accumulator = 0;
let resizePending = true;
const TICK = 1 / 60;

function cfgStationsVal() {
  document.getElementById('cfg-stations-val').textContent =
    document.getElementById('cfg-stations').value + ' 个';
}

function cfgMapscaleVal() {
  const scale = parseInt(document.getElementById('cfg-mapscale').value) / 10;
  const w = Math.floor(192 * scale);
  const h = Math.floor(144 * scale);
  document.getElementById('cfg-mapscale-val').textContent = w + '×' + h;
}

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
      Ui.showMapConfig();
    }
  });

  document.getElementById('confirm-yes').addEventListener('click', () => {
    deleteSave();
    Ui.hideNewGameConfirm();
    Ui.showMapConfig();
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    Ui.hideNewGameConfirm();
  });

  document.getElementById('cfg-start').addEventListener('click', () => {
    const mRatio = parseInt(document.getElementById('cfg-mountain').value) / 100;
    const rRatio = parseInt(document.getElementById('cfg-river').value) / 100;
    const stationCount = parseInt(document.getElementById('cfg-stations').value);
    const mapScale = parseInt(document.getElementById('cfg-mapscale').value) / 10;
    startNewGame({ mountainRatio: mRatio, riverRatio: rRatio, stationCount, mapScale });
  });

  document.getElementById('cfg-back').addEventListener('click', () => {
    Ui.hideMapConfig();
  });

  document.getElementById('cfg-mountain').addEventListener('input', () => {
    const mv = parseInt(document.getElementById('cfg-mountain').value);
    document.getElementById('cfg-mountain-val').textContent = mv + '%';
    document.getElementById('cfg-river').max = Math.min(50, 80 - mv);
    const rv = parseInt(document.getElementById('cfg-river').value);
    document.getElementById('cfg-plain-val').textContent = (100 - mv - rv) + '%';
  });

  document.getElementById('cfg-river').addEventListener('input', () => {
    const rv = parseInt(document.getElementById('cfg-river').value);
    document.getElementById('cfg-river-val').textContent = rv + '%';
    document.getElementById('cfg-mountain').max = Math.min(50, 80 - rv);
    const mv = parseInt(document.getElementById('cfg-mountain').value);
    document.getElementById('cfg-plain-val').textContent = (100 - mv - rv) + '%';
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

function startNewGame(opts) {
  resetGame(opts);
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

  const clk = dayTimeToClock();
  if (clk.h !== G.lastDeductHour) {
    G.lastDeductHour = clk.h;
    for (const st of G.stations) {
      const queue = G.stationQueues[st.id] || {};
      const total = Object.values(queue).reduce((a, b) => a + b, 0);
      const platformCells = Math.max(1, G.platforms.filter(p => p.stationId === st.id).length);
      const avg = total / platformCells;
      if (avg >= 100) G.satisfaction = Math.max(0, G.satisfaction - 1.0);
      else if (avg >= 50) G.satisfaction = Math.max(0, G.satisfaction - 0.5);
    }
  }

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
    train.trail = [];
  }
  Ui.showSettlement();
}

init();
