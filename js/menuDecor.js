const MenuDecor = {
  canvas: null,
  ctx: null,
  animId: null,
  trainT: 0,
  trainDir: 1,
  pulseT: 0,

  stations: [
    { x: 50,  y: 120, color: '#E84A4A' },
    { x: 240, y: 40,  color: '#4A90D9' },
    { x: 240, y: 170, color: '#50B86C' },
  ],
  depot: { x: 290, y: 220 },
  path: [
    { x: 50,  y: 120 },
    { x: 145, y: 120 },
    { x: 170, y: 90 },
    { x: 240, y: 40  },
    { x: 170, y: 90 },
    { x: 240, y: 170 },
    { x: 290, y: 220 },
  ],

  init() {
    this.canvas = document.getElementById('menu-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 340;
    this.canvas.height = 260;
    this.loop();
  },

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
  },

  loop() {
    this.trainT += 0.0012 * this.trainDir;
    if (this.trainT >= 1) { this.trainT = 1; this.trainDir = -1; }
    if (this.trainT <= 0) { this.trainT = 0; this.trainDir = +1; }
    this.pulseT += 0.03;
    this.draw();
    this.animId = requestAnimationFrame(() => this.loop());
  },

  pointOnPath(t) {
    const idx = t * (this.path.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    if (i >= this.path.length - 1) return { ...this.path[this.path.length - 1] };
    const a = this.path[i];
    const b = this.path[i + 1];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  },

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = '#DDD8CE';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.stroke();

    const s = 1 + Math.sin(this.pulseT) * 0.05;
    for (const st of this.stations) {
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(this.depot.x - 5, this.depot.y - 5, 10, 10);

    const p = this.pointOnPath(this.trainT);
    ctx.fillStyle = '#E8734A';
    ctx.beginPath();
    this.roundRect(ctx, p.x - 10, p.y - 4, 20, 8, 3);
    ctx.fill();

    const passengers = [
      { sx: 50, sy: 105, c: '#E84A4A', phase: 0 },
      { sx: 240, sy: 155, c: '#50B86C', phase: 1.5 },
    ];
    for (const px of passengers) {
      const alpha = 0.3 + Math.abs(Math.sin(this.pulseT + px.phase)) * 0.5;
      ctx.fillStyle = px.c;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px.sx, px.sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  },
};
