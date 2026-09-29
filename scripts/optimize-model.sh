#!/usr/bin/env bash
# Optimise a Higgsfield-generated rigged GLB for the web without hurting how Hamin looks:
# meshopt geometry compression (no simplification: it made the hair blotchy and faceted),
# texture resized to 1536 px and stored as high-quality WebP (1024 px / default quality speckled the skin).
# usage: scripts/optimize-model.sh art-src/raw.glb public/models/out.glb
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
npx gltf-transform optimize "$1" "$tmp/a.glb" --compress meshopt --texture-compress false \
  --simplify false --join false --instance false >/dev/null
npx gltf-transform resize "$tmp/a.glb" "$tmp/b.glb" --width 1536 --height 1536 >/dev/null
npx gltf-transform webp "$tmp/b.glb" "$2" --quality 92 >/dev/null
