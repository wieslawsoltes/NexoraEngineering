/** Run: node examples/graph-api.mjs
 * Uses the same browser-independent graph kernel as the interactive editor.
 */
import assert from 'node:assert/strict';
import { EngineeringStore, makeDemo, routeEdge, validateEngineering } from '../src/core.js';

const store = new EngineeringStore(makeDemo());
let pump;
let valve;
let line;

store.transact('Create a connected pump and valve', () => {
  pump = store.addNode('pump', 500, 740, 'pid-101', {
    tag: 'P-901',
    description: 'API-created demonstration pump',
    props: { flow: '40', pressure: '4', designPressure: '10' }
  });
  valve = store.addNode('valve', 660, 740, 'pid-101', {
    tag: 'HV-901',
    description: 'API-created discharge isolation valve'
  });
  line = store.addEdge(
    { node: pump.id, port: 'E' },
    { node: valve.id, port: 'W' },
    'pid-101',
    'pipe'
  );
  store.update(line.id, 'tag', 'L-901');
  store.update(line.id, 'props.diameter', 'DN40');
});

const before = routeEdge(line, store.nodes);
store.transact('Move pump and update its process attribute', () => {
  store.update(pump.id, 'y', 680);
  store.update(pump.id, 'props.pressure', '5');
});
const after = routeEdge(store.edges.get(line.id), store.nodes);
assert.notDeepEqual(after, before, 'Routing must follow the referenced equipment port.');

store.undo();
assert.deepEqual(routeEdge(store.edges.get(line.id), store.nodes), before);
store.redo();
assert.equal(store.nodes.get(pump.id).props.pressure, '5');

const revision = store.captureRevision('API example baseline');
store.transact('Change a tag', () => store.update(valve.id, 'tag', 'HV-902'));
assert.equal(store.compareRevision(revision).nodes.length, 1);
store.restoreRevision(revision.id);
assert.equal(store.nodes.get(valve.id).tag, 'HV-901');

console.log(JSON.stringify({
  nodes: store.nodes.size,
  connections: store.edges.size,
  route: routeEdge(store.edges.get(line.id), store.nodes),
  validationIssues: validateEngineering(store).length,
  format: store.serialize().format,
  schemaVersion: store.serialize().version
}, null, 2));
