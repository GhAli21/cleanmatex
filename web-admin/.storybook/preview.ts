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
    // Theme switches — same data-* attributes and UPPERCASE values the app sets on <html>.
    mode: {
      name: 'Mode',
      defaultValue: 'LIGHT',
      toolbar: { icon: 'circlehollow', items: ['LIGHT', 'DARK'], title: 'Mode' },
    },
    density: {
      name: 'Density',
      defaultValue: 'COMFORTABLE',
      toolbar: { icon: 'component', items: ['COMFORTABLE', 'COMPACT'], title: 'Density' },
    },
  },
  decorators: [
    (Story, context) => {
      // Apply dir attribute to root so all rtl: Tailwind variants activate correctly
      document.documentElement.dir = context.globals.direction ?? 'ltr';
      document.documentElement.dataset.mode = context.globals.mode ?? 'LIGHT';
      document.documentElement.dataset.density = context.globals.density ?? 'COMFORTABLE';
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
