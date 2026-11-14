import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import CharacterPicker from './CharacterPicker';
import type { CharacterId } from '../games/shared/hero';

const meta = {
  title: 'Players/CharacterPicker',
  component: CharacterPicker,
  args: { value: 'remy', onChange: () => undefined },
  argTypes: { value: { control: 'inline-radio', options: ['remy', 'soldier'] } },
} satisfies Meta<typeof CharacterPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Remy: Story = {};

export const Soldier: Story = { args: { value: 'soldier' } };

/** Click a tile to switch. The test checks that the choice moves to the clicked tile. */
export const Interactive: Story = {
  render: function Render() {
    const [value, setValue] = useState<CharacterId>('remy');
    return <CharacterPicker value={value} onChange={setValue} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: /soldier/i }));
    await expect(canvas.getByRole('radio', { name: /soldier/i })).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('radio', { name: /remy/i })).toHaveAttribute('aria-checked', 'false');
  },
};
