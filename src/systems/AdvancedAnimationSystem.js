import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * AdvancedAnimationSystem - Comprehensive animation system for Verdance.
 * Provides sprite and skeletal animation support with state machines,
 * blend trees, animation layers, root motion, IK, and procedural animation.
 */
export class AdvancedAnimationSystem {
  static instance = null;

  constructor(scene) {
    if (AdvancedAnimationSystem.instance) return AdvancedAnimationSystem.instance;

    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.animators = new Map();
    this.clipLibrary = new Map();
    this.globalSpeed = 1.0;
    this.debugMode = false;

    AdvancedAnimationSystem.instance = this;
  }

  static getInstance(scene) {
    if (!AdvancedAnimationSystem.instance && scene) new AdvancedAnimationSystem(scene);
    return AdvancedAnimationSystem.instance;
  }

  // ─── Clip Library ─────────────────────────────────────────────────

  registerClip(id, config) {
    const clip = {
      id,
      key: config.key || id,
      frames: config.frames || [],
      frameRate: config.frameRate || 10,
      repeat: config.repeat !== undefined ? config.repeat : -1,
      yoyo: config.yoyo || false,
      duration: config.duration || null,
      events: config.events || [],
      rootMotion: config.rootMotion || null,
      blendMask: config.blendMask || null
    };
    this.clipLibrary.set(id, clip);

    // Create Phaser animation if frames specified
    if (config.key && config.frames && !this.scene.anims.exists(id)) {
      this.scene.anims.create({
        key: id,
        frames: this.scene.anims.generateFrameNumbers(config.key, {
          start: config.frames[0] || 0,
          end: config.frames[1] || config.frames[0] || 0
        }),
        frameRate: clip.frameRate,
        repeat: clip.repeat,
        yoyo: clip.yoyo
      });
    }

    return clip;
  }

  getClip(id) {
    return this.clipLibrary.get(id) || null;
  }

  // ─── Animator Management ──────────────────────────────────────────

  createAnimator(entityId, sprite, config = {}) {
    const animator = new Animator(this, entityId, sprite, config);
    this.animators.set(entityId, animator);
    this.eventBus.emit('animation:animatorCreated', { entityId });
    return animator;
  }

  getAnimator(entityId) {
    return this.animators.get(entityId) || null;
  }

  removeAnimator(entityId) {
    const animator = this.animators.get(entityId);
    if (animator) {
      animator.destroy();
      this.animators.delete(entityId);
    }
  }

  // ─── Update ───────────────────────────────────────────────────────

  update(time, delta) {
    const scaledDelta = delta * this.globalSpeed;
    for (const animator of this.animators.values()) {
      animator.update(time, scaledDelta);
    }
  }

  // ─── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    let totalLayers = 0;
    let totalStateMachines = 0;
    for (const animator of this.animators.values()) {
      totalLayers += animator.layers.length;
      totalStateMachines += animator.stateMachine ? 1 : 0;
    }
    return {
      animatorCount: this.animators.size,
      clipCount: this.clipLibrary.size,
      totalLayers,
      totalStateMachines,
      globalSpeed: this.globalSpeed
    };
  }

  destroy() {
    for (const animator of this.animators.values()) {
      animator.destroy();
    }
    this.animators.clear();
    this.clipLibrary.clear();
    AdvancedAnimationSystem.instance = null;
  }
}

/**
 * Animator - Per-entity animation controller.
 * Manages animation state machine, layers, blending, root motion, and IK.
 */
export class Animator {
  constructor(system, entityId, sprite, config = {}) {
    this.system = system;
    this.entityId = entityId;
    this.sprite = sprite;
    this.eventBus = EventBus.getInstance();

    // Animation state
    this.currentClip = null;
    this.currentTime = 0;
    this.speed = config.speed || 1.0;
    this.playing = false;
    this.paused = false;

    // Blending
    this.blendFrom = null;
    this.blendTo = null;
    this.blendDuration = 0;
    this.blendElapsed = 0;
    this.isBlending = false;

    // Layers
    this.layers = [];
    if (config.layers) {
      for (const layerConfig of config.layers) {
        this.addLayer(layerConfig);
      }
    } else {
      this.addLayer({ name: 'Base', weight: 1.0 });
    }

    // State machine
    this.stateMachine = null;
    if (config.stateMachine) {
      this.stateMachine = new AnimationStateMachine(this, config.stateMachine);
    }

    // Root motion
    this.rootMotionEnabled = config.rootMotion || false;
    this.rootMotionDelta = { x: 0, y: 0 };
    this.rootMotionAccumulated = { x: 0, y: 0 };

    // IK
    this.ikTargets = new Map();
    this.ikEnabled = config.ik || false;

    // Parameters (used by state machine conditions)
    this.parameters = new Map();
    if (config.parameters) {
      for (const [key, value] of Object.entries(config.parameters)) {
        this.parameters.set(key, value);
      }
    }

    // Frame events
    this.eventListeners = new Map();
  }

