import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppCard, GhostButton, PrimaryButton, StatCard } from './design-system';

const meta = {
  title: 'Design System/AppCard',
  component: AppCard,
  tags: ['autodocs'],
} satisfies Meta<typeof AppCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppCard>
      <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>루틴 완료 현황</h3>
      <p style={{ color: 'var(--ds-color-text-muted)', marginBottom: '16px' }}>
        AppCard는 섹션 콘텐츠를 일관된 표면/테두리/그림자로 감쌉니다.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <StatCard label="완료" value="8/10" />
        <StatCard label="연속" value="12일" />
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <PrimaryButton>오늘 체크</PrimaryButton>
        <GhostButton>나중에</GhostButton>
      </div>
    </AppCard>
  ),
};
