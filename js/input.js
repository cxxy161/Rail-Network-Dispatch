const Input = {
  canvas: null,
  dragBatchEdges: [],
  dragBatchPlats: [],
  _depotTrackClick: false,

  init(canvas) {
    this.canvas = canvas;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseleave', () => {
      G.mouseGridX = -1;
      G.mouseGridY = -1;
    });

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },

  // ── Undo ──
  pushUndo(action) {
    if (G.undoStack.length > 50) G.undoStack.shift();
    G.undoStack.push(action);
  },

  undoLast() {
    if (G.undoStack.length === 0) return null;
    const action = G.undoStack.pop();

    if (action.type === 'add_edges') {
      for (const pair of action.pairs) {
        Graph.removeEdge(pair[0], pair[1]);
        G.trackFragments++;
      }
      return true;
    }
    if (action.type === 'remove_edges') {
      for (const pair of action.pairs) {
        Graph.addEdge(pair[0], pair[1]);
        G.trackFragments--;
      }
      return true;
    }
    if (action.type === 'add_platform') {
      G.platforms.pop();
      G.platformComponents++;
      return true;
    }
    if (action.type === 'remove_platform') {
      G.platforms.push(action.platform);
      G.platformComponents--;
      return true;
    }
    if (action.type === 'remove_platforms') {
      for (const item of action.items) {
        G.platforms.push(item.platform);
        G.platformComponents--;
      }
      return true;
    }
    if (action.type === 'batch') {
      for (let i = action.items.length - 1; i >= 0; i--) {
        this.undoItem(action.items[i]);
      }
      return true;
    }
    return false;
  },

  undoItem(item) {
    if (item.type === 'add_edge') {
      Graph.removeEdge(item.k1, item.k2);
      G.trackFragments++;
    } else if (item.type === 'remove_edge') {
      Graph.addEdge(item.k1, item.k2);
      G.trackFragments--;
    } else if (item.type === 'add_platform') {
      G.platforms.pop();
      G.platformComponents++;
    } else if (item.type === 'remove_platform') {
      G.platforms.push(item.platform);
      G.platformComponents--;
    }
  },

  // ── Mouse down ──
  onMouseDown(e) {
    const pos = this.getCanvasPos(e);

    if (e.button === 1 || e.button === 2) {
      G.isPanning = true;
      G.panStartX = e.clientX;
      G.panStartY = e.clientY;
      G.panOffsetStartX = G.offsetX;
      G.panOffsetStartY = G.offsetY;
      return;
    }

    if (e.button === 0) {
      if (G.phase === 'operate') {
        this.operateClick(screenToGrid(pos.x, pos.y), e);
        return;
      }
      if (G.phase !== 'build') return;

      const grid = screenToGrid(pos.x, pos.y);
      const clamped = clampGrid(grid.x, grid.y);

      if (G.depotX - 1 <= clamped.x && clamped.x <= G.depotX &&
          G.depotY - 1 <= clamped.y && clamped.y <= G.depotY) {
        if (G.selectedTool === 'track' && Tutorial.isActionAllowed('drag_track')) {
          this._depotTrackClick = true;
        } else {
          if (Tutorial.gateAction('click_depot')) {
            this.showDepotBuildPopup(e);
          }
          return;
        }
      }

      this.dragBatchEdges = [];
      this.dragBatchPlats = [];

      if (G.selectedTool === 'track') {
        if (!Tutorial.gateAction('drag_track')) return;
        this.trackDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'platform') {
        if (!Tutorial.gateAction('drag_platform')) return;
        this.platformDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'eraser') {
        if (!Tutorial.gateAction('drag_track')) return;
        G.eraserDragging = true;
        G.eraserLastGX = clamped.x;
        G.eraserLastGY = clamped.y;
        this.eraserAt(clamped.x, clamped.y);
      }
    }
  },

  // ── Track drag ──
  trackDown(gx, gy) {
    G.trackDrag.active = true;
    G.trackDrag.startX = gx;
    G.trackDrag.startY = gy;
  },

  trackUp(gx, gy) {
    if (!G.trackDrag.active) return;
    G.trackDrag.active = false;

    const sx = G.trackDrag.startX, sy = G.trackDrag.startY;
    if (sx === gx && sy === gy) return;

    const path = computeOptimalPath(sx, sy, gx, gy);
    let prevX = sx, prevY = sy;
    const edges = [];

    for (const p of path) {
      if (Station.getPlatformAt(p.x, p.y)) {
        prevX = p.x; prevY = p.y;
        continue;
      }
      if (G.trackFragments <= 0) {
        Ui.flashMessage('轨道碎片不足！');
        break;
      }
      const k1 = Graph.key(prevX, prevY), k2 = Graph.key(p.x, p.y);
      if (!Graph.hasEdge(k1, k2) && k1 !== k2) {
        Graph.addEdge(k1, k2);
        G.trackFragments--;
        edges.push({ type: 'add_edge', k1, k2 });
      }
      prevX = p.x; prevY = p.y;
    }

    if (edges.length > 0) {
      this.pushUndo({ type: 'add_edges', pairs: edges.map(e => [e.k1, e.k2]) });
      G._dirty = true;
    }

    G.trackDrag.startX = -1;
    G.trackDrag.startY = -1;
  },

  // ── Platform drag ──
  platformDown(gx, gy) {
    G.platDrag.active = true;
    G.platDrag.startX = gx;
    G.platDrag.startY = gy;
    G.platDrag.lastGX = gx;
    G.platDrag.lastGY = gy;
    G.platDrag.dir = null;
    G.platDrag.locked = false;
    G.platDrag.firstPlaced = false;
  },

  platformDragTo(startGX, startGY, gx, gy) {
    if (!G.platDrag.active) return;

    const dx = Math.abs(gx - startGX);
    const dy = Math.abs(gy - startGY);

    if (!G.platDrag.locked && (dx > 0 || dy > 0)) {
      G.platDrag.dir = dx >= dy ? 'h' : 'v';
      G.platDrag.locked = true;
    }
    if (!G.platDrag.dir) return;

    if (!G.platDrag.firstPlaced) {
      G.platDrag.firstPlaced = true;
      if (G.platformComponents > 0) {
        const result = Station.addPlatform(startGX, startGY, G.platDrag.dir);
        if (result && typeof result !== 'string') this.dragBatchPlats.push({ type: 'add_platform', platform: result });
        else if (typeof result === 'string') { G.platDrag.active = false; return; }
      }
    }

    let lgx = G.platDrag.lastGX;
    let lgy = G.platDrag.lastGY;

    while (true) {
      if (G.platDrag.dir === 'h' && lgx === gx) break;
      if (G.platDrag.dir === 'v' && lgy === gy) break;

      const sx = Math.sign(gx - lgx);
      const sy = Math.sign(gy - lgy);

      const nx = G.platDrag.dir === 'h' ? lgx + sx : startGX;
      const ny = G.platDrag.dir === 'v' ? lgy + sy : startGY;

      if ((G.platDrag.dir === 'h' && sx === 0) || (G.platDrag.dir === 'v' && sy === 0)) break;

      if (G.platformComponents <= 0) {
        G.platDrag.active = false;
        Ui.flashMessage('站台组件不足！');
        break;
      }

      const result = Station.addPlatform(nx, ny, G.platDrag.dir);
      if (typeof result === 'string') break;
      if (result) this.dragBatchPlats.push({ type: 'add_platform', platform: result });

      G.platDrag.lastGX = nx;
      G.platDrag.lastGY = ny;
      lgx = nx;
      lgy = ny;
    }
  },

  platformUp(gx, gy) {
    G.platDrag.active = false;
    G.platDrag.dir = null;
    G.platDrag.locked = false;
    G.platDrag.lastGX = -1;
    G.platDrag.lastGY = -1;

    if (this.dragBatchPlats.length > 0) {
      const plats = [...this.dragBatchPlats];
      this.dragBatchPlats = [];
      this.pushUndo({
        type: 'remove_platforms',
        items: plats,
      });
      G._dirty = true;
    }
  },

  // ── Eraser ──
  eraserAt(gx, gy) {
    const key = Graph.key(gx, gy);

    const plat = Station.getPlatformAt(gx, gy);
    if (plat) {
      const removed = Station.removePlatform(gx, gy);
      if (removed) {
        this.dragBatchPlats.push({ type: 'remove_platform', platform: removed });
      }
      return;
    }

    if (G.connectionMap[key]) {
      const neighbors = [...Graph.getNeighbors(key)];
      for (const nk of neighbors) {
        Graph.removeEdge(key, nk);
        G.trackFragments++;
        this.dragBatchEdges.push({ type: 'remove_edge', k1: key, k2: nk });
      }
      return;
    }
  },

  eraserUp() {
    if (!G.eraserDragging) return;
    G.eraserDragging = false;
    G.eraserLastGX = -1;
    G.eraserLastGY = -1;

    const items = [...this.dragBatchPlats, ...this.dragBatchEdges];
    this.dragBatchPlats = [];
    this.dragBatchEdges = [];
    if (items.length > 0) {
      this.pushUndo({ type: 'batch', items });
      G._dirty = true;
    }
  },

  // ── Operate ──
  showDepotPopup(e) {
    let html = '<b>车辆段</b>';
    if (G.depotTrains.length === 0) {
      html += '<br>暂无停放列车';
    } else {
      for (const train of G.depotTrains) {
        html += `<br>列车 #${train.id} (${train.carCount}节) <span class="depot-dispatch-btn" data-id="${train.id}">[发车]</span>`;
      }
    }
    updateRightPanel(html);
    setTimeout(() => {
      const btns = document.querySelectorAll('.depot-dispatch-btn');
      btns.forEach(btn => {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          const tid = parseInt(btn.dataset.id);
          const idx = G.depotTrains.findIndex(t => t.id === tid);
          if (idx >= 0) {
            const train = G.depotTrains.splice(idx, 1)[0];
            if (Train.dispatch(train)) {
              G._dirty = true;
              Input.showDepotPopup();
            } else {
              G.depotTrains.push(train);
              Ui.flashMessage('车辆段未连接到铁路网！');
              Input.showDepotPopup();
            }
          }
        };
      });
    }, 0);
  },

  showDepotBuildPopup(e) {
    let body = `<b>车辆段</b><br>可用车厢: ${G.wagons}<hr>`;
    body += `新编组: <button onclick="Input._depotChange(-1)">−</button> <span id="form-count">2</span> 节 <button onclick="Input._depotChange(1)">+</button>`;
    body += ` <button onclick="Input._depotCreate()">创建</button><hr>`;
    body += '现有列车:';
    if (G.depotTrains.length === 0) {
      body += '<br>暂无';
    } else {
      for (const train of G.depotTrains) {
        body += `<br>#${train.id} (${train.carCount}节) <button onclick="Input._depotDelete(${train.id})">删除</button>`;
      }
    }
    Input._depotFormCount = 2;
    updateRightPanel(body);
  },

  _depotChange(d) {
    Input._depotFormCount = Math.max(1, Math.min(G.wagons, Input._depotFormCount + d));
    const el = document.getElementById('form-count');
    if (el) el.textContent = Input._depotFormCount;
  },

  _depotDelete(tid) {
    const idx = G.depotTrains.findIndex(t => t.id === tid);
    if (idx >= 0) {
      G.wagons += G.depotTrains[idx].carCount;
      G.depotTrains.splice(idx, 1);
      G._dirty = true;
      Ui.updateShopDisplay();
      Input.showDepotBuildPopup();
    }
  },

  _depotCreate() {
    const n = Input._depotFormCount;
    if (G.wagons < n) {
      Ui.flashMessage('车厢不足！');
      return;
    }
    G.wagons -= n;
    G.depotTrains.push(Train.create(n));
    G._dirty = true;
    Ui.updateShopDisplay();
    Input.showDepotBuildPopup();
  },

  operateClick(grid, e) {
    const clamped = clampGrid(grid.x, grid.y);
    const key = Graph.key(clamped.x, clamped.y);

    if (G.depotX - 1 <= clamped.x && clamped.x <= G.depotX &&
        G.depotY - 1 <= clamped.y && clamped.y <= G.depotY) {
      if (Tutorial.gateAction('click_depot')) {
        this.showDepotPopup(e);
      }
      return;
    }

    if (G.operateSubTool === 'stop') {
      if (!Tutorial.gateAction('click_train')) return;
      const train = this.findTrainAt(clamped.x, clamped.y);
      if (train) {
        if (train.state === 'moving') {
          train.state = 'stopped';
          Tutorial.flags.usedStop = true;
        } else if (train.state === 'stopped') {
          train.state = 'moving';
          train.speed = 0;
          Tutorial.flags.usedStop = true;
        }
      }
      return;
    }

    if (G.operateSubTool === 'reverse') {
      if (!Tutorial.gateAction('click_train')) return;
      const train = this.findTrainAt(clamped.x, clamped.y);
      if (train) {
        Train.reverseTrain(train);
        Tutorial.flags.usedReverse = true;
      }
      return;
    }

    if (G.activeSwitches[key] !== undefined) {
      if (Tutorial.gateAction('click_switch')) {
        Graph.cycleSwitch(key);
        Tutorial.flags.switchToggled = true;
      }
      return;
    }

    const train = this.findTrainAt(clamped.x, clamped.y);
    if (train) {
      if (Tutorial.gateAction('click_train')) {
        G.infoTarget = { type: 'train', id: train.id };
        updateRightPanel();
      }
      return;
    }

    const plat = Station.getPlatformAdjacent(clamped.x, clamped.y) || Station.getPlatformAt(clamped.x, clamped.y);
    if (plat) {
      G.infoTarget = { type: 'station', id: plat.stationId };
      updateRightPanel();
      return;
    }

    G.infoTarget = null;
    hideRightPanel();
  },

  findTrainAt(gx, gy) {
    const cw = gx * G.CELL_SIZE + G.CELL_SIZE / 2;
    const ch = gy * G.CELL_SIZE + G.CELL_SIZE / 2;
    for (const train of G.activeTrains) {
      if (!train.fromKey) continue;
      let px, py;
      if (train.toKey) {
        const [x1, y1] = train.fromKey.split(',').map(Number);
        const [x2, y2] = train.toKey.split(',').map(Number);
        const wx1 = x1 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const wy1 = y1 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const wx2 = x2 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const wy2 = y2 * G.CELL_SIZE + G.CELL_SIZE / 2;
        px = wx1 + (wx2 - wx1) * train.t;
        py = wy1 + (wy2 - wy1) * train.t;
      } else {
        const [x1, y1] = train.fromKey.split(',').map(Number);
        px = x1 * G.CELL_SIZE + G.CELL_SIZE / 2;
        py = y1 * G.CELL_SIZE + G.CELL_SIZE / 2;
      }
      if (Math.hypot(cw - px, ch - py) < G.CELL_SIZE) return train;
    }
    return null;
  },

  // ── Mouse move ──
  onMouseMove(e) {
    const pos = this.getCanvasPos(e);

    if (G.isPanning) {
      G.offsetX = G.panOffsetStartX + (e.clientX - G.panStartX);
      G.offsetY = G.panOffsetStartY + (e.clientY - G.panStartY);
      return;
    }

    const grid = screenToGrid(pos.x, pos.y);
    const clamped = clampGrid(grid.x, grid.y);
    G.mouseGridX = clamped.x;
    G.mouseGridY = clamped.y;

    if (G.selectedTool === 'track' && G.trackDrag.active) {
    } else if (G.selectedTool === 'platform' && G.platDrag.active) {
      this.platformDragTo(G.platDrag.startX, G.platDrag.startY, clamped.x, clamped.y);
    } else if (G.selectedTool === 'eraser' && G.eraserDragging) {
      if (clamped.x !== G.eraserLastGX || clamped.y !== G.eraserLastGY) {
        G.eraserLastGX = clamped.x;
        G.eraserLastGY = clamped.y;
        this.eraserAt(clamped.x, clamped.y);
      }
    }
  },

  onMouseUp(e) {
    if (e.button === 1 || e.button === 2) {
      G.isPanning = false;
      return;
    }

    const pos = this.getCanvasPos(e);
    const grid = screenToGrid(pos.x, pos.y);
    const clamped = clampGrid(grid.x, grid.y);

    if (G.selectedTool === 'track' && G.trackDrag.active) {
      if (this._depotTrackClick &&
          G.trackDrag.startX === clamped.x && G.trackDrag.startY === clamped.y) {
        G.trackDrag.active = false;
        this._depotTrackClick = false;
        if (Tutorial.gateAction('click_depot')) {
          this.showDepotBuildPopup(e);
        }
      } else {
        this._depotTrackClick = false;
        this.trackUp(clamped.x, clamped.y);
      }
    } else if (G.selectedTool === 'platform' && G.platDrag.active) {
      this.platformUp(clamped.x, clamped.y);
    } else if (G.selectedTool === 'eraser') {
      this.eraserUp();
    }
  },

  onWheel(e) {
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);
    const newZoom = Math.max(0.05, Math.min(2.0, G.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    G.offsetX = pos.x - world.x * newZoom;
    G.offsetY = pos.y - world.y * newZoom;
    G.zoom = newZoom;
  },

  switchTool(tool) {
    G.trackDrag.active = false;
    G.trackDrag.startX = -1;
    G.trackDrag.startY = -1;
    G.platDrag.active = false;
    G.platDrag.dir = null;
    G.eraserDragging = false;
    G.selectedTool = tool;
    hideRightPanel();
    Ui.updateToolButtons();
  },

  onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      this.undoLast();
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (G.phase === 'operate') {
        G.paused = !G.paused;
        Ui.updatePauseButton();
      }
      return;
    }

    if (e.key === '1') { if (G.phase === 'build') this.switchTool('track'); }
    if (e.key === '2') { if (G.phase === 'build') this.switchTool('platform'); }
    if (e.key === '3') { if (G.phase === 'build') this.switchTool('eraser'); }

    if (e.key === 'Escape') {
      G.trackDrag.active = false;
      G.platDrag.active = false;
      G.platDrag.dir = null;
      G.eraserDragging = false;
      G.selectedItem = null;
      hideRightPanel();
    }
  },
};

