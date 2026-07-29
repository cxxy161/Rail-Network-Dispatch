const Station = {
  getStationById(id) {
    return G.stations.find(s => s.id === id) || null;
  },

  isInStationArea(gx, gy, station) {
    return Math.abs(gx - station.x) <= 3 && Math.abs(gy - station.y) <= 3;
  },

  findStationForGrid(gx, gy) {
    return G.stations.find(s => this.isInStationArea(gx, gy, s));
  },

  getPlatformAt(gx, gy) {
    return G.platforms.find(p => p.x === gx && p.y === gy) || null;
  },

  getPlatformAdjacent(gx, gy) {
    for (const plat of G.platforms) {
      if (plat.dir === 'h' && plat.x === gx && (plat.y === gy + 1 || plat.y === gy - 1)) return plat;
      if (plat.dir === 'v' && plat.y === gy && (plat.x === gx + 1 || plat.x === gx - 1)) return plat;
    }
    return null;
  },

  platformAtKey(key) {
    const [x, y] = key.split(',').map(Number);
    return this.getPlatformAdjacent(x, y);
  },

  addPlatform(gx, gy, dir) {
    const station = this.findStationForGrid(gx, gy);
    if (!station) return 'err_not_in_area';
    if (this.getPlatformAt(gx, gy)) return 'err_dup';
    if (G.platformComponents <= 0) return 'err_no_comp';

    G.platforms.push({ x: gx, y: gy, dir: dir, stationId: station.id });
    G._stationGroupsDirty = true;
    G.platformComponents--;
    return { type: 'add_platform', x: gx, y: gy, dir: dir, stationId: station.id };
  },

  removePlatform(gx, gy) {
    const idx = G.platforms.findIndex(p => p.x === gx && p.y === gy);
    if (idx < 0) return null;
    const removed = G.platforms.splice(idx, 1)[0];
    G._stationGroupsDirty = true;
    G.platformComponents++;
    return removed;
  },

  hasTrackConnection(plat) {
    if (plat.dir === 'h') {
      const uk = Graph.key(plat.x, plat.y - 1);
      const dk = Graph.key(plat.x, plat.y + 1);
      return (G.connectionMap[uk] && Graph.getDegree(uk) > 0) ||
             (G.connectionMap[dk] && Graph.getDegree(dk) > 0);
    }
    if (plat.dir === 'v') {
      const lk = Graph.key(plat.x - 1, plat.y);
      const rk = Graph.key(plat.x + 1, plat.y);
      return (G.connectionMap[lk] && Graph.getDegree(lk) > 0) ||
             (G.connectionMap[rk] && Graph.getDegree(rk) > 0);
    }
    return false;
  },

  stationHasTrackConnection(stationId) {
    const plats = G.platforms.filter(p => p.stationId === stationId);
    return plats.some(p => this.hasTrackConnection(p));
  },

  getStationGroups() {
    if (!G._stationGroupsDirty && G._stationGroupsCache) return G._stationGroupsCache;
    G._stationGroupsDirty = false;
    const groups = {};
    for (const plat of G.platforms) {
      if (!groups[plat.stationId]) {
        const st = G.stations.find(s => s.id === plat.stationId);
        groups[plat.stationId] = { stationId: plat.stationId, platforms: [], color: st ? st.color : '#999' };
      }
      groups[plat.stationId].platforms.push(plat);
    }
    for (const [sid, grp] of Object.entries(groups)) {
      const xs = grp.platforms.map(p => p.x);
      const ys = grp.platforms.map(p => p.y);
      grp.bounds = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
      grp.cx = (grp.bounds.minX + grp.bounds.maxX) / 2;
      grp.cy = (grp.bounds.minY + grp.bounds.maxY) / 2;
    }
    G._stationGroupsCache = groups;
    return groups;
  },

  generatePassengers() {},

  tickPassengers(dt) {
    const RATE = 1.0;
    for (const st of G.stations) {
      if (!this.stationHasTrackConnection(st.id)) continue;
      if (st.id in G._passengerAccum === false) G._passengerAccum[st.id] = 0;
      G._passengerAccum[st.id] += RATE * (G.satisfaction / 100) * dt;
      while (G._passengerAccum[st.id] >= 1) {
        G._passengerAccum[st.id] -= 1;
        G.totalGeneratedToday++;
        const others = G.stations.filter(s => s.id !== st.id && this.stationHasTrackConnection(s.id));
        if (others.length === 0) continue;
        const dest = others[Math.floor(Math.random() * others.length)];
        if (!G.stationQueues[st.id]) G.stationQueues[st.id] = {};
        G.stationQueues[st.id][dest.id] = (G.stationQueues[st.id][dest.id] || 0) + 1;
      }
    }
  },

  boardPassengers(stationId, trainDestIds) {
    if (!G.stationQueues[stationId]) return {};
    const boarded = {};
    for (const destId of Object.keys(G.stationQueues[stationId])) {
      if (G.stationQueues[stationId][destId] === 0) continue;
      if (trainDestIds.includes(destId)) {
        boarded[destId] = G.stationQueues[stationId][destId];
        G.stationQueues[stationId][destId] = 0;
      }
    }
    for (const destId of Object.keys(boarded)) {
      delete G.stationQueues[stationId][destId];
    }
    if (Object.keys(G.stationQueues[stationId]).length === 0) {
      delete G.stationQueues[stationId];
    }
    return boarded;
  },

  alightPassengers(train, stationId) {
    let count = 0;
    if (train.passengers[stationId]) {
      count = train.passengers[stationId];
      delete train.passengers[stationId];
    }
    return count;
  },
};
