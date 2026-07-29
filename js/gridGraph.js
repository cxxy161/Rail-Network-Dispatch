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
      const pairs = this.getThroughPairs(key);
      const throughSet = new Set();
      for (const [a, b] of pairs) { throughSet.add(a); throughSet.add(b); }
      const ns = this.getNeighbors(key);
      const hasBranch = ns.some(nk => !throughSet.has(nk));
      if (!hasBranch) {
        delete G.activeSwitches[key];
        return;
      }
      if (!(key in G.activeSwitches)) {
        G.activeSwitches[key] = 0;
      } else {
        G.activeSwitches[key] = Math.min(G.activeSwitches[key], deg - 1);
      }
    } else {
      delete G.activeSwitches[key];
    }
  },

  isValidSwitchTurn(dx, dy, ndx, ndy) {
    if (dx === ndx && dy === ndy) return true;
    if (dx === 0 && dy === 0) return true;
    const rdx = Math.sign(ndx), rdy = Math.sign(ndy);
    if (Math.sign(dx) === -rdx && Math.sign(dy) === -rdy) return false;
    if ((dx !== 0 && ndx !== 0 && Math.sign(dx) === Math.sign(ndx)) ||
        (dy !== 0 && ndy !== 0 && Math.sign(dy) === Math.sign(ndy))) return true;
    return false;
  },

  getSwitchExit(key, entryKey) {
    const neighbors = this.getNeighbors(key);
    if (neighbors.length === 0) return null;
    const [cx, cy] = key.split(',').map(Number);
    const [fx, fy] = entryKey ? entryKey.split(',').map(Number) : [cx, cy];
    const edx = cx - fx, edy = cy - fy;

    let idx = G.activeSwitches[key] || 0;
    for (let i = 0; i < neighbors.length; i++) {
      const nk = neighbors[(idx + i) % neighbors.length];
      if (nk === entryKey) continue;
      const [tx, ty] = nk.split(',').map(Number);
      const ndx = tx - cx, ndy = ty - cy;
      if (this.isValidSwitchTurn(edx, edy, ndx, ndy)) return nk;
    }
    for (const nk of neighbors) {
      if (nk === entryKey) continue;
      const [tx, ty] = nk.split(',').map(Number);
      const ndx = tx - cx, ndy = ty - cy;
      if (ndx === edx && ndy === edy) return nk;
    }
    for (const nk of neighbors) {
      if (nk === entryKey) continue;
      const [tx, ty] = nk.split(',').map(Number);
      const ndx = tx - cx, ndy = ty - cy;
      if (this.isValidSwitchTurn(edx, edy, ndx, ndy)) return nk;
    }
    for (const nk of neighbors) {
      if (nk !== entryKey) return nk;
    }
    return neighbors[0];
  },

  getSwitchExitDirection(key) {
    const deg = this.getDegree(key);
    if (deg < 3) return null;
    const idx = G.activeSwitches[key] || 0;
    const neighbors = this.getNeighbors(key);
    const [cx, cy] = key.split(',').map(Number);
    for (let i = 0; i < neighbors.length; i++) {
      const nk = neighbors[(idx + i) % neighbors.length];
      const [tx, ty] = nk.split(',').map(Number);
      const ndx = tx - cx, ndy = ty - cy;
      if (this.isValidSwitchTurn(0, 0, ndx, ndy)) {
        return { x: ndx, y: ndy };
      }
    }
    return null;
  },

  getThroughPairs(key) {
    const ns = this.getNeighbors(key);
    const pairs = [];
    const [sx, sy] = key.split(',').map(Number);
    for (let i = 0; i < ns.length; i++) {
      const [ax, ay] = ns[i].split(',').map(Number);
      const adx = ax - sx, ady = ay - sy;
      for (let j = i + 1; j < ns.length; j++) {
        const [bx, by] = ns[j].split(',').map(Number);
        const bdx = bx - sx, bdy = by - sy;
        if (adx === -bdx && ady === -bdy) {
          pairs.push([ns[i], ns[j]]);
        }
      }
    }
    return pairs;
  },

  countBranchesNear(key, refDx, refDy, excludeKey) {
    const ns = this.getNeighbors(key);
    const [sx, sy] = key.split(',').map(Number);
    let count = 0;
    for (const nk of ns) {
      if (nk === excludeKey) continue;
      const [nx, ny] = nk.split(',').map(Number);
      const ndx = nx - sx, ndy = ny - sy;
      if ((refDx !== 0 && Math.sign(refDx) === Math.sign(ndx)) ||
          (refDy !== 0 && Math.sign(refDy) === Math.sign(ndy))) count++;
    }
    return count;
  },

  findMinAnglePair(key) {
    const ns = this.getNeighbors(key);
    const [sx, sy] = key.split(',').map(Number);
    let bestAngle = Infinity, bestPair = null;
    for (let i = 0; i < ns.length; i++) {
      const [ax, ay] = ns[i].split(',').map(Number);
      const adx = ax - sx, ady = ay - sy;
      for (let j = i + 1; j < ns.length; j++) {
        const [bx, by] = ns[j].split(',').map(Number);
        const bdx = bx - sx, bdy = by - sy;
        const dot = adx * bdx + ady * bdy;
        const la = Math.hypot(adx, ady), lb = Math.hypot(bdx, bdy);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (la * lb))));
        if (angle < bestAngle) { bestAngle = angle; bestPair = [ns[i], ns[j]]; }
      }
    }
    return bestPair;
  },

  cycleSwitch(key) {
    const deg = this.getDegree(key);
    if (deg < 3) return;
    const old = G.activeSwitches[key] || 0;
    const ns = this.getNeighbors(key);
    const [sx, sy] = key.split(',').map(Number);
    const pairs = this.getThroughPairs(key);
    const fixedSet = new Set();

    if (pairs.length > 0) {
      for (const [a, b] of pairs) {
        const [ax, ay] = a.split(',').map(Number);
        const [bx, by] = b.split(',').map(Number);
        const adx = ax - sx, ady = ay - sy;
        const bdx = bx - sx, bdy = by - sy;
        const cntA = this.countBranchesNear(key, adx, ady, b);
        const cntB = this.countBranchesNear(key, bdx, bdy, a);
        const fixedA = (cntA < cntB) || (cntA === cntB && (adx > 0 || (adx === 0 && ady < 0)));
        if (fixedA) { fixedSet.add(a); } else { fixedSet.add(b); }
      }
    } else {
      const mp = this.findMinAnglePair(key);
      if (mp) {
        for (const nk of ns) {
          if (nk !== mp[0] && nk !== mp[1]) fixedSet.add(nk);
        }
      }
    }

    const candidates = ns.filter((nk, i) => !fixedSet.has(nk));
    if (candidates.length === 0) return;

    const currentCandidate = ns[old % deg];
    let curIdx = candidates.indexOf(currentCandidate);
    if (curIdx < 0) curIdx = 0;
    const nextIdx = (curIdx + 1) % candidates.length;
    G.activeSwitches[key] = ns.indexOf(candidates[nextIdx]);
  },
};