function computeOptimalPath(sx, sy, ex, ey) {
  const dx = ex - sx, dy = ey - sy;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const diag = Math.min(adx, ady);
  const straight = Math.max(adx, ady) - diag;
  const sdx = Math.sign(dx), sdy = Math.sign(dy);
  const path = [];
  let cx = sx, cy = sy;
  for (let i = 0; i < diag; i++) { cx += sdx; cy += sdy; path.push({ x: cx, y: cy }); }
  let ddx = 0, ddy = 0;
  if (adx > ady) { ddx = sdx; } else if (ady > adx) { ddy = sdy; }
  for (let i = 0; i < straight; i++) { cx += ddx; cy += ddy; path.push({ x: cx, y: cy }); }
  return path;
}

function updateRightPanel(html) {
  const el = document.getElementById('right-panel');
  if (html !== undefined) el.innerHTML = html;
  if (el.innerHTML) el.classList.remove('hidden');
}

function hideRightPanel() {
  G.infoTarget = null;
  const el = document.getElementById('right-panel');
  el.classList.add('hidden');
  el.innerHTML = '';
}

function updateInfoPopup() {
  if (!G.infoTarget) { hideRightPanel(); return; }
  let html = '';

  if (G.infoTarget.type === 'train') {
    const train = G.activeTrains.find(t => t.id === G.infoTarget.id);
    if (!train) { hideRightPanel(); return; }
    const load = Object.values(train.passengers).reduce((a, b) => a + b, 0);
    const maxLoad = Train.maxLoad(train);

    const status = train.docked ? '停靠中' : (train.speed > 0 ? `运行中 (${train.speed.toFixed(1)} 格/秒)` : '待发');

    html += `<div class="rp-header">列车 #${train.id} (${train.carCount}节)</div>`;
    html += `<div class="rp-key-stat">载客: <strong>${load} / ${maxLoad}</strong></div>`;
    html += `<div class="rp-stat">状态: ${status}</div>`;

    const dests = Object.entries(train.passengers).filter(([, cnt]) => cnt > 0);
    if (dests.length > 0) {
      html += '<hr class="rp-divider">';
      html += '<div class="rp-section-title">目的地</div>';
      for (const [dest, cnt] of dests) {
        const st = Station.getStationById(dest);
        const color = st ? st.color : '#999';
        html += `<div class="rp-row"><span><span class="rp-dot" style="display:inline-block;background:${color}"></span> ${dest}站</span><strong>${cnt}人</strong></div>`;
      }
    }
  } else if (G.infoTarget.type === 'station') {
    const sid = G.infoTarget.id;
    const st = Station.getStationById(sid);
    const color = st ? st.color : '#999';
    const queue = G.stationQueues[sid] || {};
    const total = Object.values(queue).reduce((a, b) => a + b, 0);

    html += `<div class="rp-header"><span class="rp-dot" style="background:${color}"></span> ${sid}站</div>`;
    html += `<div class="rp-key-stat">待乘: <strong>${total} 人</strong></div>`;
    if (st && st.flowLevel) html += `<div class="rp-stat">客流等级: ${st.flowLevel}</div>`;

    const dests = Object.entries(queue).filter(([, cnt]) => cnt > 0);
    if (dests.length > 0) {
      html += '<hr class="rp-divider">';
      html += '<div class="rp-section-title">目的地</div>';
      for (const [dest, cnt] of dests) {
        const dt = Station.getStationById(dest);
        const dcolor = dt ? dt.color : '#999';
        html += `<div class="rp-row"><span><span class="rp-dot" style="display:inline-block;background:${dcolor}"></span> ${dest}站</span><strong>${cnt}人</strong></div>`;
      }
    }
  }

  document.getElementById('right-panel').innerHTML = html;
  document.getElementById('right-panel').classList.remove('hidden');
}
