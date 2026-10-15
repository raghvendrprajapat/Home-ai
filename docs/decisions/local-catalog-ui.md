# PH4-T02 — local catalog browsing

D40, 2026-10-15, under D17 subject to D36. Base: PR86 merge `96874690de166bb99c7c7c05342adedc88111526`. This task exposes the static original catalog through a bilingual browse dialog. It does not implement placement or complete FR-016/UF-07: placement belongs to PH4-T03 and the ~30-item set to PH4-T05. Premium badges/entitlement preparation require D36 permission and remain unstarted.

## Contracts and alternatives

- Keep catalog code app-owned. A small immutable DTO/parser accepts the current bounded local format, verifies unique ID/version, integer dimensions, original provenance fields and hashed relative paths. It retains all versions for exact lookup; browsing separately selects the latest version per ID. It never rewrites historical metadata or a saved project's asset reference. Arbitrary vendor formats require an explicit future pipeline contract, not a permissive parser.
- Use the existing native dialog, not another modal library. Native focus containment, focus return and Escape remain; all keydown propagation stops at this dialog so window-level editor shortcuts cannot edit behind the modal. Close/Escape stay enabled during loading. Other dialogs retain their current behavior.
- Search both languages, category and tags using Unicode NFKC normalization, locale casing and stable locale/name ordering. Category labels use bilingual known-name keys and a text fallback. Search/category changes reset the page; at most 24 cards mount. This is ordinary feature UI, not a measured mobile optimization claim.
- Package-local same-origin fetches use the Vite base URL, bounded streams (2 MiB manifest, 128 KiB SVG), fatal UTF-8/format checks and a 15 s owned deadline. Fetch is invoked with the browser global receiver; extracting it as an API-instance method otherwise causes a native browser `Illegal invocation`. No cloud/CDN adapter, persistent catalog cache or new runtime dependency is introduced.
- Thumbnails start on first intersection. Actual received bytes drive progress; unknown totals remain indeterminate, and 100% is not claimed before successful image load. Exact declared size and SHA-256 must match before creating a Blob URL. Each image also has a 5 s load/decode deadline and must have the expected native 256×256 dimensions.
- Each retry/open owns its abort signal, timer, observer and Blob URL. Filtering, paging, closing and unmounting abort/revoke only that ownership. A completed/late request cannot publish into a newer attempt. URL-keyed image nodes and URL-matched load/error callbacks prevent old decode events from settling a newer image. Aborted operations settle even if an injected request ignores cancellation. Error/retry is per manifest or per card; it never changes the drawing.
- This screen has no model command, saved selection or fake Add action. Existing furniture properties remain independent. No second WebGL preview context is added; catalog thumbnails are actual validated packaged SVG images. GPU preview concurrency is a separate engineering problem.

Alternatives: bundling the entire manifest directly would remove retry/loading behavior and grow the initial bundle; a server catalog would introduce D36-gated services; a generic query/image library is unnecessary for one small bounded request owner. Hand-owned effects require cancellation and lifecycle tests; they do not establish device performance or a general remote asset sandbox.

## Test-only import policy

The two exact catalog unit-test paths may import `node:fs/promises` to test the actual shipped manifest/SVG, rather than duplicating metadata in a mock. Production catalog code and unrelated tests still reject that import. Existing actual-ESLint positive/negative boundary tests cover the narrow exception. This changes no runtime package direction or renderer/storage boundary.

## Verification and remaining scope

See [executed verification](../verification/ph4-t02.md). Search, browsing, request cancellation, native image failures, URL cleanup, focus and unchanged complete exported JSON/history are separately checked. Test-generated catalog entries are synthetic metadata for pagination, not shipped assets or independent Claude fixtures.

Only the single original desk is shipped at this stage. Actual GLB placement, object interaction/snapping/collision, materials and catalog breadth follow independently. No physical phone, thermal, TalkBack, vendor browser matrix or full project/device-memory claim follows from Linux tests. D36 cloud/accounts/history, mobile optimization/sharing/real devices, billing/security/privacy/release/final Claude work remains unstarted.
