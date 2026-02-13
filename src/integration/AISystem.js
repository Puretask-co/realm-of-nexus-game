import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * AISystem — Drives all enemy behaviour through configurable
 * state-machine patterns loaded from enemy data.
 *
 * Each enemy definition in enemies.json has an `aiPattern` field
 * which selects one of these built-in behaviour trees:
 *
 *  - 'patrol_and_chase' — wanders near spawn, chases player in range
 *  - 'ambush'           — stays hidden, attacks when player is very close
 *  - 'ranged_kite'      — keeps distance, fires spells, retreats if cornered
 *  - 'guardian'          — holds position, attacks anything in territory
 *  - 'swarm'            — moves toward nearest ally, coordinates group rushes
 *
 * The system also reacts to phase changes: during the phase matching
 * an enemy's phaseSpawnWeights, enemies become more aggressive.
 *
 * Integration:
 *   Called from GameScene.update() for each active enemy.
 *   Emits 'combat-action' when an enemy decides to attack.
 */
export default class AISystem {
    constructor(scene) {
        this.scene = scene;
        this.currentPhase = 'blue';

        this._unsubs = [
            EventBus.on('phase-changed', (phase) => {
                this.currentPhase = phase;
            })
        ];
    }

    /**
     * Update all enemies in the group.
     */
    updateAll(enemies, player, delta) {
        if (!enemies || !player) return;
        const dt = delta / 1000;

        enemies.children.entries.forEach((enemy) => {
            if (!enemy.active || !enemy.data) return;
            this._updateEnemy(enemy, player, dt);
        });
    }

    _updateEnemy(enemy, player, dt) {
        const d = enemy.data;
        const def = d.definition;
        const pattern = def?.aiPattern || 'patrol_and_chase';
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);

        // Phase aggression boost
        const phaseBoost = this._getPhaseAggression(def);

        d.aiTimer = (d.aiTimer || 0) + dt;
        d.attackCooldown = Math.max(0, (d.attackCooldown || 0) - dt);

