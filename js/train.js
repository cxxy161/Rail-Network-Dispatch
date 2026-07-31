const Train = {
  SPEED: 1.0,
  ACCEL: 1.5,
  DECEL: 1.2,

  edgeDistance(k1, k2) {
    const [x1, y1] = k1.split(',').map(Number);
    const [x2, y2] = k2.split(',').map(Number);
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  _advanceOccupied(train, key) {
    if (G.cellOccupancy[key] && G.cellOccupancy[key] !== train.id) return false;
    G.cellOccupancy[key] = train.id;
    if (!train.occupiedCells) train.occupiedCells = [];
    if (train.occupiedCells[0] !== key) {
      train.occupiedCells.unshift(key);
      const limit = train.carCount + 1;
      while (train.occupiedCells.length > limit) {
        const old = train.occupiedCells.pop();
        this._releaseCell(train, old);
      }
    }
    return true;
  },

  _releaseCell(train, key) {
    if (G.cellOccupancy[key] === train.id) delete G.cellOccupancy[key];
  },

  maxLoad(train) {
    return train.carCount * 20;
  },

  reachableStationIds(train) {
    return G.stations.map(s => s.id).filter(() => true);
  },

  create(carCount) {
    return {
      id: G.nextTrainId++,
      carCount: carCount,
      fromKey: null,
      toKey: null,
      t: 0,
      speed: 0,
      state: 'in_depot',
      dockedTimer: 0,
      passengers: {},
      lastDockedStationId: null,
      trail: [],
      occupiedCells: [],
      reversed: false,
      nextDesiredKey: null,
      prevKey: null,
      depotExitDir: null,
      _lastBrakeSfx: 0,
    };
  },

  _playBrakeSound(train) {
    const now = performance.now();
    if (now - (train._lastBrakeSfx || 0) > 2000) {
      train._lastBrakeSfx = now;
      AudioMgr.play('emergency_brake');
    }
  },

  dispatch(train) {
    const depotKey = Graph.key(G.depotX, G.depotY);
    const neighbors = Graph.getNeighbors(depotKey);
    if (neighbors.length === 0) return false;

    const firstKey = neighbors[0];
    const [fx, fy] = firstKey.split(',').map(Number);
    train.depotExitDir = { x: Math.sign(fx - G.depotX), y: Math.sign(fy - G.depotY) };
    this._advanceOccupied(train, depotKey);
    if (!this._advanceOccupied(train, firstKey)) {
      train.fromKey = depotKey;
      train.toKey = null;
      train.nextDesiredKey = firstKey;
      train.state = 'waiting';
    } else {
      train.fromKey = depotKey;
      train.toKey = firstKey;
      train.state = 'moving';
      train.nextDesiredKey = null;
    }
    train.t = 0;
    train.speed = 0;
    train.dockedTimer = 0;
    train.passengers = {};
    train.lastDockedStationId = null;
    G.activeTrains.push(train);
    AudioMgr.play('train_departure');
    return true;
  },

  recall(train) {
    for (const cell of (train.occupiedCells || [])) {
      this._releaseCell(train, cell);
    }
    train.occupiedCells = [];
    train.nextDesiredKey = null;
    train.depotExitDir = null;
    const idx = G.activeTrains.indexOf(train);
    if (idx >= 0) {
      G.activeTrains.splice(idx, 1);
      G.depotTrains.push(train);
      train.state = 'in_depot';
    }
  },

  update(train, dt) {
    if (train.state === 'docked') {
      train.dockedTimer -= dt;
      if (train.dockedTimer <= 0) {
        train.dockedTimer = 0;
        if (!this._advanceOccupied(train, train.toKey)) {
          train.nextDesiredKey = train.toKey;
          train.toKey = null;
          train.state = 'waiting';
        } else {
          train.state = 'moving';
        }
        train.t = 0;
        train.speed = 0;
      }
      return;
    }

    if (train.state === 'waiting') {
      if (!train.nextDesiredKey) return;
      if (this._advanceOccupied(train, train.nextDesiredKey)) {
        train.toKey = train.nextDesiredKey;
        train.nextDesiredKey = null;
        train.t = 0;
        train.speed = 0;
        train.state = 'moving';
        this.recordTrail(train);
      }
      return;
    }

    if (train.state !== 'moving') return;

    const dist = this.edgeDistance(train.fromKey, train.toKey);
    const travelLeft = (1 - train.t) * dist;

    let needStop = false;
    if (G.cellOccupancy[train.toKey] && G.cellOccupancy[train.toKey] !== train.id) {
      needStop = true;
    }
    if (travelLeft < 2) {
      const nextKey = train.toKey;
      const exits = Graph.getNeighbors(nextKey).filter(nk => nk !== train.fromKey);
      if (exits.length === 0) {
        needStop = true;
      } else if (this.isPlatformNode(nextKey)) {
        const plat = Station.platformAtKey(nextKey);
        if (plat && plat.stationId !== train.lastDockedStationId) {
          const hasFurther = exits.some(k => {
            const np = Station.platformAtKey(k);
            return np && np.stationId === plat.stationId;
          });
          if (!hasFurther) needStop = true;
        }
      }
      if (!needStop) {
        let aheadExit = null;
        if (exits.length === 1) {
          aheadExit = exits[0];
        } else if (exits.length >= 2) {
          aheadExit = Graph.getSwitchExit(nextKey, train.fromKey);
          if (!aheadExit) aheadExit = exits[0];
        }
        if (aheadExit) {
          if (G.cellOccupancy[aheadExit] && G.cellOccupancy[aheadExit] !== train.id) {
            needStop = true;
          }
        }
      }
    }

    const DECEL_START = 0.7, DECEL_END = 0.06, MIN_SPEED = 0.04;
    let targetSpeed;
    if (!needStop || travelLeft > DECEL_START) {
      targetSpeed = this.SPEED;
    } else {
      if (travelLeft <= DECEL_END) {
        if (G.cellOccupancy[train.toKey] && G.cellOccupancy[train.toKey] !== train.id) {
          this._playBrakeSound(train);
          train.speed = 0; return;
        }
        this.arriveNode(train, train.toKey, train.fromKey); return;
      }
      const frac = (travelLeft - DECEL_END) / (DECEL_START - DECEL_END);
      targetSpeed = MIN_SPEED + frac * (this.SPEED - MIN_SPEED);
    }

    if (train.speed > targetSpeed)
      train.speed = Math.max(targetSpeed, train.speed - this.DECEL * dt);
    else if (train.speed < targetSpeed)
      train.speed = Math.min(targetSpeed, train.speed + this.ACCEL * dt);

    train.t += (train.speed * dt) / dist;
    if (train.t >= 1) {
      train.t = 1;
      if (G.cellOccupancy[train.toKey] && G.cellOccupancy[train.toKey] !== train.id) {
        this._playBrakeSound(train);
        train.speed = 0; return;
      }
      this.arriveNode(train, train.toKey, train.fromKey);
    }

    if (train.state === 'moving') {
      this.recordTrail(train);
    }
  },

  recordTrail(train) {
    if (!train.trail) train.trail = [];
    if (!train.fromKey || !train.toKey) return;
    const [x1, y1] = train.fromKey.split(',').map(Number);
    const [x2, y2] = train.toKey.split(',').map(Number);
    const wx1 = x1 * G.CELL_SIZE + G.CELL_SIZE / 2;
    const wy1 = y1 * G.CELL_SIZE + G.CELL_SIZE / 2;
    const wx2 = x2 * G.CELL_SIZE + G.CELL_SIZE / 2;
    const wy2 = y2 * G.CELL_SIZE + G.CELL_SIZE / 2;
    const px = wx1 + (wx2 - wx1) * train.t;
    const py = wy1 + (wy2 - wy1) * train.t;
    const angle = Math.atan2(wy2 - wy1, wx2 - wx1);
    train.trail.unshift({ x: px, y: py, angle });
    const maxTrail = Math.max(60, train.carCount * 80);
    if (train.trail.length > maxTrail) train.trail.length = maxTrail;
  },

  isPlatformNode(key) {
    return !!Station.platformAtKey(key);
  },

  arriveNode(train, nodeKey, fromKey) {
    if (nodeKey === Graph.key(G.depotX, G.depotY)) {
      for (const cell of (train.occupiedCells || [])) {
        this._releaseCell(train, cell);
      }
      train.occupiedCells = [];
      train.nextDesiredKey = null;
      train.depotExitDir = null;
      train.state = 'docked';
      train.dockedTimer = 3;
      train.fromKey = nodeKey;
      train.toKey = fromKey;
      train.t = 0;
      train.speed = 0;
      train.lastDockedStationId = null;
      train.trail = [];
      return;
    }

    const neighbors = Graph.getNeighbors(nodeKey);
    const exits = neighbors.filter(nk => nk !== fromKey);
    let nextKey = null;
    if (exits.length === 1) {
      nextKey = exits[0];
    } else if (exits.length >= 2) {
      nextKey = Graph.getSwitchExit(nodeKey, fromKey);
      if (!nextKey || !exits.includes(nextKey)) nextKey = exits[0];
    }

    if (nextKey === fromKey) { this.reverseTrain(train); return; }

    const plat = Station.platformAtKey(nodeKey);
    const stationId = plat ? plat.stationId : null;

    if (plat) {
      if (stationId !== train.lastDockedStationId) {
        const nextPlat = nextKey ? Station.platformAtKey(nextKey) : null;
        if (nextPlat && nextPlat.stationId === stationId && nextKey) {
          this._tryEnterCell(train, nodeKey, nextKey, fromKey);
        } else {
          train.lastDockedStationId = stationId;
          const alighted = Station.alightPassengers(train, stationId);
          G.passengersDeliveredToday += alighted;
          G.totalPassengersDelivered += alighted;

          const capacity = this.maxLoad(train);
          const currentLoad = Object.values(train.passengers).reduce((a, b) => a + b, 0);
          const canBoard = capacity > currentLoad;
          const queue = G.stationQueues[stationId] || {};
          const hasMatch = Object.keys(queue).some(destId => queue[destId] > 0);

          if (canBoard && hasMatch) {
            this._advanceOccupied(train, nextKey || fromKey);
            train.fromKey = nodeKey;
            train.toKey = nextKey || fromKey;
            const platformCells = G.platforms.filter(p => p.stationId === stationId).length;
            const penalty = train.carCount > platformCells ? 1.7 : 1;
            train.dockedTimer = train.carCount * 2.5 * penalty;
            train.t = 0;
            train.speed = 0;
            train.state = 'docked';
            AudioMgr.play('train_arrive');
            AudioMgr.play('train_board');
            this.boardAtStation(train, nodeKey);
          } else if (nextKey) {
            this._tryEnterCell(train, nodeKey, nextKey, fromKey);
          } else {
            this.reverseTrain(train);
          }
        }
      } else if (nextKey) {
        this._tryEnterCell(train, nodeKey, nextKey, fromKey);
      } else {
        this.reverseTrain(train);
      }
    } else if (nextKey) {
      this._tryEnterCell(train, nodeKey, nextKey, fromKey);
    } else {
      train.lastDockedStationId = null;
      this.reverseTrain(train);
    }
  },

  _tryEnterCell(train, nodeKey, nextKey, prevKey) {
    if (!this._advanceOccupied(train, nextKey)) {
      if (train.occupiedCells.length > 0) {
        const old = train.occupiedCells.pop();
        this._releaseCell(train, old);
      }
      train.state = 'waiting';
      train.fromKey = nodeKey;
      train.toKey = null;
      train.nextDesiredKey = nextKey;
      train.prevKey = prevKey || null;
      train.t = 0;
      train.speed = 0;
      return false;
    }
    train.state = 'moving';
    train.fromKey = nodeKey;
    train.toKey = nextKey;
    train.t = 0;
    return true;
  },

  _trailPosAt(trail, targetDist) {
    if (!trail || trail.length === 0) return null;
    if (trail.length < 2) return { x: trail[0].x, y: trail[0].y, angle: trail[0].angle, index: 1 };
    const biasedDist = Math.max(0, targetDist) + 3;
    let accum = 0;
    for (let i = 1; i < trail.length; i++) {
      const seg = Math.hypot(trail[i - 1].x - trail[i].x, trail[i - 1].y - trail[i].y);
      if (seg < 0.01) continue;
      accum += seg;
      if (accum >= biasedDist) {
        const overshoot = accum - biasedDist;
        const t = Math.max(0, Math.min(1, 1 - overshoot / seg));
        let da = trail[i].angle - trail[i - 1].angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        return {
          x: trail[i - 1].x + (trail[i].x - trail[i - 1].x) * t,
          y: trail[i - 1].y + (trail[i].y - trail[i - 1].y) * t,
          angle: trail[i - 1].angle + da * t,
          index: i,
        };
      }
    }
    const last = trail[trail.length - 1];
    const remaining = biasedDist - accum;
    const la = last.angle;
    return { x: last.x - Math.cos(la) * remaining, y: last.y - Math.sin(la) * remaining, angle: la, index: trail.length };
  },

  reverseTrain(train) {
    train.lastDockedStationId = null;

    if (train.toKey === null) {
      if (!train.prevKey || !this._advanceOccupied(train, train.prevKey)) return;
      train.toKey = train.prevKey;
      train.nextDesiredKey = null;
      train.prevKey = null;
      train.t = 0;
      train.speed = 0;
      train.state = 'moving';
      return;
    }

    const cs = G.CELL_SIZE;
    const carW = cs * 0.92;
    const gap = 4;
    const trainLen = (train.carCount - 1) * (carW + gap);
    const oldTrail = train.trail || [];

    // New head = old tail position (rearmost car along the old trail).
    let T = null;
    let tailIdx = oldTrail.length;
    if (oldTrail.length >= 2) {
      T = this._trailPosAt(oldTrail, trainLen);
      if (T) tailIdx = T.index;
    } else {
      const [fx, fy] = train.fromKey.split(',').map(Number);
      const hx = fx * cs + cs / 2, hy = fy * cs + cs / 2;
      let angle = 0;
      const dirKey = train.nextDesiredKey || train.toKey;
      if (dirKey) {
        const [nx, ny] = dirKey.split(',').map(Number);
        angle = Math.atan2(ny - fy, nx - fx);
      }
      T = { x: hx - Math.cos(angle) * trainLen, y: hy - Math.sin(angle) * trainLen, angle: angle, index: oldTrail.length };
      tailIdx = oldTrail.length;
    }

    if (train.occupiedCells) train.occupiedCells.reverse();

    let moved = false;
    if (T) {
      const newDir = T.angle + Math.PI;
      const gx = Math.round(Math.cos(newDir));
      const gy = Math.round(Math.sin(newDir));
      const cx = Math.floor(T.x / cs);
      const cy = Math.floor(T.y / cs);
      const fromKey = Graph.key(cx, cy);
      const toKey = Graph.key(cx + gx, cy + gy);
      const neighbors = Graph.getNeighbors(fromKey);
      if (neighbors.includes(toKey)) {
        const ax = cx * cs + cs / 2, ay = cy * cs + cs / 2;
        const [bx, by] = toKey.split(',').map(Number);
        const bx2 = bx * cs + cs / 2, by2 = by * cs + cs / 2;
        const len2 = (bx2 - ax) * (bx2 - ax) + (by2 - ay) * (by2 - ay) || 1;
        const proj = ((T.x - ax) * (bx2 - ax) + (T.y - ay) * (by2 - ay)) / len2;
        train.fromKey = fromKey;
        train.toKey = toKey;
        train.t = Math.max(0, Math.min(1, proj));
        moved = true;
      }
    }

    if (!moved) {
      const targetKey = train.fromKey;
      train.fromKey = train.toKey;
      train.toKey = targetKey;
      train.t = 0;
    }

    // Rebuild trail: head-first from the new head (old tail). The body extends
    // from the new head BACK toward the old head (the side the train was on),
    // so iterate the old trail from the tail index DOWN to index 0.
    const [fx2, fy2] = train.fromKey.split(',').map(Number);
    const [tx2, ty2] = train.toKey.split(',').map(Number);
    const hx = fx2 * cs + cs / 2 + (tx2 * cs + cs / 2 - (fx2 * cs + cs / 2)) * train.t;
    const hy = fy2 * cs + cs / 2 + (ty2 * cs + cs / 2 - (fy2 * cs + cs / 2)) * train.t;
    const headAng = Math.atan2(ty2 - fy2, tx2 - fx2);

    const newTrail = [{ x: hx, y: hy, angle: headAng }];
    for (let j = tailIdx - 1; j >= 0; j--) {
      const p = oldTrail[j];
      let a = p.angle + Math.PI;
      if (a > Math.PI) a -= 2 * Math.PI;
      if (a < -Math.PI) a += 2 * Math.PI;
      newTrail.push({ x: p.x, y: p.y, angle: a });
    }
    // Fallback: no recorded path behind the tail, extend straight backward.
    if (newTrail.length < 2) {
      newTrail.push({ x: hx - Math.cos(headAng) * trainLen, y: hy - Math.sin(headAng) * trainLen, angle: headAng });
    }
    train.trail = newTrail;

    train.reversed = false;
    train.speed = 0;
    train.state = 'moving';
  },

  boardAtStation(train, nodeKey) {
    const plat = Station.platformAtKey(nodeKey);
    if (!plat) return 0;
    const stationId = plat.stationId;
    if (!G.stationQueues[stationId]) return 0;

    const capacity = this.maxLoad(train);
    const currentLoad = Object.values(train.passengers).reduce((a, b) => a + b, 0);
    const remaining = capacity - currentLoad;
    if (remaining <= 0) return 0;

    const reach = this.reachableStationIds(train);
    const boarded = Station.boardPassengers(stationId, reach);
    let total = 0;
    for (const [destId, count] of Object.entries(boarded)) {
      const take = Math.min(count, remaining - total);
      if (take > 0) {
        train.passengers[destId] = (train.passengers[destId] || 0) + take;
        total += take;
        if (count > take) {
          if (!G.stationQueues[stationId]) G.stationQueues[stationId] = {};
          G.stationQueues[stationId][destId] = (G.stationQueues[stationId][destId] || 0) + (count - take);
        }
      }
    }
    return total;
  },
};
