const Station = {
  isInStationArea(gx, gy, station) {
    return Math.abs(gx - station.x) <= 1 && Math.abs(gy - station.y) <= 1;
  },

  findStationForGrid(gx, gy) {
    return G.stations.find(s => this.isInStationArea(gx, gy, s));
  },

  addPlatform(gx, gy) {
    const key = Graph.key(gx, gy);
    const station = this.findStationForGrid(gx, gy);
    if (!station) return false;
    if (G.platformMap[key]) return false;
    if (!G.connectionMap[key]) return false;
    G.platformMap[key] = station.id;
    return true;
  },

  removePlatform(gx, gy) {
    const key = Graph.key(gx, gy);
    if (!G.platformMap[key]) return;
    delete G.platformMap[key];
  },

  getStationById(id) {
    return G.stations.find(s => s.id === id);
  },

  generatePassengers() {
    G.stationQueues = {};
    const keys = Object.keys(G.platformMap);

    for (const key of keys) {
      const stationId = G.platformMap[key];
      const count = 5 + Math.floor(Math.random() * 11);
      const dests = {};
      for (let i = 0; i < count; i++) {
        const otherStations = G.stations.filter(s => s.id !== stationId);
        if (otherStations.length === 0) continue;
        const dest = otherStations[Math.floor(Math.random() * otherStations.length)];
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
    const stationId = G.platformMap[platformKey];
    let count = 0;
    if (train.passengers[stationId]) {
      count = train.passengers[stationId];
      delete train.passengers[stationId];
    }
    return count;
  },
};