  // ─── Playback Control ─────────────────────────────────────────────

  play(clipId, options = {}) {
    const clip = this.system.getClip(clipId);
    if (!clip) {
      console.warn(`Animator: Unknown clip '${clipId}'`);
      return this;
    }

    const { crossfade = 0, layer = 0, restart = false } = options;

    if (crossfade > 0 && this.currentClip && this.currentClip.id !== clipId) {
      this.crossfadeTo(clipId, crossfade, layer);
      return this;
    }

    if (this.currentClip?.id === clipId && !restart) return this;

    this.currentClip = clip;
    this.currentTime = 0;
    this.playing = true;
    this.paused = false;

    if (this.sprite && this.sprite.anims && this.sprite.scene) {
      try {
        this.sprite.play(clipId, !restart);
      } catch (e) {
        // Animation may not exist in Phaser yet
      }
    }

    this.eventBus.emit('animation:play', { entityId: this.entityId, clip: clipId });
    return this;
  }

  stop() {
    this.playing = false;
    if (this.sprite?.anims) {
      this.sprite.anims.stop();
    }
    this.eventBus.emit('animation:stop', { entityId: this.entityId });
    return this;
  }

  pause() {
    this.paused = true;
    if (this.sprite?.anims) {
      this.sprite.anims.pause();
    }
    return this;
  }

  resume() {
    this.paused = false;
    if (this.sprite?.anims) {
      this.sprite.anims.resume();
    }
    return this;
  }

  // ─── Crossfade / Blending ─────────────────────────────────────────

  crossfadeTo(clipId, duration = 0.3, layerIndex = 0) {
    const clip = this.system.getClip(clipId);
    if (!clip) return this;

    this.blendFrom = this.currentClip;
    this.blendTo = clip;
    this.blendDuration = duration;
    this.blendElapsed = 0;
    this.isBlending = true;

    this.currentClip = clip;
    this.currentTime = 0;
    this.playing = true;

    if (this.sprite?.anims && this.sprite.scene) {
      try {
        this.sprite.play(clipId);
      } catch (e) { /* skip */ }
    }

    this.eventBus.emit('animation:crossfade', {
      entityId: this.entityId,
      from: this.blendFrom?.id,
      to: clipId,
      duration
    });

    return this;
  }

  // ─── Layers ───────────────────────────────────────────────────────

  addLayer(config = {}) {
    const layer = {
      name: config.name || `Layer_${this.layers.length}`,
      weight: config.weight !== undefined ? config.weight : 1.0,
      currentClip: null,
      blendMode: config.blendMode || 'override', // override, additive
      mask: config.mask || null, // array of body part names to affect
      speed: config.speed || 1.0,
      active: config.active !== false
    };
    this.layers.push(layer);
    return this.layers.length - 1;
  }

