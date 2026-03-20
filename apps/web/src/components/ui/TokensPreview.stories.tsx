import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const tokenGroups = {
  color: [
    '--ds-color-bg',
    '--ds-color-surface',
    '--ds-color-surface-strong',
    '--ds-color-border',
    '--ds-color-text',
    '--ds-color-text-muted',
    '--ds-color-accent',
    '--ds-color-accent-strong',
    '--ds-color-accent-soft',
  ],
  radius: ['--ds-radius-lg', '--ds-radius-md', '--ds-radius-sm'],
  spacing: ['--ds-space-1', '--ds-space-2', '--ds-space-3', '--ds-space-4', '--ds-space-5'],
  shadow: ['--ds-shadow-card', '--ds-shadow-soft'],
};

const typography = [
  { label: 'Title / 32px 800', style: { fontSize: '32px', fontWeight: 800, lineHeight: 1.2 } },
  { label: 'Body / 14px 400', style: { fontSize: '14px', fontWeight: 400, lineHeight: 1.4 } },
  { label: 'Button / 13px 700', style: { fontSize: '13px', fontWeight: 700, lineHeight: 1.2 } },
  { label: 'Eyebrow / 12px 400', style: { fontSize: '12px', letterSpacing: '1.2px', textTransform: 'uppercase' as const } },
];

const meta = {
  title: 'Design System/Tokens Preview',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <div style={{ width: 'min(920px, 92vw)', display: 'grid', gap: '24px' }}>
      <section>
        <h3 style={{ marginBottom: '10px' }}>Colors</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {tokenGroups.color.map((token) => (
            <div key={token} style={{ border: '1px solid var(--ds-color-border)', borderRadius: '12px', padding: '10px' }}>
              <div
                style={{
                  height: '56px',
                  borderRadius: '10px',
                  background: `var(${token})`,
                  border: '1px solid rgba(255,255,255,0.12)',
                  marginBottom: '8px',
                }}
              />
              <code style={{ fontSize: '11px' }}>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: '10px' }}>Typography</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {typography.map((item) => (
            <div key={item.label} style={{ borderBottom: '1px solid var(--ds-color-border)', paddingBottom: '8px' }}>
              <p style={item.style}>빠르게, 가볍게, 꾸준하게 Routine App</p>
              <small style={{ color: 'var(--ds-color-text-muted)' }}>{item.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: '10px' }}>Spacing / Radius / Shadow</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {tokenGroups.spacing.map((token) => (
            <div key={token} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ width: '90px', fontSize: '11px' }}>{token}</code>
              <div style={{ height: '12px', width: `calc(var(${token}) * 3)`, background: 'var(--ds-color-accent)' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {tokenGroups.radius.map((token) => (
              <div
                key={token}
                style={{
                  width: '100px',
                  height: '64px',
                  borderRadius: `var(${token})`,
                  background: 'var(--ds-color-surface-strong)',
                  border: '1px solid var(--ds-color-border)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                }}
              >
                {token}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {tokenGroups.shadow.map((token) => (
              <div
                key={token}
                style={{
                  width: '140px',
                  height: '72px',
                  borderRadius: '14px',
                  background: 'var(--ds-color-surface)',
                  border: '1px solid var(--ds-color-border)',
                  boxShadow: `var(${token})`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                }}
              >
                {token}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  ),
};
