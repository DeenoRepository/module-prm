import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../ui/__tests__/test-utils';
import PrmDeliveryDialog from './PrmDeliveryDialog';
import type { PrmRequestTableItem } from './PrmRequestTableView';

const enqueueSnackbar = vi.fn();
const fetchMock = vi.fn();
const onSuccess = vi.fn();
const onClose = vi.fn();

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const request: PrmRequestTableItem = {
  id: 'request-1',
  requestNumber: 'PR-20260902-ABC123',
  status: 'PARTIALLY_DELIVERED',
  priority: 'MEDIUM',
  estimatedTotal: 100,
  currency: 'RUB',
  createdAt: '2026-09-02T00:00:00.000Z',
  justification: 'Need parts',
  supplierName: 'Supplier',
  targetWarehouse: { id: 'warehouse-1', name: 'Main', code: 'MAIN' },
  requester: { id: 'requester-1', displayName: 'Requester' },
  reviewer: null,
  items: [{
    id: 'request-item-1',
    nomenclatureId: 'nom-1',
    requestedQty: 10,
    receivedQty: 4,
    estimatedPrice: 10,
    nomenclature: { name: 'Bearing', unit: 'pcs' },
  }],
};

beforeEach(() => {
  enqueueSnackbar.mockReset();
  fetchMock.mockReset();
  onSuccess.mockReset();
  onClose.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('PrmDeliveryDialog', () => {
  it('shows previously received quantity and remaining quantity', async () => {
    renderWithProviders(<PrmDeliveryDialog open request={request} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(screen.getByText('4 pcs')).toBeInTheDocument());
    expect(screen.getByText(/Осталось: 6 pcs/)).toBeInTheDocument();
  });

  it('rejects submit when no current delivery quantity is entered', async () => {
    renderWithProviders(<PrmDeliveryDialog open request={request} onClose={onClose} onSuccess={onSuccess} />);

    const submitButton = await screen.findByRole('button', { name: /Зарегистрировать приёмку/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(
      'Укажите количество хотя бы по одной позиции',
      { variant: 'warning' },
    ));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/deliveries'), expect.anything());
  });
});
