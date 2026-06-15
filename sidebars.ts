import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/requirements',
        'getting-started/installation',
        'getting-started/first-time-setup',
      ],
    },
    {
      type: 'category',
      label: 'Adding Financial Data',
      collapsed: false,
      items: [
        'adding-data/using-plus-button',
        'adding-data/editing-files',
        'adding-data/adding-account-commodity',
        'adding-data/adding-price-metadata',
      ],
    },
    {
      type: 'category',
      label: 'Dashboards',
      collapsed: false,
      items: [
        'dashboards/overview',
        'dashboards/transactions',
        'dashboards/journal',
        'dashboards/accounts-balances',
        'dashboards/income-statement',
        'dashboards/commodities',
      ],
    },
    'queries/bql',
    'snapshot-view',
    'plugin-api',
    'settings',
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/beancount-syntax',
        'advanced/advanced-queries',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
