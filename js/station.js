const Station = {
  getStationById(id) {
    return G.stations.find(s => s.id === id) || null;
  },

  isInStationArea(gx, gy, station) {
    return Math.abs(gx - station.x) <= 1 && Math.abs(gy - station.y) <= 1;
  },

  findStationForGrid(gx, gy) {
    return G.stations.find(s => this.isInStationArea(gx, gy, s));
  },

  getPlatformAt(gx, gy) {
    return G.platforms.find(p => p.x === gx && p.y === gy) || null;
  },

  getPlatformAdjacent(gx, gy) {
    for (const plat of G.platforms) {
      if (plat.dir === 'h' && plat.y === gy && (plat.x === gx + 1 || plat.x === gx - 1)) return plat;
      if (plat.dir === 'v' && plat.x === gx && (plat.y === gy + 1 || plat.y === gy - 1)) return plat;
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
    G.platformComponents--;
    return { type: 'add_platform', x: gx, y: gy, dir: dir, stationId: station.id };
  },

  removePlatform(gx, gy) {
    const idx = G.platforms.findIndex(p => p.x === gx && p.y === gy);
    if (idx < 0) return null;
    const removed = G.platforms.splice(idx, 1)[0];
    G.platformComponents++;
    return removed;
  },

  hasTrackConnection(plat) {
    if (plat.dir === 'h') {
      const lk = Graph.key(plat.x - 1, plat.y);
      const rk = Graph.key(plat.x + 1, plat.y);
      return (G.connectionMap[lk] && Graph.getDegree(lk) > 0) ||
             (G.connectionMap[rk] && Graph.getDegree(rk) > 0);
    }
    if (plat.dir === 'v') {
      const uk = Graph.key(plat.x, plat.y - 1);
      const dk = Graph.key(plat.x, plat.y + 1);
      return (G.connectionMap[uk] && Graph.getDegree(uk) > 0) ||
             (G.connectionMap[dk] && Graph.getDegree(dk) > 0);
    }
    return false;
  },

  getStationGroups() {
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
    }
    return groups;
  },

  generatePassengers() {
    G.stationQueues = {};
    for (const plat of G.platforms) {
      if (!this.hasTrackConnection(plat)) continue;
      const key = Graph.key(plat.x, plat.y);
      const count = 5 + Math.floor(Math.random() * 11);
      const dests = {};
      for (let i = 0; i < count; i++) {
        const others = G.stations.filter(s => s.id !== plat.stationId);
        if (others.length === 0) continue;
        const dest = others[Math.floor(Math.random() * others.length)];
        dests[dest.id] = (dests[dest.id] || 0) + 1;
      }
      if (Object.keys(dests).length > 0) {
        G.stationQueues[key] = dests;
      }
    }
  },

  boardPassengers(key, trainDestIds) {
    if (!G.stationQueues[key]) return {};
    const boarded = {};
    for (const destId of Object.keys(G.stationQueues[key])) {
      if (G.stationQueues[key][destId] === 0) continue;
      if (trainDestIds.includes(destId)) {
        boarded[destId] = G.stationQueues[key][destId];
        G.stationQueues[key][destId] = 0;
      }
    }
    for (const destId of Object.keys(boarded)) {
      delete G.stationQueues[key][destId];
    }
    if (Object.keys(G.stationQueues[key]).length === 0) {
      delete G.stationQueues[key];
    }
    return boarded;
  },

  alightPassengers(train, nodeKey) {
    const plat = this.platformAtKey(nodeKey);
    if (!plat) return 0;
    let count = 0;
    if (train.passengers[plat.stationId]) {
      count = train.passengers[plat.stationId];
      delete train.passengers[plat.stationId];
    }
    return count;
  },
};
