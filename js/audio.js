const AudioMgr = (() => {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let initialized = false;

  let masterEnabled = true;
  let sfxEnabled = true;
  let musicEnabled = true;
  let sfxVol = 0.7;
  let musicVol = 0.2;

  const SETTINGS_KEY = 'mini_rail_audio';

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      masterEnabled = s.masterEnabled !== false;
      sfxEnabled = s.sfxEnabled !== false;
      musicEnabled = s.musicEnabled !== false;
      sfxVol = s.sfxVol != null ? s.sfxVol : 0.7;
      musicVol = s.musicVol != null ? s.musicVol : 0.2;
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        masterEnabled, sfxEnabled, musicEnabled, sfxVol, musicVol,
      }));
    } catch (e) { /* ignore */ }
  }

  function ensureContext() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();

    masterGain = ctx.createGain();
    masterGain.gain.value = masterEnabled ? 1 : 0;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = musicVol;
    musicGain.connect(masterGain);

    initialized = true;
  }

  function resume() {
    ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function _synth(cfg) {
    if (!ctx || !initialized) return;
    const {
      wave = 'sine', frequency = 440, duration = 0.1,
      attack = 0.01, decay = 0, sustain = 1, release = 0.05,
      filterFreq = 0, Q = 1, gain = 1, destGain = sfxGain, when = 0,
    } = cfg;

    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = frequency;

    let node = osc;
    let filter = null;
    if (filterFreq > 0) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = Q;
      osc.connect(filter);
      node = filter;
    }

    const envGain = ctx.createGain();
    const now = ctx.currentTime + when;
    const peak = gain;
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(peak, now + attack);
    if (decay > 0) envGain.gain.linearRampToValueAtTime(peak * sustain, now + attack + decay);
    envGain.gain.setValueAtTime(peak * sustain, now + Math.max(attack + decay, duration - release));
    envGain.gain.linearRampToValueAtTime(0, now + duration);

    node.connect(envGain);
    envGain.connect(destGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);
    const total = (duration + 0.2) * 1000 + when * 1000;
    setTimeout(() => {
      osc.disconnect();
      if (filter) filter.disconnect();
      envGain.disconnect();
    }, total);
  }

  function _synthNoise(cfg) {
    if (!ctx || !initialized) return;
    const {
      duration = 0.1, attack = 0.01, release = 0.05,
      bandpass = 0, Q = 1, gain = 1, destGain = sfxGain, when = 0,
    } = cfg;

    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    let node = src;
    let filter = null;
    if (bandpass > 0) {
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = bandpass;
      filter.Q.value = Q;
      src.connect(filter);
      node = filter;
    }

    const envGain = ctx.createGain();
    const now = ctx.currentTime + when;
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(gain, now + attack);
    envGain.gain.setValueAtTime(gain, now + duration - release);
    envGain.gain.linearRampToValueAtTime(0, now + duration);

    node.connect(envGain);
    envGain.connect(destGain);

    src.start(now);
    const total = (duration + 0.2) * 1000 + when * 1000;
    setTimeout(() => {
      src.disconnect();
      if (filter) filter.disconnect();
      envGain.disconnect();
    }, total);
  }

  function play(name) {
    if (!masterEnabled || !sfxEnabled) return;
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const vol = sfxVol;

    switch (name) {
      case 'track_place':
        _synthNoise({ duration: 0.04, bandpass: 1400, Q: 1.2, attack: 0.002, release: 0.02, gain: 0.5 * vol });
        break;
      case 'platform_place':
        _synth({ wave: 'sine', frequency: 150, duration: 0.12, attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.06, gain: 0.7 * vol });
        break;
      case 'eraser':
        _synthNoise({ duration: 0.1, bandpass: 450, Q: 0.8, attack: 0.01, release: 0.05, gain: 0.35 * vol });
        break;
      case 'undo':
        _synth({ wave: 'triangle', frequency: 440, duration: 0.07, attack: 0.004, release: 0.03, gain: 0.4 * vol });
        _synth({ wave: 'triangle', frequency: 330, duration: 0.09, attack: 0.004, release: 0.04, gain: 0.4 * vol, when: 0.06 });
        break;
      case 'buy_success':
        _synth({ wave: 'sine', frequency: 880, duration: 0.22, attack: 0.008, decay: 0.05, sustain: 0.35, release: 0.1, gain: 0.5 * vol });
        _synth({ wave: 'sine', frequency: 1318.5, duration: 0.3, attack: 0.008, decay: 0.08, sustain: 0.3, release: 0.12, gain: 0.5 * vol, when: 0.09 });
        break;
      case 'buy_fail':
        _synth({ wave: 'sawtooth', frequency: 80, duration: 0.28, attack: 0.02, release: 0.1, filterFreq: 260, Q: 2, gain: 0.5 * vol });
        break;
      case 'train_departure':
        if (ctx) {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(440, now + 0.3);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.35 * vol, now + 0.05);
          g.gain.linearRampToValueAtTime(0.001, now + 0.55);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now);
          osc.stop(now + 0.6);
          setTimeout(() => { osc.disconnect(); g.disconnect(); }, 700);
        }
        break;
      case 'train_arrive':
        _synth({ wave: 'sine', frequency: 880, duration: 0.32, attack: 0.005, decay: 0.12, sustain: 0.4, release: 0.12, gain: 0.4 * vol });
        _synth({ wave: 'sine', frequency: 1318.5, duration: 0.35, attack: 0.005, decay: 0.14, sustain: 0.35, release: 0.12, gain: 0.35 * vol, when: 0.08 });
        break;
      case 'train_board':
        _synthNoise({ duration: 0.18, bandpass: 500, Q: 0.7, attack: 0.03, release: 0.06, gain: 0.25 * vol });
        _synth({ wave: 'sine', frequency: 392, duration: 0.12, attack: 0.01, decay: 0.04, sustain: 0.5, release: 0.05, gain: 0.2 * vol });
        break;
      case 'switch_clack':
        _synthNoise({ duration: 0.03, bandpass: 2400, Q: 2, attack: 0.001, release: 0.008, gain: 0.6 * vol });
        _synth({ wave: 'square', frequency: 900, duration: 0.02, attack: 0.001, release: 0.008, gain: 0.2 * vol });
        break;
      case 'emergency_brake':
        _synth({ wave: 'sawtooth', frequency: 200, duration: 0.5, attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.15, filterFreq: 400, Q: 1.5, gain: 0.5 * vol });
        _synthNoise({ duration: 0.35, bandpass: 800, Q: 1, attack: 0.02, release: 0.1, gain: 0.3 * vol });
        break;
      case 'day_start':
        _synth({ wave: 'sine', frequency: 440, duration: 0.9, attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.3, gain: 0.45 * vol });
        _synth({ wave: 'sine', frequency: 554.37, duration: 0.9, attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.3, gain: 0.45 * vol, when: 0.18 });
        _synth({ wave: 'sine', frequency: 659.25, duration: 1.1, attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.35, gain: 0.45 * vol, when: 0.36 });
        break;
      case 'pause':
        _synth({ wave: 'sine', frequency: 660, duration: 0.09, attack: 0.004, release: 0.03, gain: 0.35 * vol });
        break;
      case 'settlement':
        _synth({ wave: 'sine', frequency: 523.25, duration: 0.6, attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.2, gain: 0.45 * vol });
        _synth({ wave: 'sine', frequency: 659.25, duration: 0.6, attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.2, gain: 0.45 * vol, when: 0.16 });
        _synth({ wave: 'sine', frequency: 783.99, duration: 0.9, attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.35, gain: 0.45 * vol, when: 0.32 });
        break;
      case 'gameover':
        _synth({ wave: 'triangle', frequency: 440, duration: 0.7, attack: 0.06, decay: 0.1, sustain: 0.5, release: 0.25, gain: 0.5 * vol });
        _synth({ wave: 'triangle', frequency: 349.23, duration: 0.8, attack: 0.06, decay: 0.1, sustain: 0.5, release: 0.3, gain: 0.5 * vol, when: 0.35 });
        _synth({ wave: 'triangle', frequency: 261.63, duration: 1.2, attack: 0.06, decay: 0.1, sustain: 0.5, release: 0.5, gain: 0.5 * vol, when: 0.7 });
        break;
      case 'congestion_warning':
        _synth({ wave: 'triangle', frequency: 440, duration: 0.14, attack: 0.008, release: 0.05, gain: 0.4 * vol });
        _synth({ wave: 'triangle', frequency: 440, duration: 0.14, attack: 0.008, release: 0.05, gain: 0.4 * vol, when: 0.25 });
        break;
      case 'flash':
        _synth({ wave: 'sine', frequency: 620, duration: 0.08, attack: 0.004, release: 0.025, gain: 0.3 * vol });
        break;
      default:
        break;
    }
  }

  // ── BGM ──
  const BGM_CHORDS = [
    [196.00, 246.94, 293.66, 392.00, 493.88],   // G大调  G3 B3 D4 G4 B4
    [261.63, 329.63, 392.00, 523.25, 659.25],   // C大调  C4 E4 G4 C5 E5
    [293.66, 369.99, 440.00, 587.33, 739.99],   // D大调  D4 F#4 A4 D5 F#5
    [196.00, 246.94, 293.66, 392.00, 493.88],   // G大调  回归主和弦
  ];

  let _musicPhase = 'none';   // 'none' | 'build' | 'operate'
  let _musicTimer = null;
  let _musicTick = 0;
  let _musicChordIdx = 0;
  let _arpeggioIdx = 0;
  let _arpeggioDir = 1;

  function _nextArpeggioNote(chordLen) {
    _arpeggioIdx += _arpeggioDir;
    if (_arpeggioIdx >= chordLen) { _arpeggioIdx = chordLen - 2; _arpeggioDir = -1; }
    if (_arpeggioIdx < 0) { _arpeggioIdx = 1; _arpeggioDir = 1; }
    return _arpeggioIdx;
  }

  function _playMusicNote() {
    if (!initialized || !ctx || !musicEnabled || _musicPhase === 'none') return;
    const chord = BGM_CHORDS[_musicChordIdx % BGM_CHORDS.length];

    if (_musicPhase === 'build') {
      const noteIdx = _nextArpeggioNote(chord.length);
      _synth({
        wave: 'triangle', frequency: chord[noteIdx], duration: 0.85,
        attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.35,
        gain: 0.4, destGain: musicGain,
      });
      if (_musicTick % 8 === 0) {
        _synth({
          wave: 'sine', frequency: chord[0] / 2, duration: 0.18,
          attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.06,
          gain: 0.3, destGain: musicGain,
        });
      }
    } else {
      for (let k = 0; k < 2; k++) {
        const noteIdx = _nextArpeggioNote(chord.length);
        _synth({
          wave: 'triangle', frequency: chord[noteIdx], duration: 0.6,
          attack: 0.015, decay: 0.2, sustain: 0.3, release: 0.25,
          gain: 0.4, destGain: musicGain, when: k * 0.24,
        });
      }
      const bassFreq = (_musicTick % 2 === 0) ? chord[0] / 2 : chord[0] * 0.75;
      _synth({
        wave: 'sine', frequency: bassFreq, duration: 0.12,
        attack: 0.008, decay: 0.06, sustain: 0.2, release: 0.04,
        gain: 0.3, destGain: musicGain,
      });
      if (_musicTick % 2 === 1) {
        _synthNoise({
          duration: 0.03, bandpass: 5200, Q: 1,
          attack: 0.002, release: 0.02, gain: 0.1, destGain: musicGain,
        });
      }
      if (_musicTick % 8 === 4) {
        _synth({
          wave: 'sine', frequency: chord[4] * 1.5, duration: 0.45,
          attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.2,
          gain: 0.12, destGain: musicGain,
        });
      }
    }

    if (_musicTick % 16 === 15) _musicChordIdx++;
    _musicTick++;
  }

  function _stopTimer() {
    if (_musicTimer) { clearInterval(_musicTimer); _musicTimer = null; }
  }

  function _applyMusic() {
    if (!initialized || !ctx) return;
    if (!masterEnabled || !musicEnabled || _musicPhase === 'none') {
      _stopTimer();
      return;
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!_musicTimer) {
      _musicTimer = setInterval(_playMusicNote, _musicPhase === 'build' ? 700 : 480);
    }
  }

  function startMusic(phase) { setMusicPhase(phase); }

  function stopMusic() { setMusicPhase('none'); }

  function setMusicPhase(phase) {
    if (_musicPhase === phase && _musicTimer) return;
    _musicPhase = phase;
    _musicTick = 0;
    _musicChordIdx = 0;
    _arpeggioIdx = 0;
    _arpeggioDir = 1;
    _stopTimer();
    ensureContext();
    _applyMusic();
  }

  function setSfxVolume(v) {
    sfxVol = v;
    if (sfxGain) sfxGain.gain.value = v;
    saveSettings();
  }

  function setMusicVolume(v) {
    musicVol = v;
    if (musicGain) musicGain.gain.value = v;
    saveSettings();
  }

  function setSfxEnabled(v) {
    sfxEnabled = !!v;
    saveSettings();
  }

  function setMusicEnabled(v) {
    musicEnabled = !!v;
    _applyMusic();
    saveSettings();
  }

  function setMasterEnabled(v) {
    masterEnabled = !!v;
    if (masterGain) masterGain.gain.value = masterEnabled ? 1 : 0;
    _applyMusic();
    saveSettings();
  }

  loadSettings();

  return {
    resume,
    suspend,
    play,
    startMusic,
    stopMusic,
    setMusicPhase,
    setSfxVolume,
    setMusicVolume,
    setSfxEnabled,
    setMusicEnabled,
    setMasterEnabled,
    get masterEnabled() { return masterEnabled; },
    get sfxEnabled() { return sfxEnabled; },
    get musicEnabled() { return musicEnabled; },
    get sfxVol() { return sfxVol; },
    get musicVol() { return musicVol; },
    get initialized() { return initialized; },
  };
})();
