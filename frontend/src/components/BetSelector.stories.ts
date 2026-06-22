import type { Meta, StoryObj } from '@storybook/svelte';
import BetSelector from './BetSelector.svelte';
import { betLevelIndex } from '../core/gameState';

/**
 * The bet stepper reads/writes the shared `betLevelIndex` store. Stories set the
 * store before rendering to demonstrate the min/middle/max states.
 */
const meta: Meta<BetSelector> = {
  title: 'Controls/BetSelector',
  component: BetSelector,
};
export default meta;

type Story = StoryObj<BetSelector>;

export const Default: Story = {
  play: () => betLevelIndex.set(2),
};

export const MinBet: Story = {
  play: () => betLevelIndex.set(0),
};

export const MaxBet: Story = {
  play: () => betLevelIndex.set(9),
};
