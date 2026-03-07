#!/usr/bin/env node

/**
 * Migration script to convert Starlight markdown files to Docusaurus format
 * 
 * This script:
 * - Reads all markdown files from docs/src/content/docs/
 * - Parses frontmatter from each file
 * - Converts Starlight frontmatter to Docusaurus format
 * - Writes converted files to docs/docs/ preserving directory structure
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Configuration
const SOURCE_DIR = path.join(__dirname, 'src', 'content', 'docs');
const DEST_DIR = path.join(__dirname, 'docs');

/**
 * Convert Starlight frontmatter to Docusaurus format
 * Removes Starlight-specific fields like 'template'
 * 
 * @param {Object} frontmatter - Starlight frontmatter object
 * @returns {Object} Docusaurus-compatible frontmatter
 */
function convertFrontmatter(frontmatter) {
  const docusaurusFrontmatter = {};
  
  // Preserve title and description
  if (frontmatter.title) {
    docusaurusFrontmatter.title = frontmatter.title;
  }
  
  if (frontmatter.description) {
    docusaurusFrontmatter.description = frontmatter.description;
  }
  
  // Convert sidebar_label if present
  if (frontmatter.sidebar_label) {
    docusaurusFrontmatter.sidebar_label = frontmatter.sidebar_label;
  }
  
  // Convert sidebar_position if present
  if (frontmatter.sidebar_position !== undefined) {
    docusaurusFrontmatter.sidebar_position = frontmatter.sidebar_position;
  }
  
  // Remove Starlight-specific fields (template, hero, etc.)
  // These are intentionally not copied to Docusaurus frontmatter
  
  return docusaurusFrontmatter;
}

/**
 * Convert Starlight Card component to Docusaurus Admonition
 * 
 * @param {string} content - Markdown content with Card components
 * @returns {string} Content with converted components
 */
function convertCardComponents(content) {
  // Match Card components with title and icon attributes
  // Pattern: <Card title="..." icon="...">content</Card>
  const cardPattern = /<Card\s+title="([^"]+)"\s+icon="[^"]*">([\s\S]*?)<\/Card>/g;
  
  return content.replace(cardPattern, (match, title, cardContent) => {
    // Trim whitespace from card content
    const trimmedContent = cardContent.trim();
    
    // Convert to Docusaurus Admonition (tip style for feature cards)
    return `:::tip ${title}\n${trimmedContent}\n:::`;
  });
}

/**
 * Convert Starlight CardGrid component to CSS Grid div
 * 
 * @param {string} content - Markdown content with CardGrid components
 * @returns {string} Content with converted components
 */
function convertCardGridComponents(content) {
  // Match CardGrid components with cols attribute
  // Pattern: <CardGrid cols={n}>content</CardGrid>
  const cardGridPattern = /<CardGrid\s+cols=\{(\d+)\}>([\s\S]*?)<\/CardGrid>/g;
  
  return content.replace(cardGridPattern, (match, cols, gridContent) => {
    // Convert to div with className for CSS Grid styling
    return `<div className="card-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', margin: '2rem 0'}}>\n${gridContent}\n</div>`;
  });
}

/**
 * Remove Starlight component imports
 * 
 * @param {string} content - Markdown content with imports
 * @returns {string} Content without Starlight imports
 */
function removeStarlightImports(content) {
  // Remove import statements for Starlight components
  const importPattern = /import\s+\{[^}]*\}\s+from\s+["']@astrojs\/starlight\/components["'];?\s*\n?/g;
  return content.replace(importPattern, '');
}

/**
 * Escape curly braces to prevent MDX parsing issues
 * MDX treats {variable} as JSX expressions
 * 
 * @param {string} content - Markdown content
 * @returns {string} Content with escaped curly braces
 */
