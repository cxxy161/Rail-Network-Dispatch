const Renderer = {
  canvas: null,
  ctx: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },

  resize() {
    const topBar = document.getElementById('top-bar');
    const bottomBar = document.getElementById('bottom-bar');
    const w = document.body.clientWidth;
    const h = document.body.clientHeight - topBar.offsetHeight - bottomBar.offsetHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (G.offsetX === 0 && G.offsetY === 0) {
      this.centerCamera();
    }
  },

  centerCamera() {
    const worldCX = G.CELL_SIZE * G.GRID_W / 2;
    const worldCY = G.CELL_SIZE * G.GRID_H / 2;
    G.offsetX = this.canvas.width / 2 - worldCX * G.zoom;
    G.offsetY = this.canvas.height / 2 - worldCY * G.zoom;
  },

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, w, h);

    ctx.translate(G.offsetX, G.offsetY);
    ctx.scale(G.zoom, G.zoom);

    this.drawGrid(ctx);
    this.drawTracks(ctx);
    this.drawPreview(ctx);
    this.drawSwitches(ctx);
    this.drawStationAreas(ctx);
    this.drawPlatforms(ctx);
    this.drawDepot(ctx);
    this.drawTrains(ctx);
    this.drawPassengerNumbers(ctx);
    this.drawCursorHighlight(ctx);

    ctx.restore();
  },

  drawGrid(ctx) {
    ctx.strokeStyle = '#E0DCD4';
    ctx.lineWidth = 0.3;
    const cs = G.CELL_SIZE;
    const invZ = 1 / G.zoom;

    const visLeft = (-G.offsetX) * invZ - cs;
    const visRight = (this.canvas.width - G.offsetX) * invZ + cs;
    const visTop = (-G.offsetY) * invZ - cs;
    const visBottom = (this.canvas.height - G.offsetY) * invZ + cs;

    const startX = Math.max(0, Math.floor(visLeft / cs) * cs);
    const startY = Math.max(0, Math.floor(visTop / cs) * cs);
    const endX = Math.min(G.GRID_W * cs, Math.ceil(visRight / cs) * cs);
    const endY = Math.min(G.GRID_H * cs, Math.ceil(visBottom / cs) * cs);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += cs) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += cs) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  },

  drawTracks(ctx) {
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const drawn = new Set();
    for (const [key, neighbors] of Object.entries(G.connectionMap)) {
      const [x1, y1] = key.split(',').map(Number);
      for (const nKey of neighbors) {
        const pairKey = key < nKey ? key + '|' + nKey : nKey + '|' + key;
        if (drawn.has(pairKey)) continue;
        drawn.add(pairKey);
        const [x2, y2] = nKey.split(',').map(Number);
        ctx.moveTo(x1 * G.CELL_SIZE + G.CELL_SIZE / 2, y1 * G.CELL_SIZE + G.CELL_SIZE / 2);
        ctx.lineTo(x2 * G.CELL_SIZE + G.CELL_SIZE / 2, y2 * G.CELL_SIZE + G.CELL_SIZE / 2);
      }
    }
    ctx.stroke();

    if (G.selectedItem && G.selectedItem.type === 'edge') {
      const [x1, y1] = G.selectedItem.k1.split(',').map(Number);
      const [x2, y2] = G.selectedItem.k2.split(',').map(Number);
      ctx.strokeStyle = '#E8734A';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x1 * G.CELL_SIZE + G.CELL_SIZE / 2, y1 * G.CELL_SIZE + G.CELL_SIZE / 2);
      ctx.lineTo(x2 * G.CELL_SIZE + G.CELL_SIZE / 2, y2 * G.CELL_SIZE + G.CELL_SIZE / 2);
      ctx.stroke();
    }
  },

  drawPreview(ctx) {
    if (G.selectedTool !== 'track') return;
    if (G.currentTrackNodes.length === 0) return;
    const last = G.currentTrackNodes[G.currentTrackNodes.length - 1];
    const endX = G.previewEndX >= 0 ? G.previewEndX : G.mouseGridX;
    const endY = G.previewEndY >= 0 ? G.previewEndY : G.mouseGridY;
    if (endX < 0 || endY < 0) return;

    ctx.strokeStyle = '#E8734A';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(last.x * G.CELL_SIZE + G.CELL_SIZE / 2, last.y * G.CELL_SIZE + G.CELL_SIZE / 2);
    ctx.lineTo(endX * G.CELL_SIZE + G.CELL_SIZE / 2, endY * G.CELL_SIZE + G.CELL_SIZE / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  drawSwitches(ctx) {
    for (const key of Object.keys(G.activeSwitches)) {
      const [x, y] = key.split(',').map(Number);
      const cx = x * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = y * G.CELL_SIZE + G.CELL_SIZE / 2;
      ctx.fillStyle = '#4A90D9';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawStationAreas(ctx) {
    for (const st of G.stations) {
      const cx = st.x * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = st.y * G.CELL_SIZE + G.CELL_SIZE / 2;
      ctx.fillStyle = st.color + '20';
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = st.color + '80';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  drawPlatforms(ctx) {
    for (const [key, stationId] of Object.entries(G.platformMap)) {
      const [x, y] = key.split(',').map(Number);
      const station = Station.getStationById(stationId);
      if (!station) continue;
      const cx = x * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = y * G.CELL_SIZE + G.CELL_SIZE / 2;

      ctx.fillStyle = station.color + '60';
      ctx.fillRect(cx - G.CELL_SIZE * 0.4, cy - G.CELL_SIZE * 0.4, G.CELL_SIZE * 0.8, G.CELL_SIZE * 0.8);

      ctx.strokeStyle = station.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - G.CELL_SIZE * 0.4, cy - G.CELL_SIZE * 0.4, G.CELL_SIZE * 0.8, G.CELL_SIZE * 0.8);
    }
  },

  drawDepot(ctx) {
    const cx = G.depotX * G.CELL_SIZE + G.CELL_SIZE / 2;
    const cy = G.depotY * G.CELL_SIZE + G.CELL_SIZE / 2;
    const half = G.CELL_SIZE * 1.2;

    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);

    ctx.strokeStyle = '#6D3DD6';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);

    ctx.fillStyle = '#FFF';
    ctx.font = `${G.CELL_SIZE * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('段', cx, cy);
  },

  drawTrains(ctx) {
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

      const angle = Math.atan2(wy2 - wy1, wx2 - wx1);
      const length = train.carCount * G.CELL_SIZE * 0.8;
      const width = G.CELL_SIZE * 0.5;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);

      ctx.fillStyle = '#E8734A';
      ctx.beginPath();
      this.roundRect(ctx, -length / 2, -width / 2, length, width, 6);
      ctx.fill();

      ctx.strokeStyle = '#D06040';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.roundRect(ctx, -length / 2, -width / 2, length, width, 6);
      ctx.stroke();

      if (train.state === 'docked') {
        ctx.fillStyle = '#FFF';
        ctx.font = `${G.CELL_SIZE * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let c = 0; c < train.carCount; c++) {
          const carCX = -length / 2 + length * (c + 0.5) / train.carCount;
          const load = Object.values(train.passengers).reduce((a, b) => a + b, 0);
          ctx.fillText(Math.min(load, train.carCount * 20).toString(), carCX, 0);
        }
      }

      ctx.restore();
    }
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  drawPassengerNumbers(ctx) {
    for (const [key, dests] of Object.entries(G.stationQueues)) {
      const total = Object.values(dests).reduce((a, b) => a + b, 0);
      if (total <= 0) continue;
      const [x, y] = key.split(',').map(Number);
      const cx = x * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = y * G.CELL_SIZE + G.CELL_SIZE / 2;

      ctx.fillStyle = '#333';
      ctx.font = `bold ${G.CELL_SIZE * 0.4}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total.toString(), cx, cy + G.CELL_SIZE * 0.6);
    }
  },

  drawCursorHighlight(ctx) {
    const gx = G.mouseGridX;
    const gy = G.mouseGridY;
    if (gx < 0 || gy < 0) return;
    const cx = gx * G.CELL_SIZE + G.CELL_SIZE / 2;
    const cy = gy * G.CELL_SIZE + G.CELL_SIZE / 2;

    if (G.selectedTool === 'eraser') {
      ctx.strokeStyle = '#E84A4A';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx - G.CELL_SIZE * 0.5, cy - G.CELL_SIZE * 0.5, G.CELL_SIZE, G.CELL_SIZE);
      ctx.setLineDash([]);
    } else if (G.selectedTool === 'platform') {
      const station = Station.findStationForGrid(gx, gy);
      if (station && G.connectionMap[Graph.key(gx, gy)]) {
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - G.CELL_SIZE * 0.5, cy - G.CELL_SIZE * 0.5, G.CELL_SIZE, G.CELL_SIZE);
      }
    }

    if (G.currentTrackNodes.length > 0) {
      for (const node of G.currentTrackNodes) {
        ctx.fillStyle = '#E8734A';
        ctx.beginPath();
        ctx.arc(node.x * G.CELL_SIZE + G.CELL_SIZE / 2, node.y * G.CELL_SIZE + G.CELL_SIZE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  nodeAtScreen(sx, sy) {
    const grid = screenToGrid(sx, sy);
    const key = Graph.key(grid.x, grid.y);
    return { x: grid.x, y: grid.y, key };
  },

  switchAtScreen(sx, sy) {
    const grid = screenToGrid(sx, sy);
    const key = Graph.key(grid.x, grid.y);
    if (G.activeSwitches[key] !== undefined) {
      return { x: grid.x, y: grid.y, key };
    }
    return null;
  },

  edgeAtScreen(sx, sy) {
    const world = screenToWorld(sx, sy);
    const wx = world.x, wy = world.y;
    const threshold = 12 / G.zoom;

    const drawn = new Set();
    for (const [key, neighbors] of Object.entries(G.connectionMap)) {
      const [x1, y1] = key.split(',').map(Number);
      for (const nKey of neighbors) {
        const pairKey = key < nKey ? key + '|' + nKey : nKey + '|' + key;
        if (drawn.has(pairKey)) continue;
        drawn.add(pairKey);
        const [x2, y2] = nKey.split(',').map(Number);
        const ax = x1 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const ay = y1 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const bx = x2 * G.CELL_SIZE + G.CELL_SIZE / 2;
        const by = y2 * G.CELL_SIZE + G.CELL_SIZE / 2;
        if (pointToSegDist(wx, wy, ax, ay, bx, by) < threshold) {
          return { k1: key, k2: nKey, x1, y1, x2, y2 };
        }
      }
    }
    return null;
  },
};

function pointToSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
