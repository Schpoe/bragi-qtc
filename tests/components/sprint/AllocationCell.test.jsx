import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AllocationCell from '@/components/sprint/AllocationCell';

// Mock the shadcn Input component with a plain <input>
vi.mock('@/components/ui/input', () => ({
  Input: ({ className, ...props }) => <input {...props} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

describe('AllocationCell', () => {
  it('renders with given value', () => {
    render(<AllocationCell value={50} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(50);
  });

  it('renders empty placeholder when value is 0', () => {
    render(<AllocationCell value={0} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(null); // 0 is falsy so stored as ""
  });

  it('calls onChange with clamped value on blur', async () => {
    const onChange = vi.fn();
    render(<AllocationCell value={0} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '75');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('clamps value above 100 to 100', async () => {
    const onChange = vi.fn();
    render(<AllocationCell value={0} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '150');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('clamps negative value to 0', async () => {
    const onChange = vi.fn();
    render(<AllocationCell value={10} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '-20');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('calls onChange(0) when input is cleared', async () => {
    const onChange = vi.fn();
    render(<AllocationCell value={50} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('treats non-numeric input as empty (browser normalizes number inputs)', async () => {
    const onChange = vi.fn();
    render(<AllocationCell value={40} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    // number inputs normalize non-numeric text to "" in jsdom
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    // empty string branch triggers onChange(0)
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('is disabled when disabled prop is true', () => {
    render(<AllocationCell value={30} onChange={() => {}} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('updates displayed value when value prop changes', () => {
    const { rerender } = render(<AllocationCell value={20} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(20);
    rerender(<AllocationCell value={60} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(60);
  });
});
