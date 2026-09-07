# Architecture and extension guide

## 1. Object flow

```text
Pointer/keyboard, inspector, navigator, register cells, file import
       │
       ▼
EngineeringStore transaction ── validation/projection at import boundaries
       │
       ├─ ID-keyed nodes and edges; stable port references
       ├─ committed sparse undo/redo patch
       └─ change event and model version
                │
                ├─ shared navigator/register/property views
                ├─ engineering consistency checks
                ├─ debounced, ordered browser-storage snapshot
                └─ EngineeringScene update
                       ├─ geometry cache by entity signature
                       ├─ spatial hash index
                       └─ visible geometry batches
                              ├─ WebGPU fills + instanced strokes
                              └─ Canvas 2D fallback
```

HTML handles interaction chrome and tabular/text input, where native browser focus and editing behavior are useful. The custom drawing surface handles coordinate mapping, engineering geometry, picking, and editing tools. Canvas 2D renders text and interaction layers in both renderer modes.

## 2. Engineering graph

The JSON envelope is `format: "nexora-project", version: 1`. Project metadata, documents, nodes, edges, and optional revision snapshots are serialized; transient selection, GPU resources, and undo stacks are not.

A node has an ID, document reference, symbol type, position, dimensions, rotation, engineering tag, description, unit, status, layer, and a string-valued property bag. Geometry is generated from the type and its placement. A connection is a first-class edge with its own tag, process/electrical properties, endpoints, and route waypoints.

An endpoint is exactly one of the projected forms:

```js
{ node: "pump-id", port: "E" }  // reference to a named port
{ x: 500, y: 300 }             // deliberately free endpoint
```

The route is derived from current node geometry on scene rebuild. Moving, resizing, or rotating a node therefore does not replace its identity or manually patch every attached line's coordinates. The connection follows the reference.

Documents own node placements in this version. There is not yet a distinct asset table and a separate representation table. That distinction is the right extension for a physical valve appearing on multiple engineering documents, rather than duplicating data into multiple nodes and pretending they are the same asset.

### Referential invariants

Import projection checks unique document and object IDs, known symbol/connection types, document existence, supported ports, in-document endpoint references, finite bounded coordinates, valid routes, and supported schema version. Unknown attributes are filtered to a bounded primitive string bag. New-node/new-edge APIs reject invalid graph references. Tags remain editable and are not primary keys; duplicate tags are reported as engineering issues rather than corrupting identity.

Delete cascades through attached edges. Graph duplication remaps cloned node IDs and internal endpoints, while generating available tags. External connections are not silently transferred to cloned equipment. Undo restores the deleted objects and their identities.

The `Map` collections are deliberately exposed for integration/testing. Calling code must use transactions and validated store operations. Raw mutations bypass API checks; this is not a capability-secured database boundary.

## 3. Transactions, history, and revisions

`begin()` snapshots metadata, document descriptors, nodes, and edges. Pointer moves can modify the live model during an interaction; `commit(label)` compares before/after snapshots, stores changed-object patches, clears redo, and emits a versioned change event. `cancel()` restores the pre-interaction state. Nested transactions are rejected.

`transact(label, action)` wraps this for atomic synchronous edits and rollback on exceptions. Undo/redo applies the corresponding before/after values. The retained history is limited to 100 committed commands.

**Complexity:** transaction snapshot creation and diff preparation are O(N) in graph size, with serialization cost in object comparisons. Stored history patches are sparse, but preparation is not. This is a deliberate correctness-first implementation, not a claim that every mutation is O(1). Large models should move to typed operation records, per-entity change journals, structural sharing, and incrementally maintained adjacency.

Revision snapshots are separate, named local checkpoints, capped at 20. Comparison reports added, modified, and deleted engineering objects by ID. Restoring a checkpoint is undoable. Revision records are mutable local project data, not cryptographically signed or append-only audit evidence. The local `Approved` status does not implement role-based approval.

## 4. Routing and interaction

The router emits deterministic orthogonal polylines. With no explicit bends it uses cardinal port escape directions and intermediate doglegs; manual waypoints constrain the path. Port locations are transformed by node rotation, while the escape direction is quantized to its dominant cardinal axis to preserve orthogonal routing. Direct mode preserves straight segments through the supplied waypoints.

The router does not perform obstacle avoidance, global crossing minimization, line hopping, or automatic pipe-network tee insertion. Manual waypoints are the supported mechanism for routing around congested equipment. Off-page connectors are symbols; cross-document continuation references are not resolved.

Picking first queries a 128-unit spatial hash, then uses geometry and segment-distance checks. Large bounds use a side set rather than inserting into unbounded numbers of cells. Camera coordinates remain JavaScript numbers. `zoomAt()` preserves the world point beneath the pointer by applying the before/after world-coordinate difference to the camera center.

Drag interactions capture pointers, distinguish translation/resize/rotation/route editing, and close transactions on completion. Escape and window blur cancel active edits. The UI updates selection classes without rebuilding the active register DOM element, which is important for double-click cell editing and focus retention.

## 5. Native WebGPU pipeline

The renderer requests an adapter/device, configures a transparent WebGPU canvas, compiles WGSL, checks compiler diagnostics, and asynchronously creates two render pipelines. Validation scopes and uncaptured-error/device-loss handlers are installed. Failure returns the drawing to a usable Canvas fallback; this version does not retry device acquisition automatically.

