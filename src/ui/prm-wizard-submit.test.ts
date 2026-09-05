/**
 * Pure-logic tests for the PRM wizard's request-building helpers.
 *
 * Covers the P1 Definition-of-Done requirement: submission must be
 * rejected without positions and with zero/negative quantity or price.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  addOrMergeLineItem,
  buildPurchaseRequestPayload,
  calculateEstimatedTotal,
  validatePurchaseRequest,
  type PrmRequestLineItem,
} from './prm-wizard-submit';

function item(overrides: Partial<PrmRequestLineItem> = {}): PrmRequestLineItem {
  return {
    nomenclatureId: 'nom-1',
    nomenclatureName: 'Bearing',
    unit: 'pcs',
    requestedQty: 2,
    estimatedPrice: 100,
    ...overrides,
  };
}

describe('addOrMergeLineItem', () => {
  test('appends a new nomenclature as a separate row', () => {
    const result = addOrMergeLineItem([item()], item({ nomenclatureId: 'nom-2', requestedQty: 1 }));
    assert.equal(result.length, 2);
  });

  test('merges quantity for an existing nomenclature instead of duplicating', () => {
    const result = addOrMergeLineItem([item({ requestedQty: 2 })], item({ requestedQty: 3 }));
    assert.equal(result.length, 1);
    assert.equal(result[0].requestedQty, 5);
  });
});

describe('validatePurchaseRequest', () => {
  test('rejects submission without a target warehouse', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: '',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [item()],
    });
    assert.match(error ?? '', /склад/i);
  });

  test('rejects submission with zero line items', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [],
    });
    assert.match(error ?? '', /позиц/i);
  });

  test('rejects a zero-quantity position', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [item({ requestedQty: 0 })],
    });
    assert.notEqual(error, null);
  });

  test('rejects a negative-quantity position', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [item({ requestedQty: -1 })],
    });
    assert.notEqual(error, null);
  });

  test('rejects a negative-price position', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [item({ estimatedPrice: -5 })],
    });
    assert.notEqual(error, null);
  });

  test('accepts a valid request with positive quantities and prices', () => {
    const error = validatePurchaseRequest({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      lineItems: [item()],
    });
    assert.equal(error, null);
  });
});

describe('calculateEstimatedTotal', () => {
  test('sums requestedQty * estimatedPrice across items', () => {
    const total = calculateEstimatedTotal([item({ requestedQty: 2, estimatedPrice: 100 }), item({ requestedQty: 1, estimatedPrice: 50 })]);
    assert.equal(total, 250);
  });
});

describe('buildPurchaseRequestPayload', () => {
  test('trims optional text fields and maps items to the API shape', () => {
    const payload = buildPurchaseRequestPayload({
      targetWarehouseId: 'wh-1',
      priority: 'HIGH',
      justification: '  need it  ',
      supplierName: '  Acme  ',
      lineItems: [item({ requestedQty: 3, estimatedPrice: 20 })],
    });
    assert.equal(payload.targetWarehouseId, 'wh-1');
    assert.equal(payload.priority, 'HIGH');
    assert.equal(payload.justification, 'need it');
    assert.equal(payload.supplierName, 'Acme');
    assert.deepEqual(payload.items, [{ nomenclatureId: 'nom-1', requestedQty: 3, estimatedPrice: 20 }]);
  });

  test('omits empty optional text fields', () => {
    const payload = buildPurchaseRequestPayload({
      targetWarehouseId: 'wh-1',
      priority: 'LOW',
      justification: '   ',
      supplierName: '',
      lineItems: [item()],
    });
    assert.equal(payload.justification, undefined);
    assert.equal(payload.supplierName, undefined);
  });

  test('includes equipmentId and maintenanceScheduleId when present', () => {
    const payload = buildPurchaseRequestPayload({
      targetWarehouseId: 'wh-1',
      priority: 'HIGH',
      justification: 'Fix pump',
      supplierName: 'Acme',
      equipmentId: 'eq-42',
      maintenanceScheduleId: 'sch-10',
      lineItems: [item()],
    });
    assert.equal(payload.equipmentId, 'eq-42');
    assert.equal(payload.maintenanceScheduleId, 'sch-10');
  });

  test('omits empty equipmentId and maintenanceScheduleId', () => {
    const payload = buildPurchaseRequestPayload({
      targetWarehouseId: 'wh-1',
      priority: 'MEDIUM',
      justification: '',
      supplierName: '',
      equipmentId: '',
      maintenanceScheduleId: '',
      lineItems: [item()],
    });
    assert.equal(payload.equipmentId, undefined);
    assert.equal(payload.maintenanceScheduleId, undefined);
  });
});
