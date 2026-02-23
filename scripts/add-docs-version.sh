#!/bin/bash
# Add a new version to docs/astro.config.mjs (used by CI/CD on tag releases)
# Usage: ./scripts/add-docs-version.sh v1.2.0

set -e

VERSION_TAG=$1

if [ -z "$VERSION_TAG" ]; then
  echo "Error: Version tag required"
  echo "Usage: $0 <version-tag>"
  exit 1
fi

# Extract major.minor from version (e.g., "v1.2.0" -> "1.2")
VERSION=$(echo "$VERSION_TAG" | sed 's/^v//' | grep -oE '^[0-9]+\.[0-9]+')

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from tag: $VERSION_TAG"
  exit 1
fi

CONFIG_FILE="docs/astro.config.mjs"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found"
  exit 1
fi

echo "Adding version $VERSION to $CONFIG_FILE"

# Use Python to update the config file
python3 << EOF
import re

version = "$VERSION"
config_file = "$CONFIG_FILE"

with open(config_file, 'r') as f:
    content = f.read()

# Add new version at the beginning of versions array if not already present
if f"slug: '{version}'" not in content:
    pattern = r'(versions:\s*\[\s*)'
    new_version_entry = f"{{ slug: '{version}', label: 'v{version}.x' }},\n\t\t\t\t\t"
    replacement = r'\1' + new_version_entry
    updated_content = re.sub(pattern, replacement, content)
else:
    print(f"Version {version} already in config, skipping")
    updated_content = content

with open(config_file, 'w') as f:
    f.write(updated_content)

print(f"✓ Version {version} added to {config_file}")
EOF

echo "Updated versions array:"
grep -A 4 "versions:" "$CONFIG_FILE" | head -6
