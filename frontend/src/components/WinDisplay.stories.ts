import type { Meta, StoryObj } from '@storybook/svelte';
import WinDisplay from './WinDisplay.svelte';
import { totalWin, currency } from '../core/gameState';

/**
 * The win display animates a count-up from the `totalWin` store. Stories seed the
 * store to show different magnitudes.
 */
const meta: Meta<WinDisplay> = {
  title: 'HUD/WinDisplay',
  component: WinDisplay,
};
export default meta;

type Story = StoryObj<WinDisplay>;

export const SmallWin: Story = {
  play: () => {
    currency.set('USD');
    totalWin.set(12.5);
  },
};

export const BigWin: Story = {
  play: () => {
    currency.set('USD');
    totalWin.set(2450.75);
  },
};
