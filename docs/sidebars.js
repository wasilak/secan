/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation
 
 The sidebars can be generated from the filesystem, or explicitly defined here.
 
 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Main documentation sidebar
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/about',
        'getting-started/installation',
        'getting-started/architecture',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/dashboard',
        'features/cluster-details',
        'features/cluster-tasks',
        'features/index-management',
        'features/shard-management',
        'features/rest-console',
        'features/additional',
      ],
    },
    {
      type: 'category',
      label: 'Monitoring',
      collapsed: false,
      items: [
        'monitoring/elasticsearch-exporter',
      ],
    },
    {
      type: 'category',
      label: 'Authentication & Authorization',
      collapsed: false,
      items: [
        'authentication/index',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: false,
      items: [
        'configuration/authentication',
        'configuration/clusters',
        'configuration/logging',
      ],
    },
  ],
};

module.exports = sidebars;
