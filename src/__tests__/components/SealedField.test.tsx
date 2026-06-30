import { render, screen, fireEvent } from '@testing-library/react';
import { SealedField } from '@/components/crypto/SealedField';

const base = {
  value: '',
  onChange: jest.fn(),
  isUnlocked: false,
  isUnlocking: false,
  onUnlock: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('SealedField', () => {
  it('renders the textarea and forwards edits', () => {
    const onChange = jest.fn();
    render(<SealedField {...base} onChange={onChange} placeholder="notes here" />);
    fireEvent.change(screen.getByPlaceholderText('notes here'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows the unlock affordance when locked and calls onUnlock', () => {
    const onUnlock = jest.fn();
    render(<SealedField {...base} onUnlock={onUnlock} />);
    fireEvent.click(screen.getByText(/Unlock client-side encryption/));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('shows an unlocking state', () => {
    render(<SealedField {...base} isUnlocking />);
    expect(screen.getByText(/Unlocking encryption/)).toBeInTheDocument();
  });

  it('shows the encrypted indicator when unlocked', () => {
    render(<SealedField {...base} isUnlocked />);
    expect(screen.getByText(/Encrypted on your device before sending/)).toBeInTheDocument();
  });
});
