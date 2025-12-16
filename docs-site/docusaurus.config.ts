import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Obsidian Finance Plugin',
  tagline: 'Comprehensive financial dashboard for Obsidian with Beancount integration',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://mkshp-dev.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/obsidian-finance-plugin/',

  // GitHub pages deployment config.
  organizationName: 'mkshp-dev',
  projectName: 'obsidian-finance-plugin',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/mkshp-dev/obsidian-finance-plugin/tree/agent/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Obsidian Finance',
      logo: {
        alt: 'Obsidian Finance Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/mkshp-dev/obsidian-finance-plugin',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/intro',
            },
            {
              label: 'Installation',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Dashboard',
              to: '/docs/core-features/unified-dashboard/overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/mkshp-dev/obsidian-finance-plugin/issues',
            },
            {
              label: 'Discussions',
              href: 'https://github.com/mkshp-dev/obsidian-finance-plugin/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/mkshp-dev/obsidian-finance-plugin',
            },
            {
              label: 'Report Issues',
              href: 'https://github.com/mkshp-dev/obsidian-finance-plugin/issues/new',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Mukund Shelake. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'powershell', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
