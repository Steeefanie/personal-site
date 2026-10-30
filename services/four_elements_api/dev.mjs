import { watchFile, unwatchFile } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('.env', import.meta.url));
const serverFile = fileURLToPath(new URL('server.mjs', import.meta.url));
let child, restart = false, stopping = false;
function start() {
  child = spawn(process.execPath, [`--env-file-if-exists=${envFile}`, serverFile], { stdio: 'inherit' });
  child.once('error', () => console.error('Unable to start the local report API.'));
  child.once('exit', () => {
    child = undefined;
    if (restart && !stopping) { restart = false; start(); }
  });
}
// Compare this file's stat directly. Directory-based watch notifications on Windows
// may include sibling edits and interrupt an in-flight report unexpectedly.
watchFile(envFile, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;
  restart = true;
  if (child) child.kill();
  else { restart = false; start(); }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true; unwatchFile(envFile); child?.kill();
});
start();
