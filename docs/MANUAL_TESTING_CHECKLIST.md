# Manual Testing Checklist - Starlight to Docusaurus Migration

This checklist verifies that the Docusaurus migration is complete and all features work correctly. Complete all items before marking the migration as successful.

## Pre-Testing Setup

- [ ] Ensure all dependencies are installed: `cd docs && npm install`
- [ ] Clear any cached builds: `npm run clear`
- [ ] Ensure you're on the correct branch with latest changes

## Content Migration Verification

### Markdown Files
- [ ] All markdown files from `docs/src/content/docs/` have been migrated to `docs/docs/`
- [ ] Directory structure is preserved under `docs/docs/`
- [ ] No markdown files are missing from the migration
- [ ] Frontmatter is present and valid in all migrated files
- [ ] Title and description fields are preserved from Starlight

### File Structure
- [ ] `docs/docs/getting-started/` directory exists with all files
- [ ] `docs/docs/features/` directory exists with all files
- [ ] `docs/docs/authentication/` directory exists with all files
- [ ] `docs/docs/configuration/` directory exists with all files
- [ ] `docs/docs/api/` directory exists with index.md

## Landing Page Testing

### Visual Elements
- [ ] Landing page loads at `http://localhost:3000/secan/`
- [ ] Sproutling logo displays prominently in hero section
- [ ] Hero section has proper styling and layout
- [ ] Tagline displays correctly below title
- [ ] "Get Started" button is visible and styled correctly
- [ ] "View Features" button is visible and styled correctly

### Functionality
- [ ] "Get Started" button navigates to `/secan/getting-started/about`
- [ ] "View Features" button navigates to `/secan/features/dashboard`
- [ ] Feature cards section displays below hero
- [ ] All 6 feature cards are visible
- [ ] Feature cards have icons and descriptions
- [ ] Feature cards are arranged in responsive grid

### Responsive Design
- [ ] Landing page is responsive on mobile (< 768px width)
- [ ] Landing page is responsive on tablet (768px - 1024px width)
- [ ] Landing page is responsive on desktop (> 1024px width)
- [ ] Logo scales appropriately on different screen sizes
- [ ] Buttons are touch-friendly on mobile

## Navigation Testing

### Navbar
- [ ] Navbar displays at top of all pages
- [ ] Secan title appears in navbar
- [ ] Sproutling logo appears in navbar
- [ ] Logo links to home page (`/secan/`)
- [ ] GitHub link appears in navbar (right side)
- [ ] GitHub link opens correct repository
- [ ] Version selector appears in navbar
- [ ] Theme switcher appears in navbar

### Sidebar
- [ ] Sidebar displays on all documentation pages
- [ ] "Getting Started" category is present
  - [ ] About link
  - [ ] Installation link
  - [ ] Architecture link
- [ ] "Features" category is present
  - [ ] Dashboard link
  - [ ] Cluster Details link
  - [ ] Index Management link
  - [ ] Shard Management link
  - [ ] REST Console link
  - [ ] Additional Features link
- [ ] "Authentication & Authorization" category is present
- [ ] "Configuration" category is present
  - [ ] Authentication link
  - [ ] Clusters link
  - [ ] Logging link
- [ ] "API Reference" link is present
- [ ] Sidebar categories are collapsible
- [ ] Current page is highlighted in sidebar
- [ ] Sidebar order matches Starlight structure

### Mobile Navigation
- [ ] Sidebar collapses into hamburger menu on mobile
- [ ] Hamburger menu icon is visible and clickable
- [ ] Sidebar opens when hamburger is clicked
- [ ] Sidebar closes when clicking outside
- [ ] Navigation is accessible via touch gestures

## Theme Testing

### Theme Switcher
- [ ] Theme switcher has three options: Light, Dark, System
- [ ] Light mode can be selected
- [ ] Dark mode can be selected
- [ ] System preference mode can be selected
- [ ] Selected theme persists after page reload
- [ ] Theme preference is stored in localStorage

