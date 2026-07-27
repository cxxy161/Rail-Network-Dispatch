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

  _lerp(a, b, t) {
    return a + (b - a) * t;
  },

  _smoothstep(t) {
    return t * t * (3 - 2 * t);
  },

  _valueNoise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = this._smoothstep(x - ix);
    const fy = this._smoothstep(y - iy);

    const v00 = this._hash(ix,     iy,     seed);
    const v10 = this._hash(ix + 1, iy,     seed);
    const v01 = this._hash(ix,     iy + 1, seed);
    const v11 = this._hash(ix + 1, iy + 1, seed);

    const a = this._lerp(v00, v10, fx);
    const b = this._lerp(v01, v11, fx);
    return this._lerp(a, b, fy);
  },

  _fbm(x, y, seed, octaves) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this._valueNoise(x * frequency, y * frequency, seed + i * 7919) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  },

  _dilateRivers(terrain) {
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

  _smoothMountains(terrain) {
    for (let iter = 0; iter < 2; iter++) {
      const copy = new Uint8Array(terrain);
      for (let y = 0; y < G.GRID_H; y++) {
        for (let x = 0; x < G.GRID_W; x++) {
          let nbr = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (this._inBounds(nx, ny) && this._get(copy, nx, ny) === TERRAIN.MOUNTAIN) {
                nbr++;
              }
            }
          }
          const t = this._get(copy, x, y);
          if (t === TERRAIN.MOUNTAIN && nbr <= 1) {
            this._set(terrain, x, y, TERRAIN.PLAIN);
          } else if (t === TERRAIN.PLAIN && nbr >= 6) {
            this._set(terrain, x, y, TERRAIN.MOUNTAIN);
          }
        }
      }
    }
  },

  _generateRiversValley(terrain, riverRatio, seed) {
    const W = G.GRID_W;
    const H = G.GRID_H;
    const total = W * H;
    const noiseScale = 0.007;
    const warpScale = 0.005;
    const warpStrength = 22.0;

    const mountainCost = new Float32Array(total);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (terrain[idx] === TERRAIN.MOUNTAIN) {
          mountainCost[idx] = 10.0;
        } else {
          let near = 0;
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const nx = x + dx, ny = y + dy;
              if (this._inBounds(nx, ny) && terrain[ny * W + nx] === TERRAIN.MOUNTAIN) {
                near += 1.0 / (Math.hypot(dx, dy) + 0.1);
              }
            }
          }
          mountainCost[idx] = near * 0.5;
        }
      }
    }

    const ng = new Float32Array(total);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const mOff = mountainCost[idx] * 4.0;
        const qx = x + mOff + this._valueNoise(x * warpScale, y * warpScale, seed + 100) * warpStrength;
        const qy = y + mOff + this._valueNoise(x * warpScale, y * warpScale, seed + 200) * warpStrength;
        ng[idx] = this._valueNoise(qx * noiseScale, qy * noiseScale, seed);
      }
    }

    const distMap = new Float32Array(total);
    const candidates = [];

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (terrain[idx] === TERRAIN.MOUNTAIN) {
          distMap[idx] = 9999;
          continue;
        }

        const gx = (ng[idx + 1] - ng[idx - 1] + 0.5 * (ng[idx + W + 1] - ng[idx + W - 1] + ng[idx - W + 1] - ng[idx - W - 1])) / 4;
        const gy = (ng[idx + W] - ng[idx - W] + 0.5 * (ng[idx + W + 1] - ng[idx - W + 1] + ng[idx + W - 1] - ng[idx - W - 1])) / 4;
        const gradLen = Math.sqrt(gx * gx + gy * gy) + 0.0001;

        const dist = (Math.abs(ng[idx] - 0.5) / gradLen) + mountainCost[idx] * 1.5;
        distMap[idx] = dist;
        candidates.push({ idx, dist });
      }
    }

    const targetRiverTiles = Math.floor(total * riverRatio);
    candidates.sort((a, b) => a.dist - b.dist);

    const fillCount = Math.min(targetRiverTiles, candidates.length);
    for (let i = 0; i < fillCount; i++) {
      terrain[candidates[i].idx] = TERRAIN.RIVER;
    }

    this._pruneIsolated(terrain, TERRAIN.RIVER);
  },

  _pruneIsolated(terrain, type) {
    const copy = new Uint8Array(terrain);
    const W = G.GRID_W;
    const H = G.GRID_H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (copy[i] !== type) continue;
        let n = 0;
        if (y > 0 && copy[i - W] === type) n++;
        if (y < H - 1 && copy[i + W] === type) n++;
        if (x > 0 && copy[i - 1] === type) n++;
        if (x < W - 1 && copy[i + 1] === type) n++;
        if (n === 0) terrain[i] = TERRAIN.PLAIN;
      }
    }
  },

  _generateTerrain(terrain, riverRatio, mountainRatio, seed) {
    const total = G.GRID_W * G.GRID_H;

    if (mountainRatio > 0) {
      const elev = new Float32Array(total);
      const scale = 14;
      for (let i = 0; i < total; i++) {
        elev[i] = this._fbm((i % G.GRID_W) / scale, Math.floor(i / G.GRID_W) / scale, seed + 5000, 4);
      }

      const mountainTarget = Math.floor(total * mountainRatio);
      const candidates = [];
      for (let i = 0; i < total; i++) {
        candidates.push({ idx: i, v: elev[i] });
      }
      candidates.sort((a, b) => b.v - a.v);
      for (let i = 0; i < Math.min(mountainTarget, candidates.length); i++) {
        terrain[candidates[i].idx] = TERRAIN.MOUNTAIN;
      }
      this._smoothMountains(terrain);
    }

    if (riverRatio > 0) {
      this._generateRiversValley(terrain, riverRatio, seed);
    }
  },

  _placeStations(terrain, seed) {
    const rng = (n) => this._rand(seed + 500 + n * 3571);
    const count = this._randBetween(3, 7, rng(0));
    let s = 1;

    const candidates = [];
    for (let y = 3; y < G.GRID_H - 3; y++) {
      for (let x = 3; x < G.GRID_W - 3; x++) {
        let allPlain = true;
        for (let dy = -3; dy <= 3 && allPlain; dy++) {
          for (let dx = -3; dx <= 3 && allPlain; dx++) {
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

    G.terrain = this._createArray();
    const terrain = G.terrain;

    this._generateTerrain(terrain, riverRatio, mountainRatio, seed);

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