  setLayerWeight(layerIndex, weight) {
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].weight = Phaser.Math.Clamp(weight, 0, 1);
    }
    return this;
  }

  setLayerClip(layerIndex, clipId) {
    if (this.layers[layerIndex]) {
      this.layers[layerIndex].currentClip = this.system.getClip(clipId);
    }
    return this;
  }

  // ─── Parameters ───────────────────────────────────────────────────

  setParameter(name, value) {
    this.parameters.set(name, value);
    if (this.stateMachine) {
      this.stateMachine.checkTransitions();
    }
    return this;
  }

  getParameter(name) {
    return this.parameters.get(name);
  }

  setBool(name, value) { return this.setParameter(name, !!value); }
  setFloat(name, value) { return this.setParameter(name, Number(value)); }
  setInt(name, value) { return this.setParameter(name, Math.floor(value)); }
  setTrigger(name) {
    this.setParameter(name, true);
    // Triggers auto-reset after being consumed
    requestAnimationFrame(() => this.parameters.set(name, false));
    return this;
  }

  // ─── Root Motion ──────────────────────────────────────────────────

  enableRootMotion(enabled = true) {
    this.rootMotionEnabled = enabled;
    return this;
  }

  getRootMotionDelta() {
    const delta = { ...this.rootMotionDelta };
    this.rootMotionDelta.x = 0;
    this.rootMotionDelta.y = 0;
    return delta;
  }

  // ─── IK (Inverse Kinematics) ──────────────────────────────────────

  setIKTarget(boneName, target) {
    this.ikTargets.set(boneName, {
      x: target.x,
      y: target.y,
      weight: target.weight !== undefined ? target.weight : 1.0
    });
    return this;
  }

  clearIKTarget(boneName) {
    this.ikTargets.delete(boneName);
    return this;
  }

  solveIK(chain, targetX, targetY, iterations = 10) {
    // Simple FABRIK-style IK solver for 2D bone chains
    if (!chain || chain.length < 2) return;

    const bones = chain.map(b => ({ x: b.x, y: b.y }));
    const lengths = [];
    for (let i = 0; i < bones.length - 1; i++) {
      const dx = bones[i + 1].x - bones[i].x;
      const dy = bones[i + 1].y - bones[i].y;
      lengths.push(Math.sqrt(dx * dx + dy * dy));
    }

    const rootX = bones[0].x;
    const rootY = bones[0].y;

    for (let iter = 0; iter < iterations; iter++) {
      // Forward reaching (from end effector to root)
      bones[bones.length - 1].x = targetX;
      bones[bones.length - 1].y = targetY;

      for (let i = bones.length - 2; i >= 0; i--) {
        const dx = bones[i].x - bones[i + 1].x;
        const dy = bones[i].y - bones[i + 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const ratio = lengths[i] / dist;
        bones[i].x = bones[i + 1].x + dx * ratio;
        bones[i].y = bones[i + 1].y + dy * ratio;
      }

      // Backward reaching (from root to end effector)
      bones[0].x = rootX;
      bones[0].y = rootY;

      for (let i = 0; i < bones.length - 1; i++) {
        const dx = bones[i + 1].x - bones[i].x;
        const dy = bones[i + 1].y - bones[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const ratio = lengths[i] / dist;
        bones[i + 1].x = bones[i].x + dx * ratio;
        bones[i + 1].y = bones[i].y + dy * ratio;
      }
    }

    // Apply solved positions back to chain
    for (let i = 0; i < chain.length; i++) {
      chain[i].x = bones[i].x;
      chain[i].y = bones[i].y;
    }
  }

  // ─── Frame Events ─────────────────────────────────────────────────

  onEvent(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
    return this;
  }

  offEvent(eventName, callback) {
    if (this.eventListeners.has(eventName)) {
      const list = this.eventListeners.get(eventName).filter(cb => cb !== callback);
      this.eventListeners.set(eventName, list);
    }
    return this;
  }

  fireEvent(eventName, data = {}) {
    const listeners = this.eventListeners.get(eventName) || [];
    for (const cb of listeners) {
      cb({ ...data, entityId: this.entityId });
    }
    this.eventBus.emit('animation:event', {
      entityId: this.entityId,
      event: eventName,
      ...data
    });
  }

  // ─── Update ───────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.playing || this.paused) return;

    const dt = (delta / 1000) * this.speed;
    this.currentTime += dt;

    // Update state machine
    if (this.stateMachine) {
      this.stateMachine.update(time, delta);
    }

    // Update blending
    if (this.isBlending) {
      this.blendElapsed += dt;
      if (this.blendElapsed >= this.blendDuration) {
        this.isBlending = false;
        this.blendFrom = null;
      }
    }

    // Update layers
    for (const layer of this.layers) {
      if (!layer.active) continue;
      // Layer-specific animation updates would go here
    }

    // Process root motion
    if (this.rootMotionEnabled && this.currentClip?.rootMotion) {
      const rm = this.currentClip.rootMotion;
      const normalizedTime = this.currentClip.duration ? (this.currentTime % this.currentClip.duration) / this.currentClip.duration : 0;
      this.rootMotionDelta.x = (rm.x || 0) * dt;
      this.rootMotionDelta.y = (rm.y || 0) * dt;
      this.rootMotionAccumulated.x += this.rootMotionDelta.x;
      this.rootMotionAccumulated.y += this.rootMotionDelta.y;
    }

    // Process IK
    if (this.ikEnabled && this.ikTargets.size > 0) {
      this.processIK();
    }

    // Check frame events
    if (this.currentClip?.events) {
      for (const event of this.currentClip.events) {
        if (event.time !== undefined) {
          const prevTime = this.currentTime - dt;
          if (prevTime < event.time && this.currentTime >= event.time) {
            this.fireEvent(event.name, event.data || {});
          }
        }
        if (event.normalizedTime !== undefined && this.currentClip.duration) {
          const norm = (this.currentTime % this.currentClip.duration) / this.currentClip.duration;
          const prevNorm = ((this.currentTime - dt) % this.currentClip.duration) / this.currentClip.duration;
          if (prevNorm < event.normalizedTime && norm >= event.normalizedTime) {
            this.fireEvent(event.name, event.data || {});
          }
        }
      }
    }
  }

  processIK() {
    // Look-at IK for sprite facing
    for (const [boneName, target] of this.ikTargets) {
      if (boneName === 'lookAt' && this.sprite) {
        const dx = target.x - this.sprite.x;
        const dy = target.y - this.sprite.y;
        const angle = Math.atan2(dy, dx);
        // Apply to sprite rotation with weight blending
        this.sprite.rotation = Phaser.Math.Linear(
          this.sprite.rotation,
          angle,
          target.weight * 0.1
        );
      }
    }
  }

  destroy() {
    this.playing = false;
    this.layers = [];
    this.parameters.clear();
    this.ikTargets.clear();
    this.eventListeners.clear();
    this.stateMachine = null;
  }
}

