#!/bin/bash
set -e

# Script to create a new release
# Usage: ./scripts/create-release.sh <version>
# Example: ./scripts/create-release.sh v0.1.0

if [ -z "$1" ]; then
    echo "Error: Version argument required"
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.1.0"
    exit 1
fi

VERSION=$1

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo "Error: Invalid version format. Expected format: vX.Y.Z or vX.Y.Z-suffix"
    echo "Examples: v0.1.0, v1.2.3, v0.1.0-beta.1"
    exit 1
fi

echo "Creating release $VERSION"

# Check if we're on the main/master branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo "Warning: You are not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "Error: You have uncommitted changes. Please commit or stash them first."
    git status -s
    exit 1
fi

# Update version in Cargo.toml
echo "Updating version in backend/Cargo.toml..."
VERSION_NUMBER=${VERSION#v}
sed -i.bak "s/^version = \".*\"/version = \"$VERSION_NUMBER\"/" backend/Cargo.toml
rm backend/Cargo.toml.bak 2>/dev/null || true

# Update version in package.json
echo "Updating version in frontend/package.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION_NUMBER\"/" frontend/package.json
rm frontend/package.json.bak 2>/dev/null || true

# Commit version changes
echo "Committing version changes..."
git add backend/Cargo.toml frontend/package.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
echo "Creating tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION"

echo ""
echo "Release $VERSION prepared successfully!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git show"
echo "2. Push the changes: git push origin $CURRENT_BRANCH"
echo "3. Push the tag: git push origin $VERSION"
echo ""
echo "The GitHub Actions workflow will automatically:"
echo "  - Build binaries for all platforms"
echo "  - Create a GitHub release"
echo "  - Upload release artifacts"
echo "  - Build and push Docker images"
echo ""
echo "Or run all at once:"
echo "  git push origin $CURRENT_BRANCH && git push origin $VERSION"
