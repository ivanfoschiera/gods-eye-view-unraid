# Upstream license review: God's Eye View v0.2.1

Reviewed upstream source: [`bilawalsidhu/gods-eye-view`](https://github.com/bilawalsidhu/gods-eye-view/tree/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee), commit `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`. This review applies to that commit only. It does not authorize unknown assets in later releases. The container is an unofficial packaging project, not an upstream-endorsed distribution.

**Publication is paused (`publication=false`).** The candidate workflow may audit and test the intact upstream source in an ephemeral CI environment, but must not push an image. Keep the complete local installation and its official icon unchanged. No replacement artwork, ALPR changes or CCTV snapshot removal has been applied or authorized as a default. Unresolved rights in runtime assets must be resolved before public image redistribution.

## Notices required for eventual redistribution

The upstream [`LICENSE`](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/LICENSE) expressly grants MIT rights for source code only. Keep that file in full, [`DATA_SOURCES.md`](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/DATA_SOURCES.md), `THIRD_PARTY_NOTICES.md`, per-dataset provenance files and in-app attribution. Do not label the entire image MIT.

| Upstream material | Declared license / required treatment if included |
| --- | --- |
| `public/models/{airplane,jet,ship,bell206,c172,citation2,mq9,b789,atr72}.glb` | Each is CC BY 4.0. Preserve [`public/models/README.md`](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/public/models/README.md), including creator, source links, license links and modification notices. No creator endorsement is implied. |
| `src/data/local_data/telegeography_submarine_cables/` | CC BY-NC-SA 3.0. Preserve the folder README and TeleGeography attribution. The data remains noncommercial and share-alike; the code's MIT license does not extend to it. |
| `public/events/bhote-koshi-2026/` and coordinate dataset in `src/data/bhoteKoshiFloodPath.js` | CC BY-NC 4.0. Preserve [`public/events/bhote-koshi-2026/README.md`](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/public/events/bhote-koshi-2026/README.md) and Vantor/GeoPera credit and modification notices. Linked witness posts retain their owners' terms. |
| Datacenters, dams and military-name data under `src/data/local_data/` | ODbL 1.0. Preserve OpenStreetMap, Open Infrastructure Map and Overture attribution and folder READMEs; retain data under its own database license. |
| Natural Earth, US Census and DataSF snapshots | Public domain / PDDL as documented upstream. Keep the provenance and courtesy credits. |
| npm dependencies and Node base | Each retains its own license. Keep installed package `LICENSE`, `COPYING`, `NOTICE` and attribution files and the base image's notices. The upstream root NOTICE does not inventory every installed dependency. |

The noncommercial datasets may be redistributed subject to their stated licenses; they do not make the image generally suitable for commercial use. Runtime data fetched from providers remains governed by those providers' terms. Never include `.env`, deployment caches, logs or credentials in the public build context.

## Findings affecting public redistribution

### Principal blocker: Google-derived CCTV height snapshot

`src/data/local_data/cctv_ground_heights/cctv_ground_heights.json` is documented in its [pinned README](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/src/data/local_data/cctv_ground_heights/README.md) as precomputed camera-mount and monitor support heights aligned to Google Photorealistic 3D Tiles. The [pinned precomputation script](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/scripts/precompute-cctv-heights.mjs) records provider `google-3d-tiles` and samples heights with `sampleHeightMostDetailed`.

Google's published [Maps Platform Terms, section 3.2.3(a)-(c)](https://cloud.google.com/maps-platform/terms) restrict extraction/export of Google Maps Content, caching except where expressly permitted, and creating content based on Google Maps Content. The [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies) also limit prefetching, caching and storage and prohibit geodata extraction. Required attribution alone is not a redistribution permission. No applicable exception or separate permission authorizing public redistribution of this bundled snapshot was located in the reviewed public sources. This is the principal blocker to clearing the intact runtime image; it is not a determination of the terms applicable to a particular account or of liability for the existing local installation. Keep the snapshot and local behavior unchanged while publication remains paused.

### Runtime artwork: contribution evidence and scope clarification

- `src/layers/alpr/assets/alpr-marker-normal.png`, `alpr-marker-selected.png`, `alpr-marker-selected-brackets.png`: [upstream commit 87629ac](https://github.com/bilawalsidhu/gods-eye-view/commit/87629ac175ed9a044b4f67d40459c27230f9a05d) and [merged PR 557](https://github.com/bilawalsidhu/gods-eye-view/pull/557) identify the ported artwork as Manjunath's contribution. The [pinned CONTRIBUTING.md](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/CONTRIBUTING.md) declares contributions licensed under the project's MIT License. This is affirmative licensing evidence, not an absence of all permission. Clarification remains appropriate because the root LICENSE expressly scopes its MIT grant to source code and excludes third-party assets; this review does not establish a separate asset-specific grant overriding that scope.
- `public/location.svg`: its path and circle geometry exactly match [Feather's map-pin.svg at v4.29.2](https://github.com/feathericons/feather/blob/v4.29.2/icons/map-pin.svg). Feather's [MIT License](https://github.com/feathericons/feather/blob/v4.29.2/LICENSE) identifies copyright 2013-2023 Cole Bemis and requires preservation of its copyright and permission notices. This geometric match suggests a possible attribution route without changing the asset; the upstream file's actual provenance is an inference, not confirmed by a source attribution. No asset change or final clearance is applied here.
- `public/logo.svg`, `public/mic.svg`, `public/pin.svg`, `public/visual-presets.svg`: asset-specific provenance and the scope of the upstream grant still need clarification. The source-only MIT wording does not establish permission for every standalone asset. This is not a claim that the upstream author lacks rights. Private use of the official icon does not by itself settle public redistribution.

A full runtime image has not been cleared for public redistribution. A successful build does not resolve these data restrictions and asset-license scope questions. Preserve the original artwork and all attribution; do not treat removal or replacement as the default resolution.

## Non-runtime exclusions acceptable for a future image candidate

- `docs/media/**`: promotional captures include third-party visual content; the runtime does not need these captures. Excluding documentation/promotional files from an image candidate is acceptable while retaining all required root and per-asset licensing/provenance documents.
- `src/data/fixtures/tomtom-flow-austin-12-935-1686.pbf`: the [fixture README](https://github.com/bilawalsidhu/gods-eye-view/blob/aa16b7c3b0166a89d8c7a6089e0aff53a22faaee/src/data/fixtures/README.md) records copyright and capture provenance, but no redistribution grant. Test-only fixtures may be omitted from an image candidate after source tests; normal startup does not use this TomTom fixture. This does not resolve the runtime asset grants above.

## Runtime effects to assess before any proposed change

The SVGs are referenced by the favicon, title, command-dock controls, CSS and voice UI. Removing or replacing them would change the supplied visual interface, even if the app still starts. Such a proposal is not applied and requires a confirmed redistribution grant or an explicit decision about the resulting differences before public publication.

ALPR `visuals.js` exports three image URLs used by `new Image()` in `overlay.js` and Cesium billboards in `presentation.js`. Deleting the PNGs leaves runtime references; disabling the feature or substituting artwork changes its visual treatment and requires explicit discussion. Empty/invalid data URIs can break canvas drawing. The candidate keeps the original ALPR assets; no replacement artwork has been created or applied.

`server/providers/cctv/groundHeights.js` catches a missing snapshot and returns `{}`. `src/layers/cctv/ground.js` can then use runtime Re:Earth/terrain or catalog/geoid fallback. This establishes a code path, not functional or visual equivalence: camera placement, network use and availability may differ. The candidate therefore retains this snapshot and pauses publication pending a grant or an explicit decision. Preserve all upstream security guards. This review did not execute or visually validate the application.

## Sharp/libvips dependency provenance

The audited lockfile contains `sharp@0.35.4`, `@img/sharp-linux-x64@0.35.4` (Apache-2.0) and `@img/sharp-libvips-linux-x64@1.3.3` (LGPL-3.0-or-later). Preserve their installed notices. The official packaging source for that exact libvips package is [`lovell/sharp-libvips` tag v1.3.3](https://github.com/lovell/sharp-libvips/tree/v1.3.3):

- [Package identity and license](https://github.com/lovell/sharp-libvips/blob/v1.3.3/npm/linux-x64/package.json)
- [Third-party library notices](https://github.com/lovell/sharp-libvips/blob/v1.3.3/THIRD-PARTY-NOTICES.md)
- [Dependency versions](https://github.com/lovell/sharp-libvips/blob/v1.3.3/versions.properties)
- [Source download, patches and compilation instructions](https://github.com/lovell/sharp-libvips/blob/v1.3.3/build/posix.sh)
- [Packaging entry point](https://github.com/lovell/sharp-libvips/blob/v1.3.3/build.sh)

The packaging source pins libvips 8.18.6 and multiple LGPL libraries. Preserve the exact package identity, notices, LGPL/GPL texts, dependency versions, source URLs and build patches. Before redistribution, establish that corresponding source for the actual distributed binaries is available and that the applicable license conditions are met. The links above are provenance evidence; their existence alone is not an assertion of complete legal compliance. Do not describe the precompiled library bundle as Apache-only. This review does not authorize pruning Sharp or other runtime dependencies.

## Release publication gate

Keep `publication=false` and image pushing disabled while runtime grants remain unresolved. Use a reviewed commit allowlist and validate licensing inputs before a future publication decision. New source commits, binary assets, changed grants or changed dependency licenses require review; do not infer redistribution permission from a release tag or successful tests. CI may test the intact source in its ephemeral workspace. Removing only documentation/promotional/test-only files from a future candidate does not clear the remaining rights questions. Keep reproducible source references and any explicitly approved patches with each candidate.
