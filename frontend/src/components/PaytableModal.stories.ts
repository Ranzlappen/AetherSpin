import type { Meta, StoryObj } from '@storybook/svelte';
import PaytableModal from './PaytableModal.svelte';

/**
 * The compliance paytable rendered entirely from the game definition.
 */
const meta: Meta<PaytableModal> = {
  title: 'Modals/PaytableModal',
  component: PaytableModal,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<PaytableModal>;

export const Open: Story = {
  args: { open: true },
};
