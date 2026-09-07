'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const csv = require('../ui/index.js');

test('parses a header row and plain fields, LF and CRLF', () => {
  assert.deepEqual(csv.parseCsv('a,b,c\n1,2,3\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(csv.parseCsv('a,b\r\n1,2\r\n3,4'), [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('quoted fields keep commas, line breaks and doubled quotes', () => {
  const text = 'name,quote\n"Smith, Jane","She said ""hi"", then left"\n"multi\nline",x\n';
  assert.deepEqual(csv.parseCsv(text), [
    ['name', 'quote'],
    ['Smith, Jane', 'She said "hi", then left'],
    ['multi\nline', 'x'],
  ]);
});

test('empty fields and empty lines are kept as the file states them', () => {
  assert.deepEqual(csv.parseCsv('a,,c\n,,\n'), [['a', '', 'c'], ['', '', '']]);
  assert.deepEqual(csv.parseCsv(''), []);
  assert.deepEqual(csv.parseCsv('\n'), [['']]);
});

test('refuses an unterminated quoted field and text after a closing quote', () => {
  assert.throws(() => csv.parseCsv('a,b\n"open,1\n'), /line 2: a quoted field is never closed/);
  assert.throws(() => csv.parseCsv('a\n"x"y\n'), /line 2: text after a closing quote/);
  assert.throws(() => csv.parseCsv('a\nab"c\n'), /line 2: a quote inside an unquoted field/);
});

test('escapeHtml neutralises every character that matters in markup', () => {
  assert.equal(csv.escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  assert.equal(csv.escapeHtml(null), '');
  assert.equal(csv.escapeHtml(42), '42');
});

test('renders a table with the header in thead and every cell escaped', () => {
  const out = csv.renderTableHtml(csv.parseCsv('h1,h2\n<script>,"a ""b"""\n'));
  assert.equal(out.rows, 1);
  assert.equal(out.columns, 2);
  assert.equal(out.ragged, 0);
  assert.match(out.html, /<thead><tr><th>h1<\/th><th>h2<\/th><\/tr><\/thead>/);
  assert.match(out.html, /<td>&lt;script&gt;<\/td><td>a &quot;b&quot;<\/td>/);
  assert.doesNotMatch(out.html, /<script>/);
  assert.match(out.html, /<caption>1 row, 2 columns<\/caption>/);
});

test('an empty file renders a note, not a table', () => {
  const out = csv.renderTableHtml([]);
  assert.equal(out.rows, 0);
  assert.doesNotMatch(out.html, /<table/);
  assert.match(out.html, /This file is empty/);
});

test('a ragged row is padded to the widest row and counted in the caption', () => {
  const out = csv.renderTableHtml(csv.parseCsv('a,b\n1\n2,3,4\n'));
  assert.equal(out.ragged, 2);
  assert.match(out.html, /<th>a<\/th><th>b<\/th><th><\/th>/);
  assert.match(out.html, /<tr class="ragged"><td>1<\/td><td><\/td><td><\/td><\/tr>/);
  assert.match(out.html, /2 ragged rows padded to the widest/);
});

test('a file over the row cap renders the first rows and says so', () => {
  const lines = ['id,value'];
  for (let i = 0; i < csv.MAX_ROWS + 25; i += 1) lines.push(`${i},v${i}`);
  const out = csv.renderTableHtml(csv.parseCsv(lines.join('\n')));
  assert.equal(out.rows, csv.MAX_ROWS + 25);
  assert.equal(out.shown, csv.MAX_ROWS);
  assert.equal((out.html.match(/<tr>/g) || []).length, csv.MAX_ROWS + 1);
  assert.match(out.html, /Showing the first 5,000 of 5,025 rows/);
  assert.match(out.html, /<caption>5,025 rows, 2 columns, showing the first 5,000<\/caption>/);
});