        switch (pattern) {
            case 'patrol_and_chase':
                this._patrolAndChase(enemy, player, dist, dt, phaseBoost);
                break;
            case 'ambush':
                this._ambush(enemy, player, dist, dt, phaseBoost);
                break;
            case 'ranged_kite':
                this._rangedKite(enemy, player, dist, dt, phaseBoost);
                break;
            case 'guardian':
                this._guardian(enemy, player, dist, dt, phaseBoost);
                break;
            case 'swarm':
                this._patrolAndChase(enemy, player, dist, dt, phaseBoost);
                break;
            default:
                this._patrolAndChase(enemy, player, dist, dt, phaseBoost);
        }
    }

    // ----------------------------------------------------------------
    // Behaviour: Patrol and Chase
    // ----------------------------------------------------------------

    _patrolAndChase(enemy, player, dist, dt, phaseBoost) {
        const d = enemy.data;
        const speed = (d.definition?.baseStats?.speed || 80) * (1 + phaseBoost * 0.3);
        const detectRange = 250 * (1 + phaseBoost * 0.2);
        const loseRange = 400;

        switch (d.aiState) {
            case 'idle':
                enemy.setVelocity(0, 0);
                if (dist < detectRange) {
                    d.aiState = 'chase';
                    d.aiTimer = 0;
                } else if (d.aiTimer > 2 + Math.random() * 2) {
                    d.aiState = 'patrol';
                    d.aiTimer = 0;
                    d.patrolAngle = Math.random() * Math.PI * 2;
                }
                break;

            case 'patrol': {
                const px = d.patrolOrigin.x + Math.cos(d.patrolAngle + d.aiTimer * 0.5) * 80;
                const py = d.patrolOrigin.y + Math.sin(d.patrolAngle + d.aiTimer * 0.5) * 80;
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, px, py);
                enemy.setVelocity(Math.cos(angle) * speed * 0.4, Math.sin(angle) * speed * 0.4);

                if (dist < detectRange) {
                    d.aiState = 'chase';
                    d.aiTimer = 0;
                } else if (d.aiTimer > 4 + Math.random() * 3) {
                    d.aiState = 'idle';
                    d.aiTimer = 0;
                }
                break;
            }

            case 'chase': {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
                enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

                // Attack if close enough
                if (dist < 40 && d.attackCooldown <= 0) {
                    this._attack(enemy, player);
                }

                if (dist > loseRange) {
                    d.aiState = 'return';
                    d.aiTimer = 0;
                }
                break;
            }

            case 'return': {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, d.patrolOrigin.x, d.patrolOrigin.y);
                enemy.setVelocity(Math.cos(angle) * speed * 0.6, Math.sin(angle) * speed * 0.6);
                const homeDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, d.patrolOrigin.x, d.patrolOrigin.y);
                if (homeDist < 30) {
                    d.aiState = 'idle';
                    d.aiTimer = 0;
                }
                if (dist < detectRange * 0.7) {
                    d.aiState = 'chase';
                    d.aiTimer = 0;
                }
                break;
            }

            default:
                d.aiState = 'idle';
        }
    }

    // ----------------------------------------------------------------
    // Behaviour: Ambush
    // ----------------------------------------------------------------

    _ambush(enemy, player, dist, dt, phaseBoost) {
        const d = enemy.data;
        const speed = (d.definition?.baseStats?.speed || 80) * 1.3;
        const ambushRange = 80 * (1 + phaseBoost * 0.3);

        switch (d.aiState) {
            case 'idle':
            case 'hidden':
                enemy.setVelocity(0, 0);
                enemy.setAlpha(0.3); // semi-invisible
                if (dist < ambushRange) {
                    d.aiState = 'strike';
                    d.aiTimer = 0;
                    enemy.setAlpha(1);
                }
                break;

            case 'strike': {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
                enemy.setVelocity(Math.cos(angle) * speed * 1.5, Math.sin(angle) * speed * 1.5);

                if (dist < 40 && d.attackCooldown <= 0) {
                    this._attack(enemy, player, 1.5); // bonus damage from ambush
                }

                if (d.aiTimer > 3) {
                    d.aiState = 'retreat';
                    d.aiTimer = 0;
                }
                break;
            }

            case 'retreat': {
                const awayAngle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
                enemy.setVelocity(Math.cos(awayAngle) * speed, Math.sin(awayAngle) * speed);
                if (d.aiTimer > 2) {
                    d.aiState = 'hidden';
                    d.aiTimer = 0;
                }
                break;
            }
        }
    }

    // ----------------------------------------------------------------
    // Behaviour: Ranged Kite
    // ----------------------------------------------------------------

    _rangedKite(enemy, player, dist, dt, phaseBoost) {
        const d = enemy.data;
        const speed = (d.definition?.baseStats?.speed || 80) * (1 + phaseBoost * 0.2);
        const idealRange = 200;
        const castRange = 250;

        // Always try to maintain ideal range
        if (dist < idealRange - 30) {
            // Too close → retreat
            const awayAngle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            enemy.setVelocity(Math.cos(awayAngle) * speed, Math.sin(awayAngle) * speed);
        } else if (dist > idealRange + 60) {
            // Too far → approach
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
            enemy.setVelocity(Math.cos(angle) * speed * 0.6, Math.sin(angle) * speed * 0.6);
        } else {
            // In sweet spot → strafe
            const strafeAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y) + Math.PI / 2;
            enemy.setVelocity(Math.cos(strafeAngle) * speed * 0.4, Math.sin(strafeAngle) * speed * 0.4);
        }

        // Cast spell at range
        if (dist < castRange && d.attackCooldown <= 0) {
            this._castSpell(enemy, player);
        }
    }

    // ----------------------------------------------------------------
    // Behaviour: Guardian
    // ----------------------------------------------------------------

    _guardian(enemy, player, dist, dt, phaseBoost) {
        const d = enemy.data;
        const speed = (d.definition?.baseStats?.speed || 80) * 0.8;
        const territoryRadius = 150;

        const homeDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, d.patrolOrigin.x, d.patrolOrigin.y);

        if (dist < territoryRadius && homeDist < territoryRadius) {
            // Player in territory → attack
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
            enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

            if (dist < 40 && d.attackCooldown <= 0) {
                this._attack(enemy, player, 1.2);
            }
        } else if (homeDist > 30) {
            // Return to post
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, d.patrolOrigin.x, d.patrolOrigin.y);
            enemy.setVelocity(Math.cos(angle) * speed * 0.5, Math.sin(angle) * speed * 0.5);
        } else {
            enemy.setVelocity(0, 0);
        }
    }

    // ----------------------------------------------------------------
    // Attack helpers
    // ----------------------------------------------------------------

    _attack(enemy, player, damageMultiplier = 1.0) {
        const d = enemy.data;
        const def = d.definition;

        const baseDamage = def?.baseStats?.attack || 10;
        const cooldown = 1.5;

        d.attackCooldown = cooldown;

        EventBus.emit('combat-action', {
            attacker: enemy,
            target: player,
            spell: {
                id: `${def?.id || 'enemy'}_melee`,
                baseDamage: baseDamage * damageMultiplier,
                element: null,
                tier: 1,
                vfx: { impactParticle: 'hit_sparks' }
            }
        });
    }

    _castSpell(enemy, player) {
        const d = enemy.data;
        const def = d.definition;
        const spells = def?.spells || [];

        if (spells.length === 0) {
            this._attack(enemy, player);
            return;
        }

        // Pick random spell from enemy's list
        const spellId = spells[Math.floor(Math.random() * spells.length)];
        const spellData = dataManager.getSpell(spellId);

        if (!spellData) {
            this._attack(enemy, player);
            return;
        }

        d.attackCooldown = spellData.cooldown || 2;

        EventBus.emit('combat-action', {
            attacker: enemy,
            target: player,
            spell: spellData
        });
    }

    // ----------------------------------------------------------------
    // Phase aggression
    // ----------------------------------------------------------------

    _getPhaseAggression(def) {
        if (!def?.phaseSpawnWeights) return 0;
        const weight = def.phaseSpawnWeights[this.currentPhase] || 0;
        // Higher weight = more aggressive during this phase
        return Math.max(0, (weight - 0.3) * 2);
    }

    shutdown() {
        this._unsubs.forEach((fn) => fn());
    }
}
