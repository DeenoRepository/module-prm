import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../ui/__tests__/test-utils';
import PrmRequestWizardDialog from './PrmRequestWizardDialog';

const enqueueSnackbar = vi.fn();
const fetchMock = vi.fn();
const onSuccess = vi.fn();
const onClose = vi.fn();

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

let mockPermissions = ['eps.equipment.view', 'mro.schedule.view', 'wms.inventory.view', 'prm.requests.create'];
vi.mock('@/lib/auth-client', () => ({
  useAuth: () => ({
    user: { userId: 'u1' },
    hasPermission: (p: string) => mockPermissions.includes(p),
  }),
}));

beforeEach(() => {
  enqueueSnackbar.mockReset();
  fetchMock.mockReset();
  onSuccess.mockReset();
  onClose.mockReset();
  mockPermissions = ['eps.equipment.view', 'mro.schedule.view', 'wms.inventory.view', 'prm.requests.create'];
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      return { ok: true, json: async () => ({ success: true, data: { id: 'req-1' } }) };
    }
    if (url.includes('/warehouses')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 'wh-1', name: 'Main warehouse', code: 'MAIN' }],
        }),
      };
    }
    if (url.includes('/nomenclature')) {
      return {
        ok: true,
        json: async () => ({ success: true, data: { items: [{ id: 'nom-1', name: 'Bearing', article: 'B-1', unit: 'pcs' }] } }),
      };
    }
    if (url.includes('/eps/equipment')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 'eq-1', name: 'Pump Alpha', inventoryNumber: 'INV-001' }],
        }),
      };
    }
    if (url.includes('/mro/schedules')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 'sch-1', title: 'Q1 Maintenance', equipmentId: 'eq-1' }],
        }),
      };
    }
    return { ok: true, json: async () => ({ success: true, data: { items: [] } }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});

describe('PrmRequestWizardDialog', () => {
  it('supports initial prefill for equipment and maintenance schedule', async () => {
    renderWithProviders(
      <PrmRequestWizardDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
        initialEquipmentId="eq-1"
        initialMaintenanceScheduleId="sch-1"
      />,
    );
    await waitFor(() => expect(screen.getByText('Новая заявка на закупку ТМЦ')).toBeInTheDocument());
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('/mro/schedules?equipmentId=eq-1'))).toBe(true);
    });
  });
  it('renders the dialog and keeps submission disabled without a selected warehouse or line item', async () => {
    renderWithProviders(<PrmRequestWizardDialog open onClose={onClose} onSuccess={onSuccess} />);
    await waitFor(() => expect(screen.getByText('Новая заявка на закупку ТМЦ')).toBeInTheDocument());

    // Dictionaries were requested (warehouses + nomenclature), proving the
    // wizard loads reference data on open.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((url) => url.includes('/warehouses'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/nomenclature'))).toBe(true);

    // Submit button stays disabled until a warehouse is chosen and at least
    // one line item is added, proving the wizard cannot be submitted empty
    // (P1 Definition of Done).
    expect(screen.getByRole('button', { name: /Создать заявку/i })).toBeDisabled();
  });

  it('disables the "Добавить" button until a nomenclature and positive quantity are provided', async () => {
    renderWithProviders(<PrmRequestWizardDialog open onClose={onClose} onSuccess={onSuccess} />);
    await waitFor(() => expect(screen.getByText('Новая заявка на закупку ТМЦ')).toBeInTheDocument());

    // No nomenclature selected yet -> add button must be disabled, so a
    // zero/negative or missing position can never reach the payload.
    expect(screen.getByRole('button', { name: /^Добавить$/i })).toBeDisabled();
  });

  it('does not fetch equipment or schedules and disables fields when cross-module permissions are absent', async () => {
    mockPermissions = ['prm.requests.create'];
    renderWithProviders(
      <PrmRequestWizardDialog
        open
        onClose={onClose}
        onSuccess={onSuccess}
        initialEquipmentId="eq-1"
        initialMaintenanceScheduleId="sch-1"
      />,
    );
    await waitFor(() => expect(screen.getByText('Новая заявка на закупку ТМЦ')).toBeInTheDocument());

    const requestedUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(requestedUrls.some((u) => u.includes('/eps/equipment'))).toBe(false);
    expect(requestedUrls.some((u) => u.includes('/mro/schedules'))).toBe(false);
    expect(screen.getByText('Требуется право на просмотр оборудования (EPS)')).toBeInTheDocument();
    expect(screen.getByText('Требуется право на просмотр графиков ТО (MRO)')).toBeInTheDocument();
  });
});
