import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * AudioManager - Comprehensive audio system for Verdance.
 * Provides layered music, adaptive soundtrack, spatial audio,
 * sound pooling, crossfading, and Sap Cycle audio integration.
 */
export class AudioManager {
  static instance = null;

  constructor(scene) {
    if (AudioManager.instance) return AudioManager.instance;

    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // Volume settings
    this.masterVolume = 0.8;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    this.ambienceVolume = 0.4;
    this.voiceVolume = 1.0;

    // Music system
    this.currentMusic = null;
    this.musicQueue = [];
    this.musicLayers = new Map();
    this.musicCrossfading = false;
    this.musicCrossfadeFrom = null;
    this.musicCrossfadeTo = null;
    this.musicCrossfadeDuration = 0;
    this.musicCrossfadeElapsed = 0;

    // Adaptive music
    this.musicIntensity = 0; // 0 = calm, 1 = intense
    this.targetIntensity = 0;
    this.intensityLerpSpeed = 0.5;
    this.adaptiveLayers = [];

    // SFX pool
    this.sfxPool = new Map();
    this.sfxCooldowns = new Map();
    this.maxConcurrentSounds = 16;
    this.activeSounds = [];

    // Ambience
    this.currentAmbience = null;
    this.ambienceInstances = [];

    // Spatial audio
    this.listenerX = 0;
    this.listenerY = 0;
    this.spatialFalloff = 300; // Distance at which sound is at 50%
    this.maxAudioDistance = 800; // Beyond this, sounds are silent

    // Sap Cycle integration
    this.currentSapPhase = 'blue';
    this.phaseAudioProfiles = {
      blue: {
        reverbLevel: 0.3,
        filterFrequency: 2000,
        pitchShift: 0,
        layers: ['ethereal', 'calm']
      },
      crimson: {
        reverbLevel: 0.5,
        filterFrequency: 4000,
        pitchShift: 0.1,
        layers: ['aggressive', 'tension']
      },
      silver: {
        reverbLevel: 0.7,
        filterFrequency: 6000,
        pitchShift: -0.05,
        layers: ['mystical', 'wonder']
      }
    };

    // Audio ducking
    this.duckTargets = new Map();
    this.isDucking = false;

    // Sound categories for volume control
    this.categories = new Map([
      ['music', { volume: 1.0, sounds: [] }],
      ['sfx', { volume: 1.0, sounds: [] }],
      ['ambience', { volume: 1.0, sounds: [] }],
      ['voice', { volume: 1.0, sounds: [] }],
      ['ui', { volume: 1.0, sounds: [] }]
    ]);

    // Event listeners
    this.eventBus.on('sapCycle:phaseChanged', (data) => this.onSapPhaseChanged(data));
    this.eventBus.on('combat:started', () => this.onCombatStarted());
    this.eventBus.on('combat:ended', () => this.onCombatEnded());

    AudioManager.instance = this;
  }

  static getInstance(scene) {
    if (!AudioManager.instance && scene) new AudioManager(scene);
    return AudioManager.instance;
  }

  // ─── Music ────────────────────────────────────────────────────────

  playMusic(key, config = {}) {
    const {
      volume = 1.0,
      loop = true,
      crossfade = 1.5,
      restart = false
    } = config;

    // Already playing this track
    if (this.currentMusic?.key === key && !restart) return this.currentMusic;

    if (this.currentMusic && crossfade > 0) {
      this.crossfadeMusic(key, crossfade, volume, loop);
    } else {
      if (this.currentMusic) {
        this.currentMusic.stop();
        this.currentMusic.destroy();
      }
      this.currentMusic = this.createSound(key, {
        volume: volume * this.musicVolume * this.masterVolume,
        loop
      });
      if (this.currentMusic) {
        this.currentMusic.play();
        this.currentMusic.setData?.('category', 'music');
      }
    }

    this.eventBus.emit('audio:musicChanged', { key });
    return this.currentMusic;
  }

  crossfadeMusic(toKey, duration = 1.5, volume = 1.0, loop = true) {
    this.musicCrossfading = true;
    this.musicCrossfadeFrom = this.currentMusic;
    this.musicCrossfadeDuration = duration;
    this.musicCrossfadeElapsed = 0;

    const targetVolume = volume * this.musicVolume * this.masterVolume;
    this.musicCrossfadeTo = this.createSound(toKey, { volume: 0, loop });
    if (this.musicCrossfadeTo) {
      this.musicCrossfadeTo.play();
      this.musicCrossfadeTo._targetVolume = targetVolume;
      this.currentMusic = this.musicCrossfadeTo;
    }
  }

