import { spawn } from 'node:child_process';

export async function withPreviewServer(task, { url = 'http://127.0.0.1:4173' } = {}) {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  let log = '';
  server.stdout.on('data', data => { log += data.toString().slice(0, 2000); });
  server.stderr.on('data', data => { log += data.toString().slice(0, 2000); });
  try {
    const deadline = Date.now() + 20000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) break;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(done => setTimeout(done, 200));
    }
    if (!ready) throw Error('Preview server could not start: ' + log.slice(-500));
    return await task(url);
  } finally {
    server.kill('SIGTERM');
  }
}
