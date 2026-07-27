const G = {
  GRID_W: 192,
  GRID_H: 144,
  CELL_SIZE: 64,

  zoom: 0.11,
  offsetX: 0,
  offsetY: 0,

  phase: 'build',
  dayTime: 300,
  paused: false,
  speedMultiplier: 1,
  dayNumber: 1,

  gold: 500,
  maintenanceCost: 30,
  passengerPrice: 2,
  passengersDeliveredToday: 0,
  totalPassengersDelivered: 0,

  trackFragments: 30,
  platformComponents: 5,
  wagons: 4,

  shopPrices: {
    trackFragment: 10,
    platformComponent: 30,
    wagon: 50,
  },

  terrain: null,
  mapSeed: 0,
  connectionMap: {},
  activeSwitches: {},

  platforms: [],

  stations: [],

  depotX: 0,
  depotY: 0,

  depotTrains: [],
  activeTrains: [],
  nextTrainId: 1,

  stationQueues: {},

  selectedTool: 'track',
  mouseGridX: -1,
  mouseGridY: -1,

  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOffsetStartX: 0,
  panOffsetStartY: 0,

  trackDrag: { active: false, startX: -1, startY: -1 },
  platDrag: { active: false, startX: -1, startY: -1, dir: null },

  selectedItem: null,
  undoStack: [],
  eraserDragging: false,
  eraserLastGX: -1,
  eraserLastGY: -1,

  operateSubTool: null,
  _passengerAccum: {},
  infoTarget: null,
  _dirty: false,
  satisfaction: 100,
  lowSatisfactionDays: 0,
  totalGeneratedToday: 0,
  lastDeductHour: 6,
};

function resetGame(opts) {
  G.zoom = 0.11;
  G.offsetX = 0;
  G.offsetY = 0;
  G.phase = 'build';
  G.dayTime = 300;
  G.paused = false;
  G.speedMultiplier = 1;
  G.dayNumber = 1;
  G.gold = 500;
  G.passengersDeliveredToday = 0;
  G.totalPassengersDelivered = 0;
  G.trackFragments = 30;
  G.platformComponents = 5;
  G.wagons = 4;
  G.connectionMap = {};
  G.activeSwitches = {};
  G.platforms = [];
  G.selectedTool = 'track';
  G.mouseGridX = -1;
  G.mouseGridY = -1;
  G.isPanning = false;
  G.trackDrag = { active: false, startX: -1, startY: -1 };
  G.platDrag = { active: false, startX: -1, startY: -1, dir: null };
  G.selectedItem = null;
  G.undoStack = [];
  G.eraserDragging = false;
  G.eraserLastGX = -1;
  G.eraserLastGY = -1;
  G.operateSubTool = null;
  G._passengerAccum = {};
  G.infoTarget = null;

  const mapScale = opts.mapScale || 0.5;
  G.GRID_W = Math.floor(192 * mapScale);
  G.GRID_H = Math.floor(144 * mapScale);
  G.zoom = 0.11 / mapScale;

  Terrain.generateMap(opts || {});
}

function terrainAt(gx, gy) {
  if (!G.terrain) return TERRAIN.PLAIN;
  return G.terrain[gy * G.GRID_W + gx];
}

function worldToScreen(wx, wy) {
  return { x: wx * G.zoom + G.offsetX, y: wy * G.zoom + G.offsetY };
}

function screenToWorld(sx, sy) {
  return { x: (sx - G.offsetX) / G.zoom, y: (sy - G.offsetY) / G.zoom };
}

function gridToWorld(gx, gy) {
  return { x: gx * G.CELL_SIZE, y: gy * G.CELL_SIZE };
}

function screenToGrid(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / G.CELL_SIZE), y: Math.floor(w.y / G.CELL_SIZE) };
}

function clampGrid(gx, gy) {
  return {
    x: Math.max(0, Math.min(G.GRID_W - 1, gx)),
    y: Math.max(0, Math.min(G.GRID_H - 1, gy)),
  };
}

function dayTimeToClock() {
  const progress = 1 - (G.dayTime / 600);
  const totalMin = 6 * 60 + progress * 18 * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  return { h, m };
}

const SAVE_KEY = 'mini_rail_ops_save';

