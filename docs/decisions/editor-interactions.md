# D27: 2D editor interactions

PH2-T01; Codex under D17; 2026-10-13. No new dependency or canonical schema change.

The canonical ProjectStore remains the only model writer. Viewport, selection, spatial index, pointer arbitration and loupe are transient UI state. World/screen transformations retain integer-mm commands, floating-point previews and the existing scale bounds 0.001–1. Pinch preserves the initial world midpoint at the moving finger midpoint, including zoom clamps. Wheel zoom preserves its pointer anchor; focused-canvas keyboard arrows, +/- and Space-drag pan affect only the viewport.

Touch on a junction requires a 150 ms hold. Motion over 6 CSS pixels before the hold pans; mouse dragging is immediate. Preview work coalesces to one animation-frame request. Release computes the final pointer target and sends at most one atomic MoveJunctions command with a unique command ID. A second finger cancels the draft before pinch; third/mixed pointers and a remaining half-pinch cannot resume editing. Escape, pointer cancellation, lost capture, scrolling, stale generation/store and page hiding/blur cancel drafts. Blur clears abandoned pointer IDs because the OS can omit pointerup; ordinary second-finger cancellation blocks remaining fingers until release.

One persistent Konva Layer retains its DOM canvas during shape redraws. Destroying/replacing that layer after selection breaks a real native multi-step touch stream; the browser regression now verifies the canvas stays connected and a second pinch movement still changes scale. Stage reconstruction on resize cancels the current interaction. Konva nodes never become saved entities.

Picking uses a generation-owned 1 m spatial hash with bounded indexing: large entities use a broad fallback instead of being dropped. Exact tests cover segment projection, rotated furniture boxes and clear-room polygons. Priority is junction, opening, furniture, wall, room; repeated stationary taps cycle the complete candidate list. Actual viewport/model changes reset the cycle. Touch junction radius is 24 CSS pixels; wall padding remains 4 pixels. Opening/furniture picks use physical bounds. Selection highlights and IDs clear when the canonical entity disappears. Full multi-selection, duplicate/delete and entity property panels remain later tasks.

The 3× touch loupe shows the snapped corner and nearby structural footprints without changing project data. Wall-chain drawing/loupe follows in PH2-T02. Buttons and existing precision/select controls have 48 CSS-pixel minimum dimensions; viewport tests cover 360×800, 768×1024 and 1440×900. CSS pixels on Linux emulation are not proof of Android dp, TalkBack, Hindi readability or real Low/Mid touch/performance.

All added analytic/property/browser cases are Codex-authored. Accepted independent geometry fixtures remain unchanged; no Claude review or fixture authorship is claimed. See ../verification/ph2-t01.md for actual execution and pending gates.
