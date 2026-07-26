const Train = {
  SPEED: 1.0,
  ACCEL: 1.5,
  DECEL: 1.2,

  edgeDistance(k1, k2) {
    const [x1, y1] = k1.split(',').map(Number);
    const [x2, y2] = k2.split(',').map(Number);
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
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
    };
  },

  dispatch(train) {
    const depotKey = Graph.key(G.depotX, G.depotY);
    const neighbors = Graph.getNeighbors(depotKey);
    if (neighbors.length === 0) return false;

    train.fromKey = depotKey;
    train.toKey = neighbors[0];
    train.t = 0;
    train.speed = 0;
    train.state = 'moving';
    train.dockedTimer = 0;
    train.passengers = {};
    train.lastDockedStationId = null;
    G.activeTrains.push(train);
    return true;
  },

  recall(train) {
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
        train.state = 'moving';
        train.t = 0;
        train.speed = 0;
      }
      return;
    }

    if (train.state !== 'moving') return;

    const dist = this.edgeDistance(train.fromKey, train.toKey);
    const travelLeft = (1 - train.t) * dist;

    let needStop = false;
    if (travelLeft < 2) {
      const nextKey = train.toKey;
      const exits = Graph.getNeighbors(nextKey).filter(nk => nk !== train.fromKey);
      if (exits.length === 0) {
        needStop = true;
      } else if (this.isPlatformNode(nextKey)) {
        const plat = Station.platformAtKey(nextKey);
        if (plat && plat.stationId !== train.lastDockedStationId) needStop = true;
      }
    }

    const DECEL_START = 0.7, DECEL_END = 0.06, MIN_SPEED = 0.04;
    let targetSpeed;
    if (!needStop || travelLeft > DECEL_START) {
      targetSpeed = this.SPEED;
    } else {
      if (travelLeft <= DECEL_END) { this.arriveNode(train, train.toKey, train.fromKey); return; }
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
      this.arriveNode(train, train.toKey, train.fromKey);
    }
  },

  isPlatformNode(key) {
    return !!Station.platformAtKey(key);
  },

  arriveNode(train, nodeKey, fromKey) {
    if (nodeKey === Graph.key(G.depotX, G.depotY)) {
      this.recall(train);
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

    const plat = Station.platformAtKey(nodeKey);
    const stationId = plat ? plat.stationId : null;

    if (plat && stationId !== train.lastDockedStationId) {
      train.fromKey = nodeKey;
      train.toKey = nextKey || fromKey;
      train.dockedTimer = 3;
      train.t = 0;
      train.speed = 0;
      train.state = 'docked';
      train.lastDockedStationId = stationId;

      const alighted = Station.alightPassengers(train, nodeKey);
      G.passengersDeliveredToday += alighted;
      G.totalPassengersDelivered += alighted;
      this.boardAtStation(train, nodeKey);
    } else if (nextKey) {
      if (!plat) train.lastDockedStationId = null;
      train.fromKey = nodeKey;
      train.toKey = nextKey;
      train.t = 0;
    } else {
      if (!plat) train.lastDockedStationId = null;
      this.reverseTrain(train);
    }
  },

  reverseTrain(train) {
    train.lastDockedStationId = null;
    const tmp = train.fromKey;
    train.fromKey = train.toKey;
    train.toKey = tmp;
    train.t = 0;
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