function saveGame() {
  const data = {
    gold: G.gold, dayNumber: G.dayNumber, dayTime: G.dayTime,
    trackFragments: G.trackFragments, platformComponents: G.platformComponents, wagons: G.wagons,
    connectionMap: G.connectionMap, activeSwitches: G.activeSwitches,
    platforms: G.platforms, stationQueues: G.stationQueues,
    stations: G.stations, depotX: G.depotX, depotY: G.depotY, mapSeed: G.mapSeed,
    terrain: G.terrain ? Array.from(G.terrain) : null,
    GRID_W: G.GRID_W, GRID_H: G.GRID_H, zoom: G.zoom,
    depotTrains: G.depotTrains, activeTrains: G.activeTrains, nextTrainId: G.nextTrainId,
    passengersDeliveredToday: G.passengersDeliveredToday, totalPassengersDelivered: G.totalPassengersDelivered,
    satisfaction: G.satisfaction, totalGeneratedToday: G.totalGeneratedToday,
    offsetX: G.offsetX, offsetY: G.offsetY,
    undoStack: G.undoStack.map(a => a.type === 'add_edges' || a.type === 'remove_edges' ? { ...a } :
      a.type === 'batch' ? { ...a, items: a.items.map(i => ({ ...i })) } : { ...a }),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  G._dirty = false;
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    G.gold = data.gold || 500;
    G.dayNumber = data.dayNumber || 1;
    G.dayTime = data.dayTime || 300;
    G.trackFragments = data.trackFragments || 30;
    G.platformComponents = data.platformComponents || 5;
    G.wagons = data.wagons || 4;
    G.connectionMap = data.connectionMap || {};
    G.activeSwitches = data.activeSwitches || {};
    G.platforms = data.platforms || [];
    G.stationQueues = data.stationQueues || {};
    G.mapSeed = data.mapSeed || 0;

    if (data.GRID_W) { G.GRID_W = data.GRID_W; G.GRID_H = data.GRID_H; }
    if (data.zoom !== undefined) { G.zoom = data.zoom; G.offsetX = data.offsetX || 0; G.offsetY = data.offsetY || 0; }

    if (data.terrain) {
      G.terrain = new Uint8Array(data.terrain);
    } else {
      G.terrain = null;
    }

    if (data.stations && data.stations.length > 0) {
      G.stations = data.stations;
    } else {
      G.stations = [
        { id: 'A', x: 6, y: 12, color: '#E84A4A' },
        { id: 'B', x: 16, y: 4, color: '#4A90D9' },
        { id: 'C', x: 16, y: 12, color: '#50B86C' },
      ];
    }
    G.depotX = data.depotX != null ? data.depotX : 31;
    G.depotY = data.depotY != null ? data.depotY : 12;

    G.depotTrains = data.depotTrains || [{ id: 1, carCount: 2, passengers: {} }];
    G.activeTrains = (data.activeTrains || []).map(t => ({ ...t }));
    G.nextTrainId = data.nextTrainId || 2;
    G.passengersDeliveredToday = data.passengersDeliveredToday || 0;
    G.totalPassengersDelivered = data.totalPassengersDelivered || 0;
    G.satisfaction = data.satisfaction != null ? data.satisfaction : 100;
    G.totalGeneratedToday = data.totalGeneratedToday || 0;
    G.undoStack = data.undoStack || [];
    G._passengerAccum = {};
    G._dirty = false;
    G.phase = 'build';
    G.paused = false;
    G.speedMultiplier = 1;
    G.infoTarget = null;
    G.trackDrag = { active: false, startX: -1, startY: -1 };
    G.platDrag = { active: false, startX: -1, startY: -1, dir: null };
    G.selectedTool = 'track';
    G.mouseGridX = -1; G.mouseGridY = -1;
    G.lowSatisfactionDays = 0;
    G.lastDeductHour = 6;
    return true;
  } catch (e) { return false; }
}

function saveExists() { return !!localStorage.getItem(SAVE_KEY); }

function deleteSave() { localStorage.removeItem(SAVE_KEY); G._dirty = true; }

function exportToBase64() {
  saveGame();
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? btoa(raw) : '';
}

function importFromBase64(b64) {
  try {
    const raw = atob(b64.trim());
    JSON.parse(raw);
    localStorage.setItem(SAVE_KEY, raw);
    return true;
  } catch (e) { return false; }
}
