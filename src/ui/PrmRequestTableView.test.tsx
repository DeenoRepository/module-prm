import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../ui/__tests__/test-utils';
import PrmRequestTableView from './PrmRequestTableView';
import type { PrmRequestTableItem } from './PrmRequestTableView';

const item: PrmRequestTableItem = {
  id: 'request-1',
  requestNumber: 'PR-20260902-ABC123',
  status: 'DELIVERED',
  priority: 'HIGH',
  estimatedTotal: 100,
  currency: 'RUB',
  createdAt: '2026-09-02T00:00:00.000Z',
  justification: null,
  supplierName: null,
  targetWarehouse: { id: 'warehouse-1', name: 'Main', code: 'MAIN', responsibleUserId: 'mol-1' },
  requester: { id: 'requester-1', displayName: 'Requester' },
  reviewer: null,
  items: [{ id: 'item-1', nomenclatureId: 'nom-1', requestedQty: 1, receivedQty: 1, estimatedPrice: 100, nomenclature: { name: 'Bearing', unit: 'pcs' } }],
};

const props = () => ({
  items: [item],
  currentUserId: 'manager-1',
  canReview: false,
  canClose: () => true,
  onSelectDetails: vi.fn(),
  onSubmit: vi.fn(),
  onReview: vi.fn(),
  onCancel: vi.fn(),
  onCloseRequest: vi.fn(),
});

describe('PrmRequestTableView', () => {
  it('shows close only when the row is delivered and authorized', () => {
    const callbacks = props();
    const { rerender } = renderWithProviders(<PrmRequestTableView {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
    rerender(<PrmRequestTableView {...callbacks} canClose={() => false} />);
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument();
    rerender(<PrmRequestTableView {...callbacks} items={[{ ...item, status: 'CLOSED' }]} />);
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument();
  });

  it('stops close click propagation and does not open details', () => {
    const callbacks = props();
    renderWithProviders(<PrmRequestTableView {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(callbacks.onCloseRequest).toHaveBeenCalledWith(item);
    expect(callbacks.onSelectDetails).not.toHaveBeenCalled();
  });
});
