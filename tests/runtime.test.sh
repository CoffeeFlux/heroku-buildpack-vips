#!/usr/bin/env bash
# Release-archive integration tests, executed only by Dockerfile.test.
set -euxo pipefail

test "$(vips --vips-version)" = 'libvips 8.17.1'
test ! -e "$HOME/vendor/vips/bin/meson"
test ! -e "$HOME/vendor/vips/bin/ninja"
if grep -R '/usr/local/vips' "$HOME/vendor/vips/lib/pkgconfig"; then
  echo 'pkg-config files still reference the release builder prefix.' >&2
  exit 1
fi

work=$(mktemp -d /tmp/vips-runtime-test.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
vips pdfload /test/tests/label.pdf "$work/label.png" --dpi 300
test "$(vipsheader -f width "$work/label.png")" = 1200
test "$(vipsheader -f height "$work/label.png")" = 1800
# Fixture contains text only: no geometry to mask missing font rendering.
vips avg "$work/label.png" | awk '{ if ($1 <= 0 || $1 >= 255) exit 1; found=1 } END { if (!found) exit 1 }'
vips rot "$work/label.png" "$work/rotated.png" d90
test "$(vipsheader -f width "$work/rotated.png")" = 1800
test "$(vipsheader -f height "$work/rotated.png")" = 1200
vips copy "$work/label.png" "$work/label.jpg"
vips copy "$work/label.jpg" "$work/roundtrip.png"
echo 'PASS: relocated libvips loads, renders PDF text at 300 DPI, rotates and round-trips JPEG/PNG.'