### Buffer layouts

| Buffer | Layout | Stride |
|---|---|---:|
| Camera uniform | viewport vec2f, center vec2f, zoom f32, DPR f32, padding vec2f | 32 bytes |
| Stroke instance | start vec2f, end vec2f, RGBA vec4f, width/dash/reserved vec4f | 48 bytes |
| Fill vertex | position vec2f, RGBA vec4f | 24 bytes |

Each stroke instance emits six triangle vertices around a segment. The fragment shader computes capsule-distance coverage with a device-pixel fringe. Dash lengths are carried in the style vector. This avoids relying on implementation-specific wide-line primitives. Dashed pattern phase restarts per segment; it is not a full CAD linetype engine.

Convex symbol fills are triangulated as fans. General nonconvex polygons, curves with analytic fill boundaries, clipping stacks, and boolean geometry are not implemented. Rounded/elliptic symbols use tessellated segments. Fills render before strokes, rather than preserving arbitrary interleaved paint ordering.

Vertex buffers grow to powers of two and reuse capacity. Scene/version/visibility keys control uploads; camera uniforms update per rendered frame. A nonempty scene submits a fill draw and a stroke-instance draw, omitting an empty batch. That count describes the two WebGPU geometry pipelines only, not the DOM, sheet, minimap, or text work.

GPU positions are Float32 world coordinates. The shader subtracts the camera center, but that subtraction happens **after Float32 conversion**. This is not a floating-origin precision design. A large-coordinate extension should rebase geometry on the CPU in local chunks and pass relative camera transforms, or use high/low split coordinates where appropriate.

Canvas dimensions are clamped to device texture limits through an effective pixel ratio. GPU buffer growth checks the maximum buffer size. Buffer replacement destroys the old allocation; `dispose()` destroys buffers, unconfigures the context, and destroys the device.

### Frame scheduling

A single pending requestAnimationFrame coalesces invalidations. Scene changes rebuild relevant cached entities; camera-only updates reuse the scene and query its visible set. The minimap caches its geometry across camera-only frames. There is no animation loop running solely to display an FPS counter.

The status metric is CPU render-function duration. It is not a GPU timestamp, end-to-end input latency measurement, or throughput benchmark. Large-scene performance and physical-adapter execution remain measurement tasks rather than inferred claims.

## 6. Persistence and interchange

`ProjectStorage` opens an IndexedDB database with a `projects` store and saves the current project in a single read/write transaction. A promise chain orders writes so a later scheduled save does not overtake an earlier one. A rejected save does not permanently poison the queue. If IndexedDB initialization fails, localStorage is attempted. The UI exposes failure when neither is writable.

The current profile stores one active project. Multiple tabs are not coordinated; last writer can win. There is no cloud synchronization, locking, retention policy, backup service, or cross-user access control. JSON export is the portable backup path.

SVG preserves generated geometry and text, but not the engineering graph. PNG rasterizes that vector output. DXF R12 emits basic ASCII LINE/TEXT entities with normalized text; it is not a semantic P&ID interchange or a COMOS export. CSV is register data, with quoting and formula-prefix neutralization. Browser-print layouts are convenience output and not controlled, certified drawing-issue packages.

## 7. Input handling and boundaries

Project import checks file size before reading (40 MiB), then projects schema v1 into known fields. Limits include 20,000 nodes, 50,000 edges, 100 documents, 500 waypoints per edge, 100 accepted primitive properties per object, and 20 revision snapshots. Each revision's snapshot is validated without recursive revision nesting. These bounds do not imply that their maximum combination is safe or fast on every machine.

Object strings are escaped before entering HTML and SVG. Property names reject prototype-sensitive keys. CSV prefixes values beginning with spreadsheet formula/control prefixes. No imported string is evaluated as JavaScript. There is no remote fetching of arbitrary project-controlled scripts or symbol assets.

For deployment, serve immutable assets over HTTPS, add suitable response headers/CSP, and introduce a dedicated import worker with time/memory budgets before accepting untrusted large projects. The standalone file intentionally embeds script/style; a strict CSP deployment should serve the modular version with reviewed hashes or external resources instead of adding a blanket unsafe-inline policy.

## 8. Practical next engineering increments

The most consequential additions are a separate asset/representation model with typed ports and unit-aware attributes; journaled incremental transactions with adjacency indexes; obstacle-aware routing and explicit junction topology; reusable base-object inheritance and symbol definitions; a versioned interchange/migration layer; and a real persistence service with authorization, concurrency control, and immutable audit events.

For rendering, first run the provided GPU smoke test across target adapters, then add pixel-difference tests for SVG/Canvas/GPU parity, device-loss coverage, large-coordinate cases, zoom extremes, translucent ordering, and buffer growth. Benchmark CPU prepare time, upload bytes, GPU timestamps when supported, and interaction latency separately before introducing workers or more elaborate GPU-side culling.

## References

WebGPU API contracts are documented in the W3C specification and GPUWeb explainer:

- https://www.w3.org/TR/webgpu/
- https://gpuweb.github.io/gpuweb/explainer/

Statements about Nexora's architecture above describe this delivery's source code, not Siemens COMOS internals.