  stopMusic(fadeOut = 1.0) {
    if (!this.currentMusic) return;

    if (fadeOut > 0) {
      this.fadeSound(this.currentMusic, 0, fadeOut, () => {
        this.currentMusic?.stop();
        this.currentMusic?.destroy();
        this.currentMusic = null;
      });
    } else {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
    }
  }

  // ─── Music Layers ─────────────────────────────────────────────────

  addMusicLayer(id, key, config = {}) {
    const {
      volume = 0,
      loop = true,
      syncWithMain = true
    } = config;

    const sound = this.createSound(key, {
      volume: volume * this.musicVolume * this.masterVolume,
      loop
    });

    if (sound) {
      const layer = {
        id,
        key,
        sound,
        baseVolume: volume,
        targetVolume: volume,
        active: volume > 0,
        intensityRange: config.intensityRange || [0, 1],
        tags: config.tags || []
      };

      this.musicLayers.set(id, layer);

      if (syncWithMain && this.currentMusic?.isPlaying) {
        sound.play();
        // Attempt to sync timing
        if (this.currentMusic.seek) {
          sound.seek = this.currentMusic.seek;
        }
      } else {
        sound.play();
      }
    }

    return this;
  }

  setMusicLayerVolume(id, volume, fadeTime = 0.5) {
    const layer = this.musicLayers.get(id);
    if (!layer) return;

    layer.targetVolume = volume;
    layer.active = volume > 0;

    if (fadeTime <= 0) {
      layer.baseVolume = volume;
      layer.sound.setVolume(volume * this.musicVolume * this.masterVolume);
    }
    // Fade is handled in update()
  }

  removeMusicLayer(id) {
    const layer = this.musicLayers.get(id);
    if (layer) {
      layer.sound.stop();
      layer.sound.destroy();
      this.musicLayers.delete(id);
    }
  }

  clearMusicLayers() {
    for (const [id] of this.musicLayers) {
      this.removeMusicLayer(id);
    }
  }

  // ─── Adaptive Music ──────────────────────────────────────────────

  setMusicIntensity(intensity, immediate = false) {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
    if (immediate) {
      this.musicIntensity = this.targetIntensity;
      this.updateAdaptiveLayers();
    }
  }

  updateAdaptiveLayers() {
    for (const [id, layer] of this.musicLayers) {
      const [minIntensity, maxIntensity] = layer.intensityRange;

      if (this.musicIntensity >= minIntensity && this.musicIntensity <= maxIntensity) {
        // Calculate volume based on position within range
        const range = maxIntensity - minIntensity;
        const normalized = range > 0 ? (this.musicIntensity - minIntensity) / range : 1;
        this.setMusicLayerVolume(id, normalized);
      } else {
        this.setMusicLayerVolume(id, 0);
      }
    }
  }

  // ─── SFX ──────────────────────────────────────────────────────────

  playSFX(key, config = {}) {
    const {
      volume = 1.0,
      rate = 1.0,
      detune = 0,
      loop = false,
      delay = 0,
      x = null,
      y = null,
      cooldown = 0,
      category = 'sfx',
      randomPitch = 0
    } = config;

    // Check cooldown
    if (cooldown > 0) {
      const lastPlayed = this.sfxCooldowns.get(key) || 0;
      if (Date.now() - lastPlayed < cooldown) return null;
      this.sfxCooldowns.set(key, Date.now());
    }

    // Limit concurrent sounds
    this.cleanupActiveSounds();
    if (this.activeSounds.length >= this.maxConcurrentSounds) {
      // Remove oldest non-looping sound
      const toRemove = this.activeSounds.find(s => !s.loop);
      if (toRemove) {
        toRemove.stop();
        toRemove.destroy();
        this.activeSounds = this.activeSounds.filter(s => s !== toRemove);
      } else {
        return null; // All slots full with looping sounds
      }
    }

    // Calculate spatial volume
    let spatialVolume = 1.0;
    if (x !== null && y !== null) {
      spatialVolume = this.calculateSpatialVolume(x, y);
      if (spatialVolume <= 0) return null; // Too far to hear
    }

    // Apply random pitch variation
    let finalRate = rate;
    if (randomPitch > 0) {
      finalRate += (Math.random() * 2 - 1) * randomPitch;
    }

    const categoryVolume = this.categories.get(category)?.volume || 1.0;
    const finalVolume = volume * spatialVolume * this.sfxVolume * this.masterVolume * categoryVolume;

    const sound = this.createSound(key, {
      volume: finalVolume,
      rate: finalRate,
      detune,
      loop,
      delay
    });

    if (sound) {
      sound.play();
      sound._spatialX = x;
      sound._spatialY = y;
      sound._baseVolume = volume;
      sound._category = category;
      this.activeSounds.push(sound);

      sound.once('complete', () => {
        this.activeSounds = this.activeSounds.filter(s => s !== sound);
      });
    }

    return sound;
  }

