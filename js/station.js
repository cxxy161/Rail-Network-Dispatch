const Station = {
  isInStationArea(gx, gy, station) {
    return Math.abs(gx - station.x) <= 1 && Math.abs(gy - station.y) <= 1;
  },

  findStationForGrid(gx, gy) {
    return G.stations.find(s => this.isInStationArea(gx, gy, s));
  },

  getPlatformAt(gx, gy) {
    return G.platforms.find(p => p.x === gx && p.y === gy) || null;
  },

  addPlatform(gx, gy, dir) {
    const station = this.findStationForGrid(gx, gy);
    if (!station) return 'err_not_in_area';
    if (this.getPlatformAt(gx, gy)) return 'err_dup';
    if (G.platformComponents <= 0) return 'err_no_comp';

    const plat = { x: gx, y: gy, dir: dir, stationId: station.id };
    G.platforms.push(plat);
    G.platformComponents--;

    this.connectPlatformToTracks(plat);
    return 'ok';
  },

  removePlatform(gx, gy) {
    const idx = G.platforms.findIndex(p => p.x === gx && p.y === gy);
    if (idx < 0) return false;
    const plat = G.platforms[idx];
    G.platforms.splice(idx, 1);
    G.platformComponents++;

    const key = Graph.key(gx, gy);
    if (G.connectionMap[key]) {
      const neighbors = [...Graph.getNeighbors(key)];
      for (const nk of neighbors) {
        Graph.removeEdge(key, nk);
      }
    }
    return true;
  },

  connectPlatformToTracks(plat) {
    const key = Graph.key(plat.x, plat.y);
    let connected = false;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nk = Graph.key(plat.x + dx, plat.y + dy);
        const c = clampGrid(plat.x + dx, plat.y + dy);
        if (G.connectionMap[Graph.key(c.x, c.y)]) {
          Graph.addEdge(key, Graph.key(c.x, c.y));
          connected = true;
        }
      }
    }
    return connected;
  },

  hasTrackConnection(plat) {
    const key = Graph.key(plat.x, plat.y);
    const deg = Graph.getDegree(key);
    return deg > 0;
  },

  refreshAllConnections() {
    for (const plat of G.platforms) {
      this.connectPlatformToTracks(plat);
    }
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

  alightPassengers(train, platformKey) {
    const plat = G.platforms.find(p => Graph.key(p.x, p.y) === platformKey);
    if (!plat) return 0;
    const stationId = plat.stationId;
    let count = 0;
    if (train.passengers[stationId]) {
      count = train.passengers[stationId];
      delete train.passengers[stationId];
    }
    return count;
  },
};
