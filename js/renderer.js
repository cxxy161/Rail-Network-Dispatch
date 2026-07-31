const Renderer = {
  canvas: null,
  ctx: null,
  depotImg: null,
  _congestionWarn: {},

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._loadDepotImg();
  },

  _loadDepotImg() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 76" width="100" height="76">' +
      '<rect x="2" y="3" width="96" height="72" rx="4" fill="#C8C0B4" opacity="0.7"/>' +
      '<rect x="0" y="0" width="96" height="72" rx="4" fill="#4A4A45"/>' +
      '<polygon points="0,0 96,0 96,18 0,18" fill="#555550"/>' +
      '<polygon points="0,0 96,0 90,18 6,18" fill="#40403C"/>' +
      '<line x1="6" y1="18" x2="90" y2="18" stroke="#333330" stroke-width="1.5"/>' +
      '<rect x="6" y="50" width="14" height="18" rx="2" fill="#E8734A"/>' +
      '<rect x="23" y="50" width="14" height="18" rx="2" fill="#E8734A"/>' +
      '<rect x="40" y="50" width="14" height="18" rx="2" fill="#E8734A"/>' +
      '<rect x="57" y="50" width="14" height="18" rx="2" fill="#E8734A"/>' +
      '<rect x="74" y="50" width="14" height="18" rx="2" fill="#E8734A"/>' +
      '</svg>';
    this.depotImg = new Image();
    this.depotImg.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
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

    this.drawTerrain(ctx);
    this.drawGrid(ctx);
    this.drawStationGroups(ctx);
    this.drawStationAreas(ctx);
    this.drawTracks(ctx);
    this.drawSwitchConnections(ctx);
    this.drawPlatforms(ctx);
    this.drawPreview(ctx);
    this.drawSwitches(ctx);
    this.drawTrains(ctx);
    this.drawDepot(ctx);
    this.drawPassengerNumbers(ctx);
    this.drawCursorHighlight(ctx);

    ctx.restore();
  },

  drawTerrain(ctx) {
    if (!G.terrain) return;
    const cs = G.CELL_SIZE;
    const invZ = 1 / G.zoom;
    const visLeft = (-G.offsetX) * invZ - cs;
    const visTop = (-G.offsetY) * invZ - cs;
    const visRight = (this.canvas.width - G.offsetX) * invZ + cs;
    const visBottom = (this.canvas.height - G.offsetY) * invZ + cs;

    const startX = Math.max(0, Math.floor(visLeft / cs));
    const startY = Math.max(0, Math.floor(visTop / cs));
    const endX = Math.min(G.GRID_W - 1, Math.ceil(visRight / cs));
    const endY = Math.min(G.GRID_H - 1, Math.ceil(visBottom / cs));

    for (let gy = startY; gy <= endY; gy++) {
      for (let gx = startX; gx <= endX; gx++) {
        const t = G.terrain[gy * G.GRID_W + gx];
        if (t === TERRAIN.RIVER) {
          ctx.fillStyle = '#8CB8D8';
          ctx.globalAlpha = 0.60;
          ctx.fillRect(gx * cs, gy * cs, cs, cs);
          ctx.globalAlpha = 1;
        } else if (t === TERRAIN.MOUNTAIN) {
          ctx.fillStyle = '#7DA050';
          ctx.globalAlpha = 0.65;
          ctx.fillRect(gx * cs, gy * cs, cs, cs);

          const cx = gx * cs + cs / 2;
          const cy = gy * cs + cs / 2;
          const hs = cs * 0.28;
          ctx.fillStyle = '#5C7838';
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.moveTo(cx, cy - hs);
          ctx.lineTo(cx + hs * 0.9, cy + hs * 0.55);
          ctx.lineTo(cx - hs * 0.9, cy + hs * 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
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
    const cs = G.CELL_SIZE;

    for (const [sid, grp] of Object.entries(groups)) {
      if (grp.platforms.length === 0) continue;
      const color = grp.color;

      const grid = {};
      for (const p of grp.platforms) grid[p.x + ',' + p.y] = p;

      const visited = new Set();

      for (const plat of grp.platforms) {
        const key = plat.x + ',' + plat.y;
        if (visited.has(key)) continue;

        const comp = [];
        const q = [plat];
        visited.add(key);
        while (q.length) {
          const p = q.shift();
          comp.push(p);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nk = (p.x + dx) + ',' + (p.y + dy);
            if (visited.has(nk)) continue;
            if (grid[nk]) { visited.add(nk); q.push(grid[nk]); }
          }
        }

        const xs = comp.map(p => p.x);
        const ys = comp.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const dir = comp[0].dir;
        const sameDir = comp.every(p => p.dir === dir) && comp.length > 1;

        if (dir === 'h' && sameDir && comp.every(p => p.y === minY)) {
          const x = minX * cs + cs * 0.03;
          const y = minY * cs + cs * 0.30;
          const w = (maxX - minX + 1) * cs * 0.94;
          const h = cs * 0.40;
          this._drawPlatBlock(ctx, x, y, w, h, color, 'h');
        } else if (dir === 'v' && sameDir && comp.every(p => p.x === minX)) {
          const x = minX * cs + cs * 0.30;
          const y = minY * cs + cs * 0.03;
          const w = cs * 0.40;
          const h = (maxY - minY + 1) * cs * 0.94;
          this._drawPlatBlock(ctx, x, y, w, h, color, 'v');
        } else {
          for (const p of comp) {
            if (p.dir === 'h') {
              const x = p.x * cs + cs * 0.03;
              const y = p.y * cs + cs * 0.30;
              this._drawPlatBlock(ctx, x, y, cs * 0.94, cs * 0.40, color, 'h');
            } else {
              const x = p.x * cs + cs * 0.30;
              const y = p.y * cs + cs * 0.03;
              this._drawPlatBlock(ctx, x, y, cs * 0.40, cs * 0.94, color, 'v');
            }
          }
        }
      }
    }
  },

  _drawPlatBlock(ctx, x, y, w, h, color, orientation) {
    ctx.fillStyle = '#A8A090';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();

    ctx.strokeStyle = '#787068';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.stroke();

    ctx.strokeStyle = '#E8C820';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (orientation === 'h') {
      ctx.moveTo(x + 4, y + 3);
      ctx.lineTo(x + w - 4, y + 3);
      ctx.moveTo(x + 4, y + h - 3);
      ctx.lineTo(x + w - 4, y + h - 3);
    } else {
      ctx.moveTo(x + 3, y + 4);
      ctx.lineTo(x + 3, y + h - 4);
      ctx.moveTo(x + w - 3, y + 4);
      ctx.lineTo(x + w - 3, y + h - 4);
    }
    ctx.stroke();
  },

  drawTracks(ctx) {
    Graph.ensureCaches();
    const edges = G._edgeRenderCache;
    if (!edges || edges.length === 0) return;

    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const cs = G.CELL_SIZE;

    ctx.beginPath();
    for (const e of edges) {
      let ax = e.x1 * cs + cs / 2, ay = e.y1 * cs + cs / 2;
      let bx = e.x2 * cs + cs / 2, by = e.y2 * cs + cs / 2;

      if (e.hasS1) {
        const gap = cs * 0.33;
        const d = Math.hypot(bx - ax, by - ay);
        if (d > 0.001) { ax += (bx - ax) / d * gap; ay += (by - ay) / d * gap; }
      }
      if (e.hasS2) {
        const gap = cs * 0.33;
        const d = Math.hypot(ax - bx, ay - by);
        if (d > 0.001) { bx += (ax - bx) / d * gap; by += (ay - by) / d * gap; }
      }

      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();

    if (G.selectedItem && G.selectedItem.type === 'edge') {
      const [x1, y1] = G.selectedItem.k1.split(',').map(Number);
      const [x2, y2] = G.selectedItem.k2.split(',').map(Number);
      ctx.strokeStyle = '#E8734A';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x1 * cs + cs / 2, y1 * cs + cs / 2);
      ctx.lineTo(x2 * cs + cs / 2, y2 * cs + cs / 2);
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

    const sx = G.trackDrag.startX, sy = G.trackDrag.startY;
    const ex = G.mouseGridX, ey = G.mouseGridY;
    if (sx < 0 || sy < 0) return;
    if (sx === ex && sy === ey) return;

    const dx = ex - sx, dy = ey - sy;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const diag = Math.min(adx, ady);
    const straight = Math.max(adx, ady) - diag;
    const sdx = Math.sign(dx), sdy = Math.sign(dy);
    const cs = G.CELL_SIZE;

    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx * cs + cs / 2, sy * cs + cs / 2);

    let cx = sx, cy = sy;
    for (let i = 0; i < diag; i++) {
      cx += sdx; cy += sdy;
      ctx.lineTo(cx * cs + cs / 2, cy * cs + cs / 2);
    }
    let ddx = 0, ddy = 0;
    if (adx > ady) ddx = sdx;
    else if (ady > adx) ddy = sdy;
    for (let i = 0; i < straight; i++) {
      cx += ddx; cy += ddy;
      ctx.lineTo(cx * cs + cs / 2, cy * cs + cs / 2);
    }
    ctx.stroke();
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
    const cs = G.CELL_SIZE;
    for (const key of Object.keys(G.activeSwitches)) {
      const [x, y] = key.split(',').map(Number);
      const cx = x * cs + cs / 2;
      const cy = y * cs + cs / 2;

      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawSwitchConnections(ctx) {
    Graph.ensureCaches();
    const cs = G.CELL_SIZE;
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for (const key of Object.keys(G.activeSwitches)) {
      const [sx, sy] = key.split(',').map(Number);
      const cx = sx * cs + cs / 2;
      const cy = sy * cs + cs / 2;
      const dir = Graph.getSwitchExitDirection(key);
      const len = cs * 0.36;

      const meta = G._switchMeta[key];
      if (!meta) continue;
      const neighbors = Graph.getNeighbors(key);

      for (const nk of neighbors) {
        const [nx, ny] = nk.split(',').map(Number);
        const ndx = nx - sx, ndy = ny - sy;
        const isFixed = meta.fixedSet.has(nk);
        const isSelected = dir && ndx === dir.x && ndy === dir.y;

        if (isFixed || isSelected) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + ndx * len, cy + ndy * len);
          ctx.stroke();
        }
      }
    }
  },

  drawStationAreas(ctx) {
    for (const st of G.stations) {
      const cs = G.CELL_SIZE;
      const x0 = (st.x - 3) * cs;
      const y0 = (st.y - 3) * cs;
      const size = 6 * cs;

      ctx.fillStyle = st.color + '18';
      ctx.fillRect(x0, y0, size, size);

      ctx.strokeStyle = st.color + '50';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x0 + 1, y0 + 1, size - 2, size - 2);
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
    const size = cs * 2;
    ctx.drawImage(this.depotImg, x0 + cs * 0.04, y0 + cs * 0.06, size * 0.92, size * 0.88);
  },

  drawTrains(ctx) {
    for (const train of G.activeTrains) {
      if (!train.fromKey) continue;

      const carW = G.CELL_SIZE * 0.92;
      const carH = G.CELL_SIZE * 0.45;
      const gap = 4;

      let trail = train.trail || [];
      if (trail.length < 2) {
        trail = this._waitingTrail(train);
      }

      const isDocked = train.state === 'docked';
      const load = Object.values(train.passengers).reduce((a, b) => a + b, 0);
      const max = Train.maxLoad(train);

      // Departure clip: hide the portion of a long train still "inside" the depot,
      // so the back cars don't stick out past the depot onto the map.
      let departClip = null;
      const depotKey = Graph.key(G.depotX, G.depotY);
      if (train.fromKey === depotKey) {
        const exitKey = train.toKey || train.nextDesiredKey;
        if (exitKey) {
          const [ex, ey] = exitKey.split(',').map(Number);
          const cs2 = G.CELL_SIZE;
          const maxX = G.GRID_W * cs2;
          const maxY = G.GRID_H * cs2;
          if (ex > G.depotX) {
            departClip = { x: (G.depotX - 1) * cs2, y: 0, w: maxX - (G.depotX - 1) * cs2, h: maxY };
          } else if (ex < G.depotX) {
            departClip = { x: 0, y: 0, w: (G.depotX + 1) * cs2, h: maxY };
          } else if (ey > G.depotY) {
            departClip = { x: 0, y: (G.depotY - 1) * cs2, w: maxX, h: maxY - (G.depotY - 1) * cs2 };
          } else if (ey < G.depotY) {
            departClip = { x: 0, y: 0, w: maxX, h: (G.depotY + 1) * cs2 };
          }
        }
      }
      if (departClip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(departClip.x, departClip.y, departClip.w, departClip.h);
        ctx.clip();
      }

      for (let c = 0; c < train.carCount; c++) {
        const carIndex = train.reversed ? train.carCount - 1 - c : c;
        const targetDist = carIndex * (carW + gap);
        const pos = this.trailPosAt(trail, targetDist);
        if (!pos) break;

        const isHead = c === 0;
        const isTail = c === train.carCount - 1;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(pos.angle);

        // Car body: single path, fill + stroke
        ctx.beginPath();
        this.roundRect(ctx, -carW / 2, -carH / 2, carW, carH, 4);
        ctx.fillStyle = '#E8734A';
        ctx.fill();
        ctx.strokeStyle = '#C85A35';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head car: front windshield + headlight
        if (isHead) {
          const facing = train.reversed ? -1 : 1;
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          this.roundRect(ctx, facing * carW * 0.5 - facing * carW * 0.16, -carH * 0.32, carW * 0.16, carH * 0.64, 2);
          ctx.fill();
          ctx.fillStyle = '#FFF8E0';
          ctx.beginPath();
          ctx.arc(facing * carW * 0.5, 0, carH * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tail car: red taillight
        if (isTail) {
          const facing = train.reversed ? -1 : 1;
          ctx.fillStyle = '#E84A4A';
          ctx.beginPath();
          ctx.arc(-facing * carW * 0.5, 0, carH * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Docked glow: soft station-color ring
        if (isDocked) {
          const plat = Station.platformAtKey(train.fromKey);
          const st = plat ? Station.getStationById(plat.stationId) : null;
          const glowColor = st ? st.color : '#E8734A';
          ctx.strokeStyle = glowColor;
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 250);
          ctx.lineWidth = 3;
          ctx.beginPath();
          this.roundRect(ctx, -carW / 2 - 3, -carH / 2 - 3, carW + 6, carH + 6, 6);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      // Passenger count bubble above the lead car
      if (trail.length > 0) {
        const lead = trail[0];
        const bx = lead.x;
        const by = lead.y - carH * 0.85;

        const txt = load + '/' + max;
        ctx.font = `bold ${G.CELL_SIZE * 0.22}px sans-serif`;
        const tw = ctx.measureText(txt).width;

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#C8C0B0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx - tw / 2 - 6, by - G.CELL_SIZE * 0.2, tw + 12, G.CELL_SIZE * 0.4, G.CELL_SIZE * 0.2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = load >= max ? '#E84A4A' : '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, bx, by + 1);
      }

      if (departClip) ctx.restore();
    }
  },

  _waitingTrail(train) {
    const [fx, fy] = train.fromKey.split(',').map(Number);
    const cs = G.CELL_SIZE;
    const hx = fx * cs + cs / 2;
    const hy = fy * cs + cs / 2;
    let angle = 0;
    const dirKey = train.nextDesiredKey || train.toKey;
    if (dirKey) {
      const [nx, ny] = dirKey.split(',').map(Number);
      angle = Math.atan2(ny - fy, nx - fx);
    }
    const head = { x: hx, y: hy, angle: angle };
    const carLen = cs * 0.92 + 4;
    const tail = {
      x: hx - Math.cos(angle) * carLen * train.carCount,
      y: hy - Math.sin(angle) * carLen * train.carCount,
      angle: angle,
    };
    return [head, tail];
  },

  trailPosAt(trail, targetDist) {
    if (trail.length < 2) return trail[0] || null;
    const biasedDist = targetDist + 3;
    let accum = 0;
    for (let i = 1; i < trail.length; i++) {
      const seg = Math.hypot(trail[i - 1].x - trail[i].x, trail[i - 1].y - trail[i].y);
      if (seg < 0.01) continue;
      accum += seg;
      if (accum >= biasedDist) {
        const overshoot = accum - biasedDist;
        const t = Math.max(0, Math.min(1, seg > 0 ? 1 - overshoot / seg : 0));
        let da = trail[i].angle - trail[i - 1].angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        return {
          x: trail[i - 1].x + (trail[i].x - trail[i - 1].x) * t,
          y: trail[i - 1].y + (trail[i].y - trail[i - 1].y) * t,
          angle: trail[i - 1].angle + da * t,
        };
      }
    }
    const last = trail[trail.length - 1];
    const remaining = biasedDist - accum;
    const la = last.angle;
    return {
      x: last.x - Math.cos(la) * remaining,
      y: last.y - Math.sin(la) * remaining,
      angle: la,
    };
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
      const dests = G.stationQueues[sid] || {};
      const total = Object.values(dests).reduce((a, b) => a + b, 0);
      if (total <= 0) continue;

      const cx = (grp.bounds.minX + grp.bounds.maxX + 1) * G.CELL_SIZE / 2;
      const cy = grp.bounds.minY * G.CELL_SIZE + G.CELL_SIZE / 2 - 10;
      const platformCells = Math.max(1, G.platforms.filter(p => p.stationId === sid).length);
      const avg = total / platformCells;

      const blink = avg >= 100 && Math.floor(Date.now() / 500) % 2 === 1;
      if (blink) continue;

      const color = avg >= 50 ? '#E84A4A' : avg >= 40 ? '#D09000' : '#333';

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, G.CELL_SIZE * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = `bold ${G.CELL_SIZE * 0.32}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total + '', cx, cy + 1);

      if (avg >= 100) {
        ctx.fillStyle = color;
        ctx.font = `bold ${G.CELL_SIZE * 0.18}px sans-serif`;
        ctx.fillText('⚠', cx, cy - G.CELL_SIZE * 0.3);
      }

      if (avg >= 100) {
        if (!this._congestionWarn[sid]) {
          this._congestionWarn[sid] = true;
          AudioMgr.play('congestion_warning');
        }
      } else if (this._congestionWarn[sid]) {
        delete this._congestionWarn[sid];
      }
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
