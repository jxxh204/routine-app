import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppCard, PageShell, SectionHeader } from './design-system';

const meta = {
  title: 'Design System/PageShell',
  component: PageShell,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { narrow: false },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <PageShell {...args}>
      <SectionHeader
        eyebrow="Routine App"
        title="오늘 루틴"
        description="공통 레이아웃 컨테이너 예시"
      />
      <div style={{ marginTop: '20px' }}>
        <AppCard>PageShell 안에서 카드/본문 콘텐츠를 안전하게 배치합니다.</AppCard>
      </div>
    </PageShell>
  ),
};

export const Narrow: Story = {
  args: { narrow: true },
  render: (args) => (
    <PageShell {...args}>
      <SectionHeader
        eyebrow="Narrow"
        title="로그인 화면"
        description="좁은 폭 레이아웃 시나리오"
      />
      <div style={{ marginTop: '20px' }}>
        <AppCard>모바일 중심 화면에 맞춘 narrow 페이지 폭</AppCard>
      </div>
    </PageShell>
  ),
};
