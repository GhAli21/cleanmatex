'use client';

/**
 * Shared payment amount money field — the single cashier amount control for
 * Simple, Advanced, Split tender, Store credit, and any other payment surface.
 *
 * Composition (always the same contract):
 * - Currency prefix + {@link CmxMoneyField}
 * - Keypad trigger → movable {@link CmxKeypadPopover}
 * - Optional Exact / Fill remaining actions
 * - Optional remaining-cap hint
 *
 * Keyboard (market-style cashier flow):
 * - Digits type into the amount while it is focused
 * - Tab: Amount → Keypad button → Exact → Fill → next field/row
 * - Enter on amount: Exact if empty / commit (+ optional onEnterConfirm)
 * - Enter / click on keypad button: open pad; focus home key (7 → 1)
 * - Inside pad: arrows move, Enter activates, hardware numpad feeds amount
 * - Esc: close pad and return focus to the keypad button
 * - Click / Tab outside the pad session: dismiss (amount field stays "inside"
 *   so the pad stays open while typing; Exact / next row still dismiss)
 *
 * No money math here — the container/engine owns capping, drafts, and keypad
 * application. This primitive is presentational + interaction chrome only.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react';
import { Keyboard } from 'lucide-react';
import { CmxButton, CmxMoneyField } from '@ui/primitives';
import { CmxKeypadPopover } from '@ui/overlays';
import {
  KEYPAD_PAYMENT_4COL,
  PAYMENT_KEY_VARIANT,
  PAYMENT_KEY_CLASS,
  type PaymentKeypadKey,
} from '@ui/utilities';

/**
 * Assigns a DOM node to a React ref object or callback ref.
 */
function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(node);
    return;
  }
  (ref as MutableRefObject<T | null>).current = node;
}

/**
 * Visual density for the amount field.
 * - `hero` — Simple / Advanced workspace amount
 * - `compact` — Split / Store credit / dialog rows
 */
export type PaymentAmountMoneyFieldSize = 'hero' | 'compact';

/**
 * Props for {@link PaymentAmountMoneyField}.
 */
export interface PaymentAmountMoneyFieldProps {
  currencyCode: string;
  decimalPlaces: number;
  formatAmount: (n: number) => string;
  value: number | null;
  /** Engine draft when this field owns the active keypad/editor session. */
  draftValue?: string;
  onValueChange: (value: number | null, draft: string) => void;
  /** Keypad key handler — must already target the correct active leg/session. */
  onKeypadPress: (key: PaymentKeypadKey) => void;
  disabled?: boolean;
  isRTL?: boolean;
  size?: PaymentAmountMoneyFieldSize;
  /** Optional external input ref (container focus helpers). */
  inputRef?: Ref<HTMLInputElement | null>;
  onFocus?: () => void;
  /**
   * When this token changes (and is non-null), focus + select the amount input.
   * Used after selecting a payment method / credit instrument so the cashier
   * lands in that leg's amount field (dialogs suppress the background editor).
   */
  focusToken?: string | number | null;
  /**
   * After Enter commits a non-empty amount (or after Exact when empty).
   * Use for dialog Done / advance-to-next-leg. Not used for payment submit.
   */
  onEnterConfirm?: () => void;
  /** Treat amounts at/below this as empty for Enter → Exact. */
  moneyEpsilon?: number;
  /**
   * When false, Exact / Fill are skipped in the Tab cycle (keypad button stays
   * in Tab). Defaults to true.
   */
  secondaryActionsInTabOrder?: boolean;
  amountAriaLabel: string;
  keypadTitle: string;
  keypadDock: string;
  keypadClose: string;
  keypadHint: string;
  keypadRestored: string;
  /** Persist keypad position separately per surface when needed. */
  keypadStorageKey?: string;
  showExact?: boolean;
  exactLabel?: string;
  exactAriaLabel?: string;
  onExact?: () => void;
  exactDisabled?: boolean;
  showFillRemaining?: boolean;
  fillRemainingLabel?: string;
  onFillRemaining?: () => void;
  fillRemainingDisabled?: boolean;
  /** e.g. "You can allocate up to OMR 5.608 on this payment leg." */
  remainingHint?: ReactNode;
  placeholder?: string;
  className?: string;
  testId?: string;
}

