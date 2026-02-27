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

# Only update and commit if version differs
if [ "$CURRENT_VERSION" != "$VERSION" ]; then
    # Update Cargo.toml
    sed -i '' "s/version = \"$CURRENT_VERSION\"/version = \"$VERSION\"/" Cargo.toml

    # Update frontend/package.json
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" frontend/package.json

    # Update Docker image tags in docker-compose.yml (for secan service if exists)
    # Only update secan-specific tags, leave infrastructure tags as 'latest'
    if grep -q "image: secan:" docker-compose.yml 2>/dev/null; then
        sed -i '' "s/image: secan:.*$/image: secan:$VERSION/" docker-compose.yml
    fi

    # Update Dockerfile image labels and comments that reference version
    if grep -q "LABEL version=" Dockerfile 2>/dev/null; then
        sed -i '' "s/LABEL version=.*/LABEL version=\"$VERSION\"/" Dockerfile 2>/dev/null || true
    fi

    # Regenerate Cargo.lock to match updated Cargo.toml
    cargo metadata > /dev/null 2>&1 || true

    # Stage changes
    git add Cargo.toml Cargo.lock frontend/package.json

    # Add docker files if they were modified
    git add docker-compose.yml Dockerfile 2>/dev/null || true

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
