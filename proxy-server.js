/**
 * Realm of Nexus — Proxy Server
 *
 * Runs on http://localhost:3001
 * Two jobs:
 *   1. Forward Claude AI requests to api.anthropic.com (keeps API key off the browser)
 *   2. Read/write save files to Documents\Realm of Nexus Saves\ (survives browser wipes)
 *
 * Start with: node --env-file=.env proxy-server.js
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = 3001;
const ANTHROPIC_HOST = 'api.anthropic.com';
const OPENAI_HOST = 'api.openai.com';

// Save files go here: C:\Users\<you>\Documents\Realm of Nexus Saves\
const SAVE_DIR = path.join(os.homedir(), 'Documents', 'Realm of Nexus Saves');
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    console.log(`[proxy] Created save folder: ${SAVE_DIR}`);
}

// Read API keys from environment
const API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY && !OPENAI_API_KEY) {
    console.warn('\n[proxy] WARNING: no AI API key set — AI narration will use fallback text.');
    console.warn('[proxy] To enable AI: add ANTHROPIC_API_KEY=sk-ant-... or OPENAI_API_KEY=sk-... to your .env file\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
    });
}

function send(res, status, data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleClaudeProxy(req, res) {
    if (!API_KEY) {
        send(res, 503, { error: 'API key not configured' });
        return;
    }

    const body = await readBody(req);

    const options = {
        hostname: ANTHROPIC_HOST,
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[proxy] Anthropic request failed:', err.message);
        send(res, 502, { error: 'Proxy request failed' });
    });

    proxyReq.write(body);
    proxyReq.end();
}

async function handleOpenAIProxy(req, res) {
    if (!OPENAI_API_KEY) {
        send(res, 503, { error: 'OpenAI API key not configured' });
        return;
    }

    const body = await readBody(req);

    const options = {
        hostname: OPENAI_HOST,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[proxy] OpenAI request failed:', err.message);
        send(res, 502, { error: 'Proxy request failed' });
    });

    proxyReq.write(body);
    proxyReq.end();
}

async function handleSaveWrite(req, res, slot) {
    const body = await readBody(req);

    try {
        const saveData = JSON.parse(body);
        const filename = `verdance_save_slot${slot}.json`;
        const filepath = path.join(SAVE_DIR, filename);

        // Keep one backup
        if (fs.existsSync(filepath)) {
            fs.copyFileSync(filepath, path.join(SAVE_DIR, `verdance_save_slot${slot}_backup.json`));
        }

        fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2), 'utf8');
        console.log(`[proxy] Save written: ${filepath}`);
        send(res, 200, { ok: true, path: filepath });
    } catch (err) {
        console.error('[proxy] Save write failed:', err.message);
        send(res, 500, { error: err.message });
    }
}

function handleSaveRead(res, slot) {
    const filename = `verdance_save_slot${slot}.json`;
    const filepath = path.join(SAVE_DIR, filename);

    if (!fs.existsSync(filepath)) {
        send(res, 404, { error: 'No save file found', slot });
        return;
    }

    try {
        const json = fs.readFileSync(filepath, 'utf8');
        send(res, 200, json);
        console.log(`[proxy] Save read: ${filepath}`);
    } catch (err) {
        console.error('[proxy] Save read failed:', err.message);
        send(res, 500, { error: err.message });
    }
}

function handleSaveList(res) {
    const slots = [];
    for (let i = 0; i < 3; i++) {
        const filepath = path.join(SAVE_DIR, `verdance_save_slot${i}.json`);
        if (fs.existsSync(filepath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                slots.push({
                    slot: i,
                    timestamp: data.timestamp,
                    level: data.progression?.level ?? '?',
                    location: data.location ?? 'Unknown',
                    path: filepath
                });
            } catch {
                slots.push({ slot: i, corrupted: true });
            }
        } else {
            slots.push({ slot: i, empty: true });
        }
    }
    send(res, 200, slots);
}

// ── Main server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url;

    // POST /api/claude  — forward to Anthropic
    if (req.method === 'POST' && url === '/api/claude') {
        await handleClaudeProxy(req, res);
        return;
    }

    // POST /api/openai  — forward to OpenAI chat completions
    if (req.method === 'POST' && url === '/api/openai') {
        await handleOpenAIProxy(req, res);
        return;
    }

    // POST /api/save/:slot  — write save file to disk
    const saveWriteMatch = url.match(/^\/api\/save\/(\d)$/);
    if (req.method === 'POST' && saveWriteMatch) {
        await handleSaveWrite(req, res, saveWriteMatch[1]);
        return;
    }

    // GET /api/save/:slot  — read save file from disk
    const saveReadMatch = url.match(/^\/api\/save\/(\d)$/);
    if (req.method === 'GET' && saveReadMatch) {
        handleSaveRead(res, saveReadMatch[1]);
        return;
    }

    // GET /api/save  — list all save slots
    if (req.method === 'GET' && url === '/api/save') {
        handleSaveList(res);
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n[proxy] Realm of Nexus proxy running on http://localhost:${PORT}`);
    console.log(`[proxy] Save files → ${SAVE_DIR}`);
    console.log(`[proxy] Claude narration → ${API_KEY ? 'ENABLED' : 'DISABLED (no key)'}`);
    console.log(`[proxy] OpenAI narration → ${OPENAI_API_KEY ? 'ENABLED' : 'DISABLED (no key)'}`);
    console.log('[proxy] Ready.\n');
});
