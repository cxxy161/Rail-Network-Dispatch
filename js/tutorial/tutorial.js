const Tutorial = {
  active: false,
  stepIdx: 0,
  stepPhase: 0,
  stepStartTime: 0,
  stepCheckTimer: 0,
  data: null,
  flags: { usedStop: false, usedReverse: false, switchToggled: false },
  _bubbleVisible: false,

  helpers: {
    pathBetweenStations(aId, bId) {
      const aPlats = G.platforms.filter(p => p.stationId === aId);
      const bPlats = G.platforms.filter(p => p.stationId === bId);
      if (aPlats.length === 0 || bPlats.length === 0) return false;

      const starts = [];
      for (const p of aPlats) {
        const key = p.x + ',' + p.y;
        if (G.connectionMap[key]) starts.push(key);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const adj = (p.x + dx) + ',' + (p.y + dy);
          if (G.connectionMap[adj]) starts.push(adj);
        }
      }
      if (starts.length === 0) return false;

      const targets = new Set();
      for (const p of bPlats) {
        const key = p.x + ',' + p.y;
        if (G.connectionMap[key]) targets.add(key);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const adj = (p.x + dx) + ',' + (p.y + dy);
          if (G.connectionMap[adj]) targets.add(adj);
        }
      }
      if (targets.size === 0) return false;

      const visited = new Set();
      const queue = [];
      for (const s of starts) {
        if (targets.has(s)) return true;
        visited.add(s);
        queue.push(s);
      }
      while (queue.length > 0) {
        const cur = queue.shift();
        const neighbors = G.connectionMap[cur];
        if (!neighbors) continue;
        for (const n of neighbors) {
          if (targets.has(n)) return true;
          if (!visited.has(n)) { visited.add(n); queue.push(n); }
        }
      }
      return false;
    },

    pathBetweenNodes(k1, k2) {
      if (k1 === k2) return true;
      const visited = new Set();
      const queue = [k1];
      visited.add(k1);
      while (queue.length > 0) {
        const cur = queue.shift();
        const neighbors = G.connectionMap[cur];
        if (!neighbors) continue;
        for (const n of neighbors) {
          if (n === k2) return true;
          if (!visited.has(n)) { visited.add(n); queue.push(n); }
        }
      }
      return false;
    },

    depotConnected() {
      const depotCells = [
        (G.depotX - 1) + ',' + (G.depotY - 1),
        G.depotX + ',' + (G.depotY - 1),
        (G.depotX - 1) + ',' + G.depotY,
        G.depotX + ',' + G.depotY,
      ];
      for (const cell of depotCells) {
        const deg = (G.connectionMap[cell] || []).length;
        if (deg > 0) return true;
      }
      return false;
    },

    stationHasTracks(sId) {
      const plats = G.platforms.filter(p => p.stationId === sId);
      for (const p of plats) {
        const key = p.x + ',' + p.y;
        if (G.connectionMap[key]) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const adj = (p.x + dx) + ',' + (p.y + dy);
          if (G.connectionMap[adj]) return true;
        }
      }
      return false;
    },

    stationInNetworkWithDepot(sId) {
      const depotCells = [
        (G.depotX - 1) + ',' + (G.depotY - 1),
        G.depotX + ',' + (G.depotY - 1),
        (G.depotX - 1) + ',' + G.depotY,
        G.depotX + ',' + G.depotY,
      ];
      let depotStart = null;
      for (const cell of depotCells) {
        if ((G.connectionMap[cell] || []).length > 0) { depotStart = cell; break; }
      }
      if (!depotStart) return false;

      const plats = G.platforms.filter(p => p.stationId === sId);
      const targets = new Set();
      for (const p of plats) {
        const key = p.x + ',' + p.y;
        if (G.connectionMap[key]) targets.add(key);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const adj = (p.x + dx) + ',' + (p.y + dy);
          if (G.connectionMap[adj]) targets.add(adj);
        }
      }
      if (targets.size === 0) return false;

      const visited = new Set();
      const queue = [depotStart];
      visited.add(depotStart);
      while (queue.length > 0) {
        const cur = queue.shift();
        if (targets.has(cur)) return true;
        const neighbors = G.connectionMap[cur];
        if (!neighbors) continue;
        for (const n of neighbors) {
          if (!visited.has(n)) { visited.add(n); queue.push(n); }
        }
      }
      return false;
    },

    getPlatformCellsAt(stationId) {
      const cells = new Set();
      for (const p of G.platforms) {
        if (p.stationId === stationId) cells.add(p.x + ',' + p.y);
      }
      return cells;
    },

    nodeConnected(key) {
      return (G.connectionMap[key] || []).length >= 2;
    },

    diagonalJunctionBranch(jKey, jx, jy) {
      const ns = G.connectionMap[jKey] || [];
      for (const nk of ns) {
        const [nx, ny] = nk.split(',').map(Number);
        if ((nx - jx) !== 0 && (ny - jy) !== 0) return true;
      }
      return false;
    },
  },

  start() {
    this.active = true;
    this.stepIdx = 0;
    this.stepPhase = 0;
    this.stepStartTime = 0;
    this.flags = { usedStop: false, usedReverse: false, switchToggled: false };
    this._flashPending = false;
    this.data = TUTORIAL_DATA;

    MenuDecor.stop();
    this._loadMapPreset();
    this._showUI();
    this._enterStep();
  },

  _loadMapPreset() {
    const mp = this.data.mapPreset;
    G.GRID_W = mp.gridW;
    G.GRID_H = mp.gridH;
    G.terrain = new Uint8Array(mp.gridW * mp.gridH);
    G.zoom = 0.65;
    G.offsetX = 0;
    G.offsetY = 0;
    G.gold = mp.startingResources.gold;
    G.trackFragments = mp.startingResources.trackFragments;
    G.platformComponents = mp.startingResources.platformComponents;
    G.wagons = mp.startingResources.wagons;
    G.dayNumber = 1;
    G.phase = 'build';
    G.paused = false;
    G.speedMultiplier = 1;
    G.passengersDeliveredToday = 0;
    G.totalPassengersDelivered = 0;
    G.totalGeneratedToday = 0;
    G.satisfaction = 100;
    G.lowSatisfactionDays = 0;
    G.lastDeductHour = 6;
    G.connectionMap = {};
    G.activeSwitches = {};
    G.platforms = [];
    G.depotTrains = [];
    G.activeTrains = [];
    G.nextTrainId = 1;
    G.stationQueues = {};
    G.selectedTool = 'track';
    G.operateSubTool = null;
    G.selectedItem = null;
    G.undoStack = [];
    G.infoTarget = null;
    G.trackDrag = { active: false, startX: -1, startY: -1 };
    G.platDrag = { active: false, startX: -1, startY: -1, dir: null };
    G._dirty = false;
    G.tutorialId = this.data.id;
    G.tutorialStep = 0;
    G.stationQueues = {};

    G.stations = mp.stations
      .filter(s => !s.appearsOnDay || s.appearsOnDay <= G.dayNumber)
      .map(s => ({ id: s.id, x: s.x, y: s.y, color: s.color, flowLevel: s.flowLevel }));

    for (const st of G.stations) {
      G.stationQueues[st.id] = {};
    }

    G.depotX = mp.depot.x;
    G.depotY = mp.depot.y;

    for (const [k1, k2] of mp.prebuiltEdges) {
      if (!G.connectionMap[k1]) G.connectionMap[k1] = [];
      if (!G.connectionMap[k2]) G.connectionMap[k2] = [];
      if (!G.connectionMap[k1].includes(k2)) G.connectionMap[k1].push(k2);
      if (!G.connectionMap[k2].includes(k1)) G.connectionMap[k2].push(k1);
    }
  },

  _showUI() {
    const spot = document.getElementById('tutorial-spotlight');
    if (spot) spot.classList.remove('hidden');
    const bubble = document.getElementById('tutorial-bubble');
    if (bubble) bubble.classList.remove('hidden');
    const skip = document.getElementById('tutorial-skip');
    if (skip) skip.classList.remove('hidden');
    document.getElementById('tutorial-complete').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('settlement-panel').classList.add('hidden');
    document.getElementById('gameover-panel').classList.add('hidden');
    document.getElementById('operate-tools').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.querySelectorAll('#bottom-bar .build-only').forEach(b => b.classList.remove('hidden'));

    Ui.updateShopDisplay();
    Ui.updateTopBar();
    Ui.updateToolButtons();
    Renderer.resize();
    Renderer.centerCamera();
  },

  _hideUI() {
    const spot = document.getElementById('tutorial-spotlight');
    if (spot) spot.classList.add('hidden');
    const bubble = document.getElementById('tutorial-bubble');
    if (bubble) bubble.classList.add('hidden');
    const skip = document.getElementById('tutorial-skip');
    if (skip) skip.classList.add('hidden');
  },

  _enterStep() {
    const step = this.currentStepRaw();
    if (!step) return;
    this.stepPhase = 0;
    this.stepStartTime = 0;
    this.stepCheckTimer = 0;

    if (step.setup) step.setup();

    G.tutorialStep = this.stepIdx;

    this._updateBubbleText();
    this._updateProgressDots();
    this._showBubble();
  },

  _advanceStep() {
    if (this._flashPending) return;
    this._flashPending = true;
    this._flashComplete();
    setTimeout(() => {
      this._flashPending = false;
      this.stepIdx++;
      if (this.stepIdx >= this.data.steps.length) {
        this._complete();
        return;
      }
      this._enterStep();
    }, 500);
  },

  _flashComplete() {
    const bubble = document.getElementById('tutorial-text');
    if (bubble) {
      const orig = bubble.innerHTML;
      bubble.innerHTML = '<span style="color:#50B86C;font-weight:600;">✓ 完成</span>';
      setTimeout(() => { bubble.innerHTML = orig; }, 400);
    }
    const spot = document.getElementById('tutorial-spotlight');
    if (spot) {
      spot.style.cssText = spot.style.cssText.replace(/pointer-events: none/, '') + 'animation: tutSpotGreen 0.5s ease-out';
      setTimeout(() => { spot.style.animation = ''; }, 500);
    }
  },

  currentStepRaw() {
    if (!this.data) return null;
    return this.data.steps[this.stepIdx] || null;
  },

  _updateBubbleText() {
    const step = this.currentStepRaw();
    if (!step) return;
    const el = document.getElementById('tutorial-text');
    if (el) el.innerHTML = step.text;
  },

  _updateProgressDots() {
    const el = document.getElementById('tutorial-dots');
    if (!el) return;
    const total = this.data.steps.length;
    let html = '';
    for (let i = 0; i < total; i++) {
      let cls = 'tdot';
      if (i < this.stepIdx) cls += ' done';
      else if (i === this.stepIdx) cls += ' current';
      html += '<span class="' + cls + '"></span>';
    }
    el.innerHTML = html;
  },

  _getTargetRect() {
    const step = this.currentStepRaw();
    if (!step) return null;
    const rawHl = step.highlight;

    let hl = null;
    if (Array.isArray(rawHl)) {
      hl = rawHl[this.stepPhase] || rawHl[rawHl.length - 1];
    } else {
      hl = rawHl;
    }
    if (!hl) return null;

    if (hl.type === 'dom') {
      const el = document.querySelector(hl.selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }

    if (hl.type === 'zone') {
      const cx = hl.x + hl.w / 2;
      const cy = hl.y + hl.h / 2;
      const tl = gridToScreen(hl.x, hl.y);
      const br = gridToScreen(hl.x + hl.w, hl.y + hl.h);
      const r = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
      return { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
    }

    return null;
  },

  _showBubble() {
    if (this._bubbleVisible) return;
    this._bubbleVisible = true;
    const bubble = document.getElementById('tutorial-bubble');
    if (bubble) {
      bubble.classList.remove('hidden');
      bubble.classList.add('tut-bubble-enter');
      setTimeout(() => bubble.classList.remove('tut-bubble-enter'), 300);
    }
    this._positionBubble();
  },

  _positionBubble() {
    const step = this.currentStepRaw();
    const bubble = document.getElementById('tutorial-bubble');
    if (!bubble) return;

    if (step && step.bubblePin) {
      const margin = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bw = 320;
      const bh = 100;
      let top, left;

      if (step.bubblePin === 'top-right') {
        top = 140;
        left = vw - bw - margin;
      } else if (step.bubblePin === 'top-center') {
        top = margin + 50;
        left = (vw - bw) / 2;
      } else if (step.bubblePin === 'bottom-center') {
        top = vh - bh - margin - 40;
        left = (vw - bw) / 2;
      } else if (step.bubblePin === 'bottom-right') {
        top = vh - bh - margin - 40;
        left = vw - bw - margin;
      } else {
        top = margin + 50;
        left = (vw - bw) / 2;
      }

      bubble.style.top = top + 'px';
      bubble.style.left = left + 'px';
      bubble.style.transform = 'none';
      bubble.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
      return;
    }

    const rect = this._getTargetRect();
    if (!rect) {
      bubble.style.top = '50%';
      bubble.style.left = '50%';
      bubble.style.transform = 'translate(-50%, -50%)';
      bubble.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
      return;
    }

    const bw = bubble.offsetWidth || 320;
    const bh = bubble.offsetHeight || 100;
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top, left, arrowDir;

    const tryAbove = rect.y - bh - margin;
    const tryBelow = rect.y + rect.h + margin;
    const tryLeft = rect.x - bw - margin;
    const tryRight = rect.x + rect.w + margin;

    if (tryAbove > 0) {
      top = tryAbove;
      left = Math.max(margin, Math.min(vw - bw - margin, rect.cx - bw / 2));
      arrowDir = 'bottom';
    } else if (tryBelow + bh < vh) {
      top = tryBelow;
      left = Math.max(margin, Math.min(vw - bw - margin, rect.cx - bw / 2));
      arrowDir = 'top';
    } else if (tryLeft > 0) {
      top = Math.max(margin, Math.min(vh - bh - margin, rect.cy - bh / 2));
      left = tryLeft;
      arrowDir = 'right';
    } else if (tryRight + bw < vw) {
      top = Math.max(margin, Math.min(vh - bh - margin, rect.cy - bh / 2));
      left = tryRight;
      arrowDir = 'left';
    } else {
      top = Math.max(margin, Math.min(vh - bh - margin, rect.y - bh - margin > 0 ? rect.y - bh - margin : rect.y + rect.h + margin));
      left = Math.max(margin, Math.min(vw - bw - margin, rect.cx - bw / 2));
      arrowDir = top > rect.cy ? 'bottom' : 'top';
    }

    bubble.style.top = top + 'px';
    bubble.style.left = left + 'px';
    bubble.style.transform = 'none';
    bubble.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
    if (arrowDir) bubble.classList.add('arrow-' + arrowDir);
  },

  update() {
    if (!this.active) return;

    const isSettlement = G.phase === 'settlement';

    if (!isSettlement) {
      const spot = document.getElementById('tutorial-spotlight');
      if (spot) spot.classList.remove('hidden');
      const bubble = document.getElementById('tutorial-bubble');
      if (bubble) bubble.classList.remove('hidden');
      const skip = document.getElementById('tutorial-skip');
      if (skip) skip.classList.remove('hidden');

      const step = this.currentStepRaw();
      if (step) {
        const rawHl = step.highlight;
        if (Array.isArray(rawHl) && step.phaseCheck && this.stepPhase < step.phaseCheck.length - 1) {
          const pc = step.phaseCheck[this.stepPhase];
          if (pc && pc()) {
            this.stepPhase++;
          }
        }

        let stepDone = false;
        if (typeof step.check === 'function') {
          try { stepDone = step.check(); } catch (e) { stepDone = false; }
        }

        if (stepDone) {
          this._advanceStep();
          return;
        }

        this._renderSpotlight();
        this._positionBubble();
      }
    } else {
      const spot = document.getElementById('tutorial-spotlight');
      if (spot && !spot.classList.contains('hidden')) spot.classList.add('hidden');
      const bubble = document.getElementById('tutorial-bubble');
      if (bubble && !bubble.classList.contains('hidden')) bubble.classList.add('hidden');
      const step = this.currentStepRaw();
      if (step) {
        let stepDone = false;
        if (typeof step.check === 'function') {
          try { stepDone = step.check(); } catch (e) { stepDone = false; }
        }
        if (stepDone) {
          this._advanceStep();
        }
      }
    }
  },

  checkTimer(seconds) {
    if (!this.stepCheckTimer) {
      this.stepCheckTimer = performance.now();
      return false;
    }
    return (performance.now() - this.stepCheckTimer) >= seconds * 1000;
  },

  gateAction(type) {
    if (!this.active) return true;
    const step = this.currentStepRaw();
    if (!step) return true;
    const allowed = step.allowActions || [];
    if (allowed.length === 0) {
      Ui.flashMessage('请先完成当前步骤的指引操作');
      return false;
    }
    if (allowed.includes(type)) return true;
    Ui.flashMessage('当前步骤不支持此操作');
    return false;
  },

  _renderSpotlight() {
    const canvas = document.getElementById('tutorial-spotlight');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);

    const rect = this._getTargetRect();
    if (!rect) return;

    ctx.globalCompositeOperation = 'destination-out';
    const pad = 6;
    ctx.fillRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2);

    ctx.globalCompositeOperation = 'source-over';
    const t = Date.now() * 0.003;
    const alpha = 0.5 + 0.3 * Math.sin(t);
    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.lineDashOffset = t * 20;
    ctx.strokeRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2);
    ctx.setLineDash([]);
  },

  skip() {
    this.active = false;
    G.tutorialId = null;
    G.tutorialStep = 0;
    this._hideUI();
    document.getElementById('tutorial-complete').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden', 'fade-out');
    document.getElementById('main-menu').querySelector('.menu-buttons').classList.remove('hidden');
    document.querySelector('#main-menu .menu-title-box').classList.remove('hidden');
    document.getElementById('map-config').classList.add('hidden');
    G.phase = 'build';
    MenuDecor.start();
  },

  _complete() {
    this.active = false;
    G.tutorialId = null;
    this._hideUI();
    document.getElementById('tutorial-complete').classList.remove('hidden');
    const linesEl = document.getElementById('tc-lines');
    if (linesEl && this.data.completeMessage) {
      linesEl.innerHTML = this.data.completeMessage.lines
        .filter(l => l).map(l => '<div>' + l + '</div>').join('');
    }
    document.getElementById('sidebar').classList.add('hidden');
    document.querySelectorAll('#bottom-bar .build-only').forEach(b => b.classList.add('hidden'));
    document.getElementById('overlay').classList.add('hidden');
  },

  completeAction(action) {
    document.getElementById('tutorial-complete').classList.add('hidden');
    if (action === 'menu') {
      document.getElementById('main-menu').classList.remove('hidden', 'fade-out');
      document.getElementById('main-menu').querySelector('.menu-buttons').classList.remove('hidden');
      document.querySelector('#main-menu .menu-title-box').classList.remove('hidden');
      document.getElementById('map-config').classList.add('hidden');
      document.getElementById('sidebar').classList.add('hidden');
      document.getElementById('bottom-bar').querySelectorAll('.build-only').forEach(b => b.classList.add('hidden'));
      document.getElementById('overlay').classList.add('hidden');
      G.phase = 'build';
      MenuDecor.start();
    } else if (action === 'freeplay') {
      G.phase = 'build';
      G.paused = false;
      G.satisfaction = 100;
      G.lowSatisfactionDays = 0;
      G.gold = 500;
      G.trackFragments = 30;
      G.platformComponents = 5;
      G.wagons = 4;
      G.dayNumber = 1;
      G.passengersDeliveredToday = 0;
      G.totalPassengersDelivered = 0;
      G.totalGeneratedToday = 0;
      G.lastDeductHour = 6;
      G.stationQueues = {};
      for (const st of G.stations) G.stationQueues[st.id] = {};
      if (G.activeTrains.length > 0) {
        for (const t of [...G.activeTrains]) {
          G.activeTrains.splice(G.activeTrains.indexOf(t), 1);
          t.state = 'in_depot';
          G.depotTrains.push(t);
        }
      }
      document.getElementById('sidebar').classList.remove('hidden');
      document.getElementById('bottom-bar').querySelectorAll('.build-only').forEach(b => b.classList.remove('hidden'));
      document.getElementById('overlay').classList.add('hidden');
      Ui.updateShopDisplay();
      Ui.updateTopBar();
      Ui.updateToolButtons();
      Renderer.resize();
      Renderer.centerCamera();
    }
    MenuDecor.stop();
  },
};

function gridToScreen(gx, gy) {
  const wx = gx * G.CELL_SIZE;
  const wy = gy * G.CELL_SIZE;
  const sx = wx * G.zoom + G.offsetX;
  const sy = wy * G.zoom + G.offsetY;
  const canvas = document.getElementById('game-canvas');
  const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
  return { x: sx + rect.left, y: sy + rect.top };
}
