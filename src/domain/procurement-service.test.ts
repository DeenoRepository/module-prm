import { describe, it, expect } from 'vitest';
import { ProcurementService } from './procurement-service.js';

describe('ProcurementService', () => {
  const service = new ProcurementService();

  describe('custom limits constructor', () => {
    it('supports custom limits', () => {
      const customService = new ProcurementService([
        { tier: 'DEPARTMENT_HEAD', maxAmount: 500 },
        { tier: 'CEO', maxAmount: Number.POSITIVE_INFINITY }
      ]);
      expect(customService.determineApprovalTier(400)).toBe('DEPARTMENT_HEAD');
      expect(customService.determineApprovalTier(600)).toBe('CEO');
    });
  });

  describe('determineApprovalTier', () => {
    it('returns DEPARTMENT_HEAD for amounts <= 1000', () => {
      expect(service.determineApprovalTier(500)).toBe('DEPARTMENT_HEAD');
      expect(service.determineApprovalTier(1000)).toBe('DEPARTMENT_HEAD');
    });

    it('returns CHIEF_ENGINEER for amounts between 1001 and 10000', () => {
      expect(service.determineApprovalTier(1001)).toBe('CHIEF_ENGINEER');
      expect(service.determineApprovalTier(10000)).toBe('CHIEF_ENGINEER');
    });

    it('returns FINANCE_DIRECTOR for amounts between 10001 and 50000', () => {
      expect(service.determineApprovalTier(10001)).toBe('FINANCE_DIRECTOR');
      expect(service.determineApprovalTier(50000)).toBe('FINANCE_DIRECTOR');
    });

    it('returns CEO for amounts over 50000', () => {
      expect(service.determineApprovalTier(50001)).toBe('CEO');
      expect(service.determineApprovalTier(1000000)).toBe('CEO');
    });

    it('throws on negative amounts', () => {
      expect(() => service.determineApprovalTier(-10)).toThrow('cannot be negative');
    });
  });

  describe('isAuthorizedForAmount', () => {
    it('authorizes according to hierarchy levels', () => {
      expect(service.isAuthorizedForAmount('DEPARTMENT_HEAD', 800)).toBe(true);
      expect(service.isAuthorizedForAmount('DEPARTMENT_HEAD', 5000)).toBe(false);

      expect(service.isAuthorizedForAmount('CHIEF_ENGINEER', 5000)).toBe(true);
      expect(service.isAuthorizedForAmount('CHIEF_ENGINEER', 20000)).toBe(false);

      expect(service.isAuthorizedForAmount('FINANCE_DIRECTOR', 30000)).toBe(true);
      expect(service.isAuthorizedForAmount('FINANCE_DIRECTOR', 100000)).toBe(false);

      expect(service.isAuthorizedForAmount('CEO', 500000)).toBe(true);
    });
  });

  describe('validateOrderAgainstBudget', () => {
    it('returns fitsBudget: true when within remaining budget', () => {
      const check = service.validateOrderAgainstBudget(4000, 5000);
      expect(check.fitsBudget).toBe(true);
      expect(check.deficit).toBe(0);
    });

    it('returns fitsBudget: false and deficit when exceeding remaining budget', () => {
      const check = service.validateOrderAgainstBudget(7500, 5000);
      expect(check.fitsBudget).toBe(false);
      expect(check.deficit).toBe(2500);
    });

    it('returns fitsBudget: false when budget is negative', () => {
      const check = service.validateOrderAgainstBudget(2000, -500);
      expect(check.fitsBudget).toBe(false);
      expect(check.deficit).toBe(2000);
    });
  });

  describe('aggregateDemands', () => {
    it('aggregates quantities per SKU correctly', () => {
      const demands = [
        { sku: 'BEARING-6204', quantity: 10 },
        { sku: 'V-BELT-100', quantity: 5 },
        { sku: 'BEARING-6204', quantity: 15 },
        { sku: 'V-BELT-100', quantity: 0 } // non-positive filtered
      ];

      const result = service.aggregateDemands(demands);
      expect(result).toEqual([
        { sku: 'BEARING-6204', totalQuantity: 25 },
        { sku: 'V-BELT-100', totalQuantity: 5 }
      ]);
    });
  });

  describe('calculateDeliveryDiscrepancies', () => {
    it('accurately calculates delivery variances', () => {
      const ordered = [
        { nomenclatureId: 'item-1', quantity: 10 },
        { nomenclatureId: 'item-2', quantity: 20 }
      ];
      const received = [
        { nomenclatureId: 'item-1', quantityReceived: 10 },
        { nomenclatureId: 'item-2', quantityReceived: 15 },
        { nomenclatureId: 'item-3', quantityReceived: 2 } // unexpected item
      ];

      const discrepancies = service.calculateDeliveryDiscrepancies(ordered, received);
      const item1 = discrepancies.find(d => d.nomenclatureId === 'item-1');
      const item2 = discrepancies.find(d => d.nomenclatureId === 'item-2');
      const item3 = discrepancies.find(d => d.nomenclatureId === 'item-3');

      expect(item1?.discrepancy).toBe(0);
      expect(item2?.discrepancy).toBe(-5); // 5 missing
      expect(item3?.discrepancy).toBe(2);  // 2 extra
    });
  });
});
