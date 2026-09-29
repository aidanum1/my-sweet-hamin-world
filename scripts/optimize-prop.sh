#!/usr/bin/env bash
# Optimise a Higgsfield prop GLB (static): meshopt, WebP texture, simplification.
# usage: scripts/optimize-prop.sh in.glb out.glb [textureSize=512] [simplifyRatio=0.45] [simplifyError=0.002]
set -euo pipefail
npx gltf-transform optimize "$1" "$2" --compress meshopt --texture-compress webp \
  --texture-size "${3:-512}" --simplify-ratio "${4:-0.45}" --simplify-error "${5:-0.002}" >/dev/null
