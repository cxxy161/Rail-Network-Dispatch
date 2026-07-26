const G = {
  GRID_W: 32,
  GRID_H: 24,
  CELL_SIZE: 64,

  zoom: 0.65,
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

  connectionMap: {},
  activeSwitches: {},

  platforms: [],

  stations: [
    { id: 'A', x: 6, y: 12, color: '#E84A4A' },
    { id: 'B', x: 16, y: 4, color: '#4A90D9' },
    { id: 'C', x: 16, y: 12, color: '#50B86C' },
  ],

  depotX: 31,
  depotY: 12,

  depotTrains: [
    { id: 1, carCount: 2, passengers: {} },
  ],
  activeTrains: [],
  nextTrainId: 2,

  stationQueues: {},

  selectedTool: 'track',
  mouseGridX: -1,
  mouseGridY: -1,

  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOffsetStartX: 0,
  panOffsetStartY: 0,

  trackDrag: { active: false, lastGX: -1, lastGY: -1 },
  platDrag: { active: false, startX: -1, startY: -1, dir: null },

  selectedItem: null,
  undoStack: [],
  eraserDragging: false,
  eraserLastGX: -1,
  eraserLastGY: -1,

  operateSubTool: null,
  _passengerAccum: {},
};

function resetGame() {
  G.zoom = 0.65;
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
  G.depotTrains = [{ id: 1, carCount: 2, passengers: {} }];
  G.activeTrains = [];
  G.nextTrainId = 2;
  G.stationQueues = {};
  G.selectedTool = 'track';
  G.mouseGridX = -1;
  G.mouseGridY = -1;
  G.isPanning = false;
  G.trackDrag = { active: false, lastGX: -1, lastGY: -1 };
  G.platDrag = { active: false, startX: -1, startY: -1, dir: null };
  G.selectedItem = null;
  G.undoStack = [];
  G.eraserDragging = false;
  G.eraserLastGX = -1;
  G.eraserLastGY = -1;
  G.operateSubTool = null;
  G._passengerAccum = {};
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
  const progress = 1 - (G.dayTime / 300);
  const totalMin = 6 * 60 + progress * 18 * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  return { h, m };
}
