const TERRAIN = { PLAIN: 0, RIVER: 1, MOUNTAIN: 2 };
const STATION_COLORS = ['#E84A4A', '#4A90D9', '#50B86C', '#E8A44A', '#A44AE8', '#4AE8C8'];

const Terrain = {
  _hash(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 437.585) * 43758.545;
    return n - Math.floor(n);
  },

  _rand(seed) {
    let s = seed | 0;
    s = (s ^ 61) ^ (s >>> 16);
    s = s + (s << 3);
    s = s ^ (s >>> 4);
    s = s * 0x27d4eb2d;
    s = s ^ (s >>> 15);
    return (s >>> 0) / 4294967296;
  },

  _randBetween(lo, hi, seed) {
    return lo + Math.floor(this._rand(seed) * (hi - lo));
  },

  _createArray() {
    return new Uint8Array(G.GRID_W * G.GRID_H);
  },

  _set(arr, x, y, val) {
    arr[y * G.GRID_W + x] = val;
  },

  _get(arr, x, y) {
    return arr[y * G.GRID_W + x];
  },

  _inBounds(x, y) {
    return x >= 0 && x < G.GRID_W && y >= 0 && y < G.GRID_H;
  },

  _count(arr, val) {
    let c = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === val) c++;
    }
    return c;
  },

  _generateRivers(terrain, targetCells, seed) {
    let remaining = targetCells;
    const maxRivers = this._randBetween(1, 4, seed + 1);
    let seedOffset = seed + 100;

    for (let r = 0; r < maxRivers && remaining > 0; r++) {
      remaining = this._walkRiver(terrain, remaining, seedOffset + r);
    }

    this._dilateRiver(terrain);
  },

  _walkRiver(terrain, remaining, seed) {
    const rng = (n) => this._rand(seed + n * 7919);
    let s = 0;

    const mode = this._randBetween(0, 4, seed);
    let sx, sy, dx, dy;
    if (mode === 0) {
      sx = 0; sy = this._randBetween(2, G.GRID_H - 2, rng(++s));
      dx = 1; dy = 0;
    } else if (mode === 1) {
      sx = G.GRID_W - 1; sy = this._randBetween(2, G.GRID_H - 2, rng(++s));
      dx = -1; dy = 0;
    } else if (mode === 2) {
      sx = this._randBetween(2, G.GRID_W - 2, rng(++s)); sy = 0;
      dx = 0; dy = 1;
    } else {
      sx = this._randBetween(2, G.GRID_W - 2, rng(++s)); sy = G.GRID_H - 1;
      dx = 0; dy = -1;
    }

    let cx = sx, cy = sy;
    let steps = 0;
    const maxSteps = G.GRID_W * G.GRID_H * 3;

    while (remaining > 0 && steps < maxSteps) {
      steps++;
      if (this._inBounds(cx, cy) && this._get(terrain, cx, cy) === TERRAIN.PLAIN) {
        this._set(terrain, cx, cy, TERRAIN.RIVER);
        remaining--;
      }

      if (rng(++s) < 0.08 && remaining > 4) {
        remaining = this._walkBranch(terrain, cx, cy, remaining,
          this._randBetween(6, 15, rng(++s)), rng(++s));
      }

      const choice = rng(++s);
      const dirs = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1],
      ];
      const weights = dirs.map(([ddx, ddy]) => {
        let w = 1;
        if (ddx === dx && ddy === dy) w += 2.0;
        if (ddx === dx) w += 0.5;
        if (ddy === dy) w += 0.5;
        if (ddx === -dx && ddy === -dy) w *= 0.3;
        const nx = cx + ddx, ny = cy + ddy;
        if (this._inBounds(nx, ny) && this._get(terrain, nx, ny) === TERRAIN.RIVER) w *= 0.2;
        if (!this._inBounds(nx, ny)) w = 0;
        return w;
      });

      const totalW = weights.reduce((a, b) => a + b, 0);
      let rnd = rng(++s) * totalW;
      let picked = 0;
      for (let i = 0; i < dirs.length; i++) {
        rnd -= weights[i];
        if (rnd <= 0) { picked = i; break; }
      }

      cx += dirs[picked][0];
      cy += dirs[picked][1];
    }
    return remaining;
  },

  _walkBranch(terrain, ox, oy, remaining, len, seed) {
    const rng = (n) => this._rand(seed + n * 6271);
    let cx = ox, cy = oy;
    let s = 0;
    for (let i = 0; i < len && remaining > 0; i++) {
      const d = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1],
      ][this._randBetween(0, 8, rng(++s)) % 8];
      cx += d[0]; cy += d[1];
      if (this._inBounds(cx, cy) && this._get(terrain, cx, cy) === TERRAIN.PLAIN) {
        this._set(terrain, cx, cy, TERRAIN.RIVER);
        remaining--;
      }
    }
    return remaining;
  },

  _dilateRiver(terrain) {
    const copy = new Uint8Array(terrain);
    for (let y = 0; y < G.GRID_H; y++) {
      for (let x = 0; x < G.GRID_W; x++) {
        if (this._get(copy, x, y) !== TERRAIN.PLAIN) continue;
        let riverNbr = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (this._inBounds(nx, ny) && this._get(copy, nx, ny) === TERRAIN.RIVER) {
            riverNbr++;
          }
        }
        if (riverNbr === 1) {
          this._set(terrain, x, y, TERRAIN.RIVER);
        }
      }
    }
  },

  _generateMountains(terrain, targetCells, seed) {
    let remaining = targetCells;
    const maxSeeds = this._randBetween(3, 7, seed + 200);
    const rng = (n) => this._rand(seed + 300 + n * 4733);

    const seeds = [];
    let s = 0;
    for (let i = 0; i < maxSeeds * 5 && seeds.length < maxSeeds; i++) {
      const sx = this._randBetween(3, G.GRID_W - 3, rng(++s));
      const sy = this._randBetween(3, G.GRID_H - 3, rng(++s));
      if (this._get(terrain, sx, sy) !== TERRAIN.PLAIN) continue;
      if (seeds.some(p => Math.abs(p.x - sx) + Math.abs(p.y - sy) < 16)) continue;
      seeds.push({ x: sx, y: sy });
    }

    if (seeds.length === 0) return;

    function distSq(ax, ay, bx, by) {
      return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
    }

    const queue = seeds.map(p => ({ x: p.x, y: p.y }));
    let qi = 0;
    const visited = new Set();
    for (const p of seeds) visited.add(p.y * G.GRID_W + p.x);

    while (remaining > 0 && qi < queue.length) {
      const { x, y } = queue[qi++];
      if (this._get(terrain, x, y) === TERRAIN.PLAIN) {
        this._set(terrain, x, y, TERRAIN.MOUNTAIN);
        remaining--;
      }

      const neighbors = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (!this._inBounds(nx, ny)) continue;
          const key = ny * G.GRID_W + nx;
          if (visited.has(key)) continue;
          if (this._get(terrain, nx, ny) !== TERRAIN.PLAIN) continue;
          visited.add(key);
          neighbors.push({ x: nx, y: ny });
        }
      }

      for (const nb of neighbors) {
        let minDistSq = Infinity;
        for (const sp of seeds) {
          minDistSq = Math.min(minDistSq, distSq(nb.x, nb.y, sp.x, sp.y));
        }
        const prob = Math.max(0.05, 1 - Math.sqrt(minDistSq) / 20);
        if (rng(++s) < prob) {
          queue.push(nb);
        }
      }
    }
  },

  _placeStations(terrain, seed) {
    const rng = (n) => this._rand(seed + 500 + n * 3571);
    const count = this._randBetween(3, 7, rng(0));
    let s = 1;

    const candidates = [];
    for (let y = 1; y < G.GRID_H - 1; y++) {
      for (let x = 1; x < G.GRID_W - 1; x++) {
        let allPlain = true;
        for (let dy = -1; dy <= 1 && allPlain; dy++) {
          for (let dx = -1; dx <= 1 && allPlain; dx++) {
            if (this._get(terrain, x + dx, y + dy) !== TERRAIN.PLAIN) {
              allPlain = false;
              break;
            }
          }
        }
        if (allPlain) candidates.push({ x, y });
      }
    }

    if (candidates.length < count) {
      const result = [];
      for (let i = 0; i < Math.min(candidates.length, count); i++) {
        const pt = candidates[Math.floor(rng(++s) * candidates.length)];
        result.push(pt);
      }
      return this._makeStationObjects(result, rng, s);
    }

    const placed = [];
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let best = null;
      while (attempts < 50) {
        attempts++;
        const pt = candidates[Math.floor(rng(++s) * candidates.length)];
        if (placed.every(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) >= 16)) {
          best = pt;
          break;
        }
      }
      if (best) placed.push(best);
    }

    return this._makeStationObjects(placed, rng, s);
  },

  _makeStationObjects(points, rng, s) {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const arr = points.map((pt, i) => ({
      id: ids[i] || 'S' + i,
      x: pt.x,
      y: pt.y,
      color: STATION_COLORS[i % STATION_COLORS.length],
      flowLevel: 0,
    }));

    for (let i = 0; i < arr.length; i++) {
      arr[i].flowLevel = this._randBetween(10, 101, rng(++s * 100 + i));
    }

    const minF = Math.min(...arr.map(a => a.flowLevel));
    const maxF = Math.max(...arr.map(a => a.flowLevel));
    if (maxF / minF < 3 && arr.length >= 2) {
      const scaleTo = minF * (3 + rng(++s) * 4);
      const idx = arr.findIndex(a => a.flowLevel === maxF);
      arr[idx].flowLevel = Math.min(100, Math.round(scaleTo));
    }

    return arr;
  },

  _placeDepot(terrain, seed) {
    const rng = (n) => this._rand(seed + 600 + n * 8387);

    for (let attempts = 0; attempts < 30; attempts++) {
      const x = this._randBetween(G.GRID_W - 10, G.GRID_W - 1, rng(attempts));
      const y = this._randBetween(2, G.GRID_H - 3, rng(attempts + 100));

      let allPlain = true;
      for (let dy = -1; dy <= 1 && allPlain; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          if (!this._inBounds(x + dx, y + dy) ||
              this._get(terrain, x + dx, y + dy) !== TERRAIN.PLAIN) {
            allPlain = false;
            break;
          }
        }
      }
      if (allPlain) return { x, y };
    }

    for (let x = G.GRID_W - 2; x >= G.GRID_W - 10; x--) {
      for (let y = 2; y < G.GRID_H - 2; y++) {
        let allPlain = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 0; dx++) {
            if (!this._inBounds(x + dx, y + dy) ||
                this._get(terrain, x + dx, y + dy) !== TERRAIN.PLAIN) {
              allPlain = false;
              break;
            }
          }
        }
        if (allPlain) return { x, y };
      }
    }

    return { x: G.GRID_W - 2, y: Math.floor(G.GRID_H / 2) };
  },

  generateMap(opts) {
    opts = opts || {};
    const mountainRatio = opts.mountainRatio != null ? opts.mountainRatio : 0.2;
    const riverRatio = opts.riverRatio != null ? opts.riverRatio : 0.2;
    const seed = opts.seed || Date.now();

    G.mapSeed = seed;
    const total = G.GRID_W * G.GRID_H;

    G.terrain = this._createArray();
    const terrain = G.terrain;

    const riverTarget = Math.floor(total * riverRatio);
    if (riverTarget > 0) {
      this._generateRivers(terrain, riverTarget, seed);
    }

    const mountainTarget = Math.floor(total * mountainRatio);
    if (mountainTarget > 0) {
      this._generateMountains(terrain, mountainTarget, seed);
    }

    G.stations = this._placeStations(terrain, seed);
    const dp = this._placeDepot(terrain, seed);
    G.depotX = dp.x;
    G.depotY = dp.y;

    G.platforms = [];
    G.stationQueues = {};

    G.connectionMap = {};
    G.activeSwitches = {};
    G.activeTrains = [];
    G.depotTrains = [{ id: 1, carCount: 2, passengers: {} }];
    G.nextTrainId = 2;
    G.undoStack = [];
    G._passengerAccum = {};
    G._dirty = true;

    deleteSave();
  },
};

function terrainTypeAt(gx, gy) {
  if (!G.terrain) return TERRAIN.PLAIN;
  return G.terrain[gy * G.GRID_W + gx];
}
