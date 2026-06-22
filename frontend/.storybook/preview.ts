import type { Preview } from '@storybook/svelte';
import '../src/styles/global.css';

/** Global Storybook parameters — dark neon backdrop to match the game. */
const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'cosmic',
      values: [{ name: 'cosmic', value: '#05010f' }],
    },
    layout: 'centered',
  },
};

export default preview;
