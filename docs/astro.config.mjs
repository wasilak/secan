// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightVersions from 'starlight-versions';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://wasilak.github.io',
	base: '/secan/',
	integrations: [
		mermaid(),
		starlight({
			title: 'Secan',
			description: 'A modern, lightweight Elasticsearch cluster management tool',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/wasilak/secan' },
			],
			plugins: [
				starlightVersions({
					versions: [
					],
					current: {
						label: 'Latest',
					},
				}),
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'About Secan', slug: 'getting-started/about' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Architecture Overview', slug: 'getting-started/architecture' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Dashboard & Overview', slug: 'features/dashboard' },
						{ label: 'Cluster Details', slug: 'features/cluster-details' },
						{ label: 'Index Management', slug: 'features/index-management' },
						{ label: 'Shard Management', slug: 'features/shard-management' },
						{ label: 'REST Console', slug: 'features/rest-console' },
						{ label: 'Additional Features', slug: 'features/additional' },
					],
				},
				{
					label: 'Authentication & Authorization',
					items: [
						{ label: 'Overview', slug: 'authentication' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'Authentication', slug: 'configuration/authentication' },
						{ label: 'Cluster Configuration', slug: 'configuration/clusters' },
						{ label: 'Logging', slug: 'configuration/logging' },
					],
				},
			],
			customCss: [],
			head: [
				{
					tag: 'meta',
					attrs: {
						name: 'theme-color',
						content: '#1e293b',
					},
				},
			],
			expressiveCode: {
				themes: ['github-dark', 'github-light'],
			},
			pagefind: true,
		}),
	],
});
