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
      amplitude *= 0.4;
      frequency *= 2.1;
    }

    return value / maxValue;
  },

  _diagLine(x1, y1, x2, y2) {
    const cells = [];
    let cx = x1;
    let cy = y1;
    cells.push({ x: cx, y: cy });

    while (cx !== x2 || cy !== y2) {
      const dx = x2 - cx;
      const dy = y2 - cy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (adx > 0 && ady > 0) {
        cx += Math.sign(dx);
        cy += Math.sign(dy);
      } else if (adx > 0) {
        cx += Math.sign(dx);
      } else if (ady > 0) {
        cy += Math.sign(dy);
      }
      cells.push({ x: cx, y: cy });
    }
    return cells;
  },

  _generateTerrain(terrain, riverRatio, mountainRatio, seed) {
    const total = G.GRID_W * G.GRID_H;
    const riverTarget = riverRatio > 0 ? Math.floor(total * riverRatio) : 0;
    const mountainTarget = mountainRatio > 0 ? Math.floor(total * mountainRatio) : 0;
    const scale = 14;
    const octaves = 4;

    const cells = [];

    for (let y = 0; y < G.GRID_H; y++) {
      for (let x = 0; x < G.GRID_W; x++) {
        const n = this._fbm(x / scale, y / scale, seed, octaves);
        cells.push({ n, x, y });
      }
    }

    cells.sort((a, b) => a.n - b.n);

    let riverThreshold = -1;
    let mountainThreshold = 2;

    if (riverTarget > 0 && riverTarget < total) {
      riverThreshold = cells[riverTarget].n;
    }
    if (mountainTarget > 0 && mountainTarget < total) {
      const idx = Math.max(0, total - mountainTarget - 1);
      mountainThreshold = cells[idx].n;
    }

    for (let i = 0; i < total; i++) {
      const { n, x, y } = cells[i];
      if (riverTarget > 0 && n <= riverThreshold) {
        this._set(terrain, x, y, TERRAIN.RIVER);
      } else if (mountainTarget > 0 && n >= mountainThreshold) {
        this._set(terrain, x, y, TERRAIN.MOUNTAIN);
      }
    }

    if (riverTarget > 0) {
      this._thinRivers(terrain);
      this._connectRivers(terrain, seed);
    }
    if (mountainTarget > 0) {
      this._smoothMountains(terrain);
    }
  },

  _thinRivers(terrain) {
    const copy = new Uint8Array(terrain);
    for (let y = 0; y < G.GRID_H; y++) {
      for (let x = 0; x < G.GRID_W; x++) {
        if (this._get(copy, x, y) !== TERRAIN.RIVER) continue;
        let nbr = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (this._inBounds(nx, ny) && this._get(copy, nx, ny) === TERRAIN.RIVER) {
              nbr++;
            }
          }
        }
        if (nbr >= 7) {
          this._set(terrain, x, y, TERRAIN.PLAIN);
        }
      }
    }
  },

  _connectRivers(terrain, seed) {
    const W = G.GRID_W;
    const H = G.GRID_H;
    const visited = new Uint8Array(W * H);
    const components = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this._get(terrain, x, y) !== TERRAIN.RIVER) continue;
        const idx = y * W + x;
        if (visited[idx]) continue;

        const comp = [];
        const queue = [[x, y]];
        visited[idx] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          comp.push({ x: cx, y: cy });

          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!this._inBounds(nx, ny)) continue;
            const nidx = ny * W + nx;
            if (visited[nidx]) continue;
            if (this._get(terrain, nx, ny) !== TERRAIN.RIVER) continue;
            visited[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
        components.push(comp);
      }
    }

    components.sort((a, b) => b.length - a.length);
    if (components.length <= 1) return;

    const kept = components[0];
    for (let i = 1; i < components.length; i++) {
      const comp = components[i];
      if (comp.length < 8) continue;

      let bestDist = Infinity;
      let bestA = null;
      let bestB = null;

      for (let ai = 0; ai < comp.length; ai += 3) {
        for (let bi = 0; bi < kept.length; bi += 3) {
          const dist = Math.abs(comp[ai].x - kept[bi].x) + Math.abs(comp[ai].y - kept[bi].y);
          if (dist < bestDist) {
            bestDist = dist;
            bestA = comp[ai];
            bestB = kept[bi];
          }
        }
      }

      if (bestA && bestDist < 30) {
        const line = this._diagLine(bestA.x, bestA.y, bestB.x, bestB.y);
        for (const { x, y } of line) {
          if (this._get(terrain, x, y) === TERRAIN.PLAIN) {
            this._set(terrain, x, y, TERRAIN.RIVER);
          }
        }
        kept.push(...comp);
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
              const nx = x + dx;
              const ny = y + dy;
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
