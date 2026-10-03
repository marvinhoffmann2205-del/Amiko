const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function page(fetch) {
  const state = []; let cursor = 0, effect;
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/learn/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, console: { error() {} }, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
        return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useEffect(fn) { if (!effect) effect = fn; },
    };
    throw new Error(name);
  } });
  const render = () => { cursor = 0; return exports.default(); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] :
    [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  return { render, nodes, mount() { render(); effect(); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (body, ok = true) => ({ ok, json: async () => body });
const event = { id: 'one', original: 'ayer voy', correction: 'ayer fui' };

test('load failures show retry, never caught up; successful retry can show empty state', async () => {
  for (const failure of [() => Promise.reject(new Error('offline')),
    async () => response({ success: false }, false), async () => response({ success: true })]) {
    let failed = true;
    const ui = page(() => failed ? failure() : Promise.resolve(response({ success: true, events: [] })));
    ui.mount(); await flush();
    let tree = ui.render();
    assert.ok(ui.nodes(tree).some(n => n.props?.role === 'alert'));
    assert.ok(!JSON.stringify(tree).includes("caught up"));
    failed = false;
    await ui.nodes(tree).find(n => n.type === 'button').props.onClick();
    assert.ok(JSON.stringify(ui.render()).includes("caught up"));
  }
});

test('failed save blocks advancement and completion; retry saves without grading again', async () => {
  let saves = 0, grades = 0;
  const ui = page(async (url, options) => {
    if (url === '/api/learning-test') return response({ success: true, events: [event] });
    if (url === '/api/learning-grade') { grades++; return response({ success: true, result: 'incorrect' }); }
    saves++;
    assert.deepEqual(JSON.parse(options.body), { id: 'one', result: 'incorrect' });
    return response({ success: saves > 1 }, saves > 1);
  });
  ui.mount(); await flush();
  ui.nodes(ui.render()).find(n => n.type === 'input').props.onChange({ target: { value: 'answer' } });
  await ui.nodes(ui.render()).find(n => n.type === 'button').props.onClick();
  let tree = ui.render();
  assert.ok(ui.nodes(tree).some(n => n.props?.role === 'alert'));
  assert.ok(!JSON.stringify(tree).includes('Review complete'));
  await ui.nodes(tree).find(n => n.type === 'button').props.onClick();
  assert.ok(JSON.stringify(ui.render()).includes('Review complete'));
  assert.equal(grades, 1); assert.equal(saves, 2);
});
