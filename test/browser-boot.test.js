'use strict';
// The host inlines ui/index.js as a plain script: no `module`, no `require`,
// `this` is the window. This test runs the same bytes that way inside a vm
// context with the smallest DOM stub that lets the bootstrap draw, and
// checks the messages it posts against the host's message table.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.js'), 'utf8');

function element(tag) {
  const el = {
    tagName: tag, id: '', className: '', textContent: '', innerHTML: '', children: [],
    appendChild(child) { el.children.push(child); return child; },
    get scrollHeight() { return 100 + el.innerHTML.length; },
  };
  return el;
}

function boot() {
  const posted = [];
  const listeners = [];
  const parent = { postMessage(message, target) { posted.push({ message, target }); } };
  const document = {
    head: element('head'),
    body: element('body'),
    documentElement: element('html'),
    createElement: element,
  };
  const window = {
    document,
    parent,
    addEventListener(name, fn) { listeners.push({ name, fn }); },
  };
  window.window = window;
  window.self = window;
  const context = vm.createContext(window);
  vm.runInContext(SOURCE, context, { filename: 'ui/index.js' });
  const deliver = (data, source = parent) => {
    for (const { name, fn } of listeners) if (name === 'message') fn({ source, data });
  };
  return { window, document, posted, deliver };
}

test('as a plain script it attaches to window, inlines its styles and posts ready', () => {
  const { window, document, posted } = boot();
  assert.equal(typeof window.RundockCsvTable.parseCsv, 'function');
  assert.equal(document.head.children[0].tagName, 'style');
  assert.ok(document.head.children[0].textContent.length > 0);
  assert.equal(document.body.children[0].id, 'csv-root');
  // The message was built in the vm realm, so compare by value, not prototype.
  assert.equal(JSON.stringify(posted), JSON.stringify([{ message: { type: 'ready' }, target: '*' }]));
});

test('on init it renders the content and posts a finite resize height', () => {
  const { document, posted, deliver } = boot();
  deliver({ type: 'init', path: 'data/people.csv', content: 'name,city\n"Doe, J",<x>\n' });
  const root = document.body.children[0];
  assert.match(root.innerHTML, /<th>name<\/th><th>city<\/th>/);
  assert.match(root.innerHTML, /<td>Doe, J<\/td><td>&lt;x&gt;<\/td>/);
  const resize = posted.find((p) => p.message.type === 'resize');
  assert.ok(resize, 'a resize was posted');
  assert.equal(typeof resize.message.height, 'number');
  assert.ok(Number.isFinite(resize.message.height));
  assert.equal(resize.target, '*');
});

test('a parse failure renders the reason and posts error with a string message', () => {
  const { document, posted, deliver } = boot();
  deliver({ type: 'init', path: 'bad.csv', content: 'a\n"never closed\n' });
  const root = document.body.children[0];
  assert.match(root.innerHTML, /Could not read this file as CSV: line 2/);
  const error = posted.find((p) => p.message.type === 'error');
  assert.ok(error, 'an error was posted');
  assert.equal(typeof error.message.message, 'string');
  assert.match(error.message.message, /never closed/);
});

test('messages from any window other than the parent are ignored', () => {
  const { document, posted, deliver } = boot();
  deliver({ type: 'init', content: 'a\n1\n' }, { other: true });
  assert.equal(document.body.children[0].innerHTML, '');
  assert.equal(posted.length, 1);
});

test('an init without content says so instead of drawing an empty table', () => {
  const { document, deliver } = boot();
  deliver({ type: 'init' });
  assert.match(document.body.children[0].innerHTML, /sent no file content/);
});

test('only the four contract message types are ever posted', () => {
  const { posted, deliver } = boot();
  deliver({ type: 'init', content: 'a\n1\n' });
  deliver({ type: 'init', content: 'a\n"x\n' });
  deliver({ type: 'refused', of: 'open', reason: 'test' });
  const allowed = new Set(['ready', 'resize', 'error', 'open']);
  for (const { message } of posted) assert.ok(allowed.has(message.type), message.type);
});
