(function (global) {
    'use strict';

    function configureCanvasForDpr(canvas, ctx, options) {
        const gameWidth = Number(options.gameWidth) || 0;
        const gameHeight = Number(options.gameHeight) || 0;
        const scale = Number(options.scale) || 1;
        const maxDpr = Number(options.maxDpr) || 2;
        const deviceDpr = Math.round(global.devicePixelRatio || 1);
        const dpr = Math.min(deviceDpr, maxDpr);

        if (dpr > 1 && gameWidth > 0 && gameHeight > 0) {
            canvas.width = gameWidth * scale * dpr;
            canvas.height = gameHeight * scale * dpr;
            canvas.style.width = (gameWidth * scale) + 'px';
            canvas.style.height = (gameHeight * scale) + 'px';
            ctx.scale(dpr, dpr);
        }

        return dpr;
    }

    function colorToVec4(input, fallback) {
        if (typeof input !== 'string') return fallback.slice();
        const color = input.trim().toLowerCase();

        if (color[0] === '#') {
            if (color.length === 4) {
                const r = parseInt(color[1] + color[1], 16) / 255;
                const g = parseInt(color[2] + color[2], 16) / 255;
                const b = parseInt(color[3] + color[3], 16) / 255;
                return [r, g, b, 1];
            }
            if (color.length === 7) {
                const r = parseInt(color.slice(1, 3), 16) / 255;
                const g = parseInt(color.slice(3, 5), 16) / 255;
                const b = parseInt(color.slice(5, 7), 16) / 255;
                return [r, g, b, 1];
            }
            return fallback.slice();
        }

        const rgba = color.match(/^rgba?\(([^)]+)\)$/);
        if (!rgba) return fallback.slice();
        const parts = rgba[1].split(',').map(v => Number(v.trim()));
        if (parts.length < 3 || parts.some(v => Number.isNaN(v))) return fallback.slice();
        const r = Math.max(0, Math.min(255, parts[0])) / 255;
        const g = Math.max(0, Math.min(255, parts[1])) / 255;
        const b = Math.max(0, Math.min(255, parts[2])) / 255;
        const a = parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1;
        return [r, g, b, a];
    }

    function getThemeEffectMode(theme) {
        switch (String(theme || '').toLowerCase()) {
            case 'snow':
            case 'packed_snow':
            case 'black_ice':
            case 'ice':
            case 'frozen_mud':
                return 1;
            case 'desert':
            case 'sandstone':
            case 'salt_flats':
                return 2;
            case 'lava':
            case 'volcanic_ash':
            case 'obsidian_floor':
                return 3;
            case 'water':
            case 'deep_sea':
            case 'coral':
            case 'wet_cave_stone':
                return 4;
            case 'crystal':
            case 'crystal_dense':
            case 'amber':
            case 'fungus_glow':
            case 'toxic_sludge':
                return 5;
            default:
                return 6;
        }
    }

    function getThemeAccentColors(theme) {
        switch (getThemeEffectMode(theme)) {
            case 1:
                return { a: [185, 225, 255], b: [235, 248, 255] };
            case 2:
                return { a: [230, 188, 108], b: [255, 218, 150] };
            case 3:
                return { a: [255, 118, 56], b: [255, 186, 82] };
            case 4:
                return { a: [74, 198, 255], b: [138, 246, 255] };
            case 5:
                return { a: [126, 238, 184], b: [148, 164, 255] };
            default:
                return { a: [136, 186, 232], b: [205, 236, 255] };
        }
    }

    function getDistortionKind(kind) {
        switch (String(kind || '').toLowerCase()) {
            case 'shockwave':
                return 0;
            case 'swirl':
                return 1;
            case 'pulse':
                return 2;
            default:
                return 0;
        }
    }

    class Canvas2DRenderer {
        constructor(canvas, options) {
            this.canvas = canvas;
            this.options = options || {};
            this.type = 'canvas2d';
            this.ctx = null;
            this.dpr = 1;
        }

        initialize() {
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) return false;

            this.ctx.imageSmoothingEnabled = false;
            this.dpr = configureCanvasForDpr(this.canvas, this.ctx, this.options);

            return true;
        }

        getContext2D() {
            return this.ctx;
        }

        getDpr() {
            return this.dpr;
        }

        supportsHybridBasePass() {
            return false;
        }

        renderGameLayerStack() {
            return false;
        }

        renderPostProcessOverlay() {
            return false;
        }

        renderParticles() {
            return false;
        }

        renderParticleCloud() {
            return false;
        }

        renderPuffinBodies() {
            return false;
        }

        renderDynamicLights() {
            return false;
        }

        renderRingwaves() {
            return false;
        }

        renderPortalEffect() {
            return false;
        }

        renderWeatherField() {
            return false;
        }

        renderShadowBlobs() {
            return false;
        }

        renderScreenDistortion() {
            return false;
        }
    }

    class WebGLRenderer {
        constructor(canvas, options) {
            this.canvas = canvas;
            this.options = options || {};
            this.type = 'webgl';
            this.ctx = null;
            this.dpr = 1;
            this.glCanvas = null;
            this.gl = null;
            this._quadBuffer = null;
            this._gradientProgram = null;
            this._textureProgram = null;
            this._solidProgram = null;
            this._vignetteProgram = null;
            this._particleProgram = null;
            this._spriteProgram = null;
            this._lightProgram = null;
            this._ringProgram = null;
            this._portalProgram = null;
            this._atmosphereProgram = null;
            this._weatherProgram = null;
            this._shadowProgram = null;
            this._distortionProgram = null;
            this._uploadTexture = null;
            this._particleBuffer = null;
            this._unitQuadBuffer = null;
            this._loc = {
                gradient: null,
                texture: null,
                solid: null,
                vignette: null,
                particles: null,
                sprite: null,
                lights: null,
                rings: null,
                portal: null,
                atmosphere: null,
                weather: null,
                shadows: null,
                distortion: null
            };
            this._particleCpuBuffer = new Float32Array(0);
            this._spriteTextureCache = {};
        }

        initialize() {
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) return false;
            this.ctx.imageSmoothingEnabled = false;
            this.dpr = configureCanvasForDpr(this.canvas, this.ctx, this.options);

            this.glCanvas = document.createElement('canvas');
            this.gl = this.glCanvas.getContext('webgl', {
                alpha: true,
                antialias: false,
                premultipliedAlpha: true,
                preserveDrawingBuffer: true
            });
            if (!this.gl) return false;

            this._initPrograms();
            return true;
        }

        getContext2D() {
            return this.ctx;
        }

        getDpr() {
            return this.dpr;
        }

        supportsHybridBasePass() {
            return !!(this.gl && this.ctx);
        }

        _ensureGLSize(width, height) {
            const w = Math.max(1, Math.floor(width));
            const h = Math.max(1, Math.floor(height));
            if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
                this.glCanvas.width = w;
                this.glCanvas.height = h;
            }
            this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
        }

        _compileShader(type, source) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                const err = this.gl.getShaderInfoLog(shader);
                this.gl.deleteShader(shader);
                throw new Error('WebGL shader compile failed: ' + err);
            }
            return shader;
        }

        _createProgram(vsSource, fsSource) {
            const vs = this._compileShader(this.gl.VERTEX_SHADER, vsSource);
            const fs = this._compileShader(this.gl.FRAGMENT_SHADER, fsSource);
            const program = this.gl.createProgram();
            this.gl.attachShader(program, vs);
            this.gl.attachShader(program, fs);
            this.gl.linkProgram(program);
            this.gl.deleteShader(vs);
            this.gl.deleteShader(fs);
            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                const err = this.gl.getProgramInfoLog(program);
                this.gl.deleteProgram(program);
                throw new Error('WebGL program link failed: ' + err);
            }
            return program;
        }

        _initPrograms() {
            const vsSource = [
                'attribute vec2 aPos;',
                'attribute vec2 aUv;',
                'varying vec2 vUv;',
                'void main() {',
                '  vUv = aUv;',
                '  gl_Position = vec4(aPos, 0.0, 1.0);',
                '}'
            ].join('\n');

            const fsGradient = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform vec3 uTop;',
                'uniform vec3 uMid;',
                'uniform vec3 uBot;',
                'uniform vec4 uVeil;',
                'uniform float uMidStop;',
                'void main() {',
                '  float y = 1.0 - vUv.y;',
                '  vec3 base;',
                '  if (y < uMidStop) {',
                '    float t = y / uMidStop;',
                '    base = mix(uTop, uMid, t);',
                '  } else {',
                '    float t = (y - uMidStop) / max(0.0001, 1.0 - uMidStop);',
                '    base = mix(uMid, uBot, t);',
                '  }',
                '  base = mix(base, uVeil.rgb, uVeil.a);',
                '  gl_FragColor = vec4(base, 1.0);',
                '}'
            ].join('\n');

            const fsTexture = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform sampler2D uTex;',
                'uniform float uAlpha;',
                'void main() {',
                '  vec4 texel = texture2D(uTex, vUv);',
                '  gl_FragColor = vec4(texel.rgb, texel.a * uAlpha);',
                '}'
            ].join('\n');

            const fsSolid = [
                'precision mediump float;',
                'uniform vec4 uColor;',
                'void main() {',
                '  gl_FragColor = uColor;',
                '}'
            ].join('\n');

            const fsVignette = [
                'precision mediump float;',
                'uniform vec2 uResolution;',
                'uniform vec2 uCenter;',
                'uniform float uInnerR;',
                'uniform float uMidR;',
                'uniform float uOuterR;',
                'uniform vec3 uColor;',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy;',
                '  float d = distance(p, uCenter);',
                '  float a = 0.0;',
                '  if (d >= uOuterR) {',
                '    a = 0.30;',
                '  } else if (d >= uMidR) {',
                '    float t = (d - uMidR) / max(0.0001, uOuterR - uMidR);',
                '    a = mix(0.10, 0.30, t);',
                '  } else if (d >= uInnerR) {',
                '    float t = (d - uInnerR) / max(0.0001, uMidR - uInnerR);',
                '    a = mix(0.0, 0.10, t);',
                '  }',
                '  gl_FragColor = vec4(uColor, a);',
                '}'
            ].join('\n');

            const vsParticles = [
                'attribute vec2 aPos;',
                'attribute vec4 aColor;',
                'attribute float aSize;',
                'uniform vec2 uResolution;',
                'varying vec4 vColor;',
                'void main() {',
                '  vec2 zeroToOne = aPos / uResolution;',
                '  vec2 clip = vec2(zeroToOne.x * 2.0 - 1.0, 1.0 - zeroToOne.y * 2.0);',
                '  gl_Position = vec4(clip, 0.0, 1.0);',
                '  gl_PointSize = aSize;',
                '  vColor = aColor;',
                '}'
            ].join('\n');

            const fsParticles = [
                'precision mediump float;',
                'varying vec4 vColor;',
                'void main() {',
                '  gl_FragColor = vColor;',
                '}'
            ].join('\n');

            const vsSprite = [
                'attribute vec2 aUnit;',
                'uniform vec2 uResolution;',
                'uniform vec2 uPos;',
                'uniform vec2 uSize;',
                'uniform float uFlipX;',
                'varying vec2 vUv;',
                'void main() {',
                '  vec2 p = uPos + aUnit * uSize;',
                '  vec2 zeroToOne = p / uResolution;',
                '  vec2 clip = vec2(zeroToOne.x * 2.0 - 1.0, 1.0 - zeroToOne.y * 2.0);',
                '  gl_Position = vec4(clip, 0.0, 1.0);',
                '  vUv = vec2(uFlipX > 0.5 ? 1.0 - aUnit.x : aUnit.x, aUnit.y);',
                '}'
            ].join('\n');

            const fsSprite = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform sampler2D uTex;',
                'uniform vec3 uTint;',
                'uniform float uTintStrength;',
                'uniform vec3 uRimColor;',
                'uniform float uRimStrength;',
                'uniform float uGlow;',
                'uniform vec2 uTexelSize;',
                'void main() {',
                '  vec4 texel = texture2D(uTex, vUv);',
                '  if (texel.a <= 0.001) discard;',
                '  float leftA = texture2D(uTex, vUv + vec2(-uTexelSize.x, 0.0)).a;',
                '  float rightA = texture2D(uTex, vUv + vec2(uTexelSize.x, 0.0)).a;',
                '  float upA = texture2D(uTex, vUv + vec2(0.0, -uTexelSize.y)).a;',
                '  float downA = texture2D(uTex, vUv + vec2(0.0, uTexelSize.y)).a;',
                '  float edge = clamp(texel.a * 4.0 - (leftA + rightA + upA + downA), 0.0, 1.0);',
                '  vec3 tinted = mix(texel.rgb, mix(texel.rgb, uTint, 0.78), clamp(uTintStrength, 0.0, 1.0));',
                '  vec3 color = tinted + uRimColor * edge * uRimStrength + uRimColor * uGlow * 0.35;',
                '  float alpha = clamp(texel.a + edge * uRimStrength * 0.22, 0.0, 1.0);',
                '  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);',
                '}'
            ].join('\n');

            const fsLights = [
                'precision mediump float;',
                'uniform vec2 uResolution;',
                'uniform int uLightCount;',
                'uniform vec2 uLightPos[16];',
                'uniform vec3 uLightColor[16];',
                'uniform float uLightRadius[16];',
                'uniform float uLightIntensity[16];',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy;',
                '  vec3 sum = vec3(0.0);',
                '  for (int i = 0; i < 16; i++) {',
                '    if (i >= uLightCount) break;',
                '    vec2 d = p - uLightPos[i];',
                '    float dist = length(d);',
                '    float r = max(1.0, uLightRadius[i]);',
                '    float t = clamp(1.0 - dist / r, 0.0, 1.0);',
                '    float falloff = t * t;',
                '    sum += uLightColor[i] * falloff * uLightIntensity[i];',
                '  }',
                '  float a = clamp(max(max(sum.r, sum.g), sum.b), 0.0, 1.0);',
                '  gl_FragColor = vec4(clamp(sum, 0.0, 1.0), a);',
                '}'
            ].join('\n');

            const fsRings = [
                'precision mediump float;',
                'uniform int uWaveCount;',
                'uniform vec2 uCenter[12];',
                'uniform float uRadius[12];',
                'uniform float uWidth[12];',
                'uniform vec3 uColor[12];',
                'uniform float uIntensity[12];',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy;',
                '  vec3 sum = vec3(0.0);',
                '  for (int i = 0; i < 12; i++) {',
                '    if (i >= uWaveCount) break;',
                '    float dist = distance(p, uCenter[i]);',
                '    float band = abs(dist - uRadius[i]);',
                '    float w = max(1.0, uWidth[i]);',
                '    float t = clamp(1.0 - band / w, 0.0, 1.0);',
                '    float falloff = t * t;',
                '    sum += uColor[i] * falloff * uIntensity[i];',
                '  }',
                '  float a = clamp(max(max(sum.r, sum.g), sum.b), 0.0, 1.0);',
                '  gl_FragColor = vec4(clamp(sum, 0.0, 1.0), a);',
                '}'
            ].join('\n');

            const fsPortal = [
                'precision mediump float;',
                'uniform vec2 uResolution;',
                'uniform vec2 uCenter;',
                'uniform float uTime;',
                'uniform float uPulse;',
                'uniform float uRadius;',
                'uniform float uIntensity;',
                'uniform vec3 uColorA;',
                'uniform vec3 uColorB;',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy - uCenter;',
                '  float dist = length(p);',
                '  float n = dist / max(1.0, uRadius);',
                '  if (n > 1.22) {',
                '    gl_FragColor = vec4(0.0);',
                '    return;',
                '  }',
                '  float ang = atan(p.y, p.x);',
                '  float swirl = 0.5 + 0.5 * sin(ang * 7.0 - uTime * 3.4 + n * 12.5);',
                '  vec3 col = mix(uColorA, uColorB, swirl);',
                '  float core = smoothstep(0.95, 0.12, n);',
                '  float hole = smoothstep(0.07, 0.24, n);',
                '  float ringBand = core * hole;',
                '  float edge = exp(-abs(dist - uRadius * 0.72) / max(1.0, uRadius * 0.09));',
                '  float ripple = 0.6 + 0.4 * sin(uTime * 7.0 + ang * 5.0 + n * 18.0);',
                '  float a = (ringBand * 0.26 + edge * 0.46 * ripple) * (0.58 + uPulse * 0.78) * uIntensity;',
                '  a = clamp(a, 0.0, 1.0);',
                '  gl_FragColor = vec4(col * a, a);',
                '}'
            ].join('\n');

            const fsAtmosphere = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform float uTime;',
                'uniform float uMode;',
                'uniform float uWind;',
                'uniform float uIntensity;',
                'uniform vec3 uColorA;',
                'uniform vec3 uColorB;',
                'float hash(vec2 p) {',
                '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
                '}',
                'float noise(vec2 p) {',
                '  vec2 i = floor(p);',
                '  vec2 f = fract(p);',
                '  float a = hash(i);',
                '  float b = hash(i + vec2(1.0, 0.0));',
                '  float c = hash(i + vec2(0.0, 1.0));',
                '  float d = hash(i + vec2(1.0, 1.0));',
                '  vec2 u = f * f * (3.0 - 2.0 * f);',
                '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
                '}',
                'void main() {',
                '  vec2 uv = vUv;',
                '  vec3 sum = vec3(0.0);',
                '  float alpha = 0.0;',
                '  if (uMode < 0.5) {',
                '    gl_FragColor = vec4(0.0);',
                '    return;',
                '  }',
                '  if (uMode < 1.5) {',
                '    float veil = smoothstep(0.22, 0.95, noise(vec2(uv.x * 3.1 + uWind * 0.7 + uTime * 0.02, uv.y * 4.9 - uTime * 0.015)));',
                '    float shimmer = 0.5 + 0.5 * sin((uv.x + uv.y) * 10.0 - uTime * 0.7);',
                '    alpha = veil * 0.15 * uIntensity * (0.45 + 0.55 * (1.0 - uv.y));',
                '    sum = mix(uColorA, uColorB, shimmer) * alpha;',
                '  } else if (uMode < 2.5) {',
                '    float band = noise(vec2(uv.x * 8.0 + uTime * 0.12 + uWind * 1.1, uv.y * 18.0 - uTime * 0.02));',
                '    alpha = smoothstep(0.48, 0.86, band) * 0.18 * uIntensity * (0.30 + 0.70 * (1.0 - uv.y));',
                '    sum = mix(uColorB, uColorA, uv.y) * alpha;',
                '  } else if (uMode < 3.5) {',
                '    float swirl = noise(vec2(uv.x * 5.2 - uTime * 0.03, uv.y * 7.4 + uTime * 0.09));',
                '    float ember = smoothstep(0.84, 0.98, noise(vec2(uv.x * 24.0 + uTime * 0.9, uv.y * 20.0 - uTime * 0.3)));',
                '    alpha = (swirl * 0.08 + ember * 0.10 * (1.0 - uv.y)) * uIntensity;',
                '    sum = mix(uColorA, uColorB, swirl) * alpha;',
                '  } else if (uMode < 4.5) {',
                '    float warp = sin((uv.x + sin(uTime * 0.22 + uv.y * 5.0) * 0.08) * 28.0 + uTime * 1.4);',
                '    float caustic = pow(abs(warp), 8.0);',
                '    alpha = caustic * 0.14 * uIntensity * smoothstep(1.1, 0.1, uv.y);',
                '    sum = mix(uColorA, uColorB, uv.y) * alpha;',
                '  } else if (uMode < 5.5) {',
                '    float field = noise(vec2(uv.x * 6.0 - uTime * 0.04, uv.y * 6.0 + uTime * 0.05));',
                '    float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + uv.x * 12.0 + uv.y * 7.0);',
                '    alpha = field * 0.13 * uIntensity;',
                '    sum = mix(uColorA, uColorB, pulse) * alpha;',
                '  } else {',
                '    float fog = noise(vec2(uv.x * 4.0 + uWind * 0.5, uv.y * 8.0 - uTime * 0.025));',
                '    alpha = fog * 0.08 * uIntensity * (1.0 - uv.y * 0.65);',
                '    sum = mix(uColorA, uColorB, uv.y) * alpha;',
                '  }',
                '  gl_FragColor = vec4(clamp(sum, 0.0, 1.0), clamp(alpha, 0.0, 0.35));',
                '}'
            ].join('\n');

            const fsWeather = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform float uTime;',
                'uniform float uMode;',
                'uniform float uWind;',
                'uniform float uIntensity;',
                'uniform vec3 uColorA;',
                'uniform vec3 uColorB;',
                'float hash(vec2 p) {',
                '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
                '}',
                'float snowLayer(vec2 uv, float scale, float speed, float drift) {',
                '  vec2 p = uv * scale;',
                '  p.x += uTime * drift;',
                '  p.y += uTime * speed;',
                '  vec2 cell = floor(p);',
                '  vec2 f = fract(p) - 0.5;',
                '  vec2 jitter = vec2(hash(cell), hash(cell + 13.7)) - 0.5;',
                '  float d = length(f - jitter * 0.35);',
                '  return smoothstep(0.20, 0.0, d);',
                '}',
                'void main() {',
                '  vec2 uv = vUv;',
                '  vec3 color = vec3(0.0);',
                '  float alpha = 0.0;',
                '  if (uMode < 0.5) {',
                '    gl_FragColor = vec4(0.0);',
                '    return;',
                '  }',
                '  if (uMode < 1.5) {',
                '    float s = snowLayer(uv, 18.0, 0.22, uWind * 0.45 + 0.02);',
                '    s += snowLayer(uv + vec2(0.23, 0.11), 26.0, 0.33, uWind * 0.60 + 0.04) * 0.85;',
                '    alpha = s * 0.34 * uIntensity;',
                '    color = mix(uColorA, uColorB, 0.65);',
                '  } else if (uMode < 2.5) {',
                '    vec2 q = vec2(uv.x * 55.0 + uv.y * 9.0 + uTime * (4.0 + uWind * 5.0), uv.y * 32.0 - uTime * 1.4);',
                '    float grit = smoothstep(0.94, 1.0, fract(q.x + sin(q.y) * 0.6));',
                '    alpha = grit * 0.26 * uIntensity * (0.45 + 0.55 * (1.0 - uv.y));',
                '    color = mix(uColorA, uColorB, fract(q.y * 0.11));',
                '  } else if (uMode < 3.5) {',
                '    vec2 q = vec2(uv.x * 28.0 + sin(uv.y * 12.0 + uTime * 0.8) * 2.2, uv.y * 24.0 + uTime * 1.6);',
                '    float ash = smoothstep(0.88, 1.0, fract(q.x + q.y));',
                '    alpha = ash * 0.25 * uIntensity * (0.35 + 0.65 * (1.0 - uv.y));',
                '    color = mix(uColorA, uColorB, fract(q.x * 0.08));',
                '  } else if (uMode < 4.5) {',
                '    vec2 p = vec2(uv.x * 14.0 + sin(uTime * 0.7 + uv.y * 4.0), (1.0 - uv.y) * 18.0 + uTime * 0.9);',
                '    vec2 cell = floor(p);',
                '    vec2 f = fract(p) - 0.5;',
                '    vec2 jitter = vec2(hash(cell), hash(cell + 3.1)) - 0.5;',
                '    float bubble = smoothstep(0.26, 0.0, length(f - jitter * 0.25));',
                '    alpha = bubble * 0.20 * uIntensity;',
                '    color = mix(uColorA, uColorB, 0.55);',
                '  } else if (uMode < 5.5) {',
                '    vec2 q = uv * 22.0 + vec2(uTime * 0.4, -uTime * 0.6);',
                '    float motes = smoothstep(0.93, 1.0, fract(sin(q.x * 1.3 + q.y * 2.1) * 12.0));',
                '    alpha = motes * 0.22 * uIntensity;',
                '    color = mix(uColorA, uColorB, fract(q.x * 0.1));',
                '  } else {',
                '    vec2 q = vec2(uv.x * 90.0 + uTime * (7.5 + uWind * 4.0), uv.y * 48.0 + uTime * 13.0);',
                '    float streak = smoothstep(0.975, 1.0, fract(q.x - q.y * 0.36));',
                '    alpha = streak * 0.22 * uIntensity;',
                '    color = mix(uColorA, uColorB, 0.35);',
                '  }',
                '  gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 0.48));',
                '}'
            ].join('\n');

            const fsShadows = [
                'precision mediump float;',
                'uniform int uBlobCount;',
                'uniform vec2 uCenter[16];',
                'uniform float uRadius[16];',
                'uniform float uIntensity[16];',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy;',
                '  float alpha = 0.0;',
                '  for (int i = 0; i < 16; i++) {',
                '    if (i >= uBlobCount) break;',
                '    vec2 d = p - uCenter[i];',
                '    d.x *= 0.78;',
                '    d.y *= 1.35;',
                '    float dist = length(d);',
                '    float r = max(1.0, uRadius[i]);',
                '    float t = clamp(1.0 - dist / r, 0.0, 1.0);',
                '    alpha += t * t * uIntensity[i];',
                '  }',
                '  alpha = clamp(alpha, 0.0, 0.45);',
                '  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);',
                '}'
            ].join('\n');

            const fsDistortion = [
                'precision mediump float;',
                'varying vec2 vUv;',
                'uniform sampler2D uTex;',
                'uniform vec2 uResolution;',
                'uniform float uTime;',
                'uniform float uMode;',
                'uniform float uGlobalStrength;',
                'uniform int uDistortionCount;',
                'uniform vec2 uCenter[12];',
                'uniform float uRadius[12];',
                'uniform float uStrength[12];',
                'uniform float uKind[12];',
                'void main() {',
                '  vec2 p = gl_FragCoord.xy;',
                '  vec2 offset = vec2(0.0);',
                '  for (int i = 0; i < 12; i++) {',
                '    if (i >= uDistortionCount) break;',
                '    vec2 d = p - uCenter[i];',
                '    float dist = length(d);',
                '    float r = max(1.0, uRadius[i]);',
                '    float n = dist / r;',
                '    if (n < 1.15) {',
                '      vec2 dir = d / max(dist, 0.001);',
                '      float strength = uStrength[i];',
                '      if (uKind[i] < 0.5) {',
                '        float ring = exp(-abs(dist - r * 0.72) / max(1.0, r * 0.10));',
                '        offset += dir * ring * strength * 12.0;',
                '      } else if (uKind[i] < 1.5) {',
                '        float swirl = (1.0 - n) * (0.7 + 0.3 * sin(uTime * 3.0 + n * 9.0));',
                '        offset += vec2(-dir.y, dir.x) * swirl * strength * 10.0;',
                '      } else {',
                '        float pulse = sin(uTime * 16.0 + n * 18.0) * (1.0 - n);',
                '        offset += dir * pulse * strength * 7.0;',
                '      }',
                '    }',
                '  }',
                '  if (uMode > 3.5 && uMode < 4.5) {',
                '    offset += vec2(sin(p.y * 0.06 + uTime * 2.4), cos(p.x * 0.05 + uTime * 1.9)) * (1.6 * uGlobalStrength);',
                '  } else if (uMode > 2.5 && uMode < 3.5) {',
                '    offset += vec2(sin(p.y * 0.12 + uTime * 5.4), 0.0) * (1.9 * uGlobalStrength);',
                '  }',
                '  vec2 sampleUv = vUv + offset / uResolution;',
                '  gl_FragColor = texture2D(uTex, sampleUv);',
                '}'
            ].join('\n');

            this._gradientProgram = this._createProgram(vsSource, fsGradient);
            this._textureProgram = this._createProgram(vsSource, fsTexture);
            this._solidProgram = this._createProgram(vsSource, fsSolid);
            this._vignetteProgram = this._createProgram(vsSource, fsVignette);
            this._particleProgram = this._createProgram(vsParticles, fsParticles);
            this._spriteProgram = this._createProgram(vsSprite, fsSprite);
            this._lightProgram = this._createProgram(vsSource, fsLights);
            this._ringProgram = this._createProgram(vsSource, fsRings);
            this._portalProgram = this._createProgram(vsSource, fsPortal);
            this._atmosphereProgram = this._createProgram(vsSource, fsAtmosphere);
            this._weatherProgram = this._createProgram(vsSource, fsWeather);
            this._shadowProgram = this._createProgram(vsSource, fsShadows);
            this._distortionProgram = this._createProgram(vsSource, fsDistortion);

            this._loc.gradient = {
                aPos: this.gl.getAttribLocation(this._gradientProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._gradientProgram, 'aUv'),
                uTop: this.gl.getUniformLocation(this._gradientProgram, 'uTop'),
                uMid: this.gl.getUniformLocation(this._gradientProgram, 'uMid'),
                uBot: this.gl.getUniformLocation(this._gradientProgram, 'uBot'),
                uVeil: this.gl.getUniformLocation(this._gradientProgram, 'uVeil'),
                uMidStop: this.gl.getUniformLocation(this._gradientProgram, 'uMidStop')
            };

            this._loc.texture = {
                aPos: this.gl.getAttribLocation(this._textureProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._textureProgram, 'aUv'),
                uTex: this.gl.getUniformLocation(this._textureProgram, 'uTex'),
                uAlpha: this.gl.getUniformLocation(this._textureProgram, 'uAlpha')
            };

            this._loc.solid = {
                aPos: this.gl.getAttribLocation(this._solidProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._solidProgram, 'aUv'),
                uColor: this.gl.getUniformLocation(this._solidProgram, 'uColor')
            };

            this._loc.vignette = {
                aPos: this.gl.getAttribLocation(this._vignetteProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._vignetteProgram, 'aUv'),
                uResolution: this.gl.getUniformLocation(this._vignetteProgram, 'uResolution'),
                uCenter: this.gl.getUniformLocation(this._vignetteProgram, 'uCenter'),
                uInnerR: this.gl.getUniformLocation(this._vignetteProgram, 'uInnerR'),
                uMidR: this.gl.getUniformLocation(this._vignetteProgram, 'uMidR'),
                uOuterR: this.gl.getUniformLocation(this._vignetteProgram, 'uOuterR'),
                uColor: this.gl.getUniformLocation(this._vignetteProgram, 'uColor')
            };

            this._loc.particles = {
                aPos: this.gl.getAttribLocation(this._particleProgram, 'aPos'),
                aColor: this.gl.getAttribLocation(this._particleProgram, 'aColor'),
                aSize: this.gl.getAttribLocation(this._particleProgram, 'aSize'),
                uResolution: this.gl.getUniformLocation(this._particleProgram, 'uResolution')
            };

            this._loc.sprite = {
                aUnit: this.gl.getAttribLocation(this._spriteProgram, 'aUnit'),
                uResolution: this.gl.getUniformLocation(this._spriteProgram, 'uResolution'),
                uPos: this.gl.getUniformLocation(this._spriteProgram, 'uPos'),
                uSize: this.gl.getUniformLocation(this._spriteProgram, 'uSize'),
                uFlipX: this.gl.getUniformLocation(this._spriteProgram, 'uFlipX'),
                uTex: this.gl.getUniformLocation(this._spriteProgram, 'uTex'),
                uTint: this.gl.getUniformLocation(this._spriteProgram, 'uTint'),
                uTintStrength: this.gl.getUniformLocation(this._spriteProgram, 'uTintStrength'),
                uRimColor: this.gl.getUniformLocation(this._spriteProgram, 'uRimColor'),
                uRimStrength: this.gl.getUniformLocation(this._spriteProgram, 'uRimStrength'),
                uGlow: this.gl.getUniformLocation(this._spriteProgram, 'uGlow'),
                uTexelSize: this.gl.getUniformLocation(this._spriteProgram, 'uTexelSize')
            };

            this._loc.lights = {
                aPos: this.gl.getAttribLocation(this._lightProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._lightProgram, 'aUv'),
                uResolution: this.gl.getUniformLocation(this._lightProgram, 'uResolution'),
                uLightCount: this.gl.getUniformLocation(this._lightProgram, 'uLightCount'),
                uLightPos: this.gl.getUniformLocation(this._lightProgram, 'uLightPos'),
                uLightColor: this.gl.getUniformLocation(this._lightProgram, 'uLightColor'),
                uLightRadius: this.gl.getUniformLocation(this._lightProgram, 'uLightRadius'),
                uLightIntensity: this.gl.getUniformLocation(this._lightProgram, 'uLightIntensity')
            };

            this._loc.rings = {
                aPos: this.gl.getAttribLocation(this._ringProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._ringProgram, 'aUv'),
                uWaveCount: this.gl.getUniformLocation(this._ringProgram, 'uWaveCount'),
                uCenter: this.gl.getUniformLocation(this._ringProgram, 'uCenter'),
                uRadius: this.gl.getUniformLocation(this._ringProgram, 'uRadius'),
                uWidth: this.gl.getUniformLocation(this._ringProgram, 'uWidth'),
                uColor: this.gl.getUniformLocation(this._ringProgram, 'uColor'),
                uIntensity: this.gl.getUniformLocation(this._ringProgram, 'uIntensity')
            };

            this._loc.portal = {
                aPos: this.gl.getAttribLocation(this._portalProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._portalProgram, 'aUv'),
                uResolution: this.gl.getUniformLocation(this._portalProgram, 'uResolution'),
                uCenter: this.gl.getUniformLocation(this._portalProgram, 'uCenter'),
                uTime: this.gl.getUniformLocation(this._portalProgram, 'uTime'),
                uPulse: this.gl.getUniformLocation(this._portalProgram, 'uPulse'),
                uRadius: this.gl.getUniformLocation(this._portalProgram, 'uRadius'),
                uIntensity: this.gl.getUniformLocation(this._portalProgram, 'uIntensity'),
                uColorA: this.gl.getUniformLocation(this._portalProgram, 'uColorA'),
                uColorB: this.gl.getUniformLocation(this._portalProgram, 'uColorB')
            };

            this._loc.atmosphere = {
                aPos: this.gl.getAttribLocation(this._atmosphereProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._atmosphereProgram, 'aUv'),
                uTime: this.gl.getUniformLocation(this._atmosphereProgram, 'uTime'),
                uMode: this.gl.getUniformLocation(this._atmosphereProgram, 'uMode'),
                uWind: this.gl.getUniformLocation(this._atmosphereProgram, 'uWind'),
                uIntensity: this.gl.getUniformLocation(this._atmosphereProgram, 'uIntensity'),
                uColorA: this.gl.getUniformLocation(this._atmosphereProgram, 'uColorA'),
                uColorB: this.gl.getUniformLocation(this._atmosphereProgram, 'uColorB')
            };

            this._loc.weather = {
                aPos: this.gl.getAttribLocation(this._weatherProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._weatherProgram, 'aUv'),
                uTime: this.gl.getUniformLocation(this._weatherProgram, 'uTime'),
                uMode: this.gl.getUniformLocation(this._weatherProgram, 'uMode'),
                uWind: this.gl.getUniformLocation(this._weatherProgram, 'uWind'),
                uIntensity: this.gl.getUniformLocation(this._weatherProgram, 'uIntensity'),
                uColorA: this.gl.getUniformLocation(this._weatherProgram, 'uColorA'),
                uColorB: this.gl.getUniformLocation(this._weatherProgram, 'uColorB')
            };

            this._loc.shadows = {
                aPos: this.gl.getAttribLocation(this._shadowProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._shadowProgram, 'aUv'),
                uBlobCount: this.gl.getUniformLocation(this._shadowProgram, 'uBlobCount'),
                uCenter: this.gl.getUniformLocation(this._shadowProgram, 'uCenter'),
                uRadius: this.gl.getUniformLocation(this._shadowProgram, 'uRadius'),
                uIntensity: this.gl.getUniformLocation(this._shadowProgram, 'uIntensity')
            };

            this._loc.distortion = {
                aPos: this.gl.getAttribLocation(this._distortionProgram, 'aPos'),
                aUv: this.gl.getAttribLocation(this._distortionProgram, 'aUv'),
                uTex: this.gl.getUniformLocation(this._distortionProgram, 'uTex'),
                uResolution: this.gl.getUniformLocation(this._distortionProgram, 'uResolution'),
                uTime: this.gl.getUniformLocation(this._distortionProgram, 'uTime'),
                uMode: this.gl.getUniformLocation(this._distortionProgram, 'uMode'),
                uGlobalStrength: this.gl.getUniformLocation(this._distortionProgram, 'uGlobalStrength'),
                uDistortionCount: this.gl.getUniformLocation(this._distortionProgram, 'uDistortionCount'),
                uCenter: this.gl.getUniformLocation(this._distortionProgram, 'uCenter'),
                uRadius: this.gl.getUniformLocation(this._distortionProgram, 'uRadius'),
                uStrength: this.gl.getUniformLocation(this._distortionProgram, 'uStrength'),
                uKind: this.gl.getUniformLocation(this._distortionProgram, 'uKind')
            };

            const verts = new Float32Array([
                -1, -1, 0, 0,
                 1, -1, 1, 0,
                -1,  1, 0, 1,
                 1,  1, 1, 1
            ]);
            this._quadBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._quadBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, verts, this.gl.STATIC_DRAW);

            const unitQuad = new Float32Array([
                0, 0,
                1, 0,
                0, 1,
                1, 1
            ]);
            this._unitQuadBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._unitQuadBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, unitQuad, this.gl.STATIC_DRAW);

            this._uploadTexture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._uploadTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);

            this._particleBuffer = this.gl.createBuffer();
        }

        _getOrCreateSpriteTexture(cacheKey, sourceCanvas) {
            if (!sourceCanvas) return null;
            let entry = this._spriteTextureCache[cacheKey];
            if (!entry) {
                const tex = this.gl.createTexture();
                this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
                entry = {
                    tex,
                    w: sourceCanvas.width,
                    h: sourceCanvas.height
                };
                this._spriteTextureCache[cacheKey] = entry;
                return entry.tex;
            }

            if (entry.w !== sourceCanvas.width || entry.h !== sourceCanvas.height) {
                this.gl.bindTexture(this.gl.TEXTURE_2D, entry.tex);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
                entry.w = sourceCanvas.width;
                entry.h = sourceCanvas.height;
            }
            return entry.tex;
        }

        _bindQuad(loc) {
            const aPos = loc.aPos;
            const aUv = loc.aUv;
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._quadBuffer);
            this.gl.enableVertexAttribArray(aPos);
            this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 16, 0);
            this.gl.enableVertexAttribArray(aUv);
            this.gl.vertexAttribPointer(aUv, 2, this.gl.FLOAT, false, 16, 8);
        }

        renderSkyLayer(ctx, sky, drawW, drawH) {
            if (!this.supportsHybridBasePass()) return false;
            this._ensureGLSize(drawW, drawH);

            const top = colorToVec4(sky && sky.top, [0.12, 0.26, 0.43, 1]);
            const mid = colorToVec4(sky && sky.mid, [0.14, 0.30, 0.45, 1]);
            const bot = colorToVec4(sky && sky.bot, [0.10, 0.22, 0.35, 1]);
            const veil = colorToVec4(sky && sky.veil, [0.5, 0.7, 0.9, 0.12]);

            this.gl.disable(this.gl.BLEND);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);

            this.gl.useProgram(this._gradientProgram);
            this._bindQuad(this._loc.gradient);
            this.gl.uniform3f(this._loc.gradient.uTop, top[0], top[1], top[2]);
            this.gl.uniform3f(this._loc.gradient.uMid, mid[0], mid[1], mid[2]);
            this.gl.uniform3f(this._loc.gradient.uBot, bot[0], bot[1], bot[2]);
            this.gl.uniform4f(this._loc.gradient.uVeil, veil[0], veil[1], veil[2], veil[3]);
            this.gl.uniform1f(this._loc.gradient.uMidStop, 0.55);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        _drawTextureSource(sourceCanvas, alpha) {
            if (!sourceCanvas) return;
            this.gl.useProgram(this._textureProgram);
            this._bindQuad(this._loc.texture);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._uploadTexture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);

            this.gl.uniform1i(this._loc.texture.uTex, 0);
            this.gl.uniform1f(this._loc.texture.uAlpha, alpha);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        }

        renderTerrainLiquidLayer(ctx, terrainCanvas, liquidCanvas, gameWidth, gameHeight) {
            if (!this.supportsHybridBasePass()) return false;
            if (!terrainCanvas) return false;

            this._ensureGLSize(gameWidth, gameHeight);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this._drawTextureSource(terrainCanvas, 1);
            if (liquidCanvas) this._drawTextureSource(liquidCanvas, 1);

            ctx.drawImage(this.glCanvas, 0, 0, gameWidth, gameHeight);
            return true;
        }

        renderGameLayerStack(ctx, layers, gameWidth, gameHeight) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(layers) || layers.length === 0) return false;

            this._ensureGLSize(gameWidth, gameHeight);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if (layer && layer.width > 0 && layer.height > 0) {
                    this._drawTextureSource(layer, 1);
                }
            }

            ctx.drawImage(this.glCanvas, 0, 0, gameWidth, gameHeight);
            return true;
        }

        renderPostProcessOverlay(ctx, drawW, drawH, options) {
            if (!this.supportsHybridBasePass()) return false;

            const opts = options || {};
            const grade = Array.isArray(opts.gradeRgb) ? opts.gradeRgb : [120, 170, 230];
            const gradeAlpha = typeof opts.gradeAlpha === 'number' ? opts.gradeAlpha : 0.05;
            const theme = String(opts.theme || 'grass');
            const themeMode = getThemeEffectMode(theme);
            const accent = getThemeAccentColors(theme);
            const colorA = Array.isArray(opts.themeColorA) ? opts.themeColorA : accent.a;
            const colorB = Array.isArray(opts.themeColorB) ? opts.themeColorB : accent.b;
            const atmosphereIntensity = typeof opts.atmosphereIntensity === 'number' ? opts.atmosphereIntensity : 1;
            const time = typeof opts.time === 'number' ? opts.time : 0;
            const wind = typeof opts.wind === 'number' ? opts.wind : 0;

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.useProgram(this._solidProgram);
            this._bindQuad(this._loc.solid);
            this.gl.uniform4f(
                this._loc.solid.uColor,
                Math.max(0, Math.min(255, grade[0])) / 255,
                Math.max(0, Math.min(255, grade[1])) / 255,
                Math.max(0, Math.min(255, grade[2])) / 255,
                Math.max(0, Math.min(1, gradeAlpha))
            );
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            this.gl.useProgram(this._atmosphereProgram);
            this._bindQuad(this._loc.atmosphere);
            this.gl.uniform1f(this._loc.atmosphere.uTime, time);
            this.gl.uniform1f(this._loc.atmosphere.uMode, themeMode);
            this.gl.uniform1f(this._loc.atmosphere.uWind, wind);
            this.gl.uniform1f(this._loc.atmosphere.uIntensity, Math.max(0, atmosphereIntensity));
            this.gl.uniform3f(this._loc.atmosphere.uColorA, colorA[0] / 255, colorA[1] / 255, colorA[2] / 255);
            this.gl.uniform3f(this._loc.atmosphere.uColorB, colorB[0] / 255, colorB[1] / 255, colorB[2] / 255);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            this.gl.useProgram(this._vignetteProgram);
            this._bindQuad(this._loc.vignette);
            this.gl.uniform2f(this._loc.vignette.uResolution, drawW, drawH);
            this.gl.uniform2f(this._loc.vignette.uCenter, drawW * 0.5, drawH * 0.5);
            this.gl.uniform1f(this._loc.vignette.uInnerR, drawH * 0.25);
            this.gl.uniform1f(this._loc.vignette.uMidR, drawW * 0.45);
            this.gl.uniform1f(this._loc.vignette.uOuterR, drawW * 0.62);
            this.gl.uniform3f(this._loc.vignette.uColor, 4 / 255, 8 / 255, 18 / 255);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        renderParticles(ctx, particles, gameWidth, gameHeight) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(particles) || particles.length === 0) return false;

            const packed = [];
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (!p) continue;
                if (!(p.life > 0 || p.isPermanent)) continue;
                const c = Array.isArray(p.color) ? p.color : [255, 255, 255];
                const alpha = p.isPermanent ? 1 : Math.max(0, (Number(p.life) || 0) / 40);
                if (alpha <= 0) continue;

                const px = Math.floor(Number(p.x) || 0) + 0.5;
                const py = Math.floor(Number(p.y) || 0) + 0.5;
                const sz = Math.max(1, Number(p.size) || 1);

                packed.push(
                    px,
                    py,
                    Math.max(0, Math.min(255, Number(c[0]) || 255)) / 255,
                    Math.max(0, Math.min(255, Number(c[1]) || 255)) / 255,
                    Math.max(0, Math.min(255, Number(c[2]) || 255)) / 255,
                    alpha,
                    sz
                );
            }

            if (packed.length === 0) return false;

            const neededFloats = packed.length;
            if (this._particleCpuBuffer.length < neededFloats) {
                const growTo = Math.max(neededFloats, Math.floor(this._particleCpuBuffer.length * 1.5) + 64);
                this._particleCpuBuffer = new Float32Array(growTo);
            }
            this._particleCpuBuffer.set(packed, 0);
            const data = this._particleCpuBuffer.subarray(0, neededFloats);
            return this._renderPackedParticleData(ctx, data, gameWidth, gameHeight);
        }

        renderParticleCloud(ctx, points, gameWidth, gameHeight) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(points) || points.length === 0) return false;

            const packed = [];
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (!p) continue;
                const c = Array.isArray(p.color) ? p.color : [255, 255, 255];
                const alpha = Math.max(0, Math.min(1, Number(p.alpha) || 0));
                if (alpha <= 0) continue;
                packed.push(
                    Number(p.x) || 0,
                    Number(p.y) || 0,
                    Math.max(0, Math.min(255, Number(c[0]) || 255)) / 255,
                    Math.max(0, Math.min(255, Number(c[1]) || 255)) / 255,
                    Math.max(0, Math.min(255, Number(c[2]) || 255)) / 255,
                    alpha,
                    Math.max(1, Number(p.size) || 1)
                );
            }

            if (packed.length === 0) return false;
            const neededFloats = packed.length;
            if (this._particleCpuBuffer.length < neededFloats) {
                const growTo = Math.max(neededFloats, Math.floor(this._particleCpuBuffer.length * 1.5) + 64);
                this._particleCpuBuffer = new Float32Array(growTo);
            }
            this._particleCpuBuffer.set(packed, 0);
            const data = this._particleCpuBuffer.subarray(0, neededFloats);
            return this._renderPackedParticleData(ctx, data, gameWidth, gameHeight);
        }

        _renderPackedParticleData(ctx, data, gameWidth, gameHeight) {
            if (!data || data.length === 0) return false;

            this._ensureGLSize(gameWidth, gameHeight);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.useProgram(this._particleProgram);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._particleBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);

            const stride = 7 * 4;
            const aPos = this._loc.particles.aPos;
            const aColor = this._loc.particles.aColor;
            const aSize = this._loc.particles.aSize;

            this.gl.enableVertexAttribArray(aPos);
            this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, stride, 0);
            this.gl.enableVertexAttribArray(aColor);
            this.gl.vertexAttribPointer(aColor, 4, this.gl.FLOAT, false, stride, 8);
            this.gl.enableVertexAttribArray(aSize);
            this.gl.vertexAttribPointer(aSize, 1, this.gl.FLOAT, false, stride, 24);

            this.gl.uniform2f(this._loc.particles.uResolution, gameWidth, gameHeight);
            this.gl.drawArrays(this.gl.POINTS, 0, data.length / 7);

            ctx.drawImage(this.glCanvas, 0, 0, gameWidth, gameHeight);
            return true;
        }

        renderPuffinBodies(ctx, instances, getCanvasByKey, gameWidth, gameHeight, bodySize) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(instances) || instances.length === 0) return false;
            if (typeof getCanvasByKey !== 'function') return false;

            const bodyW = bodySize && Number(bodySize.w) > 0 ? Number(bodySize.w) : 12;
            const bodyH = bodySize && Number(bodySize.h) > 0 ? Number(bodySize.h) : 14;

            this._ensureGLSize(gameWidth, gameHeight);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.useProgram(this._spriteProgram);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._unitQuadBuffer);
            this.gl.enableVertexAttribArray(this._loc.sprite.aUnit);
            this.gl.vertexAttribPointer(this._loc.sprite.aUnit, 2, this.gl.FLOAT, false, 8, 0);
            this.gl.uniform2f(this._loc.sprite.uResolution, gameWidth, gameHeight);
            this.gl.uniform1i(this._loc.sprite.uTex, 0);

            let draws = 0;
            for (let i = 0; i < instances.length; i++) {
                const inst = instances[i];
                if (!inst || !inst.key) continue;
                const sourceCanvas = getCanvasByKey(inst.key);
                if (!sourceCanvas) continue;

                const tex = this._getOrCreateSpriteTexture(inst.key, sourceCanvas);
                if (!tex) continue;

                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
                this.gl.uniform2f(this._loc.sprite.uPos, inst.x, inst.y);
                this.gl.uniform2f(this._loc.sprite.uSize, bodyW, bodyH);
                this.gl.uniform1f(this._loc.sprite.uFlipX, inst.flipX ? 1 : 0);
                const tint = Array.isArray(inst.tint) ? inst.tint : [255, 255, 255];
                const rimColor = Array.isArray(inst.rimColor) ? inst.rimColor : [255, 255, 255];
                this.gl.uniform3f(this._loc.sprite.uTint, tint[0] / 255, tint[1] / 255, tint[2] / 255);
                this.gl.uniform1f(this._loc.sprite.uTintStrength, Math.max(0, Math.min(1, Number(inst.tintStrength) || 0)));
                this.gl.uniform3f(this._loc.sprite.uRimColor, rimColor[0] / 255, rimColor[1] / 255, rimColor[2] / 255);
                this.gl.uniform1f(this._loc.sprite.uRimStrength, Math.max(0, Math.min(1.5, Number(inst.rimStrength) || 0)));
                this.gl.uniform1f(this._loc.sprite.uGlow, Math.max(0, Math.min(1.5, Number(inst.glow) || 0)));
                this.gl.uniform2f(this._loc.sprite.uTexelSize, 1 / Math.max(1, sourceCanvas.width), 1 / Math.max(1, sourceCanvas.height));
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
                draws++;
            }

            if (draws === 0) return false;
            ctx.drawImage(this.glCanvas, 0, 0, gameWidth, gameHeight);
            return true;
        }

        renderDynamicLights(ctx, drawW, drawH, lights) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(lights) || lights.length === 0) return false;

            const active = [];
            for (let i = 0; i < lights.length && active.length < 16; i++) {
                const l = lights[i];
                if (!l) continue;
                const radius = Number(l.radius) || 0;
                const intensity = Number(l.intensity) || 0;
                if (radius <= 0 || intensity <= 0) continue;
                const c = Array.isArray(l.color) ? l.color : [255, 255, 255];
                active.push({
                    x: Number(l.x) || 0,
                    y: Number(l.y) || 0,
                    radius,
                    intensity,
                    color: [
                        Math.max(0, Math.min(255, Number(c[0]) || 255)) / 255,
                        Math.max(0, Math.min(255, Number(c[1]) || 255)) / 255,
                        Math.max(0, Math.min(255, Number(c[2]) || 255)) / 255
                    ]
                });
            }
            if (active.length === 0) return false;

            const pos = new Float32Array(16 * 2);
            const col = new Float32Array(16 * 3);
            const rad = new Float32Array(16);
            const inten = new Float32Array(16);

            for (let i = 0; i < active.length; i++) {
                const l = active[i];
                pos[i * 2] = l.x;
                pos[i * 2 + 1] = l.y;
                col[i * 3] = l.color[0];
                col[i * 3 + 1] = l.color[1];
                col[i * 3 + 2] = l.color[2];
                rad[i] = l.radius;
                inten[i] = l.intensity;
            }

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

            this.gl.useProgram(this._lightProgram);
            this._bindQuad(this._loc.lights);
            this.gl.uniform2f(this._loc.lights.uResolution, drawW, drawH);
            this.gl.uniform1i(this._loc.lights.uLightCount, active.length);
            this.gl.uniform2fv(this._loc.lights.uLightPos, pos);
            this.gl.uniform3fv(this._loc.lights.uLightColor, col);
            this.gl.uniform1fv(this._loc.lights.uLightRadius, rad);
            this.gl.uniform1fv(this._loc.lights.uLightIntensity, inten);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        renderRingwaves(ctx, drawW, drawH, waves) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(waves) || waves.length === 0) return false;

            const active = [];
            for (let i = 0; i < waves.length && active.length < 12; i++) {
                const w = waves[i];
                if (!w) continue;
                const radius = Number(w.radius) || 0;
                const width = Number(w.width) || 0;
                const intensity = Number(w.intensity) || 0;
                if (radius <= 0 || width <= 0 || intensity <= 0) continue;
                const c = Array.isArray(w.color) ? w.color : [255, 140, 60];
                active.push({
                    x: Number(w.x) || 0,
                    y: Number(w.y) || 0,
                    radius,
                    width,
                    intensity,
                    color: [
                        Math.max(0, Math.min(255, Number(c[0]) || 255)) / 255,
                        Math.max(0, Math.min(255, Number(c[1]) || 255)) / 255,
                        Math.max(0, Math.min(255, Number(c[2]) || 255)) / 255
                    ]
                });
            }
            if (active.length === 0) return false;

            const center = new Float32Array(12 * 2);
            const radius = new Float32Array(12);
            const width = new Float32Array(12);
            const color = new Float32Array(12 * 3);
            const intensity = new Float32Array(12);

            for (let i = 0; i < active.length; i++) {
                const w = active[i];
                center[i * 2] = w.x;
                center[i * 2 + 1] = w.y;
                radius[i] = w.radius;
                width[i] = w.width;
                color[i * 3] = w.color[0];
                color[i * 3 + 1] = w.color[1];
                color[i * 3 + 2] = w.color[2];
                intensity[i] = w.intensity;
            }

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

            this.gl.useProgram(this._ringProgram);
            this._bindQuad(this._loc.rings);
            this.gl.uniform1i(this._loc.rings.uWaveCount, active.length);
            this.gl.uniform2fv(this._loc.rings.uCenter, center);
            this.gl.uniform1fv(this._loc.rings.uRadius, radius);
            this.gl.uniform1fv(this._loc.rings.uWidth, width);
            this.gl.uniform3fv(this._loc.rings.uColor, color);
            this.gl.uniform1fv(this._loc.rings.uIntensity, intensity);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        renderPortalEffect(ctx, drawW, drawH, effect) {
            if (!this.supportsHybridBasePass()) return false;
            if (!effect) return false;

            const x = Number(effect.x) || 0;
            const y = Number(effect.y) || 0;
            const radius = Number(effect.radius) || 0;
            const pulse = Math.max(0, Math.min(1.5, Number(effect.pulse) || 0));
            const intensity = Math.max(0, Math.min(2, Number(effect.intensity) || 0));
            const time = Number(effect.time) || 0;
            if (radius <= 0 || intensity <= 0) return false;

            const ca = Array.isArray(effect.colorA) ? effect.colorA : [80, 255, 170];
            const cb = Array.isArray(effect.colorB) ? effect.colorB : [40, 220, 255];

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

            this.gl.useProgram(this._portalProgram);
            this._bindQuad(this._loc.portal);
            this.gl.uniform2f(this._loc.portal.uResolution, drawW, drawH);
            this.gl.uniform2f(this._loc.portal.uCenter, x, y);
            this.gl.uniform1f(this._loc.portal.uTime, time);
            this.gl.uniform1f(this._loc.portal.uPulse, pulse);
            this.gl.uniform1f(this._loc.portal.uRadius, radius);
            this.gl.uniform1f(this._loc.portal.uIntensity, intensity);
            this.gl.uniform3f(
                this._loc.portal.uColorA,
                Math.max(0, Math.min(255, Number(ca[0]) || 255)) / 255,
                Math.max(0, Math.min(255, Number(ca[1]) || 255)) / 255,
                Math.max(0, Math.min(255, Number(ca[2]) || 255)) / 255
            );
            this.gl.uniform3f(
                this._loc.portal.uColorB,
                Math.max(0, Math.min(255, Number(cb[0]) || 255)) / 255,
                Math.max(0, Math.min(255, Number(cb[1]) || 255)) / 255,
                Math.max(0, Math.min(255, Number(cb[2]) || 255)) / 255
            );
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        renderWeatherField(ctx, gameWidth, gameHeight, options) {
            if (!this.supportsHybridBasePass()) return false;

            const opts = options || {};
            const theme = String(opts.theme || 'grass');
            const mode = getThemeEffectMode(theme);
            const intensity = typeof opts.intensity === 'number' ? opts.intensity : 1;
            const accent = getThemeAccentColors(theme);
            const colorA = Array.isArray(opts.colorA) ? opts.colorA : accent.a;
            const colorB = Array.isArray(opts.colorB) ? opts.colorB : accent.b;
            const time = typeof opts.time === 'number' ? opts.time : 0;
            const wind = typeof opts.wind === 'number' ? opts.wind : 0;

            this._ensureGLSize(gameWidth, gameHeight);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.useProgram(this._weatherProgram);
            this._bindQuad(this._loc.weather);
            this.gl.uniform1f(this._loc.weather.uTime, time);
            this.gl.uniform1f(this._loc.weather.uMode, mode);
            this.gl.uniform1f(this._loc.weather.uWind, wind);
            this.gl.uniform1f(this._loc.weather.uIntensity, Math.max(0, intensity));
            this.gl.uniform3f(this._loc.weather.uColorA, colorA[0] / 255, colorA[1] / 255, colorA[2] / 255);
            this.gl.uniform3f(this._loc.weather.uColorB, colorB[0] / 255, colorB[1] / 255, colorB[2] / 255);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, gameWidth, gameHeight);
            return true;
        }

        renderShadowBlobs(ctx, drawW, drawH, blobs) {
            if (!this.supportsHybridBasePass()) return false;
            if (!Array.isArray(blobs) || blobs.length === 0) return false;

            const active = [];
            for (let i = 0; i < blobs.length && active.length < 16; i++) {
                const blob = blobs[i];
                if (!blob) continue;
                const radius = Number(blob.radius) || 0;
                const intensity = Number(blob.intensity) || 0;
                if (radius <= 0 || intensity <= 0) continue;
                active.push({
                    x: Number(blob.x) || 0,
                    y: Number(blob.y) || 0,
                    radius,
                    intensity
                });
            }
            if (active.length === 0) return false;

            const center = new Float32Array(16 * 2);
            const radius = new Float32Array(16);
            const intensity = new Float32Array(16);
            for (let i = 0; i < active.length; i++) {
                center[i * 2] = active[i].x;
                center[i * 2 + 1] = active[i].y;
                radius[i] = active[i].radius;
                intensity[i] = active[i].intensity;
            }

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.useProgram(this._shadowProgram);
            this._bindQuad(this._loc.shadows);
            this.gl.uniform1i(this._loc.shadows.uBlobCount, active.length);
            this.gl.uniform2fv(this._loc.shadows.uCenter, center);
            this.gl.uniform1fv(this._loc.shadows.uRadius, radius);
            this.gl.uniform1fv(this._loc.shadows.uIntensity, intensity);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }

        renderScreenDistortion(ctx, drawW, drawH, options) {
            if (!this.supportsHybridBasePass()) return false;

            const opts = options || {};
            const theme = String(opts.theme || 'grass');
            const mode = getThemeEffectMode(theme);
            const effects = Array.isArray(opts.effects) ? opts.effects : [];
            const active = [];
            for (let i = 0; i < effects.length && active.length < 12; i++) {
                const effect = effects[i];
                if (!effect) continue;
                const radius = Number(effect.radius) || 0;
                const strength = Number(effect.strength) || 0;
                if (radius <= 0 || strength <= 0) continue;
                active.push({
                    x: Number(effect.x) || 0,
                    y: Number(effect.y) || 0,
                    radius,
                    strength,
                    kind: getDistortionKind(effect.kind)
                });
            }

            const center = new Float32Array(12 * 2);
            const radius = new Float32Array(12);
            const strength = new Float32Array(12);
            const kind = new Float32Array(12);
            for (let i = 0; i < active.length; i++) {
                center[i * 2] = active[i].x;
                center[i * 2 + 1] = active[i].y;
                radius[i] = active[i].radius;
                strength[i] = active[i].strength;
                kind[i] = active[i].kind;
            }

            this._ensureGLSize(drawW, drawH);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.disable(this.gl.BLEND);

            this.gl.useProgram(this._distortionProgram);
            this._bindQuad(this._loc.distortion);
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._uploadTexture);
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.canvas);
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
            this.gl.uniform1i(this._loc.distortion.uTex, 0);
            this.gl.uniform2f(this._loc.distortion.uResolution, drawW, drawH);
            this.gl.uniform1f(this._loc.distortion.uTime, typeof opts.time === 'number' ? opts.time : 0);
            this.gl.uniform1f(this._loc.distortion.uMode, mode);
            this.gl.uniform1f(this._loc.distortion.uGlobalStrength, Math.max(0, Number(opts.globalStrength) || 0));
            this.gl.uniform1i(this._loc.distortion.uDistortionCount, active.length);
            this.gl.uniform2fv(this._loc.distortion.uCenter, center);
            this.gl.uniform1fv(this._loc.distortion.uRadius, radius);
            this.gl.uniform1fv(this._loc.distortion.uStrength, strength);
            this.gl.uniform1fv(this._loc.distortion.uKind, kind);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            ctx.drawImage(this.glCanvas, 0, 0, drawW, drawH);
            return true;
        }
    }

    function createRenderer(canvas, options) {
        const requested = (options && options.backend ? String(options.backend) : 'canvas2d').toLowerCase();

        if (requested === 'webgl') {
            const webglRenderer = new WebGLRenderer(canvas, options);
            if (webglRenderer.initialize()) {
                console.info('[Renderer] WebGL backend initialized.');
                return webglRenderer;
            }
            console.warn('[Renderer] WebGL unavailable, falling back to Canvas2D backend.');
        }

        const canvasRenderer = new Canvas2DRenderer(canvas, options);
        if (!canvasRenderer.initialize()) {
            throw new Error('Unable to initialize Canvas2D renderer.');
        }
        return canvasRenderer;
    }

    global.RendererFactory = {
        createRenderer
    };
})(window);
