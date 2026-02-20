#!/bin/bash
set -e

TAG="$1"
VERSION="${TAG#v}"

if [ -z "$TAG" ]; then
    echo "ERROR: TAG is required (e.g., ./scripts/bump-version.sh v0.2.0)"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working directory must be clean before bumping version"
    exit 1
fi

echo "Bumping version from 0.1.0 to $VERSION"

# Update Cargo.toml
sed -i '' "s/version = \"0.1.0\"/version = \"$VERSION\"/" Cargo.toml

# Update frontend/package.json
sed -i '' "s/\"version\": \"0.1.0\"/\"version\": \"$VERSION\"/" frontend/package.json

# Stage changes
git add Cargo.toml frontend/package.json

# Commit version bump
git commit -m "chore: bump version to $VERSION"

# Create annotated tag
git tag -a "$TAG" -m "Release $TAG"

echo "Version bumped to $VERSION"
echo "Tag created: $TAG"
echo "Push with: git push && git push origin $TAG"
