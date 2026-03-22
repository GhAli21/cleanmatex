import '../app/globals.css';
import type { Preview } from '@storybook/nextjs';

const preview: Preview = {
  // RTL toggle — allows switching between LTR (English) and RTL (Arabic) layouts in the toolbar
  globalTypes: {
    direction: {
      name: 'Direction',
      defaultValue: 'ltr',
      toolbar: {
        icon: 'globe',
        items: ['ltr', 'rtl'],
        title: 'Direction',
      },
    },
  },
  decorators: [
    (Story, context) => {
      // Apply dir attribute to root so all rtl: Tailwind variants activate correctly
      document.documentElement.dir = context.globals.direction ?? 'ltr';
      return Story();
    },
  ],
  parameters: {
    // Default background — matches cmx-surface token
    backgrounds: { default: 'light' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
