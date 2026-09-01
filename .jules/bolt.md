# Bolt's Journal

## 2025-05-18 - World-Space Frustum Culling Eliminates Off-Screen GC Pressure in Canvas Loops
**Learning:** In 2D canvas map rendering with thousands of game entities, converting world coordinates to screen coordinates (`worldToScreen`) on every frame creates intermediate `{ x, y }` objects for every off-screen item, leading to heavy Garbage Collection pauses at 60 FPS.
**Action:** Always pre-compute the viewport bounding box in world coordinates (`minX, maxX, minY, maxY`) and perform world-space frustum culling BEFORE allocating screen position objects or evaluating detailed entity filters.

## 2025-05-18 - Squared-Distance Pre-Culling Before String Manipulation and Trigonometry
**Learning:** In 60 FPS radar and HUD canvas loops processing game entities and POIs, string manipulation (`toLowerCase()`, `includes()`) and trigonometry (`Math.atan2`) performed before range checks consume significant frame time.
**Action:** Always compute squared distance (`dx*dx + dy*dy`) and cull entities against squared range (`maxDistSq`) BEFORE invoking string parsing, subfilter matching, or trigonometric functions.

## 2025-05-18 - Deferred Trigonometry & Squared-Distance Sorting in Large Entity Search Results
**Learning:** In fuzzy search over thousands of map entities (harvestables, creations, units), computing `Math.hypot`/`Math.sqrt` and distance label string formatting for every match before sorting causes UI thread stutters.
**Action:** Sort matching entities using raw squared distance (`dx*dx + dy*dy`), and defer `Math.sqrt` distance string calculation lazily until rendering the visible 25-item DOM batch.