function escapeCurlyBraces(content) {
  // Escape curly braces in fenced code blocks
  const fencedCodeBlockPattern = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
  
  content = content.replace(fencedCodeBlockPattern, (codeBlock) => {
    // Escape curly braces within code blocks using backslash
    return codeBlock.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  });
  
  // Fix inline code followed by text with curly braces in parentheses
  // Pattern: `code` - text (example{variable})
  // Convert to: `code` - text (example\{variable\})
  content = content.replace(/(\([^)]*)\{([^}]+)\}([^)]*\))/g, (match, before, variable, after) => {
    // Only escape if not already in backticks
    if (!before.includes('`') || before.lastIndexOf('`') < before.lastIndexOf('(')) {
      return `${before}\\{${variable}\\}${after}`;
    }
    return match;
  });
  
  return content;
}

/**
 * Convert all Starlight components to Docusaurus equivalents
 * 
 * @param {string} content - Markdown content body
 * @returns {string} Converted content
 */
function convertComponents(content) {
  let converted = content;
  
  // Remove Starlight imports first
  converted = removeStarlightImports(converted);
  
  // Convert CardGrid (must be done before Card to preserve nesting)
  converted = convertCardGridComponents(converted);
  
  // Convert individual Card components
  converted = convertCardComponents(converted);
  
  // Escape curly braces to prevent MDX parsing issues
  converted = escapeCurlyBraces(converted);
  
  return converted;
}

/**
 * Recursively get all markdown files from a directory
 * 
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Array<{sourcePath: string, relativePath: string}>} Array of file info objects
 */
function getAllMarkdownFiles(dir, baseDir = dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`Warning: Directory does not exist: ${dir}`);
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      files.push(...getAllMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      // Calculate relative path from base directory
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        sourcePath: fullPath,
        relativePath: relativePath
      });
    }
  }
  
  return files;
}

/**
 * Migrate a single markdown file
 * 
 * @param {string} sourcePath - Source file path
 * @param {string} relativePath - Relative path for destination
 */
function migrateFile(sourcePath, relativePath) {
  try {
    // Read source file
    const content = fs.readFileSync(sourcePath, 'utf8');
    
    // Parse frontmatter and content
    const { data: frontmatter, content: body } = matter(content);
    
    // Convert frontmatter
    const newFrontmatter = convertFrontmatter(frontmatter);
    
    // Convert Starlight components to Docusaurus equivalents
    const convertedBody = convertComponents(body);
    
    // Reconstruct file with new frontmatter and converted content
    const newContent = matter.stringify(convertedBody, newFrontmatter);
    
    // Determine destination path
    const destPath = path.join(DEST_DIR, relativePath);
    const destDir = path.dirname(destPath);
    
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Write converted file
    fs.writeFileSync(destPath, newContent, 'utf8');
    
    console.log(`✓ Migrated: ${relativePath}`);
    
    return { success: true, path: relativePath };
  } catch (error) {
    console.error(`✗ Error migrating ${relativePath}:`, error.message);
    return { success: false, path: relativePath, error: error.message };
  }
}

/**
 * Main migration function
 */
function migrate() {
  console.log('Starting Starlight to Docusaurus content migration...\n');
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Destination: ${DEST_DIR}\n`);
  
  // Get all markdown files
  const files = getAllMarkdownFiles(SOURCE_DIR);
  
  if (files.length === 0) {
    console.log('No markdown files found to migrate.');
    return;
  }
  
  console.log(`Found ${files.length} markdown files to migrate.\n`);
  
  // Migrate each file
  const results = files.map(({ sourcePath, relativePath }) => 
    migrateFile(sourcePath, relativePath)
  );
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n' + '='.repeat(50));
  console.log('Migration Summary:');
  console.log(`Total files: ${files.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    console.log('\nFailed files:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.path}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n✓ Migration completed successfully!');
}

// Run migration
if (require.main === module) {
  migrate();
}

// Export functions for testing
module.exports = {
  convertFrontmatter,
  convertCardComponents,
  convertCardGridComponents,
  removeStarlightImports,
  escapeCurlyBraces,
  convertComponents,
  getAllMarkdownFiles,
  migrateFile,
  migrate
};
