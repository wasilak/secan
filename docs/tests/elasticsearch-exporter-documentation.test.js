/**
 * Unit tests for elasticsearch_exporter documentation content validation
 * 
 * These tests verify that the documentation contains all required sections,
 * headings, metrics, links, and code examples as specified in the requirements.
 */

const fs = require('fs');
const path = require('path');

// Read the documentation file
const docPath = path.join(__dirname, '../src/content/docs/monitoring/elasticsearch-exporter.md');
let docContent = '';

try {
  docContent = fs.readFileSync(docPath, 'utf-8');
} catch (error) {
  console.error(`Failed to read documentation file: ${error.message}`);
  process.exit(1);
}

/**
 * Test helper to check if content contains a string
 */
function assertContains(content, searchString, message) {
  if (!content.includes(searchString)) {
    throw new Error(`Assertion failed: ${message}\nExpected to find: "${searchString}"`);
  }
}

/**
 * Test helper to check if content matches a regex
 */
function assertMatches(content, regex, message) {
  if (!regex.test(content)) {
    throw new Error(`Assertion failed: ${message}\nExpected to match: ${regex}`);
  }
}

/**
 * Test runner
 */
function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✓ ${testName}`);
    return true;
  } catch (error) {
    console.error(`✗ ${testName}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

// Test suite
let passedTests = 0;
let failedTests = 0;

console.log('\n=== Elasticsearch Exporter Documentation Tests ===\n');

// Requirement 1: elasticsearch_exporter Overview Documentation
console.log('Requirement 1: Overview Documentation');

if (runTest('1.1 Should contain overview section', () => {
  assertContains(docContent, '## Overview', 'Overview section heading not found');
})) passedTests++; else failedTests++;

if (runTest('1.2 Should explain elasticsearch_exporter purpose', () => {
  assertContains(docContent, 'elasticsearch_exporter', 'elasticsearch_exporter term not found');
  assertContains(docContent, 'Prometheus', 'Prometheus term not found in overview');
})) passedTests++; else failedTests++;

if (runTest('1.3 Should link to official repository', () => {
  assertContains(docContent, 'https://github.com/prometheus-community/elasticsearch_exporter', 
    'Official repository link not found');
})) passedTests++; else failedTests++;

if (runTest('1.4 Should explain component relationship', () => {
  assertContains(docContent, 'Elasticsearch', 'Elasticsearch not mentioned');
  assertContains(docContent, 'Cerebro', 'Cerebro not mentioned');
})) passedTests++; else failedTests++;

if (runTest('1.5 Should describe benefits of Prometheus metrics', () => {
  assertMatches(docContent, /benefit|advantage|why use/i, 'Benefits section not found');
})) passedTests++; else failedTests++;

// Requirement 2: Installation and Setup Documentation
console.log('\nRequirement 2: Installation and Setup Documentation');

if (runTest('2.1 Should provide installation instructions', () => {
  assertMatches(docContent, /install|installation|setup/i, 'Installation section not found');
})) passedTests++; else failedTests++;

if (runTest('2.2 Should document configuration options', () => {
  assertContains(docContent, 'configuration', 'Configuration section not found');
})) passedTests++; else failedTests++;

if (runTest('2.3 Should provide Elasticsearch connection example', () => {
  assertContains(docContent, '--es.uri', 'Elasticsearch URI configuration not found');
})) passedTests++; else failedTests++;

if (runTest('2.4 Should document Prometheus scrape configuration', () => {
  assertContains(docContent, 'scrape_configs', 'Prometheus scrape configuration not found');
})) passedTests++; else failedTests++;

if (runTest('2.5 Should provide example Prometheus configuration', () => {
  assertContains(docContent, 'prometheus.yml', 'Prometheus configuration example not found');
})) passedTests++; else failedTests++;

if (runTest('2.6 Should specify default port 9114', () => {
  assertContains(docContent, '9114', 'Default port 9114 not documented');
})) passedTests++; else failedTests++;

// Requirement 3: Metrics Reference Documentation
console.log('\nRequirement 3: Metrics Reference Documentation');

