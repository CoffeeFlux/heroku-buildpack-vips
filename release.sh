#!/usr/bin/env bash
# CI publisher: only master pushes after successful build/runtime tests call this.
set -euo pipefail
cd "$(dirname "$0")"

if [[ ${GITHUB_EVENT_NAME:-} != push || ${GITHUB_REF:-} != refs/heads/master ]]; then
  echo 'Release publication is only allowed for a push to master.' >&2
  exit 1
fi
version=$(<package-version)
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+-r[1-9][0-9]*$ || ! ${GITHUB_SHA:-} =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Invalid package version or release commit.' >&2
  exit 1
fi
for asset in build/heroku-24.tar.gz build/heroku-24.tar.gz.sha256 build/heroku-24.config.log; do
  test -s "$asset"
done

# gh release create refuses an existing release. Never update/clobber assets for
# a cached version. Bump package-version for each new release, even if the vips
# library version is unchanged. A failed upload leaves a draft, not a public
# partially populated release; retrying it also fails instead of overwriting.
gh release create "v$version" \
  build/heroku-24.tar.gz build/heroku-24.tar.gz.sha256 build/heroku-24.config.log \
  --target "$GITHUB_SHA" --title "libvips package $version (Heroku-24)" \
  --notes "Tested Heroku-24 x64 package from commit $GITHUB_SHA." --draft
gh release edit "v$version" --draft=false
