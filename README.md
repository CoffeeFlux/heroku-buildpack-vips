# Heroku libvips buildpack — CoffeeFlux fork

Heroku-24 **x64** libvips with PDFium, forked from
[hardpixel/heroku-buildpack-vips](https://github.com/hardpixel/heroku-buildpack-vips).
The initial candidate uses **libvips 8.17.1** and **PDFium Chromium 8044**.
It does not claim support for the upstream fork's old Heroku-18/20/22 targets.

**Review candidate, not deployed:** a reviewed release archive must be published
in this fork before an app can install it. Merging to `master` automatically
publishes after build/runtime tests pass. PR builds only produce temporary CI
artifacts; neither publishing nor testing updates Heroku or changes dyno sizes.

## What to review

- `container/Dockerfile`: the inherited **release builder**, updated for
  Heroku-24 and pinned PDF-enabled libvips. This is not an app deployment image.
- `bin/compile`: downloads and verifies this fork's release archive, caches it
  separately from upstream, installs it, and sets build/runtime library paths.
- `bin/detect`: supported Heroku stack.
- `build.sh`, `release.sh` and `.github/workflows/build.yml`: artifact build and
  automatic publication after successful tests on `master`.
- `package-version`: package revision, independent of the native library version.
- **Tests only:** `container/Dockerfile.test` and everything under `tests/`.

Meson, Ninja, compilers and source trees exist only in the release builder.
The archive contains native binaries/libraries, headers/pkg-config metadata
needed by later language buildpacks, and license notices. Apps download that
archive instead of recompiling libvips on every deployment.

## Build and test a candidate (maintainers)

```sh
node --test tests/*.test.cjs        # Mocked downloads/publication; installer tests require Linux
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
package revision, build/test expectations and documentation together. Some
inherited codec source dependencies remain at upstream's versions; APT package
versions still follow Ubuntu repositories. Passing builds do not establish
bit-for-bit reproducibility or compatibility with a future Heroku stack.

## Release and application integration (after review)

Each release change must bump `package-version` (initially `8.17.1-r1`). Increase
the `rN` revision for packaging fixes even when libvips itself is unchanged.
`VIPS_VERSION` selects a published `x.y.z-rN` package, defaults to the version in
that file, and never falls back to upstream.

After a push/merge to `master`, CI builds and tests the archive, then a separate
job with release-write permission publishes **those same tested artifacts** as
`v8.17.1-r1`. No separate manual publishing step is needed. PRs and manual test
dispatches cannot publish. The publisher creates a draft with all three assets,
then makes it public; an upload failure cannot expose a partial public release.

Existing releases are never overwritten. A rerun after successful publication
will refuse to recreate that release; likewise, an interrupted upload leaves a
draft for inspection. Use a new package revision for a new publication. This
keeps Heroku's version-keyed caches consistent. Publishing is not an app deploy.

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

Validation gates (publication requires the first; application rollout requires
the remaining checks):

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