if (runTest('3.1 Should document elasticsearch_os_cpu_percent', () => {
  assertContains(docContent, 'elasticsearch_os_cpu_percent', 'CPU metric not documented');
  assertContains(docContent, 'CPU usage percentage', 'CPU metric description not found');
})) passedTests++; else failedTests++;

if (runTest('3.2 Should document elasticsearch_os_load1', () => {
  assertContains(docContent, 'elasticsearch_os_load1', 'Load1 metric not documented');
  assertContains(docContent, '1-minute load average', 'Load1 description not found');
})) passedTests++; else failedTests++;

if (runTest('3.3 Should document elasticsearch_os_load5', () => {
  assertContains(docContent, 'elasticsearch_os_load5', 'Load5 metric not documented');
  assertContains(docContent, '5-minute load average', 'Load5 description not found');
})) passedTests++; else failedTests++;

if (runTest('3.4 Should document elasticsearch_os_load15', () => {
  assertContains(docContent, 'elasticsearch_os_load15', 'Load15 metric not documented');
  assertContains(docContent, '15-minute load average', 'Load15 description not found');
})) passedTests++; else failedTests++;

if (runTest('3.5 Should document elasticsearch_os_mem_free_bytes', () => {
  assertContains(docContent, 'elasticsearch_os_mem_free_bytes', 'Free memory metric not documented');
  assertContains(docContent, 'Free memory in bytes', 'Free memory description not found');
})) passedTests++; else failedTests++;

if (runTest('3.6 Should document elasticsearch_os_mem_used_bytes', () => {
  assertContains(docContent, 'elasticsearch_os_mem_used_bytes', 'Used memory metric not documented');
  assertContains(docContent, 'Used memory in bytes', 'Used memory description not found');
})) passedTests++; else failedTests++;

if (runTest('3.7 Should document elasticsearch_os_mem_actual_free_bytes', () => {
  assertContains(docContent, 'elasticsearch_os_mem_actual_free_bytes', 'Actual free memory metric not documented');
  assertContains(docContent, 'Actual free memory in bytes', 'Actual free memory description not found');
})) passedTests++; else failedTests++;

if (runTest('3.8 Should document elasticsearch_os_mem_actual_used_bytes', () => {
  assertContains(docContent, 'elasticsearch_os_mem_actual_used_bytes', 'Actual used memory metric not documented');
  assertContains(docContent, 'Actual used memory in bytes', 'Actual used memory description not found');
})) passedTests++; else failedTests++;

if (runTest('3.9 Should explain difference between actual and regular memory metrics', () => {
  assertMatches(docContent, /actual.*memory|buffers.*cache/i, 'Memory metrics difference not explained');
})) passedTests++; else failedTests++;

if (runTest('3.10 Should document metric labels', () => {
  assertContains(docContent, 'cluster', 'Cluster label not documented');
  assertContains(docContent, 'node', 'Node label not documented');
})) passedTests++; else failedTests++;

// Requirement 4: Cerebro UI Metrics Display Documentation
console.log('\nRequirement 4: UI Display Locations Documentation');

if (runTest('4.1 Should document CPU metrics in nodes list view', () => {
  assertMatches(docContent, /nodes.*list.*view|nodes.*view/i, 'Nodes list view not documented');
  assertMatches(docContent, /CPU.*node|node.*CPU/i, 'CPU in nodes view not documented');
})) passedTests++; else failedTests++;

if (runTest('4.2 Should document load average in nodes list view', () => {
  assertMatches(docContent, /load.*node|node.*load/i, 'Load average in nodes view not documented');
})) passedTests++; else failedTests++;

if (runTest('4.3 Should document memory metrics in nodes list view', () => {
  assertMatches(docContent, /memory.*node|node.*memory/i, 'Memory in nodes view not documented');
})) passedTests++; else failedTests++;

if (runTest('4.4 Should document cluster overview section', () => {
  assertMatches(docContent, /cluster.*overview/i, 'Cluster overview not documented');
})) passedTests++; else failedTests++;

// Requirement 5: Cerebro Configuration Documentation
console.log('\nRequirement 5: Cerebro Configuration Documentation');

