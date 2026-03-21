import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SectionHeader } from './design-system';

const meta = {
  title: 'Design System/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  args: {
    eyebrow: 'Overview',
    title: '친구와 루틴 공유',
    description: '현재 페이지의 핵심 정보를 상단에서 명확하게 전달합니다.',
  },
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutEyebrow: Story = {
  args: { eyebrow: undefined },
};
