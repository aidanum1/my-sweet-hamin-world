#!/usr/bin/env bash
# Optimise a Higgsfield-generated rigged GLB for the web:
# meshopt geometry compression, 1024px WebP texture, light simplification (skinning preserved).
# usage: scripts/optimize-model.sh art-src/raw.glb public/models/out.glb
set -euo pipefail
npx gltf-transform optimize "$1" "$2" \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --simplify-ratio 0.55 --simplify-error 0.0008 --join false --instance false
