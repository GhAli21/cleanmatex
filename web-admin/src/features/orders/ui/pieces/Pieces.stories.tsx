import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { IntakePieceCard } from './IntakePieceCard';
import { ProcessingPieceCard } from './ProcessingPieceCard';
import { SortingPieceCard } from './SortingPieceCard';
import { AssemblyPieceCard } from './AssemblyPieceCard';
import { QCPieceCard } from './QCPieceCard';
import type { OrderItemPiece } from '@/types/order';
import { NextIntlClientProvider } from 'next-intl';

// Mock translation messages for storybook
const mockMessages = {
  orders: {
    pieces: {
      piece: 'Piece',
      prefSummaryNone: 'No special preferences',
      editPreferences: 'Edit Preferences',
      split: 'Split',
      notes: 'Notes',
      notesPlaceholder: 'Add notes...',
      noNotes: 'No notes',
      rackLocation: 'Rack Location',
      notSet: 'Not set',
      rackLocationPlaceholder: 'Scan or type rack...',
      step: 'Step',
      selectStep: 'Select step',
      steps: {
        sorting: 'Sorting',
        pretreatment: 'Pre-treatment',
        washing: 'Washing',
        drying: 'Drying',
        finishing: 'Finishing',
      },
      bulkSelectPiece: 'Select piece {seq}',
      scanToAssign: 'Scan tag barcode...',
      printTag: 'Print Tag',
      tagAssignment: 'Tag Assignment',
      assigned: 'Assigned',
      pending: 'Pending',
      packingInstructions: 'Packing Instructions',
      scanToMarkAssembled: 'Scan to mark assembled...',
      assembled: 'Assembled',
      inspectionCriteria: 'Inspection Criteria',
      noSpecialConditions: 'No special conditions',
      rewash: 'Rewash',
      pass: 'Pass',
    }
  }
};

// Mock Data
const mockPiece: OrderItemPiece = {
  id: 'piece-1',
  order_item_id: 'item-1',
  piece_seq: 1,
  piece_code: 'CMX-1234-5678',
  name: 'Two Piece Suit',
  piece_status: 'NEW',
  is_rejected: false,
  notes: 'Needs careful pressing',
  rack_location: 'A-12',
  last_step: 'washing',
  packing_pref_code: 'HANGER_COVER',
  service_prefs: [
    { preference_code: 'STARCH_HEAVY', extra_price: 0.5 },
    { preference_code: 'IRON_ONLY', extra_price: 0 }
  ],
  conditions: ['DAMAGE_TORN_HEM', 'STAIN_INK'],
  color: { primary: 'Navy Blue' },
};

const meta = {
  title: 'Features/Orders/Pieces',
  component: IntakePieceCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={mockMessages}>
        <div className="max-w-md w-full mx-auto">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
} satisfies Meta<typeof IntakePieceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IntakeMode: Story = {
  args: {
    piece: mockPiece,
    onEditPreferences: fn(),
    showSplitCheckbox: true,
  },
};

export const ProcessingMode: StoryObj<typeof ProcessingPieceCard> = {
  render: (args) => <ProcessingPieceCard {...args} />,
  args: {
    piece: mockPiece,
    isBulkSelected: false,
    onBulkSelectToggle: fn(),
  },
};

export const SortingMode: StoryObj<typeof SortingPieceCard> = {
  render: (args) => <SortingPieceCard {...args} />,
  args: {
    piece: { ...mockPiece, piece_code: '' }, // Simulate pending assignment
    onBarcodeScan: fn(),
    onPrintTag: fn(),
  },
};

export const AssemblyMode: StoryObj<typeof AssemblyPieceCard> = {
  render: (args) => <AssemblyPieceCard {...args} />,
  args: {
    piece: mockPiece,
    isAssembled: false,
    onAssembleScan: fn(),
  },
};

export const QCMode: StoryObj<typeof QCPieceCard> = {
  render: (args) => <QCPieceCard {...args} />,
  args: {
    piece: mockPiece,
    onPass: fn(),
    onRewash: fn(),
  },
};

// RTL story for Intake mode
export const IntakeModeRTL: Story = {
  name: 'Intake Mode (RTL)',
  args: {
    piece: {
      ...mockPiece,
      notes: 'يحتاج كي بعناية',
    },
    onEditPreferences: fn(),
    showSplitCheckbox: true,
  },
  parameters: { direction: 'rtl' },
};