/**
 * AnimationStateMachine - State machine for managing animation transitions.
 * Supports states, transitions with conditions, blend trees, and sub-state machines.
 */
export class AnimationStateMachine {
  constructor(animator, config = {}) {
    this.animator = animator;
    this.states = new Map();
    this.transitions = [];
    this.anyStateTransitions = [];
    this.currentState = null;
    this.previousState = null;
    this.stateTime = 0;

    // Build from config
    if (config.states) {
      for (const stateConfig of config.states) {
        this.addState(stateConfig);
      }
    }
    if (config.transitions) {
      for (const transConfig of config.transitions) {
        this.addTransition(transConfig);
      }
    }
    if (config.anyStateTransitions) {
      for (const transConfig of config.anyStateTransitions) {
        this.addAnyStateTransition(transConfig);
      }
    }
    if (config.defaultState) {
      this.setState(config.defaultState);
    }
  }

  addState(config) {
    const state = {
      name: config.name,
      clip: config.clip || null,
      blendTree: config.blendTree || null,
      speed: config.speed || 1.0,
      onEnter: config.onEnter || null,
      onExit: config.onExit || null,
      onUpdate: config.onUpdate || null,
      subMachine: config.subMachine ? new AnimationStateMachine(this.animator, config.subMachine) : null,
      transitions: []
    };
    this.states.set(config.name, state);
    return state;
  }

  addTransition(config) {
    const transition = {
      from: config.from,
      to: config.to,
      conditions: config.conditions || [],
      duration: config.duration || 0.2,
      exitTime: config.exitTime || null, // null = can transition any time, 0-1 = normalized exit time
      hasExitTime: config.hasExitTime || false,
      interruptible: config.interruptible !== false,
      priority: config.priority || 0
    };

    this.transitions.push(transition);

    // Also add to state's transition list
    const state = this.states.get(config.from);
    if (state) {
      state.transitions.push(transition);
    }

    return transition;
  }

  addAnyStateTransition(config) {
    const transition = {
      to: config.to,
      conditions: config.conditions || [],
      duration: config.duration || 0.15,
      interruptible: config.interruptible !== false,
      priority: config.priority || 0,
      canTransitionToSelf: config.canTransitionToSelf || false
    };
    this.anyStateTransitions.push(transition);
    return transition;
  }

