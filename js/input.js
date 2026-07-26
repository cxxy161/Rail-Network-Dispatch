const Input = {
  canvas: null,

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
        this.operateClick(screenToGrid(pos.x, pos.y));
        return;
      }
      if (G.phase !== 'build') return;

      const grid = screenToGrid(pos.x, pos.y);
      const clamped = clampGrid(grid.x, grid.y);

      if (G.selectedTool === 'track') {
        this.trackDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'platform') {
        this.platformDown(clamped.x, clamped.y);
      } else if (G.selectedTool === 'eraser') {
        this.eraseClick(clamped.x, clamped.y, Graph.key(clamped.x, clamped.y), pos.x, pos.y);
      }
    }
  },

  // ── Track drag ──
  trackDown(gx, gy) {
    G.trackDrag.active = true;
    G.trackDrag.lastGX = gx;
    G.trackDrag.lastGY = gy;
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
      }

      G.trackDrag.lastGX = nx;
      G.trackDrag.lastGY = ny;
      // Update refs for next iteration
      // We need to update lgx, lgy for the while loop
      lgx = nx;
      lgy = ny;
    }
  },

  trackUp() {
    G.trackDrag.active = false;
    G.trackDrag.lastGX = -1;
    G.trackDrag.lastGY = -1;
  },

  // ── Platform drag ──
  platformDown(gx, gy) {
    G.platDrag.active = true;
    G.platDrag.startX = gx;
    G.platDrag.startY = gy;
    G.platDrag.dir = null;
  },

  platformDragTo(startGX, startGY, gx, gy) {
    if (!G.platDrag.active) return;
    const dx = gx - startGX;
    const dy = gy - startGY;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      G.platDrag.dir = null;
    } else {
      G.platDrag.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
  },

  platformUp(gx, gy) {
    G.platDrag.active = false;
    const dir = G.platDrag.dir;
    G.platDrag.dir = null;
    if (!dir) return;

    const result = Station.addPlatform(gx, gy, dir);
    if (result === 'err_not_in_area') {
      Ui.flashMessage('站台必须在站点区域内（圆形虚线范围）');
    } else if (result === 'err_dup') {
      Ui.flashMessage('此格已有站台');
    } else if (result === 'err_no_comp') {
      Ui.flashMessage('站台组件不足！');
    }
  },

  // ── Eraser ──
  eraseClick(gx, gy, key, screenX, screenY) {
    if (Station.getPlatformAt(gx, gy)) {
      Station.removePlatform(gx, gy);
      return;
    }

    if (G.connectionMap[key]) {
      const neighbors = [...Graph.getNeighbors(key)];
      for (const nk of neighbors) {
        Graph.removeEdge(key, nk);
        G.trackFragments++;
      }
      return;
    }

    const clickedEdge = Renderer.edgeAtScreen(screenX, screenY);
    if (clickedEdge) {
      G.trackFragments++;
      Graph.removeEdge(clickedEdge.k1, clickedEdge.k2);
      for (const train of [...G.activeTrains]) {
        const keys = [train.fromKey, train.toKey].filter(Boolean);
        if (keys.includes(clickedEdge.k1) || keys.includes(clickedEdge.k2)) {
          Train.recall(train);
        }
      }
    }
  },

  // ── Operate ──
  operateClick(grid) {
    const clamped = clampGrid(grid.x, grid.y);
    const key = Graph.key(clamped.x, clamped.y);

    if (G.activeSwitches[key] !== undefined) {
      Graph.cycleSwitch(key);
      return;
    }

    const cw = clamped.x * G.CELL_SIZE + G.CELL_SIZE / 2;
    const ch = clamped.y * G.CELL_SIZE + G.CELL_SIZE / 2;
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
      if (Math.hypot(cw - px, ch - py) < G.CELL_SIZE) {
        if (train.state === 'moving') {
          train.state = 'stopped';
          Ui.flashMessage('列车已停车');
        } else if (train.state === 'stopped') {
          train.state = 'moving';
          Ui.flashMessage('列车已启动');
        }
        return;
      }
    }
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
    G.selectedTool = tool;
    Ui.updateToolButtons();
  },

  onKeyDown(e) {
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
      G.selectedItem = null;
    }

    if (e.key === 'Delete' && G.phase === 'build') {
      const edge = Renderer.edgeAtScreen(
        G.mouseGridX < 0 ? 0 : G.mouseGridX * G.CELL_SIZE * G.zoom + G.offsetX,
        G.mouseGridY < 0 ? 0 : G.mouseGridY * G.CELL_SIZE * G.zoom + G.offsetY
      );
      if (edge) {
        G.trackFragments++;
        Graph.removeEdge(edge.k1, edge.k2);
      }
    }
  },
};
