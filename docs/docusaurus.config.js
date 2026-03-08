// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Secan',
  tagline: 'Modern Elasticsearch cluster management tool',
  favicon: 'img/favicon.svg',

  // Set the production url of your site here
  url: 'https://wasilak.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/secan/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'wasilak', // Usually your GitHub org/user name.
  projectName: 'secan', // Usually your repo name.

  onBrokenLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    format: 'mdx',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/wasilak/secan/tree/main/docs/',
          // Versioning configuration
          lastVersion: 'current',
          versions: {
            current: {
              label: '1.2.x (Latest)',
              path: '/',
            },
            '1.1': {
              label: '1.1',
              path: '1.1',
              banner: 'none',
            },
          },
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/secan-social-card.jpg',
      navbar: {
        title: 'Secan',
        logo: {
          alt: 'Secan Logo',
          src: 'img/sproutling.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Documentation',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/wasilak/secan',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: 'docs/getting-started/about',
              },
              {
                label: 'Features',
                to: 'docs/features/dashboard',
              },
              {
                label: 'Configuration',
                to: 'docs/configuration/authentication',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/wasilak/secan',
              },
              {
                label: 'Issues',
                href: 'https://github.com/wasilak/secan/issues',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Secan. Built with Docusaurus.`,
      },
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['rust', 'toml', 'yaml', 'json', 'bash'],
      },
      mermaid: {
        theme: {
          light: 'default',
          dark: 'dark',
        },
        options: {
          themeVariables: {
            primaryColor: '#2e8555',
            primaryTextColor: '#fff',
            primaryBorderColor: '#29784c',
            lineColor: '#29784c',
            secondaryColor: '#33925d',
            tertiaryColor: '#3cad6e',
          },
        },
      },
    }),

  themes: ['@docusaurus/theme-mermaid'],
};

module.exports = config;