  stopSFX(sound) {
    if (sound) {
      sound.stop();
      sound.destroy();
      this.activeSounds = this.activeSounds.filter(s => s !== sound);
    }
  }

  stopAllSFX() {
    for (const sound of [...this.activeSounds]) {
      sound.stop();
      sound.destroy();
    }
    this.activeSounds = [];
  }

  // ─── Ambience ─────────────────────────────────────────────────────

  playAmbience(key, config = {}) {
    const {
      volume = 1.0,
      loop = true,
      crossfade = 2.0
    } = config;

    const finalVolume = volume * this.ambienceVolume * this.masterVolume;

    if (this.currentAmbience && crossfade > 0) {
      this.fadeSound(this.currentAmbience, 0, crossfade, () => {
        this.currentAmbience?.stop();
        this.currentAmbience?.destroy();
      });
    }

    this.currentAmbience = this.createSound(key, { volume: 0, loop });
    if (this.currentAmbience) {
      this.currentAmbience.play();
      this.fadeSound(this.currentAmbience, finalVolume, crossfade);
    }

    this.eventBus.emit('audio:ambienceChanged', { key });
    return this.currentAmbience;
  }

  addAmbienceLayer(key, config = {}) {
    const { volume = 0.3, loop = true } = config;
    const finalVolume = volume * this.ambienceVolume * this.masterVolume;

    const sound = this.createSound(key, { volume: finalVolume, loop });
    if (sound) {
      sound.play();
      this.ambienceInstances.push(sound);
    }
    return sound;
  }

  stopAmbience(fadeOut = 2.0) {
    if (this.currentAmbience) {
      this.fadeSound(this.currentAmbience, 0, fadeOut, () => {
        this.currentAmbience?.stop();
        this.currentAmbience?.destroy();
        this.currentAmbience = null;
      });
    }

    for (const amb of this.ambienceInstances) {
      this.fadeSound(amb, 0, fadeOut, () => {
        amb.stop();
        amb.destroy();
      });
    }
    this.ambienceInstances = [];
  }

  // ─── Spatial Audio ────────────────────────────────────────────────

  setListenerPosition(x, y) {
    this.listenerX = x;
    this.listenerY = y;
  }

  calculateSpatialVolume(soundX, soundY) {
    const dx = soundX - this.listenerX;
    const dy = soundY - this.listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= this.maxAudioDistance) return 0;
    if (distance <= 0) return 1;

