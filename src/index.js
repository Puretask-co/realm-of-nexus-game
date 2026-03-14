/**
 * Verdance Engine - Realm of Nexus
 * Central export hub for all game systems and tools.
 */

// Core
export { EventBus } from './core/EventBus.js';
export { GameConfig } from './core/GameConfig.js';

// Tool 1: Data-Driven Architecture
export { default as DataManager } from './systems/DataManager.js';
export { CSVDataLoader } from './systems/CSVDataLoader.js';

// Tool 2: Visual Level Editor
export { SceneLoader } from './systems/SceneLoader.js';
export { InspectorPanel } from './ui/InspectorPanel.js';
export { HotReloadOverlay } from './ui/HotReloadOverlay.js';
export { HotReloadSystem } from './systems/HotReloadSystem.js';

// Tool 3: Advanced Lighting System
export { default as AdvancedLightingSystem } from './systems/AdvancedLightingSystem.js';
export { SapCycleLightingIntegration } from './integration/SapCycleLightingIntegration.js';

// Tool 4: Advanced Particle System
export { default as AdvancedParticleSystem } from './systems/AdvancedParticleSystem.js';
export { ParticleCollisionSystem } from './systems/ParticleCollisionSystem.js';
export { SpellParticleIntegration } from './integration/SpellParticleIntegration.js';

// Tool 5: Advanced Camera System
export { default as AdvancedCameraSystem } from './systems/AdvancedCameraSystem.js';
export { CombatCameraIntegration } from './integration/CombatCameraIntegration.js';
export { ScreenSpaceEffects } from './effects/ScreenSpaceEffects.js';
export { CameraZoneSystem } from './systems/CameraZoneSystem.js';

// Tool 6: Animation System
export { AdvancedAnimationSystem, Animator, AnimationStateMachine, AnimationTimeline } from './systems/AdvancedAnimationSystem.js';

// Tool 7: Audio Manager
export { AudioManager } from './systems/AudioManager.js';

// Tool 8: Dialogue System
export { DialogueSystem } from './systems/DialogueSystem.js';

// Tool 9: Quest & Progression System
export { QuestSystem } from './systems/QuestSystem.js';

// Tool 10: UI Framework
export { UIFramework } from './ui/UIFramework.js';
export { HUDPanel } from './ui/HUDPanel.js';
export { InventoryPanel } from './ui/InventoryPanel.js';
export { SkillTreePanel } from './ui/SkillTreePanel.js';
export { MainMenuPanel } from './ui/MainMenuPanel.js';

// Player Class System
export { PlayerClassSystem } from './systems/PlayerClassSystem.js';

// Game Systems
export { default as SapCycleManager } from './systems/SapCycleManager.js';
export { default as CooldownManager } from './systems/CooldownManager.js';
export { CombatSystem } from './systems/CombatSystem.js';
export { SpellSystem } from './systems/SpellSystem.js';
export { ProgressionSystem } from './systems/ProgressionSystem.js';
export { AISystem } from './systems/AISystem.js';
export { default as SaveManager } from './systems/SaveManager.js';
export { default as PerformanceProfiler } from './systems/PerformanceProfiler.js';

// Components
export { default as Player } from './components/Player.js';
export { default as Enemy } from './components/Enemy.js';
export { default as NPC } from './components/NPC.js';
export { default as Projectile } from './components/Projectile.js';

// Pipelines
export { default as NormalMapPipeline } from './pipelines/NormalMapPipeline.js';
export { default as PostProcessingPipeline } from './pipelines/PostProcessingPipeline.js';

// Renderers
export { default as DamageNumberRenderer } from './renderers/DamageNumberRenderer.js';
export { default as MinimapRenderer } from './renderers/MinimapRenderer.js';

// Schemas
export { spellSchema } from './schemas/spellSchema.js';
export { enemySchema } from './schemas/enemySchema.js';
export { itemSchema } from './schemas/itemSchema.js';
export { locationSchema } from './schemas/locationSchema.js';

// Configs
export { sceneFormatSpec, createBlankScene } from './configs/sceneFormatSpec.js';
