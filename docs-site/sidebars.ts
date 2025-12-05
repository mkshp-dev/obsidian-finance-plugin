import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Manual sidebar definition to ensure correct ordering and grouping
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/intro',
        'getting-started/installation',
        'agent-context', // Keep technical context handy
      ],
    },
    {
      type: 'category',
      label: 'Core Features',
      collapsed: false,
      items: [
        'core-features/adding-directives',
        'core-features/snapshot-view',
        {
          type: 'category',
          label: 'Unified Dashboard',
          collapsed: false,
          items: [
            'core-features/unified-dashboard/overview',
            'core-features/unified-dashboard/transactions',
            'core-features/unified-dashboard/journal',
            'core-features/unified-dashboard/balance-sheet',
            'core-features/unified-dashboard/commodities',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/settings',
      ],
    },
    {
      type: 'category',
      label: 'Queries & Advanced',
      items: [
        'queries/bql',
        'queries/troubleshooting',
      ],
    },
  ],
};

export default sidebars;
