#!/bin/bash
# Script to update astro.config.mjs with a new version for tagged releases
# Usage: ./scripts/update-docs-version.sh "v1.1.0"

set -e

VERSION_TAG=$1

if [ -z "$VERSION_TAG" ]; then
  echo "Error: Version tag required"
  echo "Usage: $0 <version-tag>"
  exit 1
fi

# Extract major.minor from version (e.g., "v1.1.0" -> "1.1")
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

# Find the versions array and add the new version at the beginning
# Pattern: versions: [ followed by any whitespace
pattern = r'(versions:\s*\[\s*)'
new_version_entry = f'{{ slug: \'{version}\', label: \'v{version}.x\' }},\n\t\t\t\t\t'
replacement = r'\1' + new_version_entry

updated_content = re.sub(pattern, replacement, content)

with open(config_file, 'w') as f:
    f.write(updated_content)

print(f'✓ Successfully added version {version} to {config_file}')
EOF

echo "Updated config file (versions array):"
grep -A 8 "versions:" "$CONFIG_FILE" | head -12
