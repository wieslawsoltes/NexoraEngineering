# Verification record

## Delivery results

The recorded build passed **39 browser-independent kernel tests** and **31 browser workflow checks**.

- Kernel output: `core-test-results.txt`
- Workflow output: `browser-test-results.json` and `browser-test-log.txt`
- Rendered screenshots: `workbench.png`, `electrical.png`, `register.png`

The captured workflow run used Chromium 144.0.7559.96 with the standalone HTML injected into an opaque origin. This environment allows DOM/canvas interaction but does not expose a usable secure-origin WebGPU adapter or writable origin storage. The application correctly reported Canvas fallback and a local-save failure. The workbench screenshot retains those honest status indicators.

**Not established by this run:** physical-adapter WebGPU execution, durable IndexedDB/localStorage persistence across reload, operating-system print output, cross-browser compatibility, accessibility conformance, or large-model performance. No FPS or million-object throughput claim is made.

The five export checks verify that JSON, SVG, CSV, DXF, and PNG actions generate browser download events with the correct extension. They are not exhaustive checks of completed writes to an external user's filesystem. SVG/DXF/CSV content generation also has kernel-level assertions.

## Covered behavior

Kernel tests include sample referential integrity; orthogonal and manual routes; transformed ports; point/segment and spatial index queries; anchored camera zoom; atomic mutation rollback; sparse undo/redo and graph-aware cloning; deletion cleanup; revision comparison/restoration; validation diagnostics; serialization round trips; schema bounds and rejection of malformed input; safe property keys; and interchange escaping.

Workflow tests use real browser pointer events, keyboard events, inputs, and double clicks. Coverage includes inspector editing and undo, equipment dragging with attached-line updates, symbol placement, semantic port-to-port routing, rotation, inline register editing, search navigation, document/register switching, validation correction, revision changes, drawing creation, internal graph clipboard, export actions, responsive layouts, and uncaught-exception monitoring.

## Run the deterministic tests

```sh
npm test
npm run build
node examples/graph-api.mjs
```

Node.js 20+ is required. The application and its build have no third-party package dependencies.

## Run the browser workflow suite

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser.test.py
```

`CHROMIUM_PATH` selects an existing Chromium-family executable; otherwise an installed `/usr/bin/chromium` is used on Linux, then Playwright's installed Chromium. `HEADLESS=0` enables a visible window.

By default, the suite injects the standalone file into an empty page. This intentionally exercises the portable fallback path. To test a hosted build, start a server in another terminal:

```sh
python3 -m http.server 8765
NEXORA_URL=http://localhost:8765/ python3 tests/browser.test.py
```

The workflow suite accepts either renderer and reports which one ran. It is not, by itself, proof of GPU coverage.

## Run the strict WebGPU smoke test

```sh
python3 -m http.server 8765
NEXORA_URL=http://localhost:8765/ HEADLESS=0 python3 tests/webgpu.test.py
```

This separate test requires WebGPU and fails if initialization falls back to Canvas. It checks shader/pipeline initialization, native geometry submission inside a validation error scope, nonempty fill/stroke batches, browser persistence across reload, and recovery to Canvas after explicit device destruction. It uses a fresh isolated browser profile and does not modify the user's normal browser data.

**This test is provided but was not executed successfully in the delivery environment.** No `webgpu-smoke-results.json` is included because there is no passing result to report. Adapter information is recorded when available; a successful WebGPU API call can still use a software adapter, so adapter metadata and system GPU tooling are needed before calling a run hardware-accelerated.

For a broader release gate, run multiple browsers and physical adapters, compare exported vectors and Canvas/GPU screenshots at several zoom/DPR combinations, check IndexedDB quota/failure/multi-tab behavior, add adversarial import fuzzing, verify keyboard-only access, and benchmark representative project sizes with separate CPU, upload, GPU, and input-latency measurements.
