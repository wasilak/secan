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

# Extract major.minor for docs versioning (e.g., "1.0.1" -> "1.0")
DOCS_VERSION=$(echo "$VERSION" | grep -oE '^[0-9]+\.[0-9]+')

# Only update and commit if version differs
if [ "$CURRENT_VERSION" != "$VERSION" ]; then
    # Update Cargo.toml
    sed -i '' "s/version = \"$CURRENT_VERSION\"/version = \"$VERSION\"/" Cargo.toml

    # Update frontend/package.json
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" frontend/package.json

    # Regenerate Cargo.lock to match updated Cargo.toml
    cargo metadata > /dev/null 2>&1 || true

    # Stage changes
    git add Cargo.toml Cargo.lock frontend/package.json

    # Commit version bump
    git commit -m "chore: bump version to $VERSION"
else
    echo "Version already $VERSION, skipping file updates"
fi

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION" -f

echo ""
echo "✓ Version bumped to $VERSION"
echo "✓ Tag created: v$VERSION"
echo ""
echo "Push with: git push origin main --tags"