/**
 * Reusable payment amount field with keypad + optional Exact / Fill remaining.
 *
 * @param props - {@link PaymentAmountMoneyFieldProps}.
 * @returns The amount editor element.
 */
export function PaymentAmountMoneyField({
  currencyCode,
  decimalPlaces,
  formatAmount,
  value,
  draftValue,
  onValueChange,
  onKeypadPress,
  disabled = false,
  isRTL = false,
  size = 'compact',
  inputRef,
  onFocus,
  focusToken = null,
  onEnterConfirm,
  moneyEpsilon = 0,
  secondaryActionsInTabOrder = true,
  amountAriaLabel,
  keypadTitle,
  keypadDock,
  keypadClose,
  keypadHint,
  keypadRestored,
  keypadStorageKey = 'cmx:payment-keypad-pos',
  showExact = false,
  exactLabel,
  exactAriaLabel,
  onExact,
  exactDisabled = false,
  showFillRemaining = false,
  fillRemainingLabel,
  onFillRemaining,
  fillRemainingDisabled = false,
  remainingHint,
  placeholder,
  className = '',
  testId = 'payment-amount-money-field',
}: PaymentAmountMoneyFieldProps) {
  const [showKeypad, setShowKeypad] = useState(false);
  const keypadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const isHero = size === 'hero';
  const actionTabIndex = secondaryActionsInTabOrder ? undefined : -1;

  const assignInputRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node;
    assignRef(inputRef, node);
  };

  const toggleKeypad = () => {
    onFocus?.();
    setShowKeypad((prev) => !prev);
  };

  // Stable identity — avoids rebinding outside-dismiss listeners every render.
  const linkedFieldRefs = useMemo(() => [localInputRef], []);

  // Focus after method/credit selection (token change). Short delay lets the
  // field mount and wins over select/dropdown focus-restore (e.g. Split
  // "+ Add payment method" closing back onto its trigger).
  useEffect(() => {
    if (focusToken == null || disabled) return;
    const timer = window.setTimeout(() => {
      const input = localInputRef.current;
      if (!input || input.disabled) return;
      input.focus();
      input.select();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusToken, disabled]);

  const showActions =
    (showExact && onExact && exactLabel) ||
    (showFillRemaining && onFillRemaining && fillRemainingLabel);

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key !== 'Enter') return;

    // Never let Enter bubble into the payment-modal submit shortcut path.
    event.preventDefault();
    event.stopPropagation();
    onFocus?.();

    const amount = value ?? 0;
    const isEmpty = amount <= moneyEpsilon;
    const canExact = Boolean(showExact && onExact && !exactDisabled);
    const canFill = Boolean(
      showFillRemaining && onFillRemaining && !fillRemainingDisabled,
    );

    if (isEmpty && canExact) {
      onExact?.();
      onEnterConfirm?.();
      return;
    }
    if (isEmpty && canFill) {
      onFillRemaining?.();
      onEnterConfirm?.();
      return;
    }

    // Commit the typed draft, then optional confirm (dialog Done / next leg).
    localInputRef.current?.blur();
    onEnterConfirm?.();
  };

  return (
    <div className={`space-y-2 ${className}`} data-testid={testId}>
      <div
        className={`flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-inner ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center rounded-s-2xl border-e border-slate-200 bg-slate-100 font-semibold text-cyan-700 ${
            isHero ? 'min-w-[88px] px-4 text-lg' : 'min-w-[64px] px-2.5 text-sm'
          }`}
        >
          {currencyCode}
        </div>
        <div className={`min-w-0 flex-1 ${isHero ? 'px-3' : 'px-2'}`}>
          <CmxMoneyField
            ref={assignInputRef}
            data-testid={`${testId}-input`}
            draftValue={draftValue}
            value={value}
            decimalPlaces={decimalPlaces}
            showZero
            aria-label={amountAriaLabel}
            onValueChange={(nextValue, draft) => onValueChange(nextValue, draft)}
            onFocus={onFocus}
            onKeyDown={handleAmountKeyDown}
            placeholder={placeholder ?? formatAmount(0)}
            disabled={disabled}
            className={
              isHero
                ? 'h-16 border-0 bg-transparent px-0 text-[2.2rem] font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0'
                : 'h-11 border-0 bg-transparent px-0 text-lg font-semibold tabular-nums text-slate-900 shadow-none focus-visible:ring-0'
            }
          />
        </div>
        <button
          ref={keypadTriggerRef}
          type="button"
          data-testid={`${testId}-keypad-toggle`}
          aria-pressed={showKeypad}
          aria-expanded={showKeypad}
          aria-haspopup="dialog"
          aria-label={keypadTitle}
          disabled={disabled}
          onClick={toggleKeypad}
          className={`flex items-center justify-center rounded-e-2xl border-s border-slate-200 transition-colors disabled:opacity-40 ${
            isHero ? 'min-w-14 px-4' : 'min-w-11 px-3'
          } ${
            showKeypad
              ? 'bg-cyan-50 text-cyan-700'
              : 'bg-slate-50 text-slate-500 hover:text-cyan-700'
          }`}
        >
          <Keyboard className={isHero ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>
      </div>

      {showActions ? (
        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {showExact && onExact && exactLabel ? (
            <CmxButton
              type="button"
              variant="outline"
              size="xs"
              tabIndex={actionTabIndex}
              disabled={disabled || exactDisabled}
              onClick={() => {
                onFocus?.();
                onExact();
              }}
              aria-label={exactAriaLabel ?? exactLabel}
              data-testid={`${testId}-exact`}
              className="min-h-[36px] rounded-lg border-cyan-200 text-cyan-800"
            >
              {exactLabel}
            </CmxButton>
          ) : null}
          {showFillRemaining && onFillRemaining && fillRemainingLabel ? (
            <CmxButton
              type="button"
              variant="outline"
              size="xs"
              tabIndex={actionTabIndex}
              disabled={disabled || fillRemainingDisabled}
              onClick={() => {
                onFocus?.();
                onFillRemaining();
              }}
              data-testid={`${testId}-fill-remaining`}
              className="min-h-[36px] rounded-lg border-cyan-200 text-cyan-800"
            >
              {fillRemainingLabel}
            </CmxButton>
          ) : null}
        </div>
      ) : null}

      {remainingHint ? (
        <div
          className={`rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 ${
            isRTL ? 'text-right' : 'text-left'
          }`}
          data-testid={`${testId}-remaining-hint`}
        >
          {remainingHint}
        </div>
      ) : null}

      <CmxKeypadPopover
        open={showKeypad}
        onClose={() => setShowKeypad(false)}
        anchorRef={keypadTriggerRef}
        linkedFieldRefs={linkedFieldRefs}
        storageKey={keypadStorageKey}
        isRTL={isRTL}
        disabled={disabled}
        keyboardMode
        restoreFocusOnClose
        title={keypadTitle}
        echo={`${currencyCode} ${formatAmount(value ?? 0)}`}
        dockLabel={keypadDock}
        closeLabel={keypadClose}
        hint={keypadHint}
        restoredAnnouncement={keypadRestored}
        keys={KEYPAD_PAYMENT_4COL}
        onKeyPress={(key) => {
          onFocus?.();
          onKeypadPress(key as PaymentKeypadKey);
        }}
        onKeyLongPress={(key) => {
          if (key === 'backspace') {
            onFocus?.();
            onKeypadPress('clear');
          }
        }}
        getKeyVariant={PAYMENT_KEY_VARIANT}
        getKeyClassName={PAYMENT_KEY_CLASS}
      />
    </div>
  );
}
