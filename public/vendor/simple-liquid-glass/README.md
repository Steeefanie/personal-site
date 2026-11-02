# WebKit material adapter

Upstream: https://github.com/lucaperullo/simple-liquid-glass
Version: 5.6.0; npm SHA-512 integrity verified. MIT and third-party notices retained.

This IIFE bundles createSceneCapture, createWebGLEngine, buildNativeMap and
resolveLensOptions, without React or runtime CDN requests. Upstream optics are
unchanged. capture-sections.patch adds an optional tile selector to avoid
flattening a whole long document into a single downsampled capture.

src/scripts/webgl-glass.ts enables this material for WebKit. Chromium retains
Hyalite; other engines use CSS without refraction. Development can force WebGL
with ?webgl-glass=1. The previous local checkpoint is preserved separately.

Background capture includes main content (article title, deck, tags, body) and
footer, with a 24 MiB cache budget. Captures stay local and are never uploaded.
Cross-origin media may fail to capture; CSS remains the complete fallback.
iPhone performance depends on content/GPU and still requires real-device testing.

Material strength 0.16, bend 0.7, bendWidth 0.22, dispersion 0.16. Icons and compact
controls use blur 2; menus, search, expanded contents and dialogs use blur 3.
The canvas owns refraction/blur; a single overlay owns tint/highlights/shadow.
Static buttons on uniform backgrounds do not attach WebGL or use backdrop blur.

The source patch uses zero-context hunks; apply it with git apply --unidiff-zero.
