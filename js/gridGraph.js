const Graph = {
  key(x, y) {
    return x + ',' + y;
  },

  addEdge(k1, k2) {
    if (k1 === k2) return false;
    if (!G.connectionMap[k1]) G.connectionMap[k1] = [];
    if (!G.connectionMap[k2]) G.connectionMap[k2] = [];
    if (G.connectionMap[k1].includes(k2)) return false;
    G.connectionMap[k1].push(k2);
    G.connectionMap[k2].push(k1);
    this.updateSwitches(k1);
    this.updateSwitches(k2);
    return true;
  },

  removeEdge(k1, k2) {
    if (!G.connectionMap[k1] || !G.connectionMap[k2]) return;
    G.connectionMap[k1] = G.connectionMap[k1].filter(k => k !== k2);
    G.connectionMap[k2] = G.connectionMap[k2].filter(k => k !== k1);
    this.updateSwitches(k1);
    this.updateSwitches(k2);
  },

  hasEdge(k1, k2) {
    if (!G.connectionMap[k1]) return false;
    return G.connectionMap[k1].includes(k2);
  },

  getNeighbors(key) {
    return G.connectionMap[key] || [];
  },

  getDegree(key) {
    return (G.connectionMap[key] || []).length;
  },

  removeNode(key) {
    if (!G.connectionMap[key]) return;
    const neighbors = [...G.connectionMap[key]];
    for (const nk of neighbors) {
      G.connectionMap[nk] = G.connectionMap[nk].filter(k => k !== key);
      this.updateSwitches(nk);
    }
    delete G.connectionMap[key];
    delete G.activeSwitches[key];
  },

  updateSwitches(key) {
    const deg = this.getDegree(key);
    if (deg >= 3) {
      if (!(key in G.activeSwitches)) {
        G.activeSwitches[key] = 0;
      } else {
        G.activeSwitches[key] = Math.min(G.activeSwitches[key], deg - 1);
      }
    } else {
      delete G.activeSwitches[key];
    }
  },

  getSwitchExit(key, entryKey) {
    const neighbors = this.getNeighbors(key);
    const options = neighbors.filter(nk => nk !== entryKey);
    if (options.length === 0) return null;
    if (options.length === 1) return options[0];
    const idx = G.activeSwitches[key] || 0;
    return options[idx % options.length] || options[0];
  },

  getSwitchExitDirection(key) {
    const deg = this.getDegree(key);
    if (deg < 3) return null;
    const idx = G.activeSwitches[key] || 0;
    const neighbors = this.getNeighbors(key);
    const nkey = neighbors[idx % deg];
    const [sx, sy] = key.split(',').map(Number);
    const [tx, ty] = nkey.split(',').map(Number);
    return { x: tx - sx, y: ty - sy };
  },

  cycleSwitch(key) {
    const deg = this.getDegree(key);
    if (deg < 3) return;
    G.activeSwitches[key] = ((G.activeSwitches[key] || 0) + 1) % deg;
  },
};
