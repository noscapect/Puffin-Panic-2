// =============================================================================
// PerfMonitor — Phase 0 draw-pass timing instrumentation
// Toggle overlay:    ` (backtick)
// Copy report:       ~ (tilde / Shift+backtick)
// Auto-log baseline: first 180 frames (~3 s) are silently collected, then a
//                    one-time summary is printed to the console automatically.
// =============================================================================
(function (global) {
    'use strict';

    const MAX_SAMPLES = 180;  // ~3 s of history at 60 fps

    // Per-feature render-time budgets (ms). Warn if avg exceeds these.
    const BUDGETS = {
        frame:        16.67,   // full draw call (60 fps target)
        sky:           0.50,
        background:    1.00,
        terrain:       1.50,
        layerStack:    2.00,
        terrainEdgeFx: 0.70,
        shadows:       0.70,
        entities:      1.50,
        particles:     1.00,
        bomberTrails:  0.50,
        weather:       1.00,
        weatherField:  0.55,
        caveMotes:     0.45,
        postProcess:   1.50,
        lights:        1.00,
        ringwaves:     0.50,
        portal:        0.50,
        exitRefraction: 0.45,
        portalSparkles: 0.35,
        distortion:    0.80
    };

    // ── Internal state ─────────────────────────────────────────────────────────
    let _enabled     = false;
    let _overlayEl   = null;
    let _intervalId  = null;
    let _baselineDone = false;

    // Map of name → { samples: number[], _start: number }
    const _timings = {};

    function _ensure(name) {
        if (!_timings[name]) _timings[name] = { samples: [], _start: 0 };
        return _timings[name];
    }

    // ── Sampling API (called from engine.js) ──────────────────────────────────
    function passStart(name) {
        const t = _ensure(name);
        t._start = performance.now();
    }

    function passEnd(name) {
        const t = _timings[name];
        if (!t || t._start === 0) return;
        const ms = performance.now() - t._start;
        t.samples.push(ms);
        if (t.samples.length > MAX_SAMPLES) t.samples.shift();
        t._start = 0;

        // Auto-baseline: after first full batch of frame samples log once.
        if (name === 'frame' && !_baselineDone && t.samples.length >= MAX_SAMPLES) {
            _baselineDone = true;
            const report = getReport();
            console.groupCollapsed('[PerfMonitor] Baseline report (first 3 s)');
            console.log(report);
            console.groupEnd();
        }
    }

    // Convenience wrappers used in gameLoop.
    function frameStart() { passStart('frame'); }
    function frameEnd()   { passEnd('frame');   }

    // ── Math helpers ──────────────────────────────────────────────────────────
    function _avg(arr) {
        if (!arr.length) return 0;
        let s = 0;
        for (let i = 0; i < arr.length; i++) s += arr[i];
        return s / arr.length;
    }
    function _max(arr) {
        if (!arr.length) return 0;
        let m = 0;
        for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
        return m;
    }
    function _p95(arr) {
        if (arr.length < 2) return _max(arr);
        const sorted = arr.slice().sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)];
    }

    // ── Overlay ───────────────────────────────────────────────────────────────
    function _createOverlay() {
        if (_overlayEl) return;
        const el = document.createElement('div');
        el.id = 'perf-overlay';
        Object.assign(el.style, {
            position:      'fixed',
            top:           '8px',
            right:         '8px',
            background:    'rgba(0,0,0,0.85)',
            color:         '#8fffaf',
            font:          '11px/1.6 "Courier New", monospace',
            padding:       '8px 12px',
            border:        '1px solid #2a6b3a',
            borderRadius:  '4px',
            zIndex:        '9999',
            pointerEvents: 'none',
            whiteSpace:    'pre',
            userSelect:    'none'
        });
        document.body.appendChild(el);
        _overlayEl = el;
    }

    function _destroyOverlay() {
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
    }

    const PASS_ORDER = [
        'frame', 'sky', 'background', 'terrain', 'layerStack',
        'terrainEdgeFx', 'shadows', 'entities', 'particles', 'bomberTrails', 'weather',
        'weatherField', 'caveMotes', 'postProcess', 'lights', 'ringwaves',
        'portal', 'exitRefraction', 'portalSparkles', 'distortion'
    ];

    function _refreshOverlay() {
        if (!_overlayEl) return;

        const ft = _timings['frame'];
        const avgF = ft ? _avg(ft.samples) : 0;
        const fps  = avgF > 0 ? (1000 / avgF).toFixed(1) : '---';
        const p95F = ft ? _p95(ft.samples).toFixed(2) : '---';

        const puffCnt  = typeof puffins    !== 'undefined' ? puffins.length    : '?';
        const partCnt  = typeof particles  !== 'undefined' ? particles.length  : '?';

        const lines = [
            `✦ Puffin Panic Perf Monitor ✦`,
            `FPS ${fps.padStart(6)}  frame ${avgF.toFixed(2)}ms  p95 ${p95F}ms`,
            `Puffins ${String(puffCnt).padStart(4)}   Particles ${String(partCnt).padStart(4)}`,
            `─────────────────────────────────────`,
        ];

        for (const name of PASS_ORDER) {
            if (name === 'frame') continue; // already shown above
            const p = _timings[name];
            if (!p || !p.samples.length) continue;
            const avg    = _avg(p.samples);
            const budget = BUDGETS[name] || 1.0;
            const over   = avg > budget;
            const marker = over ? '⚠' : '✓';
            const col    = over ? '\u001b[33m' : '';  // no real ANSI in DOM but irrelevant
            lines.push(
                `${marker} ${name.padEnd(13)} ${avg.toFixed(2).padStart(5)}ms  /${budget}ms`
            );
        }

        lines.push('');
        lines.push('` toggle  ~ copy report');
        _overlayEl.textContent = lines.join('\n');
    }

    // ── Public lifecycle ──────────────────────────────────────────────────────
    function enable() {
        if (_enabled) return;
        _enabled = true;
        _createOverlay();
        _intervalId = setInterval(_refreshOverlay, 200);
    }

    function disable() {
        if (!_enabled) return;
        _enabled = false;
        if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
        _destroyOverlay();
    }

    function toggle() {
        if (_enabled) disable(); else enable();
    }

    // ── Report ────────────────────────────────────────────────────────────────
    function getReport() {
        const ft   = _timings['frame'];
        const avgF = ft ? _avg(ft.samples)  : 0;
        const maxF = ft ? _max(ft.samples)  : 0;
        const p95F = ft ? _p95(ft.samples)  : 0;
        const fps  = avgF > 0 ? (1000 / avgF).toFixed(1) : '---';

        const lines = [
            '=== Puffin Panic 2 — Perf Baseline Report ===',
            `Date      : ${new Date().toISOString()}`,
            `FPS (avg) : ${fps}`,
            `Frame avg : ${avgF.toFixed(3)} ms`,
            `Frame max : ${maxF.toFixed(3)} ms`,
            `Frame p95 : ${p95F.toFixed(3)} ms`,
            `Samples   : ${ft ? ft.samples.length : 0}`,
            ''
        ];

        /* Per-pass breakdown */
        let passData = [];
        for (const name of PASS_ORDER) {
            if (name === 'frame') continue;
            const p = _timings[name];
            if (!p || !p.samples.length) continue;
            const avg    = _avg(p.samples);
            const max    = _max(p.samples);
            const budget = BUDGETS[name] || 1.0;
            passData.push({ name, avg, max, budget });
        }
        const nameW   = Math.max(...passData.map(d => d.name.length), 4);
        lines.push('Pass breakdown:');
        lines.push(`  ${'pass'.padEnd(nameW)}  avg(ms)  max(ms)  budget  ok?`);
        lines.push(`  ${'─'.repeat(nameW)}  ───────  ───────  ──────  ───`);
        for (const d of passData) {
            const ok = d.avg <= d.budget ? 'yes' : 'NO ⚠';
            lines.push(
                `  ${d.name.padEnd(nameW)}  ${d.avg.toFixed(3).padStart(7)}  ` +
                `${d.max.toFixed(3).padStart(7)}  ${String(d.budget).padStart(6)}  ${ok}`
            );
        }

        return lines.join('\n');
    }

    function copyReport() {
        const txt = getReport();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(txt)
                .then(() => console.log('[PerfMonitor] Report copied to clipboard.'))
                .catch(() => console.log(txt));
        } else {
            console.log(txt);
        }
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    window.addEventListener('keydown', function (e) {
        if (e.key === '`') { toggle(); e.preventDefault(); }
        if (e.key === '~') { copyReport(); e.preventDefault(); }
    });

    // ── Export ────────────────────────────────────────────────────────────────
    global.PerfMonitor = {
        enable,
        disable,
        toggle,
        frameStart,
        frameEnd,
        passStart,
        passEnd,
        getReport,
        copyReport,
        get enabled() { return _enabled; }
    };

    // Start collecting samples immediately even before the overlay is open,
    // so the baseline auto-log works without the user touching anything.
    // (passStart/passEnd are no-ops if the timing isn't running — we always
    //  record but only display when _enabled is true.)

    // Override to always collect (display controlled separately)
    const _origPassStart = passStart;
    const _origPassEnd   = passEnd;

})(window);
