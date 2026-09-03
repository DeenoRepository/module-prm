import { describe, it, expect } from 'vitest';
import { ProcurementService } from './procurement-service.js';

describe('ProcurementService (TDD)', () => {
  const service = new ProcurementService();

  it('selects approval tier based on order value', () => {
    expect(service.determineApprovalTier(25000)).toBe('DEPARTMENT_HEAD');
    expect(service.determineApprovalTier(250000)).toBe('FINANCE_DIRECTOR');
    expect(service.determineApprovalTier(1000000)).toBe('CEO');
  });

  it('aggregates individual item demands into combined batch lots', () => {
    const raw = [
      { sku: 'BEARING-1', quantity: 2 },
      { sku: 'BELT-V4', quantity: 1 },
      { sku: 'BEARING-1', quantity: 5 }
    ];
    const consolidated = service.aggregateDemands(raw);
    expect(consolidated).toEqual([
      { sku: 'BEARING-1', totalQuantity: 7 },
      { sku: 'BELT-V4', totalQuantity: 1 }
    ]);
  });
});
