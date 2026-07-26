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
    const sidebar = document.getElementById('sidebar');
    const sbW = sidebar.classList.contains('hidden') ? 0 : sidebar.offsetWidth;
    const w = document.body.clientWidth - sbW;
    const h = document.body.clientHeight - topBar.offsetHeight - bottomBar.offsetHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.style.left = sbW + 'px';
    if (G.offsetX === 0) {
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
    this.drawStationGroups(ctx);
    this.drawStationAreas(ctx);
    this.drawTracks(ctx);
    this.drawPlatforms(ctx);
    this.drawPreview(ctx);
    this.drawSwitches(ctx);
    this.drawDepot(ctx);
    this.drawTrains(ctx);
    this.drawPassengerNumbers(ctx);
    this.drawCursorHighlight(ctx);

    ctx.restore();
    this.drawPopup(ctx);
  },

  drawGrid(ctx) {
      ctx.strokeStyle = '#B8A898';
      ctx.lineWidth = 0.7;
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

  drawStationGroups(ctx) {
    const groups = Station.getStationGroups();
    for (const [sid, grp] of Object.entries(groups)) {
      if (grp.platforms.length === 0) continue;
      const b = grp.bounds;
      const cs = G.CELL_SIZE;

      ctx.beginPath();
      for (const plat of grp.platforms) {
        const x = plat.x * cs + cs * 0.03;
        const y = plat.y * cs + cs * 0.03;
        ctx.rect(x, y, cs * 0.94, cs * 0.94);
      }
      ctx.fillStyle = '#C8BFA8';
      ctx.fill();

      ctx.strokeStyle = grp.color + '40';
      ctx.lineWidth = 1;
      for (const plat of grp.platforms) {
        const cx = plat.x * cs + cs / 2;
        const cy = plat.y * cs + cs / 2;
        const hw = cs * 0.38;
        const hh = cs * 0.38;
        if (plat.dir === 'h') {
          ctx.beginPath();
          ctx.moveTo(cx - hw, cy - cs * 0.1);
          ctx.lineTo(cx + hw, cy - cs * 0.1);
          ctx.moveTo(cx - hw, cy + cs * 0.1);
          ctx.lineTo(cx + hw, cy + cs * 0.1);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx - cs * 0.1, cy - hh);
          ctx.lineTo(cx - cs * 0.1, cy + hh);
          ctx.moveTo(cx + cs * 0.1, cy - hh);
          ctx.lineTo(cx + cs * 0.1, cy + hh);
          ctx.stroke();
        }
      }

      const pad = 5;
      const x0 = b.minX * cs + cs * 0.03 - pad;
      const y0 = b.minY * cs + cs * 0.03 - pad;
      const w0 = (b.maxX - b.minX + 1) * cs * 0.94 + pad * 2;
      const h0 = (b.maxY - b.minY + 1) * cs * 0.94 + pad * 2;

      ctx.strokeStyle = grp.color + '88';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, y0, w0, h0);
    }
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
    this.drawTrackPreview(ctx);
    this.drawPlatformPreview(ctx);
  },

  drawTrackPreview(ctx) {
    if (G.selectedTool !== 'track') return;
    if (!G.trackDrag.active) return;
    if (G.mouseGridX < 0 || G.mouseGridY < 0) return;

    const gx = G.mouseGridX, gy = G.mouseGridY;
    const lastGX = G.trackDrag.lastGX, lastGY = G.trackDrag.lastGY;
    if (lastGX < 0 || lastGY < 0) return;
    if (gx === lastGX && gy === lastGY) return;

    ctx.strokeStyle = '#E8734A88';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(lastGX * G.CELL_SIZE + G.CELL_SIZE / 2, lastGY * G.CELL_SIZE + G.CELL_SIZE / 2);
    ctx.lineTo(gx * G.CELL_SIZE + G.CELL_SIZE / 2, gy * G.CELL_SIZE + G.CELL_SIZE / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  drawPlatformPreview(ctx) {
    if (G.selectedTool !== 'platform') return;
    if (!G.platDrag.active) return;
    if (G.mouseGridX < 0 || G.mouseGridY < 0) return;

    const gx = G.mouseGridX, gy = G.mouseGridY;
    const dir = G.platDrag.dir || 'h';
    const cx = gx * G.CELL_SIZE + G.CELL_SIZE / 2;
    const cy = gy * G.CELL_SIZE + G.CELL_SIZE / 2;

    const station = Station.findStationForGrid(gx, gy);
    const hasPlat = !!Station.getPlatformAt(gx, gy);

    if (!station || hasPlat || G.platformComponents <= 0) {
      ctx.fillStyle = 'rgba(232,74,74,0.4)';
      ctx.strokeStyle = '#E84A4A';
    } else {
      ctx.fillStyle = station.color + '40';
      ctx.strokeStyle = station.color;
    }

    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    const hw = dir === 'h' ? G.CELL_SIZE * 0.35 : G.CELL_SIZE * 0.15;
    const hh = dir === 'h' ? G.CELL_SIZE * 0.15 : G.CELL_SIZE * 0.35;
    ctx.beginPath();
    ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, 4);
    ctx.fill();
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
      ctx.fillStyle = st.color + '15';
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = st.color + '60';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  drawPlatforms(ctx) {
    for (const plat of G.platforms) {
      if (Station.hasTrackConnection(plat)) continue;
      const cx = plat.x * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = plat.y * G.CELL_SIZE + G.CELL_SIZE / 2;
      ctx.fillStyle = '#E84A4A';
      ctx.font = `bold ${G.CELL_SIZE * 0.22}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('无轨道', cx, cy + G.CELL_SIZE * 0.3);
    }
  },

  drawDepot(ctx) {
    const cs = G.CELL_SIZE;
    const x0 = (G.depotX - 1) * cs, y0 = (G.depotY - 1) * cs;
    const x1 = (G.depotX + 1) * cs, y1 = (G.depotY + 1) * cs;

    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    ctx.strokeStyle = '#6D3DD6';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    const cx = x0 + (x1 - x0) / 2;
    const cy = y0 + (y1 - y0) / 2;
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${cs * 0.4}px sans-serif`;
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
      const length = train.carCount * G.CELL_SIZE * 0.7;
      const width = G.CELL_SIZE * 0.45;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);

      ctx.fillStyle = '#E8734A';
      ctx.beginPath();
      this.roundRect(ctx, -length / 2, -width / 2, length, width, 5);
      ctx.fill();

      ctx.strokeStyle = '#D06040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      this.roundRect(ctx, -length / 2, -width / 2, length, width, 5);
      ctx.stroke();

      const load = Object.values(train.passengers).reduce((a, b) => a + b, 0);
      const max = Train.maxLoad(train);
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${G.CELL_SIZE * 0.24}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(load + '/' + max, 0, 1);

      ctx.restore();
    }
  },

  drawPopup(ctx) {
    if (!G.popup) return;
    const pop = G.popup;

    let px, py;
    if (pop.worldX !== undefined) {
      const s = worldToScreen(pop.worldX, pop.worldY);
      px = s.x; py = s.y;
    } else {
      px = G.mouseGridX * G.CELL_SIZE * G.zoom + G.offsetX + G.CELL_SIZE * G.zoom;
      py = G.mouseGridY * G.CELL_SIZE * G.zoom + G.offsetY;
    }
    py += 24;

    ctx.font = '12px sans-serif';
    const pad = 10;
    const lineH = 18;
    const lines = pop.lines.length;
    const maxW = Math.max(...pop.lines.map(l => ctx.measureText(l).width));
    const w = maxW + pad * 2;
    const h = lines * lineH + pad * 2;

    if (px + w > this.canvas.width) px = this.canvas.width - w - 4;
    if (py + h > this.canvas.height) py = py - h - 40;

    ctx.fillStyle = 'rgba(40,40,40,0.92)';
    ctx.beginPath();
    ctx.roundRect(px, py, w, h, 6);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(pop.lines[i], px + pad, py + pad + lineH * i + lineH / 2);
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
    const groups = Station.getStationGroups();
    for (const [sid, grp] of Object.entries(groups)) {
      if (!grp.bounds) continue;
      const dests = G.stationQueues[sid];
      if (!dests) continue;
      const total = Object.values(dests).reduce((a, b) => a + b, 0);
      if (total <= 0) continue;

      const cx = grp.cx * G.CELL_SIZE + G.CELL_SIZE / 2;
      const cy = grp.cy * G.CELL_SIZE + G.CELL_SIZE / 2;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.font = `bold ${G.CELL_SIZE * 0.35}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total + '', cx, cy + 1);
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
    }
  },

  nodeAtScreen(sx, sy) {
    const grid = screenToGrid(sx, sy);
    return { x: grid.x, y: grid.y, key: Graph.key(grid.x, grid.y) };
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
