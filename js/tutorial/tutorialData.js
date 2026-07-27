const TUTORIAL_DATA = {
  id: 'full_tutorial',
  title: '铁路调度入门',
  version: 2,

  mapPreset: {
    gridW: 32,
    gridH: 24,
    startingResources: { gold: 100, trackFragments: 12, platformComponents: 5, wagons: 4 },
    stations: [
      { id: 'A', x: 8,  y: 12, color: '#E84A4A', flowLevel: 30 },
      { id: 'B', x: 18, y: 10, color: '#4A90D9', flowLevel: 20, appearsOnDay: 2 },
      { id: 'C', x: 20, y: 12, color: '#50B86C', flowLevel: 40 },
    ],
    depot: { x: 24, y: 12 },
    prebuiltEdges: (() => {
      const pairs = [];
      const k = (x, y) => x + ',' + y;
      for (let x = 20; x >= 15; x--) {
        pairs.push([k(x, 12), k(x - 1, 12)]);
      }
      return pairs;
    })(),
  },

  steps: [
    {
      id: 's1',
      text: '先给车站装站台。点底部<span class="tut-hl">「站台」</span>，在<span class="tut-hl">A站</span>（红色虚线框）内<span class="tut-hl">横向拖拽</span>——方向决定朝向，拉 2 格即可。',
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
      text: '好，<span class="tut-hl">C站</span>（绿色框）也来一段——同样<span class="tut-hl">横向拖拽</span>，拉 2 格。',
      highlight: { type: 'zone', x: 18, y: 10, w: 7, h: 5, desc: 'C站' },
      allowActions: ['drag_platform'],
      check: () => G.platforms.some(p => p.stationId === 'C'),
    },
    {
      id: 's3',
      text: '站台就位，开始铺铁路。切到<span class="tut-hl">「铺轨」</span>，从A站向交叉路口方向拖拽画线。',
      highlight: [
        { type: 'dom', selector: '#tool-track', desc: '铺轨按钮' },
        { type: 'zone', x: 7, y: 10, w: 8, h: 5, desc: 'A→路口铁路' },
      ],
      phaseCheck: [
        () => G.selectedTool === 'track',
        null,
      ],
      allowActions: ['drag_track'],
      check: () => Tutorial.helpers.pathBetweenStations('A', 'C') && Tutorial.helpers.nodeConnected('14,12'),
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
      text: '继续往右画，从<span class="tut-hl">C站</span>延伸轨道到<span class="tut-hl">车辆段</span>——这样列车才能从段里开上正线。',
      highlight: { type: 'zone', x: 19, y: 10, w: 7, h: 5, desc: 'C→车辆段' },
      allowActions: ['drag_track'],
      bubblePin: 'bottom-center',
      check: () => Tutorial.helpers.depotConnected(),
    },
    {
      id: 's6a',
      text: '来，造一列车。点地图上的<span class="tut-hl">紫色车辆段</span>，打开编组菜单。',
      highlight: { type: 'zone', x: 22, y: 10, w: 5, h: 5, desc: '车辆段' },
      allowActions: ['click_depot'],
      check: () => {
        const rp = document.getElementById('right-panel');
        if (rp && rp.classList.contains('hidden')) return false;
        return rp && rp.innerHTML.includes('车辆段');
      },
    },
    {
      id: 's6b',
      text: '用 <span class="tut-hl">+/−</span> 调车厢数，然后点<span class="tut-hl">「创建」</span>——造一列列车，等一下发车用。',
      highlight: { type: 'dom', selector: '#right-panel', desc: '车辆段面板' },
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
      highlight: { type: 'zone', x: 22, y: 10, w: 5, h: 5, desc: '车辆段' },
      allowActions: ['click_depot'],
      check: () => G.activeTrains.length >= 1,
    },
    {
      id: 's9',
      text: '列车自动跑起来了！到站停车、乘客上下，全程自动驾驶。<br>试试右上角<span class="tut-hl">倍速按钮</span>——调成 3x 或 5x 看看加速效果。',
      highlight: { type: 'dom', selector: '#time-control', desc: '倍速控制' },
      allowActions: [],
      bubblePin: 'bottom-center',
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
      bubblePin: 'bottom-center',
      check: () => Tutorial.flags.usedReverse,
    },
    {
      id: 's12',
      text: '注意顶部<span class="tut-hl">满意度</span> 🙂。运人效率高，满意度涨、客流多；积压严重，满意度掉、客流少。<br>这是循环反馈——客流越多调度压力越大。',
      highlight: { type: 'dom', selector: '#satisfaction-label', desc: '满意度' },
      allowActions: [],
      bubblePin: 'top-right',
      check: () => Tutorial.checkTimer(8),
    },
    {
      id: 's13',
      text: '天快黑了。结算时会自动弹出<span class="tut-hl">结算面板</span>——看看今天运了多少人、挣了多少。',
      highlight: null,
      allowActions: [],
      bubblePin: 'bottom-center',
      check: () => G.dayNumber === 2,
    },

    {
      id: 's14',
      text: '新的一天。地图上多了个<span class="tut-hl">B站</span>（蓝色虚线框）——先给它建一段站台。',
      highlight: { type: 'zone', x: 16, y: 8, w: 5, h: 5, desc: 'B站' },
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
      text: '从交叉路口的<span class="tut-hl">黑点</span>（道岔节点）向B站<span class="tut-hl">↘ 斜向</span>拖拽铺轨。<br>必须从黑点直接走斜线——如果先横后竖走直角折线，道岔无法切换到这个方向！',
      highlight: { type: 'zone', x: 14, y: 9, w: 5, h: 4, desc: '路口→B站' },
      allowActions: ['drag_track'],
      bubblePin: 'bottom-center',
      check: () => (G.connectionMap['14,12'] || []).length >= 3 && Tutorial.helpers.stationInNetworkWithDepot('B'),
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
      highlight: { type: 'zone', x: 13, y: 11, w: 3, h: 3, desc: '三向道岔' },
      allowActions: ['click_switch'],
      check: () => Tutorial.flags.switchToggled,
    },
    {
      id: 's18',
      text: '每次点道岔都会循环切换方向。试着多切几次，看列车跟着怎么走——<span class="tut-hl">进路控制</span>的核心就是这个。',
      highlight: null,
      allowActions: ['click_switch'],
      bubblePin: 'bottom-center',
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