  setState(stateName) {
    const newState = this.states.get(stateName);
    if (!newState) {
      console.warn(`AnimationStateMachine: Unknown state '${stateName}'`);
      return;
    }

    if (this.currentState) {
      if (this.currentState.onExit) this.currentState.onExit(this.animator);
      this.previousState = this.currentState;
    }

    this.currentState = newState;
    this.stateTime = 0;

    if (newState.onEnter) newState.onEnter(this.animator);

    // Play the associated animation
    if (newState.clip) {
      this.animator.play(newState.clip, { crossfade: 0.2 });
    } else if (newState.blendTree) {
      this.evaluateBlendTree(newState.blendTree);
    }

    // Enter sub-machine
    if (newState.subMachine && newState.subMachine.states.size > 0) {
      const defaultSub = newState.subMachine.states.keys().next().value;
      newState.subMachine.setState(defaultSub);
    }

    this.animator.eventBus.emit('animation:stateChanged', {
      entityId: this.animator.entityId,
      from: this.previousState?.name,
      to: stateName
    });
  }

  checkTransitions() {
    if (!this.currentState) return;

    // Check any-state transitions first (higher priority)
    for (const transition of this.anyStateTransitions) {
      if (!transition.canTransitionToSelf && this.currentState.name === transition.to) continue;
      if (this.evaluateConditions(transition.conditions)) {
        this.setState(transition.to);
        return;
      }
    }

    // Check current state transitions (sorted by priority)
    const sorted = [...this.currentState.transitions].sort((a, b) => b.priority - a.priority);
    for (const transition of sorted) {
      // Check exit time
      if (transition.hasExitTime && transition.exitTime !== null) {
        if (this.currentState.clip) {
          const clip = this.animator.system.getClip(this.currentState.clip);
          if (clip?.duration) {
            const normalizedTime = (this.stateTime % clip.duration) / clip.duration;
            if (normalizedTime < transition.exitTime) continue;
          }
        }
      }

      if (this.evaluateConditions(transition.conditions)) {
        this.setState(transition.to);
        return;
      }
    }
  }

  evaluateConditions(conditions) {
    for (const condition of conditions) {
      const paramValue = this.animator.getParameter(condition.parameter);
      if (paramValue === undefined) return false;

      switch (condition.comparison) {
        case 'equals':
        case '==':
          if (paramValue !== condition.value) return false;
          break;
        case 'notEquals':
        case '!=':
          if (paramValue === condition.value) return false;
          break;
        case 'greater':
        case '>':
          if (paramValue <= condition.value) return false;
          break;
        case 'less':
        case '<':
          if (paramValue >= condition.value) return false;
          break;
        case 'greaterOrEqual':
        case '>=':
          if (paramValue < condition.value) return false;
          break;
        case 'lessOrEqual':
        case '<=':
          if (paramValue > condition.value) return false;
          break;
        case 'true':
          if (!paramValue) return false;
          break;
        case 'false':
          if (paramValue) return false;
          break;
        default:
          if (paramValue !== condition.value) return false;
      }
    }
    return true;
  }

  // ─── Blend Trees ──────────────────────────────────────────────────

  evaluateBlendTree(blendTree) {
    if (!blendTree) return;

    const paramValue = this.animator.getParameter(blendTree.parameter);
    if (paramValue === undefined) return;

    if (blendTree.type === '1D') {
      this.evaluate1DBlendTree(blendTree, paramValue);
    } else if (blendTree.type === '2D') {
      const paramValue2 = this.animator.getParameter(blendTree.parameter2);
      this.evaluate2DBlendTree(blendTree, paramValue, paramValue2 || 0);
    }
  }

  evaluate1DBlendTree(tree, paramValue) {
    // Find the two closest motion thresholds and blend between them
    const motions = tree.motions.sort((a, b) => a.threshold - b.threshold);
    let lowerMotion = motions[0];
    let upperMotion = motions[motions.length - 1];

    for (let i = 0; i < motions.length - 1; i++) {
      if (paramValue >= motions[i].threshold && paramValue <= motions[i + 1].threshold) {
        lowerMotion = motions[i];
        upperMotion = motions[i + 1];
        break;
      }
    }

    const range = upperMotion.threshold - lowerMotion.threshold;
    const blend = range > 0 ? (paramValue - lowerMotion.threshold) / range : 0;

    // For sprite animation, play the dominant clip
    const dominantClip = blend < 0.5 ? lowerMotion.clip : upperMotion.clip;
    this.animator.play(dominantClip, { crossfade: 0.15 });

    // Adjust speed based on blend position
    const speedLower = lowerMotion.speed || 1.0;
    const speedUpper = upperMotion.speed || 1.0;
    this.animator.speed = Phaser.Math.Linear(speedLower, speedUpper, blend);
  }

