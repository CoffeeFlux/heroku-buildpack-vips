# Heroku libvips buildpack — CoffeeFlux fork

Heroku-24 **x64** libvips with PDFium, forked from
[hardpixel/heroku-buildpack-vips](https://github.com/hardpixel/heroku-buildpack-vips).
The initial candidate uses **libvips 8.17.1** and **PDFium Chromium 8044**.
It does not claim support for the upstream fork's old Heroku-18/20/22 targets.

**Review candidate, not deployed:** a reviewed release archive must be published
in this fork before an app can install it. PR builds only produce temporary CI
artifacts; they never publish releases, update Heroku, or change dyno sizes.

## What to review

- `container/Dockerfile`: the inherited **release builder**, updated for
  Heroku-24 and pinned PDF-enabled libvips. This is not an app deployment image.
- `bin/compile`: downloads and verifies this fork's release archive, caches it
  separately from upstream, installs it, and sets build/runtime library paths.
- `bin/detect`: supported Heroku stack.
- `build.sh` and `.github/workflows/build.yml`: maintainer artifact-build process.
- **Tests only:** `container/Dockerfile.test` and everything under `tests/`.

Meson, Ninja, compilers and source trees exist only in the release builder.
The archive contains native binaries/libraries, headers/pkg-config metadata
needed by later language buildpacks, and license notices. Apps download that
archive instead of recompiling libvips on every deployment.

## Build and test a candidate (maintainers)

```sh
node --test tests/installer.test.cjs # Linux/GNU tooling; mocked downloads
bash build.sh                     # Docker required to build release artifacts
```

Output: `build/heroku-24.tar.gz`, its `.sha256` checksum, and a configuration log.
The existing release-builder architecture is retained. Its separately named
`Dockerfile.test` installs the archive through the actual buildpack, relocates
the app to `/app`, and tests PDF text rendering at 300 DPI, dimensions,
rotation and JPEG/PNG conversion on the **unmodified Heroku runtime** without
network access. It installs no test dependencies that could mask missing libs.
`tests/label.pdf` is a synthetic text-only 4×6-inch PDF, not a carrier label.

For a new native version, update the recipe's versions **and checksums**, the
installer default, build/test expectations and documentation together. Some
inherited codec source dependencies remain at upstream's versions; APT package
versions still follow Ubuntu repositories. Passing builds do not establish
bit-for-bit reproducibility or compatibility with a future Heroku stack.

## Release and application integration (after review)

Publish the tested archive, checksum and configuration log as an **immutable**
release `v8.17.1` in this fork. Do not overwrite assets for a cached version.
`VIPS_VERSION` selects a published `x.y.z` release; it defaults to `8.17.1` and
does not fall back to upstream if this fork has no matching release.

For an isolated Heroku-24 Basic canary, pin the reviewed buildpack commit before
the official Node buildpack. If APT is needed for Canvas or other app libraries,
place it before this buildpack. Clear the old app build cache on migration.
The buildpack supplies relocatable pkg-config files; an application-specific
rewrite of `/usr/local/vips` is no longer necessary.

**This only supplies libvips/PDFium.** It does not fix Canvas's prebuilt
FreeType/HarfBuzz conflict or install Node. The service must still source-build
its native adapters against compatible libraries and test both import orders.
Do not combine this with the service PR's in-repo libvips compiler: that PR
needs simplifying to use this fork before rollout.

Release gates, all still unchecked:

- [ ] Candidate archive build, installer unit tests and bare-runtime tests pass.
- [ ] Full service canary using Sharp and Canvas on a real Heroku-24 Basic dyno.
- [ ] Representative sanitized carrier labels, including decoded barcodes.
- [ ] HEIC input if needed, slug size, memory behavior and repeat-build checks.

The earlier isolated app experiment validated the selected libvips/PDFium
combination, **not this fork's complete codec bundle**. PDF pixels differed from
the old font stack. These remaining gates must not be inferred from a version
bump or a successful synthetic PDF test.

Record the old app release, stack, buildpacks and formation before migration.
On failure, roll back the app release and restore the recorded build
configuration before another build. No production action is taken by this repo.

## License

Buildpack scripts retain the upstream MIT license. Bundled libraries retain
their respective licenses; the release recipe preserves libvips/PDFium notices.
