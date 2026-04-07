#!/usr/bin/env bash
# Usage: ./scripts/release.sh patch|minor|major
# Bumps version in pyproject.toml, commits, tags, and pushes.
set -euo pipefail

BUMP="${1:-patch}"

# Read current version from pyproject.toml
CURRENT=$(grep -oP 'version = "\K[^"]+' pyproject.toml)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 patch|minor|major"; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
TAG="v${NEW_VERSION}"

echo "Bumping: ${CURRENT} → ${NEW_VERSION}"

# Update pyproject.toml
sed -i "s/^version = .*/version = \"${NEW_VERSION}\"/" pyproject.toml

# Commit, tag, push
git add pyproject.toml
git commit -m "release: v${NEW_VERSION}"
git tag "$TAG"
git push origin master "$TAG"

echo ""
echo "Released ${TAG} — GitHub Actions will build and publish."
echo "https://github.com/ashleyleslie1/needicons/releases"
