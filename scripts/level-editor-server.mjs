#!/usr/bin/env node
/**
 * Puffin Panic 2 – Standalone Level Editor Server
 *
 * Serves the level editor UI and provides read/write API for the 99 campaign levels.
 * Run:  node scripts/level-editor-server.mjs
 * Open: http://localhost:3747
 */

import { createServer }                          from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, extname, sep }                   from 'path';
import { fileURLToPath }                           from 'url';
import { exec }                                    from 'child_process';

const ROOT       = resolve(fileURLToPath(import.meta.url), '..', '..');
const LEVELS_DIR = resolve(ROOT, 'levels');
const PORT       = 3747;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico':  'image/x-icon',
    '.svg':  'image/svg+xml',
};

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((ok, fail) => {
        let data = '';
        req.on('data', chunk => { data += chunk; if (data.length > 8_000_000) fail(new Error('Body too large')); });
        req.on('end',  () => ok(data));
        req.on('error', fail);
    });
}

const server = createServer(async (req, res) => {
    try {
        const url      = new URL(req.url, `http://localhost:${PORT}`);
        const pathname = url.pathname;
        const method   = req.method;

        // CORS preflight
        if (method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

        // ── GET /api/levels  (list all 99 with names) ──────────────
        if (pathname === '/api/levels' && method === 'GET') {
            const list = [];
            for (let i = 1; i <= 99; i++) {
                const n = String(i).padStart(3, '0');
                const p = resolve(LEVELS_DIR, `level_${n}.json`);
                if (!existsSync(p)) continue;
                try {
                    const d = JSON.parse(readFileSync(p, 'utf8'));
                    list.push({ n: i, name: d.name || `Level ${i}` });
                } catch { /* skip malformed */ }
            }
            return sendJson(res, list);
        }

        // ── GET /api/level/:n  (read raw JSON) ─────────────────────
        // ── POST /api/level/:n (write JSON back to disk) ──────────
        const m = pathname.match(/^\/api\/level\/(\d+)$/);
        if (m) {
            const n   = parseInt(m[1]);
            if (n < 1 || n > 99) return sendJson(res, { error: 'Level number out of range (1-99)' }, 400);
            const pad = String(n).padStart(3, '0');
            const p   = resolve(LEVELS_DIR, `level_${pad}.json`);

            if (method === 'GET') {
                if (!existsSync(p)) return sendJson(res, { error: 'Level file not found' }, 404);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
                res.end(readFileSync(p, 'utf8'));
                return;
            }

            if (method === 'POST') {
                const body = await readBody(req);
                try { JSON.parse(body); } catch (e) {
                    return sendJson(res, { ok: false, error: `Invalid JSON: ${e.message}` }, 400);
                }
                // Path traversal guard — resolved path must be inside LEVELS_DIR
                if (!p.startsWith(LEVELS_DIR + sep)) {
                    return sendJson(res, { ok: false, error: 'Forbidden' }, 403);
                }
                writeFileSync(p, body, 'utf8');
                console.log(`  Saved levels/level_${pad}.json`);
                return sendJson(res, { ok: true, file: `levels/level_${pad}.json` });
            }
        }

        // ── Static files ────────────────────────────────────────────
        let filePath;
        if (pathname === '/' || pathname === '/level-editor.html') {
            filePath = resolve(ROOT, 'level-editor.html');
        } else {
            const rel = pathname.replace(/^\//, '');
            filePath  = resolve(ROOT, rel);
            // Path traversal guard — must stay inside project root
            if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
        }

        if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }

        const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, ...CORS });
        res.end(readFileSync(filePath));

    } catch (err) {
        console.error(err);
        res.writeHead(500); res.end('Internal error: ' + err.message);
    }
});

const editorUrl = `http://localhost:${PORT}`;
server.listen(PORT, () => {
    console.log('\n  🐧 Puffin Panic 2 – Level Editor');
    console.log(`  🌐 ${editorUrl}`);
    console.log('  Press Ctrl+C to stop.\n');
    const open = process.platform === 'win32' ? `start ${editorUrl}`
               : process.platform === 'darwin' ? `open ${editorUrl}`
               : `xdg-open ${editorUrl}`;
    exec(open);
});
