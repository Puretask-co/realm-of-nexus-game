import EventBus from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { QuestSystem } from './QuestSystem.js';
import { DialogueSystem } from './DialogueSystem.js';
import { PlayerClassSystem } from './PlayerClassSystem.js';

/**
 * ContentInitializer — Registers all game content (quests, dialogues, skills,
 * factions, narrative, veilkeepers) from data files into the respective systems.
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

        // Register legacy factions in QuestSystem for backward compat
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
        questSystem.registerAchievement({
            id: 'veilkeeper_friend',
            name: 'Keeper\'s Confidence',
            description: 'Consult a Veilkeeper 5 times.',
            category: 'exploration',
            conditions: [{ type: 'veilkeeperConsultations', count: 5 }],
            rewards: { experience: 200 },
            points: 30
        });
        questSystem.registerAchievement({
            id: 'faction_honored',
            name: 'Honored Ally',
            description: 'Reach reputation 30 with any faction.',
            category: 'social',
            conditions: [{ type: 'factionReputation', min: 30 }],
            rewards: { experience: 250 },
            points: 40
        });

        console.log(`[ContentInit] Registered ${quests.length} quests, 2 factions, 6 achievements`);
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
     * Register talent trees (GDD 5 trees) and optional legacy skills into SkillTreePanel.
     */
    static registerSkills(skillTreePanel) {
        if (!skillTreePanel) return;
        if (skillTreePanel.loadTalentTrees) {
            skillTreePanel.loadTalentTrees(dataManager.getTalentTrees());
        }
        const skills = dataManager.getAllSkills();
        for (const skill of skills) {
            if (skillTreePanel.registerSkill) skillTreePanel.registerSkill(skill);
        }
        const treeCount = dataManager.getTalentTrees?.()?.length ?? 0;
        console.log(`[ContentInit] Talent trees: ${treeCount}, legacy skills: ${skills.length}`);
    }

    /**
     * Register the 6 Verdance factions into FactionSystem.
     */
    static registerFactions(factionSystem) {
        if (!factionSystem) return;

        const factions = [
            { id: 'bloomguard', name: 'Bloomguard', description: 'Military protectors of the Canopy of Life. Front-line warriors who channel the strength of the great trees.' },
            { id: 'thornbinders', name: 'Thornbinders', description: 'Rogues, spies, and shadow operatives. They protect Verdance through subterfuge and stealth.' },
            { id: 'emerald_coven', name: 'Emerald Coven', description: 'Mages and scholars dedicated to understanding and preserving the Sap\'s mysteries.' },
            { id: 'wildkin_pact', name: 'Wildkin Pact', description: 'Rangers and nature spirits who maintain the wild balance between civilization and untamed forest.' },
            { id: 'sporecallers', name: 'Sporecaller Syndicate', description: 'Practitioners of decay magic who believe corruption is a natural part of the cycle.' },
            { id: 'sapling_consortium', name: 'Sapling Consortium', description: 'Crafters, merchants, and builders who form the economic backbone of Verdance.' }
        ];

        for (const faction of factions) {
            factionSystem.registerFaction(faction.id, faction);
        }

        console.log(`[ContentInit] Registered ${factions.length} factions`);
    }

    /**
     * Register narrative eras and acts from data/story.json into NarrativeSystem.
     */
    static registerNarrative(narrativeSystem) {
        if (!narrativeSystem) return;

        const storyData = dataManager.getStoryData ? dataManager.getStoryData() : null;
        if (storyData) {
            narrativeSystem.loadStoryData(storyData);
        }

        console.log('[ContentInit] Narrative system initialized with story data');
    }

    /**
     * Register Veilkeeper spirits from data/veilkeepers.json.
     */
    static registerVeilkeepers(veilkeeperSystem) {
        if (!veilkeeperSystem) return;

        // VeilkeeperSystem self-loads from dataManager in constructor
        const count = veilkeeperSystem.getAliveCount ? veilkeeperSystem.getAliveCount() : 0;
        console.log(`[ContentInit] Veilkeeper system initialized (${count} alive)`);
    }

    static registerCompanions(companionSystem) {
        if (!companionSystem) return;
        if (companionSystem.loadFromData) companionSystem.loadFromData();
        const count = companionSystem.getRecruited?.()?.length ?? 0;
        console.log(`[ContentInit] Companion system initialized (${companionSystem.companions?.size ?? 0} definitions, ${count} recruited)`);
    }

    /**
     * Wire the save-collect / save-restore events so all systems persist state.
     */
    static wireSaveSystem(systems) {
        const {
            questSystem, dialogueSystem, progressionSystem, inventoryPanel, skillTreePanel,
            dspSystem, factionSystem, narrativeSystem, moralChoiceSystem,
            companionSystem, attributeSystem, veilkeeperSystem, skillCheckSystem
        } = systems;
        const classSystem = PlayerClassSystem.getInstance();

        EventBus.on('save-collect', (saveData) => {
            if (questSystem) saveData.quests = questSystem.saveState();
            if (dialogueSystem) saveData.dialogues = dialogueSystem.saveState();
            if (progressionSystem?.serialize) saveData.progression = progressionSystem.serialize();
            if (inventoryPanel) saveData.inventory = inventoryPanel.saveState();
            if (skillTreePanel) saveData.skills = skillTreePanel.saveState();
            saveData.playerClass = classSystem.serialize();

            // New systems
            if (dspSystem?.saveState) saveData.dsp = dspSystem.saveState();
            if (factionSystem?.saveState) saveData.factions = factionSystem.saveState();
            if (narrativeSystem?.saveState) saveData.narrative = narrativeSystem.saveState();
            if (moralChoiceSystem?.saveState) saveData.moralChoices = moralChoiceSystem.saveState();
            if (companionSystem?.saveState) saveData.companions = companionSystem.saveState();
            if (attributeSystem?.saveState) saveData.attributes = attributeSystem.saveState();
            if (veilkeeperSystem?.saveState) saveData.veilkeepers = veilkeeperSystem.saveState();
            if (skillCheckSystem?.saveState) saveData.skillChecks = skillCheckSystem.saveState();
        });

        EventBus.on('save-restore', (saveData) => {
            if (saveData.quests && questSystem) questSystem.loadState(saveData.quests);
            if (saveData.dialogues && dialogueSystem) dialogueSystem.loadState(saveData.dialogues);
            if (saveData.progression && progressionSystem?.deserialize) progressionSystem.deserialize(saveData.progression);
            if (saveData.inventory && inventoryPanel) inventoryPanel.loadState(saveData.inventory);
            if (saveData.skills && skillTreePanel) skillTreePanel.loadState(saveData.skills);
            if (saveData.playerClass) classSystem.deserialize(saveData.playerClass);

            // New systems
            if (saveData.dsp && dspSystem?.loadState) dspSystem.loadState(saveData.dsp);
            if (saveData.factions && factionSystem?.loadState) factionSystem.loadState(saveData.factions);
            if (saveData.narrative && narrativeSystem?.loadState) narrativeSystem.loadState(saveData.narrative);
            if (saveData.moralChoices && moralChoiceSystem?.loadState) moralChoiceSystem.loadState(saveData.moralChoices);
            if (saveData.companions && companionSystem?.loadState) companionSystem.loadState(saveData.companions);
            if (saveData.attributes && attributeSystem?.loadState) attributeSystem.loadState(saveData.attributes);
            if (saveData.veilkeepers && veilkeeperSystem?.loadState) veilkeeperSystem.loadState(saveData.veilkeepers);
            if (saveData.skillChecks && skillCheckSystem?.loadState) skillCheckSystem.loadState(saveData.skillChecks);
        });

        console.log('[ContentInit] Save system wired (including new systems)');
    }
}
