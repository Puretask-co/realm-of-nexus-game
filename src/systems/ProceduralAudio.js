import { EventBus } from '../core/EventBus.js';

/**
 * ProceduralAudio — Synthesized sound effects and ambient music using the
 * Web Audio API. Requires zero audio files. All sounds are generated in real time.
 *
 * Ambient music adapts to the current Sap phase:
 *   Blue    → calm, slow drone + soft chimes
 *   Crimson → tense, low pulse + dissonant overtones
 *   Silver  → ethereal, high shimmer + reverb pad
 *
 * SFX triggered by EventBus events:
 *   spell-cast        → rising tone burst
 *   spell-impact      → sharp thud
 *   enemy-attack      → low crack
 *   enemy-defeated    → descending arpeggio
 *   player-levelup    → triumphant ascending chord
 *   player-hurt       → discordant burst
 *   ui-click          → soft tick
 *   loot-dropped      → coin chime
 *   dialogue-open     → soft whoosh
 *   quest:completed   → fanfare chord
 *   dsp:changed       → low hum pulse (when DSP < 30)
 */
export class ProceduralAudio {
    static instance = null;

    static getInstance() {
        if (!ProceduralAudio.instance) new ProceduralAudio();
        return ProceduralAudio.instance;
    }

    constructor() {
        if (ProceduralAudio.instance) return ProceduralAudio.instance;

        this.eb = EventBus.getInstance();
        this._ctx = null;
        this._masterGain = null;
        this._musicGain = null;
        this._sfxGain = null;
        this._ambientNodes = [];
        this._currentPhase = 'blue';

        this.masterVolume = 0.8;
        this.musicVolume  = 0.5;
        this.sfxVolume    = 0.8;
        this._muted = false;

        this._init();
        this._bindEvents();

        ProceduralAudio.instance = this;
    }

