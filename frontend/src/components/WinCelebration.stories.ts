import type { Meta, StoryObj } from '@storybook/svelte';
import WinCelebration from './WinCelebration.svelte';
import { activeCelebration } from '../core/celebration';
import { currency } from '../core/gameState';

/**
 * The tiered win celebration overlay. Stories seed the `activeCelebration`
 * store directly to show each tier (in the app it is driven by `celebrate`
 * intents on the event bus).
 */
const meta: Meta<WinCelebration> = {
  title: 'HUD/WinCelebration',
  component: WinCelebration,
};
export default meta;

type Story = StoryObj<WinCelebration>;

function seed(tier: 'big' | 'mega' | 'epic' | 'wincap', amount: number): () => void {
  return () => {
    currency.set('USD');
    activeCelebration.set({ tier, amount });
  };
}

export const BigWin: Story = { play: seed('big', 250) };
export const MegaWin: Story = { play: seed('mega', 620.5) };
export const EpicWin: Story = { play: seed('epic', 1580) };
export const MaxWin: Story = { play: seed('wincap', 50_000) };
