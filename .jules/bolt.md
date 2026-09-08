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

## 2025-05-20 - Static Object Reuse in 60 FPS Radar Loops Eliminates Per-Frame Allocation Churn
**Learning:** Returning newly allocated `{ bx, by, dist, ... }` objects and creating inline static arrays/objects inside 60 FPS animation loops (`renderRadar`, `mousemove` listeners) allocates over 2,200 temporary objects per second, causing periodic Garbage Collection frame drops.
**Action:** Module-scope constant arrays (e.g. `CARDINALS`) and reuse static result objects (`tempRadarPoint`, `radarCenterPos`) when reading properties synchronously, and mutate state coordinates in-place on high-frequency event listeners.
