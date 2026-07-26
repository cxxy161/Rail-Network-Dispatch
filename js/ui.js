const Ui = {
  flashTimer: null,

  init() {
    document.getElementById('tool-track').addEventListener('click', () => Input.switchTool('track'));
    document.getElementById('tool-platform').addEventListener('click', () => Input.switchTool('platform'));
    document.getElementById('tool-eraser').addEventListener('click', () => Input.switchTool('eraser'));

    document.getElementById('btn-operate-stop').addEventListener('click', () => {
      G.operateSubTool = G.operateSubTool === 'stop' ? null : 'stop';
      hidePopup();
      this.updateOperateToolButtons();
    });
    document.getElementById('btn-operate-reverse').addEventListener('click', () => {
      G.operateSubTool = G.operateSubTool === 'reverse' ? null : 'reverse';
      hidePopup();
      this.updateOperateToolButtons();
    });

    document.getElementById('time-dropdown-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('time-dropdown');
      dd.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      document.getElementById('time-dropdown').classList.add('hidden');
    });

    document.getElementById('btn-pause').addEventListener('click', (e) => {
      e.stopPropagation();
      if (G.phase === 'operate') {
        G.paused = !G.paused;
        this.updatePauseButton();
      }
    });
    document.getElementById('btn-speed1').addEventListener('click', (e) => {
      e.stopPropagation();
      G.speedMultiplier = 1;
      this.updateSpeedButtons();
    });
    document.getElementById('btn-speed2').addEventListener('click', (e) => {
      e.stopPropagation();
      G.speedMultiplier = 2;
      this.updateSpeedButtons();
    });
    document.getElementById('btn-speed3').addEventListener('click', (e) => {
      e.stopPropagation();
      G.speedMultiplier = 3;
      this.updateSpeedButtons();
    });

    document.getElementById('btn-start-day').addEventListener('click', () => this.startDay());
    document.getElementById('btn-dispatch-confirm').addEventListener('click', () => this.confirmDispatch());
    document.getElementById('btn-dispatch-back').addEventListener('click', () => {
      document.getElementById('dispatch-panel').classList.add('hidden');
      this.hideOverlay();
      this.startBuild();
    });
    document.getElementById('btn-settle-continue').addEventListener('click', () => this.nextCycle());
    document.getElementById('btn-restart').addEventListener('click', () => {
      resetGame();
      Renderer.centerCamera();
      this.startBuild();
    });

    for (const btn of document.querySelectorAll('.buy-btn')) {
      btn.addEventListener('click', () => {
        const resource = btn.dataset.resource;
        this.buyItem(resource);
      });
    }

    document.getElementById('time-dropdown').classList.add('hidden');
  },

  updateToolButtons() {
    document.getElementById('tool-track').classList.toggle('active', G.selectedTool === 'track');
    document.getElementById('tool-platform').classList.toggle('active', G.selectedTool === 'platform');
    document.getElementById('tool-eraser').classList.toggle('active', G.selectedTool === 'eraser');
  },

  updateOperateToolButtons() {
    const stopBtn = document.getElementById('btn-operate-stop');
    const revBtn = document.getElementById('btn-operate-reverse');
    if (stopBtn) stopBtn.classList.toggle('active', G.operateSubTool === 'stop');
    if (revBtn) revBtn.classList.toggle('active', G.operateSubTool === 'reverse');
  },

  updateTopBar() {
    document.getElementById('gold-val').textContent = G.gold;
    document.getElementById('delivered-val').textContent = G.passengersDeliveredToday;
    document.getElementById('day-val').textContent = G.dayNumber;
    document.getElementById('sidebar-gold').textContent = G.gold;

    if (G.phase === 'operate') {
      const clk = dayTimeToClock();
      document.getElementById('time-display').textContent =
        '⏱ ' + String(clk.h).padStart(2, '0') + ':' + String(clk.m).padStart(2, '0');
    } else {
      document.getElementById('time-display').textContent = '⏱ --:--';
    }
  },

  updatePauseButton() {
    document.getElementById('btn-pause').textContent = G.paused ? '继续' : '暂停';
  },

  updateSpeedButtons() {
    document.getElementById('btn-speed1').classList.toggle('active-speed', G.speedMultiplier === 1);
    document.getElementById('btn-speed2').classList.toggle('active-speed', G.speedMultiplier === 2);
    document.getElementById('btn-speed3').classList.toggle('active-speed', G.speedMultiplier === 3);
  },

  showOverlay() {
    document.getElementById('overlay').classList.remove('hidden');
  },

  hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  },

  startBuild() {
    G.phase = 'build';
    G.passengersDeliveredToday = 0;
    G.paused = false;

    G.trackDrag.active = false;
    G.trackDrag.lastGX = -1;
    G.trackDrag.lastGY = -1;
    G.platDrag.active = false;
    G.platDrag.dir = null;

    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('dispatch-panel').classList.add('hidden');
    document.getElementById('settlement-panel').classList.add('hidden');
    document.getElementById('gameover-panel').classList.add('hidden');
    document.getElementById('operate-tools').classList.add('hidden');
    document.getElementById('tool-track').parentElement.querySelectorAll('.tool-btn.build-only').forEach(b => b.classList.remove('hidden'));
    G.operateSubTool = null;
    this.hideOverlay();
    this.updateShopDisplay();
    this.updateTopBar();
    Renderer.resize();
  },

  startDay() {
    G.phase = 'dispatch';
    G.dispatchDecisions = {};
    this.showDispatchPanel();
    this.updateTopBar();
  },

  showDispatchPanel() {
    const list = document.getElementById('depot-train-list');
    list.innerHTML = '';
    for (const train of G.depotTrains) {
      const div = document.createElement('div');
      div.className = 'depot-train-item';
      div.innerHTML =
        `<span>列车 #${train.id} (${train.carCount}节车厢)</span>
         <span style="color:#E8734A;font-weight:bold">发车</span>`;
      div.addEventListener('click', () => {
        if (train.id in G.dispatchDecisions) {
          delete G.dispatchDecisions[train.id];
          div.querySelector('span:last-child').textContent = '发车';
          div.querySelector('span:last-child').style.color = '#E8734A';
          div.querySelector('span:last-child').style.fontWeight = 'bold';
        } else {
          G.dispatchDecisions[train.id] = true;
          div.querySelector('span:last-child').textContent = '发车 ✓';
          div.querySelector('span:last-child').style.color = '#50B86C';
          div.querySelector('span:last-child').style.fontWeight = 'bold';
        }
      });
      list.appendChild(div);
    }

    document.getElementById('dispatch-panel').classList.remove('hidden');
    this.showOverlay();
  },

  confirmDispatch() {
    const depotKey = Graph.key(G.depotX, G.depotY);
    let depotConnected = false;
    const depotCells = [
      { x: G.depotX - 1, y: G.depotY - 1 },
      { x: G.depotX,     y: G.depotY - 1 },
      { x: G.depotX - 1, y: G.depotY },
      { x: G.depotX,     y: G.depotY },
    ];
    for (const cell of depotCells) {
      const key = Graph.key(cell.x, cell.y);
      if (Graph.getDegree(key) > 0) {
        Graph.addEdge(depotKey, key);
        depotConnected = true;
        break;
      }
    }
    if (!depotConnected) {
      this.flashMessage('车辆段未连接到铁路网！');
      return;
    }

    for (const train of [...G.depotTrains]) {
      if (G.dispatchDecisions[train.id]) {
        const idx = G.depotTrains.indexOf(train);
        if (idx >= 0) G.depotTrains.splice(idx, 1);
        Train.dispatch(train);
      }
    }

    G.phase = 'operate';
    G.dayTime = 300;
    G.paused = false;
    G.speedMultiplier = 1;
    this.updatePauseButton();
    this.updateSpeedButtons();
    this.updateTopBar();
    this.hideOverlay();

    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('tool-track').parentElement.querySelectorAll('.tool-btn.build-only').forEach(b => b.classList.add('hidden'));
    document.getElementById('operate-tools').classList.remove('hidden');
    G.operateSubTool = null;
    Ui.updateOperateToolButtons();
    Input.switchTool('track');
    Renderer.resize();

    Station.generatePassengers();
  },

  nextCycle() {
    G.gold += G.passengersDeliveredToday * G.passengerPrice;
    G.gold -= G.maintenanceCost;
    G.passengersDeliveredToday = 0;

    if (G.gold < 0) {
      this.showGameOver();
      return;
    }

    G.dayNumber++;
    document.getElementById('settlement-panel').classList.add('hidden');
    this.hideOverlay();
    this.startBuild();
  },

  showSettlement() {
    const income = G.passengersDeliveredToday * G.passengerPrice;
    const nextGold = G.gold + income - G.maintenanceCost;

    document.getElementById('settle-delivered').textContent = G.passengersDeliveredToday;
    document.getElementById('settle-income').textContent = income;
    document.getElementById('settle-maintenance').textContent = G.maintenanceCost;
    document.getElementById('settle-gold').textContent = Math.max(0, nextGold);

    document.getElementById('settlement-panel').classList.remove('hidden');
    document.getElementById('dispatch-panel').classList.add('hidden');
    this.showOverlay();
    this.updateTopBar();
  },

  showGameOver() {
    document.getElementById('gameover-total').textContent = G.totalPassengersDelivered;
    document.getElementById('gameover-days').textContent = G.dayNumber - 1;
    document.getElementById('gameover-panel').classList.remove('hidden');
    document.getElementById('settlement-panel').classList.add('hidden');
    document.getElementById('shop-panel').classList.add('hidden');
    this.showOverlay();
    G.phase = 'gameover';
  },

  buyItem(resource) {
    const price = G.shopPrices[resource];
    if (G.gold < price) {
      this.flashMessage('资金不足！');
      return;
    }
    G.gold -= price;
    if (resource === 'trackFragment') G.trackFragments++;
    else if (resource === 'platformComponent') G.platformComponents++;
    else if (resource === 'wagon') G.wagons++;
    this.updateShopDisplay();
    this.updateTopBar();
  },

  updateShopDisplay() {
    document.getElementById('res-track').textContent = G.trackFragments;
    document.getElementById('res-platform').textContent = G.platformComponents;
    document.getElementById('res-wagon').textContent = G.wagons;
    for (const btn of document.querySelectorAll('.buy-btn')) {
      const resource = btn.dataset.resource;
      btn.disabled = G.gold < G.shopPrices[resource];
    }
  },

  flashMessage(msg) {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    let el = document.getElementById('flash-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flash-msg';
      el.style.cssText =
        'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#333;color:#FFF;padding:8px 20px;border-radius:4px;font-size:14px;z-index:200;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    this.flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1200);
  },
};
