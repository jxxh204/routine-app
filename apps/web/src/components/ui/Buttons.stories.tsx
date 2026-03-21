import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GhostButton, PrimaryButton } from './design-system';

const meta = {
  title: 'Design System/Buttons',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: () => <PrimaryButton>저장하기</PrimaryButton>,
};

export const Ghost: Story = {
  render: () => <GhostButton>취소</GhostButton>,
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '10px' }}>
      <PrimaryButton disabled>비활성 기본</PrimaryButton>
      <GhostButton disabled>비활성 고스트</GhostButton>
    </div>
  ),
};
