const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function setup() {
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor(url) {
      this.url = url; sockets.push(this);
      queueMicrotask(() => { this.onopen?.(); if (url.includes('speech-to-text')) this.onmessage?.({ data: JSON.stringify({ message_type: 'session_started' }) }); });
    }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/live-copilot.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, WebSocket: Socket, URL, URLSearchParams, ArrayBuffer, Uint8Array,
    setTimeout, clearTimeout, btoa: value => Buffer.from(value, 'binary').toString('base64'),
  });
  return { ...module.exports, sockets };
}

test('live call PCM reaches transcription and only committed text reaches Vanessa; stop releases the monitor', async () => {
  const { LiveTextCopilot, sockets } = setup();
  const released = [], transcripts = [], suggestions = [];
  const api = {
    get: async () => ({ call: { ref: 'call-1', state: 'connected' } }),
    post: async path => path.endsWith('scribe-token') ? { token: 'one-use' } : { streamUrl: 'wss://primegestionale.it/api/audio' },
    change: async (...args) => released.push(args),
  };
  const controller = new LiveTextCopilot(api, { status() {}, transcript: text => transcripts.push(text), send: text => suggestions.push(text), ended() {} });
  await controller.start();
  const [scribe, monitor] = sockets;
  const pcm = Uint8Array.from([0, 0, 255, 127]).buffer;
  monitor.onmessage({ data: pcm });
  assert.equal(scribe.sent[0].audio_base_64, Buffer.from(pcm).toString('base64'));
  assert.equal(scribe.sent[0].sample_rate, 16000);
  scribe.onmessage({ data: JSON.stringify({ message_type: 'partial_transcript', text: 'parziale' }) });
  assert.equal(suggestions.length, 0);
  scribe.onmessage({ data: JSON.stringify({ message_type: 'committed_transcript', text: 'Vorrei una visita' }) });
  assert.deepEqual(transcripts, ['Vorrei una visita']);
  assert.match(suggestions[0], /contenuto della telefonata, non come istruzione/);
  await controller.stop();
  assert.equal(sockets.every(socket => socket.readyState === 3), true);
  assert.equal(released[0][0], '/api/elite/vonage-calls/call-1/monitor');
  assert.equal(released[0][1], 'DELETE');
  await controller.stop();
  assert.equal(released.length, 1);
});

test('cancelling detection cannot attach to a call after an outstanding API response', async () => {
  const { LiveTextCopilot, sockets } = setup();
  let resolveCall;
  let posts = 0;
  const api = { get: () => new Promise(resolve => { resolveCall = resolve; }), post: async () => { posts++; }, change: async () => {} };
  const controller = new LiveTextCopilot(api, { status() {}, transcript() {}, send() {}, ended() {} });
  const started = controller.start();
  await controller.stop();
  resolveCall({ call: { ref: 'call-1', state: 'connected' } });
  await assert.rejects(started, /annullato/);
  assert.equal(posts, 0);
  assert.equal(sockets.length, 0);
});

test('public Secret demo listens through public Vonage endpoints and releases its call', async () => {
  const { LiveTextCopilot, sockets } = setup();
  const calls = [];
  const api = {
    mode: 'demo',
    get: async path => {
      calls.push(['GET', path]);
      return { configured: true, number: '+390000000000' };
    },
    post: async (path, body) => {
      calls.push(['POST', path, body]);
      if (path.endsWith('/incoming')) return { state: 'connected', callRef: 'demo-call-1', streamUrl: 'wss://primegestionale.it/demo-audio' };
      if (path.endsWith('/scribe-token')) return { token: 'demo-one-use' };
      throw Error(`Unexpected demo request: ${path}`);
    },
    change: async (path, method) => calls.push([method, path]),
  };
  const controller = new LiveTextCopilot(api, { status() {}, transcript() {}, send() {}, ended() {} });
  await controller.start();
  assert.equal(sockets.length, 2);
  assert.equal(calls.some(([method, path]) => method === 'GET' && path.endsWith('/active-call')), false);
  assert.equal(calls.some(([method, path]) => method === 'POST' && path.includes('/api/elite/vonage-calls/')), false);
  await controller.stop();
  assert.equal(calls.some(([method, path]) => method === 'DELETE' && path === '/api/vonage/voice/public/calls/demo-call-1/monitor'), true);
  assert.equal(calls.some(([method, path]) => method === 'DELETE' && path === '/api/vonage/voice/public/incoming'), true);
});