    _init() {
        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._masterGain = this._ctx.createGain();
            this._masterGain.gain.value = this.masterVolume;
            this._masterGain.connect(this._ctx.destination);

            this._musicGain = this._ctx.createGain();
            this._musicGain.gain.value = this.musicVolume;
            this._musicGain.connect(this._masterGain);

            this._sfxGain = this._ctx.createGain();
            this._sfxGain.gain.value = this.sfxVolume;
            this._sfxGain.connect(this._masterGain);

            // Start ambient music after a short delay (needs user gesture first)
            this._resumeCtx().then(() => this._startAmbient('blue'));
        } catch (e) {
            console.warn('[ProceduralAudio] Web Audio API not available:', e.message);
        }
    }

    async _resumeCtx() {
        if (this._ctx && this._ctx.state === 'suspended') {
            await this._ctx.resume();
        }
    }

    _bindEvents() {
        this.eb.on('spell-cast',         () => this.sfx('spellCast'));
        this.eb.on('spell-impact',        () => this.sfx('spellImpact'));
        this.eb.on('enemy-attack',        () => this.sfx('enemyAttack'));
        this.eb.on('enemy-defeated',      () => this.sfx('enemyDeath'));
        this.eb.on('player-levelup',      () => this.sfx('levelUp'));
        this.eb.on('player-hurt',         () => this.sfx('playerHurt'));
        this.eb.on('ui-click',            () => this.sfx('uiClick'));
        this.eb.on('loot-dropped',        () => this.sfx('lootDrop'));
        this.eb.on('dialogue-open',       () => this.sfx('dialogueOpen'));
        this.eb.on('quest:completed',     () => this.sfx('questComplete'));
        this.eb.on('save-complete',       () => this.sfx('uiClick'));
        this.eb.on('zone:discovered',     () => this.sfx('zoneDiscover'));

        this.eb.on('dsp:changed', (data) => {
            if (data?.current <= 30) this.sfx('dspWarning');
        });

        this.eb.on('sapCycle:phaseChanged', (data) => {
            if (data?.phase) this._changePhase(data.phase);
        });

        this.eb.on('combat:started', () => {
            this._setCombatIntensity(true);
        });
        this.eb.on('combat:ended', () => {
            this._setCombatIntensity(false);
        });

        this.eb.on('settings:volumeChanged', (data) => {
            this.setVolume(data.master, data.music, data.sfx);
        });

        // ── Equipment ──────────────────────────────────────────────
        this.eb.on('equipment:slotChanged', () => this.sfx('uiClick'));

        // ── Companions ─────────────────────────────────────────────
        this.eb.on('companion:recruited',   () => this.sfx('levelUp'));
        this.eb.on('companion:bondChanged', () => this.sfx('questComplete'));

        // ── Portal ─────────────────────────────────────────────────
        this.eb.on('portal:enter', () => this.sfx('zoneDiscover'));

        // ── Crafting ───────────────────────────────────────────────
        this.eb.on('crafting:success',          () => this.sfx('levelUp'));
        this.eb.on('crafting:recipeDiscovered', () => this.sfx('questComplete'));

        // ── DSP overload ───────────────────────────────────────────
        this.eb.on('dsp:overload', () => {
            this.sfx('dspWarning');
            this._playBoom();
        });

        // ── Tutorial / new game ────────────────────────────────────
        this.eb.on('game:newGameStarted', () => this.sfx('zoneDiscover'));

        // ── Home base ──────────────────────────────────────────────
        this.eb.on('homebase:exit', () => this.sfx('zoneDiscover'));
        this.eb.on('homebase:playerRested', () => {
            this.sfx('levelUp');
            this._playRestChime();
        });
    }

    // ── Boom SFX (deep resonant, used for DSP overload) ───────────

    _playBoom() {
        try {
            const ctx = this._ctx;
            if (!ctx) return;
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.5);
            gain.gain.setValueAtTime(0.6 * this.masterVolume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
            osc.start();
            osc.stop(ctx.currentTime + 1.5);
        } catch {}
    }

    // ── Soft rest chime (home base rest) ──────────────────────────

    _playRestChime() {
        try {
            const ctx = this._ctx;
            if (!ctx) return;
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, i) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                const s = ctx.currentTime + i * 0.18;
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.12 * this.masterVolume, s);
                gain.gain.exponentialRampToValueAtTime(0.001, s + 1.2);
                osc.connect(gain);
                gain.connect(this._sfxGain);
                osc.start(s);
                osc.stop(s + 1.2);
            });
        } catch {}
    }

    // ── Volume control ────────────────────────────────────────────────

    setVolume(master, music, sfx) {
        if (!this._ctx) return;
        if (master !== undefined) {
            this.masterVolume = master;
            this._masterGain.gain.setTargetAtTime(master, this._ctx.currentTime, 0.1);
        }
        if (music !== undefined) {
            this.musicVolume = music;
            this._musicGain.gain.setTargetAtTime(music, this._ctx.currentTime, 0.1);
        }
        if (sfx !== undefined) {
            this.sfxVolume = sfx;
            this._sfxGain.gain.setTargetAtTime(sfx, this._ctx.currentTime, 0.1);
        }
    }

    // ── SFX synthesis ────────────────────────────────────────────────

    sfx(name) {
        if (!this._ctx || this._muted) return;
        this._resumeCtx();
        const fn = this[`_sfx_${name}`];
        if (fn) fn.call(this);
    }

    _sfx_spellCast() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.3);
    }

    _sfx_spellImpact() {
        const t = this._ctx.currentTime;
        // Noise burst
        const buf = this._ctx.createBuffer(1, this._ctx.sampleRate * 0.15, this._ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
        const source = this._ctx.createBufferSource();
        source.buffer = buf;
        const filter = this._ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        const gain = this._ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        source.connect(filter); filter.connect(gain); gain.connect(this._sfxGain);
        source.start(t);
    }

    _sfx_enemyAttack() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.12);
    }

    _sfx_enemyDeath() {
        const t = this._ctx.currentTime;
        [440, 330, 220, 150].forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            const start = t + i * 0.06;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
            osc.connect(gain); gain.connect(this._sfxGain);
            osc.start(start); osc.stop(start + 0.15);
        });
    }

    _sfx_levelUp() {
        const t = this._ctx.currentTime;
        const chord = [261.63, 329.63, 392.00, 523.25]; // C major
        chord.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            const start = t + i * 0.08;
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.setValueAtTime(0.25, start + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
            osc.connect(gain); gain.connect(this._sfxGain);
            osc.start(start); osc.stop(start + 0.8);
        });
    }

    _sfx_playerHurt() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.1);
    }

    _sfx_uiClick() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.06);
    }

    _sfx_lootDrop() {
        const t = this._ctx.currentTime;
        [1046, 1318, 1568].forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            const s = t + i * 0.07;
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, s);
            gain.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
            osc.connect(gain); gain.connect(this._sfxGain);
            osc.start(s); osc.stop(s + 0.25);
        });
    }

    _sfx_dialogueOpen() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.2);
    }

    _sfx_questComplete() {
        const t = this._ctx.currentTime;
        const notes = [392, 494, 587, 784]; // G major
        notes.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            const s = t + i * 0.1;
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, s);
            gain.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
            osc.connect(gain); gain.connect(this._sfxGain);
            osc.start(s); osc.stop(s + 0.5);
        });
    }

    _sfx_zoneDiscover() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(660, t + 0.25);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.4);
    }

    _sfx_dspWarning() {
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 110;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.setValueAtTime(0.08, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain); gain.connect(this._sfxGain);
        osc.start(t); osc.stop(t + 0.4);
    }

    // ── Ambient music ─────────────────────────────────────────────────

    _startAmbient(phase) {
        if (!this._ctx) return;
        this._stopAmbient();
        this._currentPhase = phase;

        const profiles = {
            blue: {
                // Calm forest: slow pad drone + soft high chimes
                drones: [82.4, 110, 164.8],  // E2, A2, E3
                tempo: 0.4, filterFreq: 800, shimmer: true
            },
            crimson: {
                // Tense: low pulse + dissonant overtones
                drones: [73.4, 98, 146.8],   // D2, G2, D3
                tempo: 0.9, filterFreq: 1200, shimmer: false
            },
            silver: {
                // Ethereal: high shimmer + wide reverb
                drones: [196, 246.9, 329.6], // G3, B3, E4
                tempo: 0.25, filterFreq: 2400, shimmer: true
            }
        };

        const profile = profiles[phase] || profiles.blue;
        this._buildDronePad(profile);
    }

    _buildDronePad(profile) {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;

        profile.drones.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gainNode = this._ctx.createGain();
            const filter = this._ctx.createBiquadFilter();

            osc.type = i === 0 ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;
            osc.detune.value = (i * 7) - 3; // slight detuning for warmth

            filter.type = 'lowpass';
            filter.frequency.value = profile.filterFreq;
            filter.Q.value = 1.5;

            const vol = i === 0 ? 0.04 : 0.025;
            gainNode.gain.setValueAtTime(0, t);
            gainNode.gain.linearRampToValueAtTime(vol, t + 3); // fade in slowly

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this._musicGain);
            osc.start(t);

            this._ambientNodes.push(osc, gainNode, filter);
        });

        // Add shimmer (high-freq sparkle) for blue and silver phases
        if (profile.shimmer) {
            this._scheduleShimmer(profile.tempo);
        }
    }

    _scheduleShimmer(interval) {
        if (!this._ctx) return;
        const freqs = [1046, 1174, 1318, 1568, 1760];

        const tick = () => {
            if (!this._ctx || this._shimmerStopped) return;
            const t = this._ctx.currentTime;
            const freq = freqs[Math.floor(Math.random() * freqs.length)];
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.015, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
            osc.connect(gain); gain.connect(this._musicGain);
            osc.start(t); osc.stop(t + 0.8);
            this._shimmerTimer = setTimeout(tick, (interval + Math.random() * interval) * 1000);
        };

        this._shimmerStopped = false;
        this._shimmerTimer = setTimeout(tick, 500);
    }

    _stopAmbient() {
        this._shimmerStopped = true;
        clearTimeout(this._shimmerTimer);
        const t = this._ctx?.currentTime ?? 0;
        this._ambientNodes.forEach(node => {
            try {
                if (node.gain) {
                    node.gain.setTargetAtTime(0, t, 1.5);
                } else if (node.stop) {
                    node.stop(t + 3);
                }
            } catch {}
        });
        this._ambientNodes = [];
    }

    _changePhase(phase) {
        if (phase === this._currentPhase) return;
        this._currentPhase = phase;
        this._stopAmbient();
        setTimeout(() => this._startAmbient(phase), 1500); // brief silence between phases
    }

    _setCombatIntensity(inCombat) {
        if (!this._musicGain || !this._ctx) return;
        const targetVol = inCombat ? this.musicVolume * 0.3 : this.musicVolume;
        this._musicGain.gain.setTargetAtTime(targetVol, this._ctx.currentTime, 1.0);
    }
}

export default ProceduralAudio;
