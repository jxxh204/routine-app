import type { Preview } from '@storybook/nextjs-vite';

import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0d0f12' }],
    },
    layout: 'centered',
  },
};

export default preview;
