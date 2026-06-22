import type { StorybookConfig } from '@storybook/svelte-vite';

/** Storybook configuration for the NovaForged component library. */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|svelte)'],
  addons: [],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
};

export default config;
