import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatCard } from './design-system';

const meta = {
  title: 'Design System/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  args: {
    label: '오늘 완료',
    value: '5/7',
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongValue: Story = {
  args: {
    label: '누적 스트릭',
    value: '128일 연속',
  },
};