  evaluate2DBlendTree(tree, paramX, paramY) {
    // Simple 2D blend: find nearest motion based on distance
    let nearest = tree.motions[0];
    let nearestDist = Infinity;

    for (const motion of tree.motions) {
      const dx = paramX - (motion.posX || 0);
      const dy = paramY - (motion.posY || 0);
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = motion;
      }
    }

    if (nearest?.clip) {
      this.animator.play(nearest.clip, { crossfade: 0.15 });
      this.animator.speed = nearest.speed || 1.0;
    }
  }

  // ─── Update ───────────────────────────────────────────────────────

  update(time, delta) {
    const dt = delta / 1000;
    this.stateTime += dt;

    if (this.currentState?.onUpdate) {
      this.currentState.onUpdate(this.animator, dt);
    }

    // Update sub-machine
    if (this.currentState?.subMachine) {
      this.currentState.subMachine.update(time, delta);
    }

    // Re-evaluate blend tree if present
    if (this.currentState?.blendTree) {
      this.evaluateBlendTree(this.currentState.blendTree);
    }

    // Check transitions periodically
    this.checkTransitions();
  }

  getCurrentStateName() {
    return this.currentState?.name || null;
  }

  getStateTime() {
    return this.stateTime;
  }
}

/**
 * AnimationTimeline - Sequence-based animation for cutscenes and scripted events.
 * Allows scheduling animation actions on a timeline with precise timing.
 */
export class AnimationTimeline {
  constructor() {
    this.tracks = [];
    this.duration = 0;
    this.currentTime = 0;
    this.playing = false;
    this.loop = false;
    this.speed = 1.0;
    this.onComplete = null;
    this.executedKeys = new Set();
  }

  addTrack(entityId, keyframes) {
    const track = {
      entityId,
      keyframes: keyframes.sort((a, b) => a.time - b.time)
    };

    // Update total duration
    for (const kf of keyframes) {
      if (kf.time > this.duration) this.duration = kf.time;
    }

    this.tracks.push(track);
    return this;
  }

  play(speed = 1.0) {
    this.currentTime = 0;
    this.playing = true;
    this.speed = speed;
    this.executedKeys.clear();
    return this;
  }

  stop() {
    this.playing = false;
    return this;
  }

  pause() {
    this.playing = false;
    return this;
  }

  resume() {
    this.playing = true;
    return this;
  }

  seek(time) {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    return this;
  }

  update(delta) {
    if (!this.playing) return;

    const dt = (delta / 1000) * this.speed;
    this.currentTime += dt;

    // Process keyframes
    for (const track of this.tracks) {
      for (const kf of track.keyframes) {
        const key = `${track.entityId}_${kf.time}`;
        if (!this.executedKeys.has(key) && this.currentTime >= kf.time) {
          this.executedKeys.add(key);
          this.executeKeyframe(track.entityId, kf);
        }
      }
    }

    // Check completion
    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = 0;
        this.executedKeys.clear();
      } else {
        this.playing = false;
        if (this.onComplete) this.onComplete();
      }
    }
  }

  executeKeyframe(entityId, keyframe) {
    const animSystem = AdvancedAnimationSystem.getInstance();
    if (!animSystem) return;

    const animator = animSystem.getAnimator(entityId);
    if (!animator) return;

    switch (keyframe.action) {
      case 'play':
        animator.play(keyframe.clip, keyframe.options);
        break;
      case 'crossfade':
        animator.crossfadeTo(keyframe.clip, keyframe.duration);
        break;
      case 'setParameter':
        animator.setParameter(keyframe.parameter, keyframe.value);
        break;
      case 'trigger':
        animator.setTrigger(keyframe.trigger);
        break;
      case 'speed':
        animator.speed = keyframe.value;
        break;
      case 'callback':
        if (keyframe.callback) keyframe.callback(animator);
        break;
    }
  }

  getProgress() {
    return this.duration > 0 ? this.currentTime / this.duration : 0;
  }
}

export default AdvancedAnimationSystem;
