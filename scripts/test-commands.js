import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cliPath = path.join(repoRoot, 'bin', 'cli.js');
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'brokkr-mem-test-'));
const envBase = {
  ...process.env,
  HOME: tmpHome
};

function run(args, { env = {}, allowFail = false } = {}) {
  process.stderr.write(`RUN brokkr-mem ${args.join(' ')}\n`);
  try {
    const output = execFileSync('node', [cliPath, ...args], {
      cwd: repoRoot,
      env: { ...envBase, ...env },
      encoding: 'utf8'
    });
    return output;
  } catch (err) {
    if (!allowFail) {
      throw new Error(`Command failed: brokkr-mem ${args.join(' ')}\n${err.stdout || ''}${err.stderr || ''}`);
    }
    return (err.stdout || '') + (err.stderr || '');
  }
}

function assertContains(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Assertion failed (${label}): expected output to contain "${needle}"\nGot:\n${text}`);
  }
}

function startFakeOllamaProcess() {
  const script = `
    const http = require('http');
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          const parsed = JSON.parse(body);
          if (!parsed.prompt) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('missing prompt');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            response: JSON.stringify([
              { category: 'project', key: 'brokkr.mem.status', value: 'Implemented CLI commands' },
              { category: 'lesson', key: 'testing.extract', value: 'Use Ollama API JSON output' }
            ])
          }));
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      process.stdout.write(String(port) + '\\n');
    });
  `;

  return new Promise((resolve, reject) => {
    const child = spawn('node', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';

    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
      const line = out.trim();
      if (line) {
        const port = Number.parseInt(line, 10);
        if (Number.isInteger(port) && port > 0) {
          resolve({ child, port });
        }
      }
    });

    child.once('error', reject);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        reject(new Error(text));
      }
    });
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Fake Ollama server exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const importFile = path.join(repoRoot, 'tmp-import.json');
  const extractFile = path.join(repoRoot, 'tmp-extract.md');
  const injectOut = path.join(repoRoot, 'tmp-inject.md');

  fs.writeFileSync(importFile, JSON.stringify([
    { category: 'person', key: 'cory.name', value: 'Cory', source: 'import', confidence: 0.9 },
    { category: 'environment', key: 'host.name', value: 'brokkr' }
  ], null, 2));
  fs.writeFileSync(extractFile, '# Session\nCory built brokkr-mem today.');

  try {
    run(['add', 'project', 'brokkr.mem', 'Persistent memory CLI', '--source', 'manual', '--confidence', '0.95']);
    const getOne = run(['get', 'project', 'brokkr.mem']);
    assertContains(getOne, 'Persistent memory CLI', 'get specific');

    run(['add', 'preference', 'planning.style', 'Structured task lists']);
    const getCat = run(['get', 'preference']);
    assertContains(getCat, 'planning.style', 'get category');

    const search = run(['search', 'Structured']);
    assertContains(search, 'planning.style', 'search');

    const list = run(['list', '--category', 'project', '--limit', '5', '--recent']);
    assertContains(list, 'brokkr.mem', 'list filtered');

    const injectStdout = run(['inject', '--max', '10']);
    assertContains(injectStdout, '# Known Facts', 'inject stdout');

    run(['inject', '--max', '10', '--output', injectOut]);
    const injectFileContent = fs.readFileSync(injectOut, 'utf8');
    assertContains(injectFileContent, '## Projects', 'inject file');

    const exportedJson = run(['export', '--format', 'json']);
    assertContains(exportedJson, 'brokkr.mem', 'export json');

    const exportedMd = run(['export', '--format', 'md']);
    assertContains(exportedMd, '## Projects', 'export md');

    run(['import', importFile]);
    const afterImport = run(['get', 'person', 'cory.name']);
    assertContains(afterImport, 'Cory', 'import');

    const stats = run(['stats']);
    assertContains(stats, 'Total facts:', 'stats');

    const pruneByConfidence = run(['prune', '--confidence-below', '0.95']);
    assertContains(pruneByConfidence, 'Pruned', 'prune confidence');

    run(['add', 'tool', 'cli.name', 'brokkr-mem']);
    const pruneByDate = run(['prune', '--before', '2999-01-01T00:00:00Z']);
    assertContains(pruneByDate, 'Pruned', 'prune date');

    run(['add', 'decision', 'persist.db', 'Use sqlite']);
    const removed = run(['remove', 'decision', 'persist.db']);
    assertContains(removed, 'Fact removed', 'remove');

    const { child, port } = await startFakeOllamaProcess();
    try {
      const extractDry = run(['extract', extractFile, '--dry-run'], { env: { OLLAMA_URL: `http://127.0.0.1:${port}` } });
      assertContains(extractDry, 'brokkr.mem.status', 'extract dry-run');

      const extractWrite = run(['extract', extractFile], { env: { OLLAMA_URL: `http://127.0.0.1:${port}` } });
      assertContains(extractWrite, 'Stored', 'extract write');

      const extractedFact = run(['get', 'project', 'brokkr.mem.status']);
      assertContains(extractedFact, 'Implemented CLI commands', 'extract persisted');
    } finally {
      child.kill('SIGTERM');
    }

    console.log('All commands tested successfully.');
  } finally {
    for (const p of [importFile, extractFile, injectOut]) {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
