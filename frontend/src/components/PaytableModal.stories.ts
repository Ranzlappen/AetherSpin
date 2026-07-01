import type { Meta, StoryObj } from '@storybook/svelte';
import PaytableModal from './PaytableModal.svelte';

/**
 * The compliance paytable rendered entirely from the game definition.
 */
const meta = {
  title: 'Modals/PaytableModal',
  component: PaytableModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PaytableModal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true },
};
