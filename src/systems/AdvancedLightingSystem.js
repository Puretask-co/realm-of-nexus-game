/**
 * AdvancedLightingSystem.js
 *
 * A comprehensive 2D lighting and shadow system for Phaser 3.
 * Renders dynamic lights (point, spot, directional, area) onto a multiply-blend
 * render texture, computes shadow polygons from registered shadow casters, and
 * supports per-light effects such as flicker, pulse, and color cycling.
 *
 * @module AdvancedLightingSystem
 */

// ---------------------------------------------------------------------------
// Unique ID counter shared across all light instances
// ---------------------------------------------------------------------------
let nextLightId = 0;

/**
 * @typedef {Object} LightConfig
 * @property {'point'|'spot'|'directional'|'area'} [type='point']
 * @property {number}  [color=0xffffff]        - Tint color (hex).
 * @property {number}  [intensity=1]           - Brightness multiplier 0-1.
 * @property {number}  [radius=200]            - Effective radius in pixels.
 * @property {boolean} [castShadows=true]      - Whether this light casts shadows.
 * @property {Object}  [flicker]               - Flicker effect settings.
 * @property {number}  [flicker.speed=10]      - Flicker oscillation speed.
 * @property {number}  [flicker.amount=0.1]    - Maximum intensity deviation.
 * @property {Object}  [pulse]                 - Pulse effect settings.
 * @property {number}  [pulse.speed=1]         - Cycles per second.
 * @property {number}  [pulse.min=0.5]         - Minimum intensity.
 * @property {number}  [pulse.max=1]           - Maximum intensity.
 * @property {Object}  [colorCycle]            - Color cycle settings.
 * @property {number[]} [colorCycle.colors]    - Array of hex colors.
 * @property {number}  [colorCycle.speed=1]    - Cycle speed multiplier.
 * @property {boolean} [volumetric=false]      - Enable volumetric rendering.
 */

/**
 * @typedef {Object} ShadowCasterConfig
 * @property {'auto'|'rectangle'|'circle'} [shapeType='auto']
 * @property {number}  [opacity=1]   - Shadow opacity 0-1.
 * @property {boolean} [static=false] - If true, vertices are cached.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate between two values.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} t - 0-1
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Linearly interpolate between two hex colors channel-by-channel.
 *
 * @param {number} colorA - Hex color.
 * @param {number} colorB - Hex color.
 * @param {number} t      - 0-1
 * @returns {number} Interpolated hex color.
 */
function lerpColor(colorA, colorB, t) {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;

    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(lerp(rA, rB, t));
    const g = Math.round(lerp(gA, gB, t));
    const b = Math.round(lerp(bA, bB, t));

    return (r << 16) | (g << 8) | b;
}

/**
 * Convert a hex number to an object with r, g, b in 0-1 range.
 *
 * @param {number} hex
 * @returns {{r: number, g: number, b: number}}
 */