    // Inverse distance falloff with a smooth curve
    return Math.max(0, 1 - (distance / this.maxAudioDistance));
  }

  calculateSpatialPan(soundX) {
    const dx = soundX - this.listenerX;
    const panRange = this.spatialFalloff * 2;
    return Math.max(-1, Math.min(1, dx / panRange));
  }

  updateSpatialSounds() {
    for (const sound of this.activeSounds) {
      if (sound._spatialX !== null && sound._spatialY !== null) {
        const volume = this.calculateSpatialVolume(sound._spatialX, sound._spatialY);
        const categoryVolume = this.categories.get(sound._category)?.volume || 1.0;
        sound.setVolume(sound._baseVolume * volume * this.sfxVolume * this.masterVolume * categoryVolume);
      }
    }
  }

  // ─── Audio Ducking ────────────────────────────────────────────────

  duck(category, targetVolume = 0.3, duration = 0.5) {
    const cat = this.categories.get(category);
    if (!cat) return;

    this.duckTargets.set(category, {
      originalVolume: cat.volume,
      targetVolume,
      duration,
      elapsed: 0
    });
    this.isDucking = true;
  }

  unduck(category, duration = 0.5) {
    const target = this.duckTargets.get(category);
    if (!target) return;

    target.targetVolume = target.originalVolume;
    target.duration = duration;
    target.elapsed = 0;
  }

  // ─── Volume Controls ──────────────────────────────────────────────

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setAmbienceVolume(volume) {
    this.ambienceVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setCategoryVolume(category, volume) {
    const cat = this.categories.get(category);
    if (cat) cat.volume = Math.max(0, Math.min(1, volume));
  }

  updateAllVolumes() {
    if (this.currentMusic) {
      this.currentMusic.setVolume(this.musicVolume * this.masterVolume);
    }
    for (const [, layer] of this.musicLayers) {
      layer.sound.setVolume(layer.baseVolume * this.musicVolume * this.masterVolume);
    }
    if (this.currentAmbience) {
      this.currentAmbience.setVolume(this.ambienceVolume * this.masterVolume);
    }
  }

  // ─── Sap Cycle Integration ────────────────────────────────────────

  onSapPhaseChanged(data) {
    const { phase, previousPhase } = data;
    this.currentSapPhase = phase;

    const profile = this.phaseAudioProfiles[phase];
    if (!profile) return;

    // Activate phase-specific music layers
    for (const [id, layer] of this.musicLayers) {
      const shouldActivate = layer.tags.some(t => profile.layers.includes(t));
      this.setMusicLayerVolume(id, shouldActivate ? 0.7 : 0, 2.0);
    }

    this.eventBus.emit('audio:sapPhaseAudio', { phase, profile });
  }

  onCombatStarted() {
    this.setMusicIntensity(0.7);
    this.duck('ambience', 0.3, 1.0);
  }

  onCombatEnded() {
    this.setMusicIntensity(0);
    this.unduck('ambience', 2.0);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  createSound(key, config = {}) {
    try {
      if (this.scene.cache.audio.exists(key)) {
        return this.scene.sound.add(key, config);
      }
    } catch (e) {
      // Audio not loaded yet
    }
    console.warn(`AudioManager: Audio key '${key}' not found`);
    return null;
  }

  fadeSound(sound, targetVolume, duration, onComplete = null) {
    if (!sound || !this.scene) return;

    this.scene.tweens.add({
      targets: sound,
      volume: targetVolume,
      duration: duration * 1000,
      ease: 'Linear',
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
  }

  cleanupActiveSounds() {
    this.activeSounds = this.activeSounds.filter(s => {
      if (!s || !s.isPlaying) {
        try { s?.destroy(); } catch (e) { /* already destroyed */ }
        return false;
      }
      return true;
    });
  }

  // ─── Update ───────────────────────────────────────────────────────

  update(time, delta) {
    const dt = delta / 1000;

    // Music crossfade
    if (this.musicCrossfading) {
      this.musicCrossfadeElapsed += dt;
      const progress = Math.min(1, this.musicCrossfadeElapsed / this.musicCrossfadeDuration);

      if (this.musicCrossfadeFrom) {
        this.musicCrossfadeFrom.setVolume(
          (1 - progress) * this.musicVolume * this.masterVolume
        );
      }
      if (this.musicCrossfadeTo) {
        this.musicCrossfadeTo.setVolume(
          progress * (this.musicCrossfadeTo._targetVolume || this.musicVolume * this.masterVolume)
        );
      }

      if (progress >= 1) {
        this.musicCrossfading = false;
        if (this.musicCrossfadeFrom) {
          this.musicCrossfadeFrom.stop();
          this.musicCrossfadeFrom.destroy();
          this.musicCrossfadeFrom = null;
        }
      }
    }

    // Adaptive music intensity lerp
    if (Math.abs(this.musicIntensity - this.targetIntensity) > 0.001) {
      this.musicIntensity += (this.targetIntensity - this.musicIntensity) * this.intensityLerpSpeed * dt;
      this.updateAdaptiveLayers();
    }

    // Music layer volume fading
    for (const [, layer] of this.musicLayers) {
      if (Math.abs(layer.baseVolume - layer.targetVolume) > 0.001) {
        layer.baseVolume += (layer.targetVolume - layer.baseVolume) * 3 * dt;
        layer.sound.setVolume(layer.baseVolume * this.musicVolume * this.masterVolume);
      }
    }

    // Audio ducking
    if (this.isDucking) {
      let stillDucking = false;
      for (const [category, duck] of this.duckTargets) {
        duck.elapsed += dt;
        const progress = Math.min(1, duck.elapsed / duck.duration);
        const cat = this.categories.get(category);
        if (cat) {
          cat.volume = Phaser.Math.Linear(cat.volume, duck.targetVolume, progress);
        }
        if (progress < 1) stillDucking = true;
        else if (Math.abs(cat.volume - duck.originalVolume) < 0.01) {
          this.duckTargets.delete(category);
        }
      }
      if (!stillDucking && this.duckTargets.size === 0) {
        this.isDucking = false;
      }
    }

    // Update spatial sounds
    this.updateSpatialSounds();

    // Cleanup
    this.cleanupActiveSounds();
  }

  // ─── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    return {
      musicPlaying: this.currentMusic?.isPlaying || false,
      musicKey: this.currentMusic?.key || 'none',
      musicLayers: this.musicLayers.size,
      musicIntensity: this.musicIntensity,
      activeSFX: this.activeSounds.length,
      ambiencePlaying: this.currentAmbience?.isPlaying || false,
      sapPhase: this.currentSapPhase,
      masterVolume: this.masterVolume
    };
  }

  destroy() {
    this.stopMusic(0);
    this.stopAllSFX();
    this.stopAmbience(0);
    this.clearMusicLayers();
    AudioManager.instance = null;
  }
}

export default AudioManager;
