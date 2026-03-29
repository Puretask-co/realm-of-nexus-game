import { DSPSystem } from './DSPSystem.js';
import { FactionSystem } from './FactionSystem.js';
import { NarrativeSystem } from './NarrativeSystem.js';

/**
 * EndingEvaluator — Determines which ending the player receives.
 *
 * Endings are prioritised in order; the first matching condition wins.
 * If no condition matches, the default 'fractured_balance' is returned.
 *
 * Faction mapping to spec concepts:
 *   verdant_circle  → wildkin_pact  (nature / restoration path)
 *   blighted_covenant → sporecallers (decay / corruption path)
 *   veilkeepers     → emerald_coven (Veil / arcane path)
 *
 * Hollowing: if tracked on player stats (player.stats.hollowing 0-100),
 *   hollow_silence fires at >= 80.  DSP <= 10 also fires it.
 */

const ENDINGS = {
    verdant_restoration: {
        id: 'verdant_restoration',
        title: 'The Verdant Restoration',
        description:
            'The forest breathes again. Corruption recedes from every root and river as ' +
            'the Sap surges with renewed life. The Wildkin Pact leads the great rekindling, ' +
            'and your name is sung in the groves for generations. The Verdance remembers.',
        epilogue:
            'In the years that follow, Hollowroot is rebuilt. The Crystal Caverns fill ' +
            'with clean water. Children play beneath trees that glow faintly gold at dusk, ' +
            'and the elders say the Sap has never flowed so freely.'
    },
    blighted_dominion: {
        id: 'blighted_dominion',
        title: 'The Blighted Dominion',
        description:
            'The Sporecallers have won. Decay spreads across the Verdance unchecked, ' +
            'and what was once forest becomes a vast grey silence. The corruption you fed ' +
            'has a memory, and it remembers your name too — carved into the new order.',
        epilogue:
            'The survivors flee north. The last Bloomguard post falls within a month. ' +
            'The Sap does not die — it transforms — and somewhere in that transformation ' +
            'something watches, patient, through your eyes.'
    },
    veilkeeper_ascension: {
        id: 'veilkeeper_ascension',
        title: 'The Veilkeeper Ascension',
        description:
            'The Veil consumes all. The Emerald Coven\'s ancient compact is fulfilled: ' +
            'the boundary between realms dissolves, and the world becomes something neither ' +
            'living nor dead. Knowledge was the price. You paid it willingly.',
        epilogue:
            'There are no seasons now — only a silver light that does not warm. ' +
            'The Veilkeepers walk between moments, no longer bound. You walk with them. ' +
            'Whether that is a gift or a sentence, only time will say.'
    },
    hollow_silence: {
        id: 'hollow_silence',
        title: 'The Hollow Silence',
        description:
            'Everything fades. The Domain Soul Pool drained to nothing, and the world ' +
            'followed it into grey. There is no enemy to point at, no villain to blame. ' +
            'The Verdance simply... stopped. Magic costs lives. You spent too many.',
        epilogue:
            'The last fires go out before dawn. Travellers who pass through the region ' +
            'years later find towns perfectly preserved, tables set, fires laid — ' +
            'but no one inside. The trees have no leaves. The Sap does not flow.'
    },
    fractured_balance: {
        id: 'fractured_balance',
        title: 'The Fractured Balance',
        description:
            'No single vision triumphed. The factions hold an uneasy truce, the Sap ' +
            'flows in fits and starts, and the Verdance carries its scars into a new age. ' +
            'It is not the ending anyone wanted — but it is the one the world could survive.',
        epilogue:
            'Peace, of a kind. The markets reopen. The crystal roads are repaired. ' +
            'Factions negotiate across campfires they would once have burned. ' +
            'They argue constantly, and that arguing is the sound of something still alive.'
    }
};

export class EndingEvaluator {
    /**
     * Evaluate which ending the player gets based on current game state.
     *
     * @param {object} gameState  Optional snapshot; if omitted, reads live singletons.
     * @param {object} [gameState.player]  Player object with optional stats.hollowing
     * @returns {{ endingId: string, title: string, description: string, epilogue: string }}
     */
    evaluate(gameState = {}) {
        const dsp        = DSPSystem.getInstance();
        const factions   = FactionSystem.getInstance();
        const narrative  = NarrativeSystem.getInstance();

        const dspValue         = dsp.current;
        const wildkinRep       = factions.getReputation('wildkin_pact');   // verdant_circle proxy
        const sporecallersRep  = factions.getReputation('sporecallers');   // blighted_covenant proxy
        const emeraldCovenRep  = factions.getReputation('emerald_coven');  // veilkeepers proxy

        // Hollowing: check player stats if available, fall back to 0
        const playerStats      = gameState.player?.stats ?? {};
        const hollowingPct     = playerStats.hollowing ?? 0; // expected 0-100

        // ── Priority order ────────────────────────────────────────────────
        // 1. Hollow Silence — catastrophic world collapse or player hollowing
        if (hollowingPct >= 80 || dspValue <= 10) {
            return this._build('hollow_silence');
        }

        // 2. Verdant Restoration — world healed + nature faction strong
        if (dspValue >= 70 && wildkinRep >= 50) {
            return this._build('verdant_restoration');
        }

        // 3. Blighted Dominion — world damaged + decay faction dominant
        if (dspValue <= 20 && sporecallersRep >= 50) {
            return this._build('blighted_dominion');
        }

        // 4. Veilkeeper Ascension — arcane faction overwhelmingly dominant
        if (emeraldCovenRep >= 60) {
            return this._build('veilkeeper_ascension');
        }

        // 5. Default — uneasy truce
        return this._build('fractured_balance');
    }

    /**
     * Build the full ending payload from the ending id.
     * @private
     */
    _build(endingId) {
        const def = ENDINGS[endingId] ?? ENDINGS.fractured_balance;
        return {
            endingId:    def.id,
            title:       def.title,
            description: def.description,
            epilogue:    def.epilogue
        };
    }
}

export default EndingEvaluator;
