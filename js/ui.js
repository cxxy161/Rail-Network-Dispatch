const Ui = {
  flashTimer: null,

  init() {
    document.getElementById('tool-track').addEventListener('click', () => Input.switchTool('track'));
    document.getElementById('tool-platform').addEventListener('click', () => Input.switchTool('platform'));
    document.getElementById('tool-eraser').addEventListener('click', () => Input.switchTool('eraser'));

    document.getElementById('btn-operate-stop').addEventListener('click', () => {
      G.operateSubTool = G.operateSubTool === 'stop' ? null : 'stop';
      hideRightPanel();
      this.updateOperateToolButtons();
    });
    document.getElementById('btn-operate-reverse').addEventListener('click', () => {
      G.operateSubTool = G.operateSubTool === 'reverse' ? null : 'reverse';
      hideRightPanel();
      this.updateOperateToolButtons();
    });

    document.getElementById('time-display').addEventListener('click', (e) => {
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
    document.getElementById('btn-speed5').addEventListener('click', (e) => {
      e.stopPropagation();
      G.speedMultiplier = 5;
      this.updateSpeedButtons();
    });
    document.getElementById('btn-speed10').addEventListener('click', (e) => {
      e.stopPropagation();
      G.speedMultiplier = 10;
      this.updateSpeedButtons();
    });

    document.getElementById('btn-start-day').addEventListener('click', () => this.startDay());
    document.getElementById('btn-settle-continue').addEventListener('click', () => this.nextCycle());
    document.getElementById('btn-restart').addEventListener('click', () => {
      resetGame();
      Renderer.centerCamera();
      this.startBuild();
    });

    document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
    document.getElementById('btn-settings-close').addEventListener('click', () => this.closeSettings());
    document.getElementById('btn-manual-save').addEventListener('click', () => { saveGame(); this.flashMessage('已保存'); });
    document.getElementById('btn-copy-export').addEventListener('click', () => this.copyExport());
    document.getElementById('btn-confirm-import').addEventListener('click', () => this.confirmImport());
    document.getElementById('btn-delete-save').addEventListener('click', () => this.confirmDeleteSave());
    document.getElementById('btn-reset-game').addEventListener('click', () => this.confirmReset());

    for (const tabBtn of document.querySelectorAll('.settings-tab')) {
      tabBtn.addEventListener('click', () => this.switchSettingsTab(tabBtn.dataset.tab));
    }

    window.addEventListener('beforeunload', (e) => {
      if (G._dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    for (const btn of document.querySelectorAll('.buy-btn')) {
      btn.addEventListener('click', () => {
        const resource = btn.dataset.resource;
        const count = parseInt(btn.dataset.count) || 1;
        this.batchBuy(resource, count);
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
    document.getElementById('gold-val').textContent = '￥' + G.gold;
    document.getElementById('delivered-val').textContent = G.passengersDeliveredToday;
    document.getElementById('day-val').textContent = G.dayNumber;
    document.getElementById('sidebar-gold').textContent = '￥' + G.gold;
    document.getElementById('satisfaction-val').textContent = Math.round(G.satisfaction) + '%';
    const sl = document.getElementById('satisfaction-label');
    sl.className = G.satisfaction > 70 ? 'satisfaction-high' : G.satisfaction > 30 ? 'satisfaction-mid' : 'satisfaction-low';

    if (G.phase === 'operate') {
      const clk = dayTimeToClock();
      document.getElementById('time-display').textContent =
        '⏱ ' + String(clk.h).padStart(2, '0') + ':' + String(clk.m).padStart(2, '0') + ' ×' + G.speedMultiplier + ' ▾';
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
    document.getElementById('btn-speed5').classList.toggle('active-speed', G.speedMultiplier === 5);
    document.getElementById('btn-speed10').classList.toggle('active-speed', G.speedMultiplier === 10);
  },

  showOverlay() {
    document.getElementById('overlay').classList.remove('hidden');
  },

  hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  },

  hideMenu() {
    const menu = document.getElementById('main-menu');
    menu.classList.add('fade-out');
    setTimeout(() => menu.classList.add('hidden'), 400);
  },

  showNewGameConfirm() {
    document.getElementById('confirm-newgame').classList.remove('hidden');
  },

  hideNewGameConfirm() {
    document.getElementById('confirm-newgame').classList.add('hidden');
  },

  showMapConfig() {
    document.getElementById('map-config').classList.remove('hidden');
    document.querySelector('#main-menu .menu-buttons').classList.add('hidden');
    document.querySelector('#main-menu .menu-title-box').classList.add('hidden');
  },

  hideMapConfig() {
    document.getElementById('map-config').classList.add('hidden');
    document.querySelector('#main-menu .menu-buttons').classList.remove('hidden');
    document.querySelector('#main-menu .menu-title-box').classList.remove('hidden');
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
    document.getElementById('settlement-panel').classList.add('hidden');
    document.getElementById('gameover-panel').classList.add('hidden');
    document.getElementById('operate-tools').classList.add('hidden');
    document.getElementById('tool-track').parentElement.querySelectorAll('.build-only').forEach(b => b.classList.remove('hidden'));
    G.operateSubTool = null;
    this.hideOverlay();
    this.updateShopDisplay();
    this.updateTopBar();
    Renderer.resize();
  },

  startDay() {
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
      this.flashMessage('铁路未连接到车辆段！');
      return;
    }
    if (G.depotTrains.length === 0) {
      this.flashMessage('车辆段没有可用列车！请先编组列车。');
      return;
    }

    G.phase = 'operate';
    G.dayTime = 600;
    G.paused = false;
    G.speedMultiplier = 1;
    G._passengerAccum = {};
    G.stationQueues = {};
    G.totalGeneratedToday = 0;
    G.lastDeductHour = 6;
    this.updatePauseButton();
    this.updateSpeedButtons();
    this.updateTopBar();

    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('tool-track').parentElement.querySelectorAll('.build-only').forEach(b => b.classList.add('hidden'));
    document.getElementById('operate-tools').classList.remove('hidden');
    G.operateSubTool = null;
    Ui.updateOperateToolButtons();
    Input.switchTool('track');
    Renderer.resize();

  },

  nextCycle() {
    if (G.tutorialId) {
      G.passengersDeliveredToday = 0;
      G.totalGeneratedToday = 0;
      G.stationQueues = {};
      for (const st of G.stations) G.stationQueues[st.id] = {};
      G.dayNumber++;
      document.getElementById('settlement-panel').classList.add('hidden');
      this.hideOverlay();
      this.startBuild();
      Renderer.centerCamera();
      return;
    }

    G.gold += G.passengersDeliveredToday * G.passengerPrice;
    G.gold -= G.maintenanceCost;

    if (G.satisfaction < 10) {
      G.lowSatisfactionDays++;
      if (G.lowSatisfactionDays >= 3) {
        this.showGameOver('满意度过低，线路被废弃');
        return;
      }
    } else {
      G.lowSatisfactionDays = 0;
    }

    G.passengersDeliveredToday = 0;
    G.totalGeneratedToday = 0;
    G.stationQueues = {};

    if (G.gold < 0) {
      this.showGameOver('破产');
      return;
    }

    G.dayNumber++;
    document.getElementById('settlement-panel').classList.add('hidden');
    this.hideOverlay();
    saveGame();
    this.startBuild();
  },

  showSettlement() {
    const income = G.passengersDeliveredToday * G.passengerPrice;
    const nextGold = G.gold + income - G.maintenanceCost;

    document.getElementById('settle-delivered').textContent = G.passengersDeliveredToday;
    document.getElementById('settle-income').textContent = '￥' + income;
    document.getElementById('settle-maintenance').textContent = '￥' + G.maintenanceCost;
    document.getElementById('settle-gold').textContent = '￥' + Math.max(0, nextGold);

    let satChange = '';
    const oldSat = G.satisfaction;
    if (G.totalGeneratedToday > 0) {
      const rate = G.passengersDeliveredToday / G.totalGeneratedToday;
      if (rate > 0.8) { G.satisfaction = Math.min(100, oldSat + 10); satChange = '+10%'; }
      else if (rate > 0.5) { G.satisfaction = Math.min(100, oldSat + 5); satChange = '+5%'; }
    }
    const allZero = G.stations.every(st => {
      const q = G.stationQueues[st.id] || {};
      return Object.values(q).reduce((a,b)=>a+b,0) === 0;
    });
    if (allZero) { G.satisfaction = Math.min(100, G.satisfaction + 3); satChange = (satChange ? satChange + ' +3%' : '+3%'); }
    const satEl = document.getElementById('settle-satisfaction');
    if (satEl) {
      const newSat = Math.round(G.satisfaction);
      satEl.textContent = satChange ? Math.round(oldSat) + '% → ' + newSat + '% (' + satChange + ')' : Math.round(oldSat) + '%';
    }

    document.getElementById('settlement-panel').classList.remove('hidden');
    this.showOverlay();
    this.updateTopBar();
  },

  showGameOver(reason) {
    document.getElementById('gameover-total').textContent = G.totalPassengersDelivered;
    document.getElementById('gameover-days').textContent = G.dayNumber - 1;
    const title = document.querySelector('#gameover-panel h2');
    if (title) title.textContent = reason || '破产！';
    document.getElementById('gameover-panel').classList.remove('hidden');
    document.getElementById('settlement-panel').classList.add('hidden');
    document.getElementById('shop-panel').classList.add('hidden');
    this.showOverlay();
    G.phase = 'gameover';
  },

  batchBuy(resource, count) {
    const price = G.shopPrices[resource] * count;
    if (G.gold < price) {
      this.flashMessage('资金不足！');
      return;
    }
    G.gold -= price;
    if (resource === 'trackFragment') G.trackFragments += count;
    else if (resource === 'platformComponent') G.platformComponents += count;
    else if (resource === 'wagon') G.wagons += count;
    G._dirty = true;
    this.updateShopDisplay();
    this.updateTopBar();
  },

  updateShopDisplay() {
    document.getElementById('res-track').textContent = G.trackFragments;
    document.getElementById('res-platform').textContent = G.platformComponents;
    document.getElementById('res-wagon').textContent = G.wagons;
    for (const btn of document.querySelectorAll('.buy-btn')) {
      const resource = btn.dataset.resource;
      const count = parseInt(btn.dataset.count) || 1;
      btn.disabled = G.gold < G.shopPrices[resource] * count;
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

  openSettings() {
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.getElementById('ta-export').value = exportToBase64();
  },

  closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
  },

  switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.settings-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
  },

  copyExport() {
    const ta = document.getElementById('ta-export');
    navigator.clipboard.writeText(ta.value).then(() => this.flashMessage('已复制到剪贴板'));
  },

  confirmImport() {
    const b64 = document.getElementById('ta-import').value.trim();
    if (!b64) { this.flashMessage('请粘贴存档文本'); return; }
    if (importFromBase64(b64)) {
      this.flashMessage('导入成功，即将刷新');
      setTimeout(() => location.reload(), 500);
    } else {
      this.flashMessage('存档格式无效');
    }
  },

  confirmDeleteSave() {
    deleteSave();
    this.flashMessage('存档已删除');
  },

  confirmReset() {
    deleteSave();
    resetGame();
    Renderer.centerCamera();
    this.startBuild();
    this.closeSettings();
  },
};