if (runTest('5.1 Should provide Cerebro configuration example', () => {
  assertContains(docContent, 'config.yaml', 'Cerebro configuration file not mentioned');
})) passedTests++; else failedTests++;

if (runTest('5.2 Should document Prometheus endpoint parameter', () => {
  assertContains(docContent, 'url', 'Prometheus URL parameter not documented');
  assertMatches(docContent, /prometheus.*9090|9090.*prometheus/i, 'Prometheus port not documented');
})) passedTests++; else failedTests++;

if (runTest('5.3 Should provide complete working example', () => {
  assertContains(docContent, 'clusters:', 'Clusters configuration not found');
  assertContains(docContent, 'metrics:', 'Metrics configuration not found');
})) passedTests++; else failedTests++;

if (runTest('5.4 Should document multi-cluster configuration', () => {
  assertMatches(docContent, /multiple.*cluster|multi.*cluster/i, 'Multi-cluster configuration not documented');
})) passedTests++; else failedTests++;

// Requirement 6: Reference Links Documentation
console.log('\nRequirement 6: Reference Links Documentation');

if (runTest('6.1 Should link to elasticsearch_exporter GitHub', () => {
  assertContains(docContent, 'https://github.com/prometheus-community/elasticsearch_exporter', 
    'GitHub repository link not found');
})) passedTests++; else failedTests++;

if (runTest('6.2 Should link to Prometheus documentation', () => {
  assertMatches(docContent, /prometheus\.io\/docs|prometheus.*documentation/i, 
    'Prometheus documentation link not found');
})) passedTests++; else failedTests++;

if (runTest('6.3 Should link to Elasticsearch monitoring documentation', () => {
  assertMatches(docContent, /elastic\.co.*monitor|elasticsearch.*monitor/i, 
    'Elasticsearch monitoring documentation not found');
})) passedTests++; else failedTests++;

// Requirement 7: Troubleshooting Documentation
console.log('\nRequirement 7: Troubleshooting Documentation');

if (runTest('7.1 Should document exporter verification', () => {
  assertMatches(docContent, /verify.*exporter|check.*exporter/i, 'Exporter verification not documented');
})) passedTests++; else failedTests++;

if (runTest('7.2 Should document Prometheus scraping verification', () => {
  assertMatches(docContent, /verify.*prometheus|prometheus.*scrap/i, 'Prometheus verification not documented');
})) passedTests++; else failedTests++;

if (runTest('7.3 Should document Cerebro connection verification', () => {
  assertMatches(docContent, /verify.*cerebro|cerebro.*connect/i, 'Cerebro verification not documented');
})) passedTests++; else failedTests++;

if (runTest('7.4 Should provide troubleshooting section', () => {
  assertContains(docContent, 'Troubleshooting', 'Troubleshooting section not found');
})) passedTests++; else failedTests++;

// Requirement 8: Code Examples and Snippets
console.log('\nRequirement 8: Code Examples and Snippets');

if (runTest('8.1 Should provide YAML code blocks', () => {
  assertMatches(docContent, /```yaml/i, 'YAML code blocks not found');
})) passedTests++; else failedTests++;

if (runTest('8.2 Should provide Prometheus query examples', () => {
  assertMatches(docContent, /```promql|prometheus.*query/i, 'PromQL examples not found');
})) passedTests++; else failedTests++;

if (runTest('8.3 Should provide curl command examples', () => {
  assertContains(docContent, 'curl', 'curl command examples not found');
})) passedTests++; else failedTests++;

// Requirement 9: Architecture Diagram
console.log('\nRequirement 9: Architecture Diagram');

if (runTest('9.1 Should include architecture diagram', () => {
  assertMatches(docContent, /```mermaid|diagram/i, 'Architecture diagram not found');
})) passedTests++; else failedTests++;

if (runTest('9.2 Should show component flow', () => {
  assertMatches(docContent, /elasticsearch.*exporter.*prometheus.*cerebro/is, 
    'Component flow not documented');
})) passedTests++; else failedTests++;

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${passedTests + failedTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed');
  process.exit(0);
}
