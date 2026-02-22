#!/bin/bash
set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "ERROR: VERSION is required (e.g., ./scripts/bump-version.sh 1.0.1)"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working directory must be clean before bumping version"
    exit 1
fi

# Get current version from Cargo.toml
CURRENT_VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')

echo "Bumping version from $CURRENT_VERSION to $VERSION"

# Update Cargo.toml
sed -i '' "s/version = \"$CURRENT_VERSION\"/version = \"$VERSION\"/" Cargo.toml

# Update frontend/package.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" frontend/package.json

# Stage changes
git add Cargo.toml frontend/package.json

# Commit version bump
git commit -m "chore: bump version to $VERSION"

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION"

echo "Version bumped to $VERSION"
echo "Tag created: v$VERSION"
echo "Push with: git push && git push origin v$VERSION"
