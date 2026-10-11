# Document 10 — Engineering Decision Register

Fields per decision: **Choice · Reason · Alternatives · Pros · Cons · License · Performance · Integration complexity · Maintenance risk · Claude Code fit · Confidence**. Confidence = High / Medium / Low, based on evidence available on 2026-10-10. License facts are from general knowledge of these projects and must be re-checked in each package's LICENSE file when added (CLAUDE.md rule).

### ADR-001 Language: TypeScript (strict)
Reason: one language for UI, geometry, 3D, edge functions. Alternatives: JavaScript, Kotlin, Dart. Pros: types catch model errors; huge ecosystem. Cons: build tooling. License: Apache-2.0. Performance: same as JS. Integration: low. Maintenance: low. Claude Code fit: very high. Confidence: High.

### ADR-002 UI framework: React + Vite
Reason: largest corpus for AI coding, mature. Alternatives: Svelte, Vue, Flutter (separate renderer, Dart), React Native (3D harder). Pros: ecosystem, Capacitor-friendly. Cons: re-render overhead if misused for canvas (we don't). License: MIT. Performance: fine for panels. Integration: low. Maintenance: low. Claude Code fit: very high. Confidence: High.

### ADR-003 UI state: Zustand
Reason: tiny, simple, works outside React (tools/renderers can read selection). Alternatives: Redux Toolkit, Jotai, MobX. Pros: little boilerplate. Cons: less structure. License: MIT. Performance: good. Integration: low. Maintenance: low. Claude Code fit: high. Confidence: High. Note: project data is **not** in Zustand — it's in `core-model` (ADR-004).

### ADR-004 Canonical model: custom pure-TS module + command pattern + Immer patches
Reason: single source of truth, exact undo via patches (Doc 4 §4). Alternatives: store in Three.js scene graph (rejected: 2D/3D drift), Redux store of everything, CRDT (Yjs/Automerge) from day one. Pros: testable without DOM; deterministic; easy migration to CRDT later. Cons: we write it. License: Immer MIT. Performance: structural sharing; patches cheap. Integration: medium. Maintenance: medium. Claude Code fit: high if invariants are specified (they are). Confidence: High.

### ADR-005 2D rendering: custom Canvas 2D
Reason: avoid a second object model (Konva/Fabric) conflicting with constraints; full control. Alternatives: SVG, Konva, Fabric, PixiJS (Doc 4 §2.1). Pros: fast, simple. Cons: write hit testing/dirty logic. License: n/a. Performance: thousands of segments OK (validate PERF-01). Integration: medium. Maintenance: low–medium. Claude Code fit: high. Confidence: Medium-High.

### ADR-006 3D engine: Three.js (imperative)
Reason: proven for web home planners (blueprint3d, MIT — verified; round-1 Planner 5D Three.js job ad is now offline and their Android app appears native, Doc 1 §1.2), small, huge corpus. Alternatives: Babylon.js (strong #2), R3F, Unity, Godot (Doc 4 §3.1). Pros: control over incremental rebuild; KTX2/meshopt support. Cons: fewer built-in editor tools than Babylon; breaking changes across releases (pin version). License: MIT (verified, npm three 0.186.1 on 2026-10-11 — pin the version). Performance: good with budgets; WebView variance (RISK-02). Integration: medium. Maintenance: medium (pin + upgrade quarterly). Claude Code fit: very high. Confidence: High (Medium for mobile perf until Phase 0).

### ADR-007 Android packaging: Capacitor
Reason: same web code on Android; native plugins for billing/ads/sign-in. Alternatives: React Native (+ expo-gl/three; more native, 3D less mature), Flutter, TWA (Trusted Web Activity; Play Billing via Digital Goods API possible but more complex), native Kotlin + Filament. Pros: one codebase, fast iteration, web version for free. Cons: WebView performance variance; storage eviction questions. **New evidence:** the market leader's Android app appears to use a native OpenGL/Vulkan/Filament stack (job ad, Doc 1 §1.2), and only anecdotal WebView-vs-Chrome reports exist. License: MIT (verified, @capacitor/core 8.5.3). Performance: risk (Doc 1 RISK-02). **Fallback path if Phase 0 fails:** keep `core-model` + `geometry` (pure TS), and render 3D natively later (Kotlin + Filament via a Capacitor plugin, or React Native + a native view). This is possible because renderers are read-only views (Doc 4 §4). Integration: low–medium. Maintenance: medium (WebView updates). Claude Code fit: high. Confidence: Medium — reconsider if Phase 0 fails.

### ADR-008 Geometry: custom wall graph; earcut for triangulation; Clipper2 port only if needed
Reason: no suitable library for wall junctions/rooms. Alternatives: JSTS (EPL/EDL — check), Turf (GIS-oriented), CGAL (C++/GPL/commercial). Pros: exact control, integer predicates. Cons: highest-risk custom code. License: earcut ISC (verified). Performance: fine. Integration: high effort. Maintenance: medium. Claude Code fit: medium (needs tests as spec). Confidence: High that custom is necessary.

### ADR-009 Backend: Supabase
Reason: Postgres + Auth + Storage + Edge Functions + RLS in one; SQL is portable. Alternatives: Firebase (NoSQL, vendor lock-in, strong Android tooling), custom Node + Postgres (more ops), Appwrite. Pros: relational data, RLS security model, free tier for development (50k MAU, 500 MB DB — VERIFIED V01). Cons: edge functions are Deno; **free projects are paused after 1 week of inactivity** (VERIFIED), so production needs Pro at $25/month. License: Apache-2.0 (self-hostable). Performance: adequate. Integration: low–medium. Maintenance: low. Claude Code fit: high. Confidence: Medium-High.

### ADR-010 Asset CDN: Cloudflare R2
Reason: zero egress fees (third-party snapshot; verify) — catalog downloads are the biggest bandwidth. Alternatives: Supabase Storage (egress billed), S3 + CloudFront, Bunny CDN. Pros: cheap at scale. Cons: another vendor account. License: n/a. Performance: global CDN. Integration: low. Maintenance: low. Claude Code fit: high. Confidence: Medium (pricing must be verified).

### ADR-011 Billing: Google Play Billing via RevenueCat or maintained Capacitor plugin, with server verification
Reason: Play policy requires Play Billing for digital subscriptions in Play-distributed apps (VERIFIED V06); India also allows alternative billing at the Play fee minus 4% (11% instead of 15% for subscriptions, V03). Alternatives: direct plugin + own verification (Google Play Developer API), RevenueCat (free tier up to a revenue threshold — verify). Pros: Play-native purchase sheet users trust; (RevenueCat) handles receipts, webhooks, entitlement state. Cons: dependency/fees above threshold. License: SDKs MIT (verify). Performance: n/a. Integration: medium. Maintenance: medium. Claude Code fit: medium-high. Confidence: Medium — choose in Phase 8 after checking current plugin maintenance.

### ADR-012 Ads: AdMob via maintained Capacitor plugin; banners only outside editor
Reason: standard for Android; UX protection. Alternatives: no ads, other networks. Pros: simple. Cons: low revenue per user — India banner eCPM only from unofficial sources (≈ $0.10–1.00), **no official figure**; consent requirements. License: plugin (verify at selection). Performance: ad SDK adds app size and startup work; load ads lazily, never on the editor screen. Integration: low. Maintenance: medium (SDK updates). Claude Code fit: high. Confidence: Medium.

### ADR-013 AI: provider-agnostic server proxy; structured AI → commands → validator
Reason: keep keys server-side; swap providers by cost; never trust AI geometry. Alternatives: client-side calls (insecure), self-hosted models (ops burden). Pros: safety, flexibility. Cons: latency of extra hop. License: per provider terms. Performance: async jobs. Integration: medium. Maintenance: medium. Claude Code fit: high. Confidence: High for architecture, Low for quality until spike.

### ADR-014 Analytics/monitoring: Sentry + Firebase Analytics or PostHog
Reason: crash visibility + funnels. Alternatives: Play vitals only. Pros: debugging in field. Cons: privacy disclosures in data safety form. License: SDKs open-source (verify). Performance: small; sample performance traces, send in background. Integration: low. Maintenance: low. Claude Code fit: high. Confidence: Medium (pick one in Phase 1).

### ADR-015 Units & precision: integer millimetres in model
Reason: exact equality, stable hashing, no drift (Doc 4 §1). Alternatives: float metres; fixed-point 0.1 mm; rational numbers. Pros: robust snapping/undo identity; exact orientation tests on integers. Cons: conversion code for display/3D; sub-mm detail impossible (not needed for homes). License: n/a. Performance: integers are fast; no BigInt needed within ±1 000 m extent. Integration: low (one conversion module). Maintenance: low. Claude Code fit: high, but watch for accidental float storage (lint rule + schema `integer`). Confidence: High.

### ADR-016 Sync: whole-document optimistic concurrency with conflicted copies; no real-time collaboration in v1
Reason: simple, safe; directly addresses Planner 5D's documented weakness ("most recent local version replaces older versions… we do not store previous versions", Doc 1 R-PM-01). Alternatives: last-write-wins (Planner 5D behaviour); CRDT (Yjs/Automerge) for live collaboration; operational transform. Pros: no silent data loss; easy to reason about; works offline. Cons: users must resolve conflicts by choosing a copy; no live co-editing. License: n/a (Yjs MIT if adopted later). Performance: uploads whole document (≤ ~1 MB gz typical) per save — fine at our scale. Integration: medium (revision check in one SQL statement). Maintenance: low. Claude Code fit: high. Confidence: High for v1.

### ADR-017 Wall openings: shape-with-holes extrusion (no CSG)
Reason: deterministic, fast, matches 2D footprints (Doc 4 §3.3); Planner 5D users report 2D/3D door mismatches (Doc 1 R-FP-07). Alternatives: three-bvh-csg or other CSG libraries; separate wall segments around openings. Pros: no numerical CSG failures; same footprint data as 2D; cheap incremental rebuild. Cons: custom triangulation code for reveals; arched openings need extra work. License: earcut ISC (verified). Performance: per-wall rebuild expected ~1 ms (to be measured in Phase 0). Integration: medium. Maintenance: low–medium. Claude Code fit: medium-high (well-specified algorithm + tests). Confidence: High.
