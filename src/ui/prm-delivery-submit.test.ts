import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeliveryPayload,
  getDeliveryProgress,
  getRemainingQuantity,
  validateDeliveryDialog,
  type DeliveryDialogItem,
} from './prm-delivery-submit';

function item(overrides: Partial<DeliveryDialogItem> = {}): DeliveryDialogItem {
  return {
    requestItemId: 'request-item-1',
    nomenclatureId: 'nom-1',
    name: 'Bearing',
    unit: 'pcs',
    requestedQty: 10,
    previouslyReceivedQty: 0,
    receivedQty: 0,
    actualPrice: null,
    ...overrides,
  };
}

describe('PRM delivery UI helpers', () => {
  test('calculates progress and remaining quantity', () => {
    assert.equal(getDeliveryProgress(item({ previouslyReceivedQty: 0, receivedQty: 4 })), 40);
    assert.equal(getRemainingQuantity(item({ previouslyReceivedQty: 4 })), 6);
  });

  test('clamps progress to 100 percent', () => {
    assert.equal(getDeliveryProgress(item({ previouslyReceivedQty: 0, receivedQty: 12 })), 100);
  });

  test('rejects empty delivery', () => {
    assert.match(validateDeliveryDialog({ idempotencyKey: 'key', supplierName: '', document: '', items: [item()] }) ?? '', /хотя бы/i);
  });

  test('rejects delivery above the remaining quantity', () => {
    assert.match(validateDeliveryDialog({ idempotencyKey: 'key', supplierName: '', document: '', items: [item({ previouslyReceivedQty: 0, receivedQty: 11 })] }) ?? '', /превышать/i);
  });

  test('accepts a partial delivery and maps only selected items', () => {
    const delivery = {
      idempotencyKey: ' key ',
      supplierName: ' Supplier ',
      document: ' INV-1 ',
      items: [item({ receivedQty: 4, actualPrice: 12 }), item({ requestItemId: 'request-item-2', receivedQty: 0 })],
    };
    assert.equal(validateDeliveryDialog(delivery), null);
    assert.deepEqual(buildDeliveryPayload(delivery), {
      idempotencyKey: 'key',
      supplierName: 'Supplier',
      document: 'INV-1',
      items: [{ requestItemId: 'request-item-1', nomenclatureId: 'nom-1', receivedQty: 4, actualPrice: 12 }],
    });
  });
});
