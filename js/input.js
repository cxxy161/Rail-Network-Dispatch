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

    if (e.button === 1 || (e.button === 2)) {
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
      const key = Graph.key(clamped.x, clamped.y);

      if (G.selectedTool === 'track') {
        this.trackClick(clamped.x, clamped.y, key);
      } else if (G.selectedTool === 'platform') {
        this.platformClick(clamped.x, clamped.y);
      } else if (G.selectedTool === 'eraser') {
        this.eraseClick(clamped.x, clamped.y, key, pos.x, pos.y);
      }
    }
  },

  trackClick(gx, gy, key) {
    if (G.currentTrackNodes.length === 0) {
      G.currentTrackNodes.push({ x: gx, y: gy });
      G.previewEndX = gx;
      G.previewEndY = gy;
      return;
    }

    const last = G.currentTrackNodes[G.currentTrackNodes.length - 1];
    if (last.x === gx && last.y === gy) return;

    const lastKey = Graph.key(last.x, last.y);

    if (Graph.hasEdge(lastKey, key)) return;

    G.trackFragments--;
    if (G.trackFragments < 0) {
      G.trackFragments = 0;
      Ui.flashMessage('轨道碎片不足！');
      return;
    }

    Graph.addEdge(lastKey, key);
    G.currentTrackNodes.push({ x: gx, y: gy });
    G.previewEndX = gx;
    G.previewEndY = gy;
  },

  platformClick(gx, gy) {
    if (G.platformComponents <= 0) {
      Ui.flashMessage('站台组件不足！');
      return;
    }
    if (Station.addPlatform(gx, gy)) {
      G.platformComponents--;
    }
  },

  eraseClick(gx, gy, key, screenX, screenY) {
    let changed = false;

    if (G.platformMap[key]) {
      Station.removePlatform(gx, gy);
      G.platformComponents++;
      changed = true;
    }

    if (G.connectionMap[key]) {
      const neighbors = [...Graph.getNeighbors(key)];
      for (const nk of neighbors) {
        Graph.removeEdge(key, nk);
        G.trackFragments++;
        changed = true;
      }
    }

    const clickedEdge = Renderer.edgeAtScreen(screenX, screenY);
    if (!changed && clickedEdge) {
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

    if (G.selectedTool === 'track' && G.currentTrackNodes.length > 0) {
      const last = G.currentTrackNodes[G.currentTrackNodes.length - 1];
      G.previewEndX = clamped.x;
      G.previewEndY = clamped.y;
    }
  },

  onMouseUp(e) {
    if (e.button === 1 || e.button === 2) {
      G.isPanning = false;
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

  onKeyDown(e) {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (G.phase === 'operate') {
        G.paused = !G.paused;
        Ui.updatePauseButton();
      }
      return;
    }

    if (e.key === '1') { this.switchTool('track'); }
    if (e.key === '2') { this.switchTool('platform'); }
    if (e.key === '3') { this.switchTool('eraser'); }

    if (e.key === 'Escape') {
      G.currentTrackNodes = [];
      G.previewEndX = -1;
      G.previewEndY = -1;
      G.selectedItem = null;
    }

    if (e.key === 'Delete' && G.phase === 'build') {
      const rect = this.canvas.getBoundingClientRect();
      const edge = Renderer.edgeAtScreen(
        G.mouseGridX < 0 ? 0 : G.mouseGridX * G.CELL_SIZE * G.zoom + G.offsetX,
        G.mouseGridY < 0 ? 0 : G.mouseGridY * G.CELL_SIZE * G.zoom + G.offsetY
      );
      if (!edge) return;
      G.trackFragments++;
      Graph.removeEdge(edge.k1, edge.k2);
    }
  },

  switchTool(tool) {
    G.selectedTool = tool;
    Ui.updateToolButtons();
    G.currentTrackNodes = [];
    G.previewEndX = -1;
    G.previewEndY = -1;
  },

  operateClick(grid) {
    const clamped = clampGrid(grid.x, grid.y);
    const key = Graph.key(clamped.x, clamped.y);

    if (G.activeSwitches[key] !== undefined) {
      Graph.cycleSwitch(key);
      return;
    }

    // Check if there's a train at this position (stop/resume)
    const pos = { x: clamped.x * G.CELL_SIZE + G.CELL_SIZE / 2, y: clamped.y * G.CELL_SIZE + G.CELL_SIZE / 2 };
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
      const dist = Math.hypot(pos.x - px, pos.y - py);
      if (dist < G.CELL_SIZE) {
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
};
