import EventBus from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { QuestSystem } from './QuestSystem.js';
import { DialogueSystem } from './DialogueSystem.js';
import { PlayerClassSystem } from './PlayerClassSystem.js';

/**
 * ContentInitializer — Registers all game content (quests, dialogues, skills)
 * from data files into the respective systems.
 *
 * Called once during GameScene.create() after DataManager has loaded.
 */
export default class ContentInitializer {
    /**
     * Register all quests from data/quests.json into QuestSystem.
     */
    static registerQuests() {
        const questSystem = QuestSystem.getInstance();
        const quests = dataManager.getAllQuests();

        for (const quest of quests) {
            questSystem.registerQuest(quest);
        }

        // Register factions
        questSystem.registerFaction('grove_protectors', {
            name: 'Grove Protectors',
            description: 'The guardians of the Verdant Grove.',
            startReputation: 0
        });
        questSystem.registerFaction('shadow_court', {
            name: 'Shadow Court',
            description: 'The enigmatic beings of the Crystal Caverns.',
            startReputation: 0
        });

        // Register achievements
        questSystem.registerAchievement({
            id: 'first_blood',
            name: 'First Blood',
            description: 'Defeat your first enemy.',
            category: 'combat',
            conditions: [{ type: 'enemiesDefeated', count: 1 }],
            rewards: { experience: 25 },
            points: 10
        });
        questSystem.registerAchievement({
            id: 'guardian_slayer',
            name: 'Guardian Slayer',
            description: 'Defeat 10 Forest Guardians.',
            category: 'combat',
            conditions: [{ type: 'enemiesDefeated', count: 10 }],
            rewards: { experience: 100 },
            points: 25
        });
        questSystem.registerAchievement({
            id: 'explorer',
            name: 'Explorer',
            description: 'Discover 3 locations.',
            category: 'exploration',
            conditions: [{ type: 'locationsDiscovered', count: 3 }],
            rewards: { experience: 150 },
            points: 25
        });
        questSystem.registerAchievement({
            id: 'questmaster',
            name: 'Questmaster',
            description: 'Complete 5 quests.',
            category: 'progression',
            conditions: [{ type: 'questsCompleted', count: 5 }],
            rewards: { experience: 300 },
            points: 50
        });

        console.log(`[ContentInit] Registered ${quests.length} quests, 2 factions, 4 achievements`);
    }

    /**
     * Register all dialogues and characters from data/dialogues.json into DialogueSystem.
     */
    static registerDialogues(scene) {
        const dialogueSystem = DialogueSystem.getInstance(scene);
        const dialogueData = dataManager.getDialogueData();

        // Register characters
        for (const char of (dialogueData.characters || [])) {
            dialogueSystem.registerCharacter(char.id, char);
        }

        // Register dialogues
        for (const dialogue of (dialogueData.dialogues || [])) {
            dialogueSystem.registerDialogue(dialogue.id, dialogue);
        }

        console.log(`[ContentInit] Registered ${(dialogueData.characters || []).length} characters, ${(dialogueData.dialogues || []).length} dialogues`);
    }

    /**
     * Register all skills from data/skills.json into a SkillTreePanel.
     */
    static registerSkills(skillTreePanel) {
        if (!skillTreePanel) return;
        const skills = dataManager.getAllSkills();

        for (const skill of skills) {
            skillTreePanel.registerSkill(skill);
        }

        console.log(`[ContentInit] Registered ${skills.length} skills`);
    }

    /**
     * Wire the save-collect / save-restore events so all systems persist state.
     */
    static wireSaveSystem(systems) {
        const { questSystem, dialogueSystem, inventoryPanel, skillTreePanel } = systems;
        const classSystem = PlayerClassSystem.getInstance();

        EventBus.on('save-collect', (saveData) => {
            if (questSystem) saveData.quests = questSystem.saveState();
            if (dialogueSystem) saveData.dialogues = dialogueSystem.saveState();
            if (inventoryPanel) saveData.inventory = inventoryPanel.saveState();
            if (skillTreePanel) saveData.skills = skillTreePanel.saveState();
            saveData.playerClass = classSystem.serialize();
        });

        EventBus.on('save-restore', (saveData) => {
            if (saveData.quests && questSystem) questSystem.loadState(saveData.quests);
            if (saveData.dialogues && dialogueSystem) dialogueSystem.loadState(saveData.dialogues);
            if (saveData.inventory && inventoryPanel) inventoryPanel.loadState(saveData.inventory);
            if (saveData.skills && skillTreePanel) skillTreePanel.loadState(saveData.skills);
            if (saveData.playerClass) classSystem.deserialize(saveData.playerClass);
        });

        console.log('[ContentInit] Save system wired');
    }
}
