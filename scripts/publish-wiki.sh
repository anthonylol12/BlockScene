#!/usr/bin/env bash
# Publica docs/wiki en la wiki de GitHub del repositorio.
# Requisito: la wiki debe tener al menos una página creada desde la web (GitHub crea el repositorio .wiki entonces).
# Uso: bash scripts/publish-wiki.sh
set -euo pipefail
REPO="${REPO:-anthonylol12/BlockScene}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
git clone -q "https://github.com/${REPO}.wiki.git" "$TMP"
find "$TMP" -maxdepth 1 -name '*.md' -delete
cp "$ROOT"/docs/wiki/*.md "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then
  echo "La wiki ya está al día."
else
  git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" \
    commit -q -m "Actualizar la wiki desde docs/wiki"
  git push -q origin HEAD
  echo "Wiki publicada: https://github.com/${REPO}/wiki"
fi
rm -rf "$TMP"
