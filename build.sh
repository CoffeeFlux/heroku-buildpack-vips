#!/usr/bin/env bash
# Maintainer release builder; never executed by the Heroku buildpack.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p build
image_name=libvips/heroku-24:8.17.1
test_image=libvips/heroku-24-runtime-test:8.17.1

docker build --platform linux/amd64 --file container/Dockerfile --tag "$image_name" .
container_id=$(docker create "$image_name")
trap 'docker rm "$container_id" >/dev/null' EXIT
docker cp "$container_id:/usr/local/vips/build/." build/

docker build --platform linux/amd64 --file container/Dockerfile.test --tag "$test_image" .
docker run --rm --platform linux/amd64 --network none "$test_image"
