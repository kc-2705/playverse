import type { StorybookConfig } from '@storybook/react-vite';

/** Storybook setup: stories live next to their components in src/. */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
};

export default config;
