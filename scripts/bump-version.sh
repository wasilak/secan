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

    # Update docs version in astro.config.mjs
    if [ -f "docs/astro.config.mjs" ]; then
        python3 << PYTHON_SCRIPT
import re

version = "$DOCS_VERSION"
config_file = "docs/astro.config.mjs"

with open(config_file, 'r') as f:
    content = f.read()

# Add new version at the beginning of versions array if not already present
if f"slug: '{version}'" not in content:
    pattern = r'(versions:\s*\[\s*)'
    new_version_entry = f"{{ slug: '{version}', label: 'v{version}.x' }},\n\t\t\t\t\t"
    replacement = r'\1' + new_version_entry
    updated_content = re.sub(pattern, replacement, content)
    print(f"✓ Added version {version} to docs config")
else:
    print(f"Version {version} already in config, skipping")
    updated_content = content

with open(config_file, 'w') as f:
    f.write(updated_content)

print(f"✓ Added version {version} to docs config")
PYTHON_SCRIPT
    fi

    # Regenerate Cargo.lock to match updated Cargo.toml
    cargo metadata > /dev/null 2>&1 || true

    # Stage changes
    git add Cargo.toml Cargo.lock frontend/package.json docs/astro.config.mjs

    # Commit version bump
    git commit -m "chore: bump version to $VERSION

- Update Cargo.toml and frontend/package.json
- Add v$DOCS_VERSION to documentation versions"
else
    echo "Version already $VERSION, skipping file updates"
fi

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION" -f

echo ""
echo "✓ Version bumped to $VERSION"
echo "✓ Documentation version added: $DOCS_VERSION"
echo "✓ Tag created: v$VERSION"
echo ""
echo "Push with: git push origin main --tags"
