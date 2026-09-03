export class ProcurementService {
  determineApprovalTier(totalAmount: number): 'DEPARTMENT_HEAD' | 'FINANCE_DIRECTOR' | 'CEO' {
    if (totalAmount <= 50000) return 'DEPARTMENT_HEAD';
    if (totalAmount <= 500000) return 'FINANCE_DIRECTOR';
    return 'CEO';
  }

  aggregateDemands(demands: { sku: string; quantity: number }[]): { sku: string; totalQuantity: number }[] {
    const map = new Map<string, number>();
    for (const d of demands) {
      map.set(d.sku, (map.get(d.sku) || 0) + d.quantity);
    }
    return Array.from(map.entries()).map(([sku, totalQuantity]) => ({ sku, totalQuantity }));
  }
}
