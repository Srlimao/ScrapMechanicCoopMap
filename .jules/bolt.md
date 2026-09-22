# Bolt's Journal

## 2025-05-18 - World-Space Frustum Culling Eliminates Off-Screen GC Pressure in Canvas Loops
**Learning:** In 2D canvas map rendering with thousands of game entities, converting world coordinates to screen coordinates (`worldToScreen`) on every frame creates intermediate `{ x, y }` objects for every off-screen item, leading to heavy Garbage Collection pauses at 60 FPS.
**Action:** Always pre-compute the viewport bounding box in world coordinates (`minX, maxX, minY, maxY`) and perform world-space frustum culling BEFORE allocating screen position objects or evaluating detailed entity filters.

## 2025-05-18 - Squared-Distance Pre-Culling Before String Manipulation and Trigonometry
**Learning:** In 60 FPS radar and HUD canvas loops processing game entities and POIs, string manipulation (`toLowerCase()`, `includes()`) and trigonometry (`Math.atan2`) performed before range checks consume significant frame time.
**Action:** Always compute squared distance (`dx*dx + dy*dy`) and cull entities against squared range (`maxDistSq`) BEFORE invoking string parsing, subfilter matching, or trigonometric functions.

## 2025-05-19 - Lazy Candidate Position Evaluation Eliminates Per-Label Object Allocations
**Learning:** Constructing candidate position/bounding box arrays `[ { x, y, box: { x, y, w, h } }, ... ]` upfront in collision-avoiding smart label placement routines allocates 13–14 temporary objects per label on every frame, generating thousands of garbage objects per second during map panning/zooming.
**Action:** Always evaluate placement candidate positions lazily one-by-one with early exit checks, testing default position first and allocating only the final chosen bounding box.

## 2025-05-20 - Deferred Distance Formatting & Squared-Distance Sorting in Search Engines
**Learning:** In search engines matching thousands of game entities (POIs, harvestables, creations), computing `Math.sqrt()` and formatting localized distance strings (`_distText`) upfront for every matching item wastes significant CPU cycles and creates thousands of intermediate string objects when only a small paginated subset (e.g. 25 items) is rendered.
**Action:** Sort matching search items directly by squared distance (`dx*dx + dy*dy`) and compute `Math.sqrt()` and string formatting lazily only when rendering the active DOM page batch.

## 2025-05-21 - Lazy Memoization of Entity Sub-Filter & Metadata Properties Eliminates Per-Frame String Allocations
**Learning:** Performing string lowercasing (`toLowerCase()`) and category matching (`includes()`) on static entity objects inside 60 FPS rendering and mousemove hover loops creates thousands of transient string objects per second and duplicates classification logic across render layers.
**Action:** Lazily memoize sub-filter group keys (`_filterGroup`), category strings (`_catLower`), radar labels/colors (`_shortLabel`, `_radarColor`), and boolean flags (`_isPassive`) on entity objects on first access to make sub-filter matching a single property lookup.

## 2025-05-22 - Squared-Distance Thresholds Eliminate Math.hypot Overhead in 60 FPS Trail Loops
**Learning:** In 60 FPS breadcrumb trail rendering loops for live player tracking and multiplayer squad peers, evaluating telemetry discontinuity thresholds with `Math.hypot(dx, dy) > threshold` invokes `Math.sqrt` and floating-point normalization up to 250 times per frame per player, generating up to 15,000 unnecessary function calls per second.
**Action:** Compare squared distance (`dx * dx + dy * dy > thresholdSq`) directly for threshold/discontinuity checks in 60 FPS animation loops to eliminate `Math.hypot` / `Math.sqrt` execution overhead completely.

## 2025-05-23 - Reusable Target Object Parameter in Coordinate Transformation Functions
**Learning:** In 60 FPS canvas rendering loops, coordinate projection helper functions (like `worldToScreen`) returning new `{ x, y }` objects on every call create steady GC pressure even for visible items on screen.
**Action:** Provide an optional `out` parameter defaulting to `null` in coordinate utility functions so callers in hot render loops can pass module-scoped target objects `{ x: 0, y: 0 }`, preserving clean API abstraction while eliminating intermediate object allocations.

## 2025-05-24 - Pooled Bounding Boxes and Direct Context Property Styling in Canvas Loops
**Learning:** In 60 FPS canvas rendering with dozens of dynamic collision labels, instantiating `{ x, y, w, h }` objects per label per frame generates thousands of transient objects per second. Additionally, wrapping simple badge/glyph drawing functions in `ctx.save()`/`ctx.restore()` causes hundreds of unnecessary canvas state stack push/pop operations per frame.
**Action:** Use pre-allocated object pools (`labelBoxPool` + count tracking) for collision detection boxes and set canvas properties directly instead of calling `ctx.save()`/`ctx.restore()` in leaf draw functions.