function hexToNormalized(hex) {
    return {
        r: ((hex >> 16) & 0xff) / 255,
        g: ((hex >> 8) & 0xff) / 255,
        b: (hex & 0xff) / 255
    };
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export default class AdvancedLightingSystem {
    // -----------------------------------------------------------------
    // Construction & initialisation
    // -----------------------------------------------------------------

    /**
     * Create the lighting system.
     *
     * @param {Phaser.Scene} scene - The owning Phaser scene.
     */
    constructor(scene) {
        /** @type {Phaser.Scene} */
        this.scene = scene;

        /** Width of the game canvas. */
        this.width = scene.scale.width;

        /** Height of the game canvas. */
        this.height = scene.scale.height;

        // -- Render textures ------------------------------------------------

        /**
         * The lighting render texture. Drawn with Multiply blend so that
         * unlit areas darken the scene and lit areas remain bright.
         * @type {Phaser.GameObjects.RenderTexture}
         */
        this.lightingTexture = scene.add
            .renderTexture(0, 0, this.width, this.height)
            .setOrigin(0, 0)
            .setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setDepth(9999);

        /**
         * The shadow render texture. Overlaid on top of the lighting pass
         * with Multiply blend to darken shadowed regions.
         * @type {Phaser.GameObjects.RenderTexture}
         */
        this.shadowTexture = scene.add
            .renderTexture(0, 0, this.width, this.height)
            .setOrigin(0, 0)
            .setBlendMode(Phaser.BlendModes.MULTIPLY)
            .setDepth(10000);

        // -- Configuration --------------------------------------------------

        /** @type {{color: number, intensity: number}} */
        this.ambientLight = {
            color: 0x222244,
            intensity: 0.3
        };

        /** Maximum number of active lights. */
        this.maxLights = 32;

        /** Shadow quality – number of vertices used for circle approximations. */
        this.shadowQuality = 16;

        /** Global enabled flag. */
        this.enabled = true;

        /** Shadow pass enabled flag. */
        this.shadowsEnabled = true;

        // -- Internal state -------------------------------------------------

        /** @type {Object[]} Active lights. */
        this.lights = [];

        /** @type {Map<Phaser.GameObjects.GameObject, Object>} Shadow casters. */
        this.shadowCasters = new Map();

        /**
         * Shared graphics object used to draw shadow polygons each frame.
         * @type {Phaser.GameObjects.Graphics}
         */
        this.shadowGraphics = scene.add.graphics();
        this.shadowGraphics.setVisible(false);

        /**
         * Shared graphics object used to draw light gradient fills.
         * @type {Phaser.GameObjects.Graphics}
         */
        this.lightGraphics = scene.add.graphics();
        this.lightGraphics.setVisible(false);

        /** Elapsed time accumulator (seconds). */
        this.elapsed = 0;

        /** Performance stats for the last frame. */
        this.stats = {
            lightsRendered: 0,
            shadowsRendered: 0,
            frameTime: 0
        };
    }

    // -----------------------------------------------------------------
    // Light management
    // -----------------------------------------------------------------

    /**
     * Add a new dynamic light to the system.
     *
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {LightConfig} [config={}] - Light configuration.
     * @returns {Object} The light object. Retains a unique `id` property.
     */
    addLight(x, y, config = {}) {
        if (this.lights.length >= this.maxLights) {
            console.warn(
                `AdvancedLightingSystem: max lights (${this.maxLights}) reached. Ignoring addLight().`
            );
            return null;
        }

        const light = {
            id: nextLightId++,
            x,
            y,
            type: config.type || 'point',
            color: config.color !== undefined ? config.color : 0xffffff,
            intensity: config.intensity !== undefined ? config.intensity : 1,
            radius: config.radius !== undefined ? config.radius : 200,
            castShadows: config.castShadows !== undefined ? config.castShadows : true,
            flicker: config.flicker || null,
            pulse: config.pulse || null,
            colorCycle: config.colorCycle || null,
            volumetric: config.volumetric || false,

            // Runtime state ---
            /** Current effective intensity (after effects). */
            currentIntensity: config.intensity !== undefined ? config.intensity : 1,
            /** Current effective color (after effects). */
            currentColor: config.color !== undefined ? config.color : 0xffffff,
            /** Per-light graphics helper for gradient rendering. */
            graphics: this.scene.add.graphics(),
            /** Whether this light is currently visible on screen. */
            visible: true,
            /** Internal flicker noise seed. */
            _flickerSeed: Math.random() * 1000
        };

        light.graphics.setVisible(false);

        this.lights.push(light);
        return light;
    }

    /**
     * Remove a light from the system and clean up its resources.
     *
     * @param {Object} light - The light object returned by {@link addLight}.
     */
    removeLight(light) {
        const idx = this.lights.indexOf(light);
        if (idx === -1) return;

        // Destroy the per-light graphics helper
        if (light.graphics) {
            light.graphics.destroy();
            light.graphics = null;
        }

        this.lights.splice(idx, 1);
    }

    // -----------------------------------------------------------------
    // Shadow caster management
    // -----------------------------------------------------------------

    /**
     * Register a game object as a shadow caster (it will block light).
     *
     * @param {Phaser.GameObjects.GameObject} gameObject - Any display object.
     * @param {ShadowCasterConfig} [config={}]
     */
    addShadowCaster(gameObject, config = {}) {
        const caster = {
            gameObject,
            shapeType: config.shapeType || 'auto',
            opacity: config.opacity !== undefined ? config.opacity : 1,
            static: config.static || false,
            /** Cached vertices (used when `static` is true). */
            _cachedVertices: null
        };

        this.shadowCasters.set(gameObject, caster);
    }

    /**
     * Un-register a shadow caster.
     *
     * @param {Phaser.GameObjects.GameObject} gameObject
     */
    removeShadowCaster(gameObject) {
        this.shadowCasters.delete(gameObject);
    }

    // -----------------------------------------------------------------
    // Ambient light
    // -----------------------------------------------------------------

    /**
     * Set the global ambient light that fills unlit areas.
     *
     * @param {number} color     - Hex color.
     * @param {number} intensity - 0-1 brightness.
     */
    setAmbientLight(color, intensity) {
        this.ambientLight.color = color;
        this.ambientLight.intensity = intensity;
    }

    // -----------------------------------------------------------------
    // Vertex helpers
    // -----------------------------------------------------------------

    /**
     * Compute the four corner vertices of an axis-aligned rectangle
     * defined by position, width and height (with optional origin offset).
     *
     * @param {number} x      - Center X.
     * @param {number} y      - Center Y.
     * @param {number} width
     * @param {number} height
     * @param {number} [originX=0.5]
     * @param {number} [originY=0.5]
     * @returns {{x: number, y: number}[]} Four vertices in clockwise order.
     */
    getRectangleVertices(x, y, width, height, originX = 0.5, originY = 0.5) {
        const left = x - width * originX;
        const top = y - height * originY;
        const right = left + width;
        const bottom = top + height;

        return [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom }
        ];
    }

    /**
     * Approximate a circle with a polygon of `segments` vertices.
     *
     * @param {number} cx       - Center X.
     * @param {number} cy       - Center Y.
     * @param {number} radius
     * @param {number} [segments] - Number of segments (defaults to shadowQuality).
     * @returns {{x: number, y: number}[]}
     */
    getCircleVertices(cx, cy, radius, segments) {
        const n = segments || this.shadowQuality;
        const verts = [];
        const step = (Math.PI * 2) / n;

        for (let i = 0; i < n; i++) {
            const angle = step * i;
            verts.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }

        return verts;
    }

    // -----------------------------------------------------------------
    // Internal: resolve caster vertices
    // -----------------------------------------------------------------

    /**
     * Determine the world-space vertices for a given shadow caster.
     *
     * @param {Object} caster - Internal caster record.
     * @returns {{x: number, y: number}[]}
     * @private
     */
    _getCasterVertices(caster) {
        // Return cached data for static casters when available
        if (caster.static && caster._cachedVertices) {
            return caster._cachedVertices;
        }

        const obj = caster.gameObject;
        let vertices;

        // Determine shape type, auto-detect when set to 'auto'
        let shapeType = caster.shapeType;
        if (shapeType === 'auto') {
            // Phaser circles expose a `radius` property; everything else is a rect
            shapeType = (obj.radius !== undefined && typeof obj.radius === 'number')
                ? 'circle'
                : 'rectangle';
        }

        if (shapeType === 'circle') {
            const r = obj.radius || (obj.displayWidth ? obj.displayWidth / 2 : 16);
            vertices = this.getCircleVertices(obj.x, obj.y, r);
        } else {
            // Default to rectangle
            const w = obj.displayWidth || obj.width || 32;
            const h = obj.displayHeight || obj.height || 32;
            const ox = obj.originX !== undefined ? obj.originX : 0.5;
            const oy = obj.originY !== undefined ? obj.originY : 0.5;
            vertices = this.getRectangleVertices(obj.x, obj.y, w, h, ox, oy);
        }

        if (caster.static) {
            caster._cachedVertices = vertices;
        }

        return vertices;
    }

    // -----------------------------------------------------------------
    // Internal: shadow projection
    // -----------------------------------------------------------------

    /**
     * For a single light, project shadow polygons from each caster edge that
     * faces away from the light and draw them onto the shadow graphics object.
     *
     * The algorithm:
     *  1. For each edge of the caster polygon, compute its outward-facing
     *     normal.
     *  2. If the dot product of the normal and the vector from the edge
     *     midpoint to the light is negative (edge faces away from the light),
     *     project its two vertices far away from the light to form a
     *     shadow quad.
     *  3. Fill that quad on the shadow graphics.
     *
     * @param {Object} light  - The light object.
     * @param {Object} caster - The shadow caster record.
     * @private
     */
    _projectShadow(light, caster) {
        const vertices = this._getCasterVertices(caster);
        if (!vertices || vertices.length < 2) return;

        const lx = light.x;
        const ly = light.y;
        const projectionDistance = light.radius * 4;
        const shadowAlpha = caster.opacity;

        const gfx = this.shadowGraphics;

        const numVerts = vertices.length;

        for (let i = 0; i < numVerts; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % numVerts];

            // Edge direction and outward normal (assuming clockwise winding)
            const edgeDx = v2.x - v1.x;
            const edgeDy = v2.y - v1.y;
            const nx = edgeDy;  // outward normal x
            const ny = -edgeDx; // outward normal y

            // Midpoint of the edge
            const mx = (v1.x + v2.x) * 0.5;
            const my = (v1.y + v2.y) * 0.5;

            // Vector from midpoint to light
            const toLightX = lx - mx;
            const toLightY = ly - my;

            // If the dot product is negative the edge faces away from the light
            const dot = nx * toLightX + ny * toLightY;
            if (dot >= 0) continue;

            // Project the two edge vertices away from the light
            const d1x = v1.x - lx;
            const d1y = v1.y - ly;
            const d2x = v2.x - lx;
            const d2y = v2.y - ly;

            const len1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
            const len2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;

            const p1x = v1.x + (d1x / len1) * projectionDistance;
            const p1y = v1.y + (d1y / len1) * projectionDistance;
            const p2x = v2.x + (d2x / len2) * projectionDistance;
            const p2y = v2.y + (d2y / len2) * projectionDistance;

            // Draw the shadow quad (v1 -> v2 -> p2 -> p1)
            gfx.fillStyle(0x000000, shadowAlpha);
            gfx.beginPath();
            gfx.moveTo(v1.x, v1.y);
            gfx.lineTo(v2.x, v2.y);
            gfx.lineTo(p2x, p2y);
            gfx.lineTo(p1x, p1y);
            gfx.closePath();
            gfx.fillPath();

            this.stats.shadowsRendered++;
        }
    }

    // -----------------------------------------------------------------
    // Internal: light effect updates
    // -----------------------------------------------------------------

    /**
     * Evaluate flicker, pulse and color-cycle effects for a single light
     * and write the results into `light.currentIntensity` / `currentColor`.
     *
     * @param {Object} light
     * @private
     */
    _updateLightEffects(light) {
        let intensity = light.intensity;
        let color = light.color;

        // -- Flicker (pseudo-random noise) ----------------------------------
        if (light.flicker) {
            const speed = light.flicker.speed || 10;
            const amount = light.flicker.amount || 0.1;
            // Simple sine-based noise using two incommensurate frequencies
            const noise =
                Math.sin(this.elapsed * speed + light._flickerSeed) *
                Math.cos(this.elapsed * speed * 0.7 + light._flickerSeed * 1.3);
            intensity += noise * amount;
        }

        // -- Pulse (smooth oscillation) -------------------------------------
        if (light.pulse) {
            const speed = light.pulse.speed || 1;
            const min = light.pulse.min !== undefined ? light.pulse.min : 0.5;
            const max = light.pulse.max !== undefined ? light.pulse.max : 1;
            const t = (Math.sin(this.elapsed * speed * Math.PI * 2) + 1) * 0.5;
            intensity = lerp(min, max, t);
        }

        // -- Color cycle ----------------------------------------------------
        if (light.colorCycle && light.colorCycle.colors && light.colorCycle.colors.length > 1) {
            const colors = light.colorCycle.colors;
            const speed = light.colorCycle.speed || 1;
            const total = colors.length;
            const progress = (this.elapsed * speed) % total;
            const idx = Math.floor(progress);
            const t = progress - idx;
            color = lerpColor(colors[idx % total], colors[(idx + 1) % total], t);
        }

        // Clamp intensity to [0, 1]
        light.currentIntensity = Math.max(0, Math.min(1, intensity));
        light.currentColor = color;
    }

    // -----------------------------------------------------------------
    // Internal: off-screen culling check
    // -----------------------------------------------------------------

    /**
     * Determine whether a light is visible inside the current camera viewport
     * (with a generous padding equal to its radius).
     *
     * @param {Object} light
     * @returns {boolean}
     * @private
     */
    _isLightVisible(light) {
        const camera = this.scene.cameras.main;
        const scrollX = camera.scrollX;
        const scrollY = camera.scrollY;
        const pad = light.radius;

        return (
            light.x + pad >= scrollX &&
            light.x - pad <= scrollX + camera.width &&
            light.y + pad >= scrollY &&
            light.y - pad <= scrollY + camera.height
        );
    }

    // -----------------------------------------------------------------
    // Internal: render a single light as a radial gradient
    // -----------------------------------------------------------------

    /**
     * Draw a radial-gradient filled circle representing a point light
     * onto the lighting render texture. The gradient fades from the light
     * colour at the centre to transparent at the edge.
     *
     * Spot, directional and area lights are simplified here as variations
     * of the point light with different fill strategies.
     *
     * @param {Object} light
     * @private
     */
    _renderLight(light) {
        const gfx = this.lightGraphics;
        const { r, g, b } = hexToNormalized(light.currentColor);
        const intensity = light.currentIntensity;
        const radius = light.radius;
        const steps = 12; // Number of concentric rings for the gradient

        // Camera offset
        const camera = this.scene.cameras.main;
        const ox = -camera.scrollX;
        const oy = -camera.scrollY;

        const cx = light.x + ox;
        const cy = light.y + oy;

        // Draw concentric filled circles from outside-in, darkest first
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;                      // 1 = edge, 0 = centre
            const ringRadius = radius * t;
            const alpha = intensity * (1 - t);        // 0 at edge, intensity at centre

            // Colour mixed toward white by alpha for an additive-like feel
            const cr = Math.min(255, Math.round(r * 255 * alpha + 255 * (1 - alpha)));
            const cg = Math.min(255, Math.round(g * 255 * alpha + 255 * (1 - alpha)));
            const cb = Math.min(255, Math.round(b * 255 * alpha + 255 * (1 - alpha)));
            const fillColor = (cr << 16) | (cg << 8) | cb;

            gfx.fillStyle(fillColor, 1);
            gfx.fillCircle(cx, cy, Math.max(ringRadius, 1));
        }

        // Volumetric glow pass – an extra soft, transparent circle
        if (light.volumetric) {
            const glowAlpha = intensity * 0.15;
            const glowColor = light.currentColor;
            gfx.fillStyle(glowColor, glowAlpha);
            gfx.fillCircle(cx, cy, radius * 1.4);
        }

        this.stats.lightsRendered++;
    }

    // -----------------------------------------------------------------
    // Public: main update loop
    // -----------------------------------------------------------------

    /**
     * Called once per frame (typically from the scene's `update` method).
     * Clears the render textures, evaluates light effects, renders
     * every visible light and computes shadows.
     *
     * @param {number} [time]  - Total elapsed time (ms). Pulled from scene if omitted.
     * @param {number} [delta] - Frame delta (ms). Pulled from scene if omitted.
     */
    update(time, delta) {
        if (!this.enabled) return;

        const frameStart = performance.now();

        // Use scene clock when caller omits arguments
        if (time === undefined) {
            time = this.scene.time.now;
        }
        if (delta === undefined) {
            delta = this.scene.game.loop.delta;
        }

        this.elapsed = time / 1000; // convert to seconds

        // Reset per-frame stats
        this.stats.lightsRendered = 0;
        this.stats.shadowsRendered = 0;

        // -- Clear render textures ------------------------------------------
        this.lightingTexture.clear();
        this.shadowTexture.clear();

        // -- Ambient fill ---------------------------------------------------
        // We fill the lighting texture with the ambient color. Because the
        // texture is drawn with Multiply blend, this effectively darkens the
        // scene to the ambient level.
        const amb = hexToNormalized(this.ambientLight.color);
        const ai = this.ambientLight.intensity;
        const ambR = Math.round(Math.min(255, amb.r * 255 * ai + 255 * (1 - ai)));
        const ambG = Math.round(Math.min(255, amb.g * 255 * ai + 255 * (1 - ai)));
        const ambB = Math.round(Math.min(255, amb.b * 255 * ai + 255 * (1 - ai)));
        const ambientFill = (ambR << 16) | (ambG << 8) | ambB;

        this.lightGraphics.clear();
        this.lightGraphics.fillStyle(ambientFill, 1);
        this.lightGraphics.fillRect(0, 0, this.width, this.height);

        // -- Update & render lights -----------------------------------------
        for (let i = 0; i < this.lights.length; i++) {
            const light = this.lights[i];

            // Evaluate per-light effects
            this._updateLightEffects(light);

            // Off-screen culling
            light.visible = this._isLightVisible(light);
            if (!light.visible) continue;

            // Draw the gradient onto the shared graphics object
            this._renderLight(light);
        }

        // Stamp the graphics onto the lighting render texture
        this.lightingTexture.draw(this.lightGraphics);

        // -- Shadows --------------------------------------------------------
        if (this.shadowsEnabled && this.shadowCasters.size > 0) {
            this.shadowGraphics.clear();

            // Fill the shadow texture with white (no shadow). Multiply by
            // black where shadows are cast.
            this.shadowGraphics.fillStyle(0xffffff, 1);
            this.shadowGraphics.fillRect(0, 0, this.width, this.height);

            for (let i = 0; i < this.lights.length; i++) {
                const light = this.lights[i];
                if (!light.visible || !light.castShadows) continue;

                this.shadowCasters.forEach((caster) => {
                    this._projectShadow(light, caster);
                });
            }

            this.shadowTexture.draw(this.shadowGraphics);
        }

        this.stats.frameTime = performance.now() - frameStart;
    }

    // -----------------------------------------------------------------
    // Public: enable / disable
    // -----------------------------------------------------------------

    /**
     * Enable or disable the entire lighting system.
     *
     * @param {boolean} flag
     */
    setEnabled(flag) {
        this.enabled = flag;
        this.lightingTexture.setVisible(flag);
        this.shadowTexture.setVisible(flag);
    }

    /**
     * Enable or disable the shadow pass only.
     *
     * @param {boolean} flag
     */
    setShadowsEnabled(flag) {
        this.shadowsEnabled = flag;
        this.shadowTexture.setVisible(flag);
    }

    // -----------------------------------------------------------------
    // Public: stats
    // -----------------------------------------------------------------

    /**
     * Return performance / debug stats for the last rendered frame.
     *
     * @returns {{lightsRendered: number, shadowsRendered: number, frameTime: number}}
     */
    getStats() {
        return { ...this.stats };
    }

    // -----------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------

    /**
     * Destroy all resources held by the lighting system. Call this when
     * the owning scene shuts down.
     */
    shutdown() {
        // Destroy per-light graphics helpers
        for (const light of this.lights) {
            if (light.graphics) {
                light.graphics.destroy();
                light.graphics = null;
            }
        }
        this.lights.length = 0;

        // Clear shadow caster registry
        this.shadowCasters.clear();

        // Destroy shared graphics objects
        if (this.shadowGraphics) {
            this.shadowGraphics.destroy();
            this.shadowGraphics = null;
        }
        if (this.lightGraphics) {
            this.lightGraphics.destroy();
            this.lightGraphics = null;
        }

        // Destroy render textures
        if (this.lightingTexture) {
            this.lightingTexture.destroy();
            this.lightingTexture = null;
        }
        if (this.shadowTexture) {
            this.shadowTexture.destroy();
            this.shadowTexture = null;
        }

        this.scene = null;
    }
}