### Light Mode
- [ ] Light mode uses light backgrounds
- [ ] Light mode uses dark text
- [ ] Light mode navbar is styled correctly
- [ ] Light mode sidebar is styled correctly
- [ ] Light mode code blocks are readable
- [ ] Light mode Mermaid diagrams use light theme

### Dark Mode
- [ ] Dark mode uses dark backgrounds (#1b1b1d)
- [ ] Dark mode uses light text
- [ ] Dark mode navbar is styled correctly
- [ ] Dark mode sidebar is styled correctly
- [ ] Dark mode code blocks are readable
- [ ] Dark mode Mermaid diagrams use dark theme
- [ ] Dark mode is the default theme

### System Preference
- [ ] System preference mode respects OS theme setting
- [ ] Changing OS theme updates site theme automatically

## Link Testing

### Internal Links
- [ ] All internal links use `/secan/` prefix locally
- [ ] Links between documentation pages work correctly
- [ ] Links to landing page work (`/secan/`)
- [ ] Links to API reference work (`/secan/api/`)
- [ ] Anchor links within pages work correctly
- [ ] No broken internal links (check browser console)

### External Links
- [ ] GitHub repository link works
- [ ] External links open in new tab (if configured)
- [ ] All external links are valid

## Asset Testing

### Images
- [ ] Sproutling logo loads in navbar (`/secan/img/sproutling.png`)
- [ ] Sproutling logo loads on landing page
- [ ] All images in documentation load correctly
- [ ] Images use correct path format (`/secan/img/...`)
- [ ] No 404 errors for images in browser console
- [ ] Images have appropriate alt text

### Favicon
- [ ] Favicon appears in browser tab
- [ ] Favicon is correct image (sproutling or secan icon)

### Static Assets
- [ ] All static assets load from `/secan/static/` path
- [ ] Custom CSS loads correctly
- [ ] Custom JavaScript loads correctly (if any)

## Content Rendering

### Markdown Features
- [ ] Headings render correctly (H1-H6)
- [ ] Paragraphs render with proper spacing
- [ ] Bold text renders correctly
- [ ] Italic text renders correctly
- [ ] Lists (ordered and unordered) render correctly
- [ ] Nested lists render correctly
- [ ] Tables render correctly
- [ ] Tables are horizontally scrollable on mobile
- [ ] Blockquotes render correctly
- [ ] Horizontal rules render correctly

### Code Blocks
- [ ] Code blocks have syntax highlighting
- [ ] JavaScript code blocks highlight correctly
- [ ] TypeScript code blocks highlight correctly
- [ ] Rust code blocks highlight correctly
- [ ] YAML code blocks highlight correctly
- [ ] JSON code blocks highlight correctly
- [ ] Bash/Shell code blocks highlight correctly
- [ ] Code blocks have copy button
- [ ] Code blocks are horizontally scrollable on mobile
- [ ] Inline code renders with monospace font

### Admonitions
- [ ] Note admonitions render correctly
- [ ] Tip admonitions render correctly
- [ ] Warning admonitions render correctly
- [ ] Danger admonitions render correctly
- [ ] Info admonitions render correctly
- [ ] Admonitions have appropriate icons and colors

### Mermaid Diagrams
- [ ] Mermaid diagrams render correctly
- [ ] Flowchart diagrams display properly
- [ ] Sequence diagrams display properly (if any)
- [ ] Class diagrams display properly (if any)
- [ ] State diagrams display properly (if any)
- [ ] Mermaid diagrams match current theme (light/dark)
- [ ] Mermaid diagrams use Secan brand colors
- [ ] Diagrams are readable on mobile
- [ ] No Mermaid syntax errors in console

## Search Functionality

### Search Bar
- [ ] Search bar appears in navbar
- [ ] Search bar is clickable
- [ ] Search modal opens when clicked
- [ ] Search accepts keyboard input
- [ ] Search provides real-time suggestions

### Search Results
- [ ] Search returns relevant results
- [ ] Search results include page titles
- [ ] Search results include context snippets
- [ ] Search results highlight matching text
- [ ] Clicking search result navigates to correct page
- [ ] Search supports keyboard navigation (arrow keys)
- [ ] Pressing Enter selects first result
- [ ] Pressing Escape closes search modal

### Search Coverage
- [ ] All documentation pages are indexed
- [ ] Search finds content from Getting Started section
- [ ] Search finds content from Features section
- [ ] Search finds content from Configuration section
- [ ] Search finds content from Authentication section

## Versioning

### Version Selector
- [ ] Version selector appears in navbar
- [ ] Version selector shows "1.2.x (Next)" as current
- [ ] Version selector shows "1.1.x" as previous version
- [ ] Clicking version selector opens dropdown
- [ ] Can select different versions from dropdown

### Version Navigation
- [ ] Selecting "1.1.x" navigates to `/secan/1.1/`
- [ ] Selecting "1.2.x (Next)" navigates to `/secan/`
- [ ] Version-specific content displays correctly
- [ ] Sidebar updates for selected version
- [ ] Version badge appears on versioned pages

## Mobile Responsiveness

### Layout
- [ ] All pages are responsive on mobile (< 768px)
- [ ] All pages are responsive on tablet (768px - 1024px)
- [ ] All pages are responsive on desktop (> 1024px)
- [ ] Content is readable without horizontal scrolling
- [ ] Images scale appropriately on mobile

### Touch Interaction
- [ ] All buttons are touch-friendly (min 44x44px)
- [ ] Links are easy to tap on mobile
- [ ] Sidebar hamburger menu is easy to tap
- [ ] Theme switcher is easy to tap
- [ ] Version selector is easy to tap
- [ ] Search bar is easy to tap

### Font Sizes
- [ ] Body text is readable on mobile (min 16px)
- [ ] Headings are appropriately sized on mobile
- [ ] Code blocks are readable on mobile
- [ ] Navigation text is readable on mobile

## Build Testing

### Development Build
- [ ] Run `npm run start` in docs directory
- [ ] Development server starts without errors
- [ ] Server listens on `http://localhost:3000/secan/`
- [ ] Hot reload works when editing markdown files
- [ ] Hot reload works when editing React components
- [ ] No errors in terminal during development
- [ ] No errors in browser console during development

### Production Build
- [ ] Run `npm run build` in docs directory
- [ ] Build completes without errors
- [ ] Build completes without warnings
- [ ] Build output is in `docs/build/` directory
- [ ] Build includes all documentation pages
- [ ] Build includes all static assets
- [ ] Build time is reasonable (< 60 seconds)

### Preview Build
- [ ] Run `npm run serve` in docs directory
- [ ] Preview server starts without errors
- [ ] Server listens on `http://localhost:3000/secan/`
- [ ] All pages load correctly in preview
- [ ] All assets load correctly in preview
- [ ] Navigation works correctly in preview
- [ ] Search works correctly in preview

## API Documentation Integration

### Rust API Docs
- [ ] Rust API docs are built: `cargo doc --no-deps`
- [ ] Rust API docs are copied to `docs/build/api/`
- [ ] API Reference link in sidebar points to `/secan/api/`
- [ ] Clicking API Reference link navigates to Rust docs
- [ ] Rust API docs display correctly
- [ ] Rust API docs navigation works
- [ ] Rust API docs search works

## Performance Testing

### Page Load Speed
- [ ] Landing page loads in < 3 seconds
- [ ] Documentation pages load in < 2 seconds
- [ ] Images load progressively (lazy loading)
- [ ] No layout shift during page load

### Bundle Size
- [ ] JavaScript bundle size is reasonable (< 500KB)
- [ ] CSS bundle size is reasonable (< 100KB)
- [ ] Images are optimized (< 500KB each)

### Lighthouse Scores (Optional)
- [ ] Performance score > 90
- [ ] Accessibility score > 95
- [ ] Best Practices score > 90
- [ ] SEO score > 90

## Browser Compatibility

### Desktop Browsers
- [ ] Works in Chrome/Chromium (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] Works in Edge (latest)

### Mobile Browsers
- [ ] Works in Chrome Mobile (Android)
- [ ] Works in Safari Mobile (iOS)
- [ ] Works in Firefox Mobile (Android)

## Error Handling

### Console Errors
- [ ] No JavaScript errors in browser console
- [ ] No CSS errors in browser console
- [ ] No network errors (404s) in browser console
- [ ] No React warnings in browser console

### Build Errors
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors
- [ ] No broken link warnings
- [ ] No missing asset warnings

## Accessibility

### Keyboard Navigation
- [ ] Can navigate site using Tab key
- [ ] Can activate links using Enter key
- [ ] Can close modals using Escape key
- [ ] Focus indicators are visible
- [ ] Skip to content link is present

### Screen Reader Support
- [ ] Images have alt text
- [ ] Links have descriptive text
- [ ] Headings are properly structured (H1 → H2 → H3)
- [ ] ARIA labels are present where needed
- [ ] Form inputs have labels (if any)

### Color Contrast
- [ ] Text has sufficient contrast in light mode
- [ ] Text has sufficient contrast in dark mode
- [ ] Links are distinguishable from text
- [ ] Focus indicators have sufficient contrast

## Final Verification

### Documentation Completeness
- [ ] All Starlight content has been migrated
- [ ] No content is missing or truncated
- [ ] All features from Starlight are present
- [ ] Documentation is accurate and up-to-date

### Configuration
- [ ] `docusaurus.config.js` is correct
- [ ] `sidebars.js` is correct
- [ ] `package.json` has correct scripts
- [ ] `.gitignore` includes Docusaurus build artifacts

### Deployment Readiness
- [ ] GitHub Actions workflow is configured
- [ ] Workflow includes Rust API doc build
- [ ] Workflow includes Docusaurus build
- [ ] Workflow deploys to GitHub Pages
- [ ] baseUrl is set to `/secan/`
- [ ] url is set to `https://wasilak.github.io`

## Sign-Off

**Tester Name:** ___________________________

**Date:** ___________________________

**Overall Status:** [ ] PASS  [ ] FAIL

**Notes/Issues Found:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Blockers (if any):**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Ready for Production Deployment:** [ ] YES  [ ] NO

---

## Quick Test Commands

```bash
# Clear cache
cd docs && npm run clear

# Start development server (serves at http://localhost:3000/secan/)
cd docs && npm run start

# Build for production
cd docs && npm run build

# Preview production build (serves at http://localhost:3000/secan/)
cd docs && npm run serve

# Build Rust API docs
cargo doc --no-deps --document-private-items

# Complete build (Docusaurus + Rust API)
just docs-build-complete
```

## Common Issues and Solutions

### Issue: Assets not loading (404 errors)
**Solution:** Ensure all asset paths use `/secan/img/...` format and files exist in `docs/static/img/`

### Issue: Links not working
**Solution:** Ensure internal links use `/secan/` prefix and match Docusaurus routing

### Issue: Mermaid diagrams not rendering
**Solution:** Check that `@docusaurus/theme-mermaid` is in themes array and mermaid code blocks use correct syntax

### Issue: Theme not persisting
**Solution:** Check browser localStorage is enabled and not being cleared

### Issue: Search not working
**Solution:** Rebuild the site to regenerate search index

### Issue: Mobile sidebar not opening
**Solution:** Check that JavaScript is enabled and no console errors are present

### Issue: Version selector not showing
**Solution:** Ensure `versions.json` exists and versioning is configured in `docusaurus.config.js`
