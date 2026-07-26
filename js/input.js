const Input = {
  canvas: null,
  dragBatchEdges: [],
  dragBatchPlats: [],

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
        this.showDepotBuildPopup(e);
        hidePopup();
        return;
      }

      this.dragBatchEdges = [];
      this.dragBatchPlats = [];

      if (G.selectedTool === 'track') {
        this.trackDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'platform') {
        this.platformDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'eraser') {
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
    G.trackDrag.lastGX = gx;
    G.trackDrag.lastGY = gy;
    G.trackDrag.firstGX = gx;
    G.trackDrag.firstGY = gy;
  },

  trackDragTo(gx, gy) {
    if (!G.trackDrag.active) return;
    let lgx = G.trackDrag.lastGX;
    let lgy = G.trackDrag.lastGY;
    if (lgx < 0 || lgy < 0) return;

    while (lgx !== gx || lgy !== gy) {
      const dx = Math.sign(gx - lgx);
      const dy = Math.sign(gy - lgy);
      const nx = lgx + dx;
      const ny = lgy + dy;

      if (Station.getPlatformAt(nx, ny)) {
        G.trackDrag.active = false;
        break;
      }

      if (G.trackFragments <= 0) {
        G.trackDrag.active = false;
        Ui.flashMessage('轨道碎片不足！');
        break;
      }

      const prevKey = Graph.key(lgx, lgy);
      const nextKey = Graph.key(nx, ny);
      if (!Graph.hasEdge(prevKey, nextKey)) {
        Graph.addEdge(prevKey, nextKey);
        G.trackFragments--;
        this.dragBatchEdges.push({ type: 'add_edge', k1: prevKey, k2: nextKey });
      }

      G.trackDrag.lastGX = nx;
      G.trackDrag.lastGY = ny;
      lgx = nx;
      lgy = ny;
    }
  },

  trackUp() {
    if (!G.trackDrag.active) return;
    G.trackDrag.active = false;
    G.trackDrag.lastGX = -1;
    G.trackDrag.lastGY = -1;
    if (this.dragBatchEdges.length > 0) {
      this.pushUndo({
        type: 'add_edges',
        pairs: this.dragBatchEdges.map(e => [e.k1, e.k2]),
      });
      this.dragBatchEdges = [];
    }
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
    showPopup(e, html, true);
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
              hidePopup();
            } else {
              G.depotTrains.push(train);
              Ui.flashMessage('车辆段未连接到铁路网！');
              hidePopup();
            }
          }
        };
      });
    }, 0);
  },

  showDepotBuildPopup(e) {
    const self = this;
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
    Input._depotEvent = e;
    showPopup(e, body, true);
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
      Ui.updateShopDisplay();
      Input.showDepotBuildPopup(Input._depotEvent);
    }
  },

  _depotCreate() {
    const n = Input._depotFormCount;
    if (G.wagons < n) {
      Ui.flashMessage('车厢碎屑不足！');
      return;
    }
    G.wagons -= n;
    G.depotTrains.push(Train.create(n));
    Ui.updateShopDisplay();
    Input.showDepotBuildPopup(Input._depotEvent);
  },

  operateClick(grid, e) {
    const clamped = clampGrid(grid.x, grid.y);
    const key = Graph.key(clamped.x, clamped.y);

    if (G.depotX - 1 <= clamped.x && clamped.x <= G.depotX &&
        G.depotY - 1 <= clamped.y && clamped.y <= G.depotY) {
      this.showDepotPopup(e);
      return;
    }

    if (G.operateSubTool === 'stop') {
      const train = this.findTrainAt(clamped.x, clamped.y);
      if (train) {
        if (train.state === 'moving') {
          train.state = 'stopped';
        } else if (train.state === 'stopped') {
          train.state = 'moving';
          train.speed = 0;
        }
      }
      return;
    }

    if (G.operateSubTool === 'reverse') {
      const train = this.findTrainAt(clamped.x, clamped.y);
      if (train) {
        Train.reverseTrain(train);
      }
      return;
    }

    if (G.activeSwitches[key] !== undefined) {
      Graph.cycleSwitch(key);
      hidePopup();
      return;
    }

    const train = this.findTrainAt(clamped.x, clamped.y);
    if (train) {
      const load = Object.values(train.passengers).reduce((a,b)=>a+b,0);
      let html = `<b>列车 #${train.id}</b> (${train.carCount}节)<br>载客: ${load} / ${Train.maxLoad(train)}`;
      for (const [dest, cnt] of Object.entries(train.passengers)) {
        if (cnt > 0) html += `<br>&nbsp;&nbsp;→ ${dest}站: ${cnt}人`;
      }
      showPopup(e, html);
      return;
    }

    const plat = Station.getPlatformAdjacent(clamped.x, clamped.y) || Station.getPlatformAt(clamped.x, clamped.y);
    if (plat) {
      const sid = plat.stationId;
      const queue = G.stationQueues[sid] || {};
      const total = Object.values(queue).reduce((a,b)=>a+b,0);
      let html = `<b>${sid}站</b> 待乘: ${total}`;
      for (const [dest, cnt] of Object.entries(queue)) {
        if (cnt > 0) html += `<br>&nbsp;&nbsp;→ ${dest}站: ${cnt}人`;
      }
      showPopup(e, html);
      return;
    }

    hidePopup();
  },

  findTrainAt(gx, gy) {
    const cw = gx * G.CELL_SIZE + G.CELL_SIZE / 2;
    const ch = gy * G.CELL_SIZE + G.CELL_SIZE / 2;
    for (const train of G.activeTrains) {
      if (!train.fromKey || !train.toKey) continue;
      const [x1, y1] = train.fromKey.split(',').map(Number);
      const [x2, y2] = train.toKey.split(',').map(Number);
      const wx1 = x1 * G.CELL_SIZE + G.CELL_SIZE / 2;
      const wy1 = y1 * G.CELL_SIZE + G.CELL_SIZE / 2;
      const wx2 = x2 * G.CELL_SIZE + G.CELL_SIZE / 2;
      const wy2 = y2 * G.CELL_SIZE + G.CELL_SIZE / 2;
      const px = wx1 + (wx2 - wx1) * train.t;
      const py = wy1 + (wy2 - wy1) * train.t;
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
      this.trackDragTo(clamped.x, clamped.y);
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
      this.trackUp();
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
    const newZoom = Math.max(0.3, Math.min(2.0, G.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    G.offsetX = pos.x - world.x * newZoom;
    G.offsetY = pos.y - world.y * newZoom;
    G.zoom = newZoom;
  },

  switchTool(tool) {
    G.trackDrag.active = false;
    G.trackDrag.lastGX = -1;
    G.trackDrag.lastGY = -1;
    G.platDrag.active = false;
    G.platDrag.dir = null;
    G.eraserDragging = false;
    G.selectedTool = tool;
    hidePopup();
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

    if (e.key === '1') this.switchTool('track');
    if (e.key === '2') this.switchTool('platform');
    if (e.key === '3') this.switchTool('eraser');

    if (e.key === 'Escape') {
      G.trackDrag.active = false;
      G.platDrag.active = false;
      G.platDrag.dir = null;
      G.eraserDragging = false;
      G.selectedItem = null;
      hidePopup();
    }
  },
};

function showPopup(e, html, interactive) {
  const el = document.getElementById('info-popup');
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.classList.toggle('clickable', !!interactive);
  const pad = 12;
  requestAnimationFrame(() => {
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const ew = el.offsetWidth, eh = el.offsetHeight;
    if (x + ew > window.innerWidth) x = e.clientX - ew - pad;
    if (y + eh > window.innerHeight) y = e.clientY - eh - pad;
    if (x < 0) x = pad;
    if (y < 0) y = pad;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  });
}

function hidePopup() {
  const el = document.getElementById('info-popup');
  el.classList.add('hidden');
  el.classList.remove('clickable');
}
