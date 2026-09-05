import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../ui/__tests__/test-utils';
import PrmRequestDetailsDialog from './PrmRequestDetailsDialog';
import type { PrmRequestTableItem } from './PrmRequestTableView';

const request: PrmRequestTableItem = {
  id: 'request-1',
  requestNumber: 'PR-20260902-ABC123',
  status: 'DELIVERED',
  priority: 'HIGH',
  estimatedTotal: 100,
  currency: 'RUB',
  createdAt: '2026-09-02T00:00:00.000Z',
  justification: 'Need parts',
  supplierName: 'Supplier',
  targetWarehouse: { id: 'warehouse-1', name: 'Main', code: 'MAIN', responsibleUserId: 'mol-1' },
  requester: { id: 'requester-1', displayName: 'Requester' },
  reviewer: null,
  items: [{
    id: 'request-item-1',
    nomenclatureId: 'nom-1',
    requestedQty: 10,
    receivedQty: 10,
    estimatedPrice: 10,
    nomenclature: { name: 'Bearing', unit: 'pcs' },
  }],
};

const props = () => ({
  open: true,
  request,
  currentUserId: 'manager-1',
  canReview: true,
  canClose: true,
  onClose: vi.fn(),
  onReceive: vi.fn(),
  onSubmit: vi.fn(),
  onReview: vi.fn(),
  onCancel: vi.fn(),
  onCloseRequest: vi.fn(),
});

describe('PrmRequestDetailsDialog', () => {
  it('shows closure action only for an authorized delivered request', () => {
    const callbacks = props();
    renderWithProviders(<PrmRequestDetailsDialog {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Закрыть заявку' })).toBeInTheDocument();

    const { rerender } = renderWithProviders(<PrmRequestDetailsDialog {...callbacks} request={{ ...request, status: 'CLOSED' }} />);
    expect(screen.queryByRole('button', { name: 'Закрыть заявку' })).not.toBeInTheDocument();
    rerender(<PrmRequestDetailsDialog {...callbacks} request={request} canClose={false} />);
    expect(screen.queryByRole('button', { name: 'Закрыть заявку' })).not.toBeInTheDocument();
  });

  it('renders closure author/date and emits the close action', () => {
    const callbacks = props();
    renderWithProviders(<PrmRequestDetailsDialog {...callbacks} request={{ ...request, closedAt: '2026-09-02T12:00:00.000Z', closedBy: { id: 'manager-1', displayName: 'Manager' } }} />);
    expect(screen.getByText(/Manager/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть заявку' }));
    expect(callbacks.onCloseRequest).toHaveBeenCalledWith(expect.objectContaining({ id: request.id }));
  });

  it('renders linked equipment and maintenance schedule cards when present', () => {
    const callbacks = props();
    renderWithProviders(
      <PrmRequestDetailsDialog
        {...callbacks}
        canViewEps
        canViewMro
        request={{
          ...request,
          equipment: { id: 'eq-1', name: 'Pump Station 1', inventoryNumber: 'INV-100' },
          maintenanceSchedule: { id: 'sch-1', title: 'Monthly Inspection' },
        }}
      />,
    );

    expect(screen.getByText('Связанные объекты')).toBeInTheDocument();
    expect(screen.getByText(/Pump Station 1/)).toBeInTheDocument();
    expect(screen.getByText(/Monthly Inspection/)).toBeInTheDocument();
  });

  it('does not render linked objects section when equipment and schedule are null', () => {
    const callbacks = props();
    renderWithProviders(
      <PrmRequestDetailsDialog
        {...callbacks}
        request={{
          ...request,
          equipment: null,
          maintenanceSchedule: null,
        }}
      />,
    );

    expect(screen.queryByText('Связанные объекты')).not.toBeInTheDocument();
  });
});
