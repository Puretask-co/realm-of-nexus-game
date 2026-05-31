/**
 * Verdance Engine - Realm of Nexus
 * Central export hub for all game systems and tools.
 */

// Core
export { EventBus } from './core/EventBus.js';
export { GameConfig } from './core/GameConfig.js';

// Tool 1: Data-Driven Architecture
export { default as DataManager } from './systems/DataManager.js';

// Tool 2: Visual Level Editor
export { InspectorPanel } from './ui/InspectorPanel.js';

// Tool 3: Advanced Lighting System
export { default as AdvancedLightingSystem } from './systems/AdvancedLightingSystem.js';
export { SapCycleLightingIntegration } from './integration/SapCycleLightingIntegration.js';
export { default as SpellVFXIntegration } from './integration/SpellVFXIntegration.js';
export { default as TacticalCombatCameraBridge } from './integration/TacticalCombatCameraBridge.js';

// Tool 4: Advanced Particle System
export { default as AdvancedParticleSystem } from './systems/AdvancedParticleSystem.js';

// Tool 5: Advanced Camera System
export { default as AdvancedCameraSystem } from './systems/AdvancedCameraSystem.js';

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
export { InventoryPanel } from './ui/InventoryPanel.js';
export { SkillTreePanel } from './ui/SkillTreePanel.js';

// Player Class System
export { PlayerClassSystem } from './systems/PlayerClassSystem.js';

// Game Systems
export { default as SapCycleManager } from './systems/SapCycleManager.js';
export { default as CooldownManager } from './systems/CooldownManager.js';
export { ProgressionSystem } from './systems/ProgressionSystem.js';
export { AISystem } from './systems/AISystem.js';
export { default as SaveManager } from './systems/SaveManager.js';
export { default as PerformanceProfiler } from './systems/PerformanceProfiler.js';

// Design-Doc Aligned Systems
export { TacticalCombatSystem } from './systems/TacticalCombatSystem.js';
export { DSPSystem } from './systems/DSPSystem.js';
export { AttributeSystem } from './systems/AttributeSystem.js';
export { FactionSystem } from './systems/FactionSystem.js';
export { VeilkeeperSystem } from './systems/VeilkeeperSystem.js';
export { NarrativeSystem } from './systems/NarrativeSystem.js';
export { MoralChoiceSystem } from './systems/MoralChoiceSystem.js';
export { CompanionSystem } from './systems/CompanionSystem.js';
export { CraftingSystem } from './systems/CraftingSystem.js';
export { SkillCheckSystem } from './systems/SkillCheckSystem.js';
export { DifficultySystem } from './systems/DifficultySystem.js';
export { AIDungeonMaster } from './systems/AIDungeonMaster.js';

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
