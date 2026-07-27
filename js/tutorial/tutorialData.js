const TUTORIAL_DATA = {
  id: 'full_tutorial',
  title: '铁路调度入门',
  version: 1,

  mapPreset: {
    gridW: 32,
    gridH: 24,
    startingResources: { gold: 100, trackFragments: 14, platformComponents: 5, wagons: 4 },
    stations: [
      { id: 'A', x: 8,  y: 12, color: '#E84A4A', flowLevel: 30 },
      { id: 'B', x: 16, y: 6,  color: '#4A90D9', flowLevel: 20, appearsOnDay: 2 },
      { id: 'C', x: 22, y: 12, color: '#50B86C', flowLevel: 40 },
    ],
    depot: { x: 16, y: 18 },
    prebuiltEdges: (() => {
      const pairs = [];
      const k = (x, y) => x + ',' + y;
      for (let x = 22; x >= 17; x--) {
        pairs.push([k(x, 12), k(x - 1, 12)]);
      }
      return pairs;
    })(),
  },

  steps: [
    {
      id: 's1',
      text: '先给车站装站台。点底部<span class="tut-hl">「站台」</span>，在<span class="tut-hl">A站</span>（红色虚线框）内拖拽，拉出一段站台。',
      highlight: [
        { type: 'dom', selector: '#tool-platform', desc: '站台按钮' },
        { type: 'zone', x: 6, y: 10, w: 8, h: 5, desc: 'A站' },
      ],
      phaseCheck: [
        () => G.selectedTool === 'platform',
        null,
      ],
      allowActions: ['drag_platform'],
      check: () => G.platforms.some(p => p.stationId === 'A'),
    },
    {
      id: 's2',
      text: '好，<span class="tut-hl">C站</span>（绿色框）也来一段。拖拽方向会决定站台朝向。',
      highlight: { type: 'zone', x: 20, y: 10, w: 7, h: 5, desc: 'C站' },
      allowActions: ['drag_platform'],
      check: () => G.platforms.some(p => p.stationId === 'C'),
    },
    {
      id: 's3',
      text: '站台就位，开始铺铁路。切到<span class="tut-hl">「铺轨」</span>，从A站向C站拖拽画线。',
      highlight: [
        { type: 'dom', selector: '#tool-track', desc: '铺轨按钮' },
        { type: 'zone', x: 7, y: 10, w: 16, h: 5, desc: 'A→C铁路线' },
      ],
      phaseCheck: [
        () => G.selectedTool === 'track',
        null,
      ],
      allowActions: ['drag_track'],
      check: () => Tutorial.helpers.pathBetweenStations('A', 'C'),
    },
    {
      id: 's4',
      text: '轨道碎片快用完了。去<span class="tut-hl">左侧商店</span>买一些——点轨道碎片的<span class="tut-hl">「5」</span>或<span class="tut-hl">「10」</span>。',
      highlight: { type: 'dom', selector: '#shop-panel', desc: '商店面板' },
      allowActions: [],
      check: () => G.trackFragments >= 8,
    },
    {
      id: 's5',
      text: '继续画，把<span class="tut-hl">车辆段</span>也接到主线上——往交叉路口连。这样列车才能从段里开出来。',
      highlight: { type: 'zone', x: 14, y: 14, w: 5, h: 7, desc: '车辆段接入点' },
      allowActions: ['drag_track'],
      check: () => Tutorial.helpers.depotConnected(),
    },
    {
      id: 's6',
      text: '来，造一列车。点地图上的<span class="tut-hl">紫色车辆段</span>，调好车厢数，等一下我们要发车。',
      highlight: { type: 'zone', x: 14, y: 16, w: 5, h: 4, desc: '车辆段' },
      allowActions: ['click_depot'],
      check: () => G.depotTrains.length >= 1,
    },

    {
      id: 's7',
      text: '万事俱备。点底部<span class="tut-hl">「开始运营 ▸」</span>，进入白天。',
      highlight: { type: 'dom', selector: '#btn-start-day', desc: '开始运营按钮' },
      allowActions: [],
      check: () => G.phase === 'operate',
    },
    {
      id: 's8',
      text: '列车还在段里。点<span class="tut-hl">车辆段</span>，选一列车<span class="tut-hl">发车</span>，它就会冲上正线。',
      highlight: { type: 'zone', x: 14, y: 16, w: 5, h: 4, desc: '车辆段' },
      allowActions: ['click_depot'],
      check: () => G.activeTrains.length >= 1,
    },
    {
      id: 's9',
      text: '列车自动跑起来了！到站停车、乘客上下，全程自动驾驶。右上角可以调<span class="tut-hl">倍速</span>试试。',
      highlight: null,
      allowActions: [],
      check: () => Tutorial.checkTimer(10),
    },
    {
      id: 's10',
      text: '底部多了<span class="tut-hl">「启停」</span>按钮。先点它选中，再点一列运行中的列车——你可以手动把车扣在站里。',
      highlight: [
        { type: 'dom', selector: '#btn-operate-stop', desc: '启停按钮' },
        null,
      ],
      phaseCheck: [
        () => G.operateSubTool === 'stop',
        () => Tutorial.flags.usedStop,
      ],
      allowActions: ['click_train'],
      check: () => Tutorial.flags.usedStop,
    },
    {
      id: 's11',
      text: '<span class="tut-hl">「调头」</span>也是同样用法。选它点列车，车就掉头反向走——死胡同里用得着。',
      highlight: [
        { type: 'dom', selector: '#btn-operate-reverse', desc: '调头按钮' },
        null,
      ],
      phaseCheck: [
        () => G.operateSubTool === 'reverse',
        () => Tutorial.flags.usedReverse,
      ],
      allowActions: ['click_train'],
      check: () => Tutorial.flags.usedReverse,
    },
    {
      id: 's12',
      text: '注意顶部<span class="tut-hl">满意度</span> 🙂。运人效率高，满意度涨、客流多；积压严重，满意度掉、客流少。<br>这是循环反馈——客流越多调度压力越大。',
      highlight: { type: 'dom', selector: '#satisfaction-label', desc: '满意度' },
      allowActions: [],
      check: () => Tutorial.checkTimer(8),
    },
    {
      id: 's13',
      text: '天快黑了。结算时会自动弹出<span class="tut-hl">结算面板</span>——看看今天运了多少人、挣了多少。',
      highlight: null,
      allowActions: [],
      check: () => G.dayNumber === 2,
    },

    {
      id: 's14',
      text: '新的一天。地图上多了个<span class="tut-hl">B站</span>（蓝色虚线框）——先给它建一段站台。',
      highlight: { type: 'zone', x: 14, y: 4, w: 5, h: 5, desc: 'B站' },
      allowActions: ['drag_platform'],
      setup() {
        const b = TUTORIAL_DATA.mapPreset.stations.find(s => s.id === 'B');
        G.stations.push({ id: b.id, x: b.x, y: b.y, color: b.color, flowLevel: b.flowLevel });
        G.stationQueues[b.id] = {};
      },
      check: () => G.platforms.some(p => p.stationId === 'B'),
    },
    {
      id: 's15',
      text: '从<span class="tut-hl">交叉路口</span>向B站拖拽铺轨。这样主线就分叉了——三向道岔。',
      highlight: { type: 'zone', x: 15, y: 6, w: 2, h: 7, desc: '交叉口→B站' },
      allowActions: ['drag_track'],
      check: () => Tutorial.helpers.stationInNetworkWithDepot('B'),
    },
    {
      id: 's16',
      text: '线路扩展好了，点<span class="tut-hl">「开始运营」</span>。',
      highlight: { type: 'dom', selector: '#btn-start-day', desc: '开始运营按钮' },
      allowActions: [],
      check: () => G.phase === 'operate',
    },

    {
      id: 's17',
      text: '交叉路口那个<span class="tut-hl">小黑点</span>看到没？那就是<span class="tut-hl">道岔</span>。点一下试试——列车路径方向变了！',
      highlight: { type: 'zone', x: 15, y: 11, w: 3, h: 3, desc: '三向道岔' },
      allowActions: ['click_switch'],
      check: () => Tutorial.flags.switchToggled,
    },
    {
      id: 's18',
      text: '每次点道岔都会循环切换方向。试着多切几次，看列车跟着怎么走——<span class="tut-hl">进路控制</span>的核心就是这个。',
      highlight: null,
      allowActions: ['click_switch'],
      check: () => Tutorial.checkTimer(10),
    },
    {
      id: 's19',
      text: '白天结束了。你完整跑了两天的铁路调度运营！<br><br>站台 → 轨道 → 编组 → 运营 → 道岔<br><br>进入结算，恭喜完成教程！',
      highlight: null,
      allowActions: [],
      check: () => G.dayNumber === 3,
    },
  ],

  completeMessage: {
    title: '教程完成！',
    lines: [
      '你已经掌握了铁路调度的基本流程：',
      '修建轨道 → 建造站台 → 编组列车 → 运营调度 → 结算收入',
      '',
      '车站越多、线路越密，调度越有挑战。去自由模式里试试吧！',
    ],
    buttons: [
      { text: '返回主菜单', action: 'menu' },
      { text: '自由模式', action: 'freeplay' },
    ],
  },
};
