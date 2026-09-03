import { ApprovalTier } from './procurement-models.js';

export interface BudgetLimit {
  tier: ApprovalTier;
  maxAmount: number;
}

export const DEFAULT_BUDGET_LIMITS: readonly BudgetLimit[] = Object.freeze([
  { tier: 'DEPARTMENT_HEAD', maxAmount: 1000 },
  { tier: 'CHIEF_ENGINEER', maxAmount: 10000 },
  { tier: 'FINANCE_DIRECTOR', maxAmount: 50000 },
  { tier: 'CEO', maxAmount: Number.POSITIVE_INFINITY }
]);

export class ProcurementService {
  private _limits: readonly BudgetLimit[];

  constructor(customLimits?: readonly BudgetLimit[]) {
    this._limits = customLimits ? [...customLimits] : DEFAULT_BUDGET_LIMITS;
  }

  determineApprovalTier(totalAmount: number): ApprovalTier {
    if (totalAmount < 0) {
      throw new Error('Total amount cannot be negative');
    }

    for (const limit of this._limits) {
      if (totalAmount <= limit.maxAmount) {
        return limit.tier;
      }
    }

    return 'CEO';
  }

  isAuthorizedForAmount(tier: ApprovalTier, totalAmount: number): boolean {
    const requiredTier = this.determineApprovalTier(totalAmount);
    const tierHierarchy: Record<ApprovalTier, number> = {
      DEPARTMENT_HEAD: 1,
      CHIEF_ENGINEER: 2,
      FINANCE_DIRECTOR: 3,
      CEO: 4
    };

    return tierHierarchy[tier] >= tierHierarchy[requiredTier];
  }

  validateOrderAgainstBudget(totalAmount: number, remainingDepartmentBudget: number): {
    fitsBudget: boolean;
    deficit: number;
  } {
    if (remainingDepartmentBudget < 0) {
      return { fitsBudget: false, deficit: totalAmount };
    }

    const deficit = Math.max(0, totalAmount - remainingDepartmentBudget);
    return {
      fitsBudget: deficit === 0,
      deficit
    };
  }

  aggregateDemands(demands: { sku: string; quantity: number }[]): { sku: string; totalQuantity: number }[] {
    const map = new Map<string, number>();
    for (const d of demands) {
      if (d.quantity > 0) {
        map.set(d.sku, (map.get(d.sku) || 0) + d.quantity);
      }
    }
    return Array.from(map.entries()).map(([sku, totalQuantity]) => ({ sku, totalQuantity }));
  }

  calculateDeliveryDiscrepancies(
    ordered: Array<{ nomenclatureId: string; quantity: number }>,
    received: Array<{ nomenclatureId: string; quantityReceived: number }>
  ): Array<{ nomenclatureId: string; ordered: number; received: number; discrepancy: number }> {
    const orderedMap = new Map(ordered.map(o => [o.nomenclatureId, o.quantity]));
    const receivedMap = new Map<string, number>();

    for (const r of received) {
      receivedMap.set(r.nomenclatureId, (receivedMap.get(r.nomenclatureId) || 0) + r.quantityReceived);
    }

    const allIds = new Set([...orderedMap.keys(), ...receivedMap.keys()]);
    const result: Array<{ nomenclatureId: string; ordered: number; received: number; discrepancy: number }> = [];

    for (const id of allIds) {
      const ord = orderedMap.get(id) ?? 0;
      const rec = receivedMap.get(id) ?? 0;
      result.push({
        nomenclatureId: id,
        ordered: ord,
        received: rec,
        discrepancy: rec - ord
      });
    }

    return result;
  }
}
