export interface PrmRequestLineItem {
  nomenclatureId: string;
  nomenclatureName: string;
  nomenclatureArticle?: string;
  unit: string;
  requestedQty: number;
  estimatedPrice: number;
}

/**
 * Adds a line item, merging quantity into an existing row for the same
 * nomenclature instead of duplicating it (mirrors WMS transfer request
 * dialog convention).
 */
export function addOrMergeLineItem(
  items: PrmRequestLineItem[],
  newItem: PrmRequestLineItem,
): PrmRequestLineItem[] {
  const existingIdx = items.findIndex((it) => it.nomenclatureId === newItem.nomenclatureId);
  if (existingIdx >= 0) {
    const updated = [...items];
    updated[existingIdx] = {
      ...updated[existingIdx],
      requestedQty: updated[existingIdx].requestedQty + newItem.requestedQty,
    };
    return updated;
  }
  return [...items, newItem];
}

export interface PrmRequestSubmitInput {
  targetWarehouseId: string;
  priority: string;
  justification: string;
  supplierName: string;
  equipmentId?: string | null;
  maintenanceScheduleId?: string | null;
  lineItems: PrmRequestLineItem[];
}

/**
 * Validates a purchase request draft before submission. Enforces the P1
 * Definition-of-Done rule: no submission without positions, and no
 * position with zero/negative quantity.
 */
export function validatePurchaseRequest(input: PrmRequestSubmitInput): string | null {
  if (!input.targetWarehouseId) return 'Выберите склад назначения';
  if (input.lineItems.length === 0) return 'Добавьте хотя бы одну позицию ТМЦ в заявку';
  for (const item of input.lineItems) {
    if (!Number.isFinite(item.requestedQty) || item.requestedQty <= 0) {
      return `Количество позиции «${item.nomenclatureName}» должно быть больше нуля`;
    }
    if (!Number.isFinite(item.estimatedPrice) || item.estimatedPrice < 0) {
      return `Цена позиции «${item.nomenclatureName}» не может быть отрицательной`;
    }
  }
  return null;
}

export function calculateEstimatedTotal(items: PrmRequestLineItem[]): number {
  return items.reduce((sum, item) => sum + item.requestedQty * item.estimatedPrice, 0);
}

export function buildPurchaseRequestPayload(input: PrmRequestSubmitInput) {
  return {
    targetWarehouseId: input.targetWarehouseId,
    priority: input.priority,
    justification: input.justification.trim() || undefined,
    supplierName: input.supplierName.trim() || undefined,
    equipmentId: input.equipmentId || undefined,
    maintenanceScheduleId: input.maintenanceScheduleId || undefined,
    items: input.lineItems.map((item) => ({
      nomenclatureId: item.nomenclatureId,
      requestedQty: item.requestedQty,
      estimatedPrice: item.estimatedPrice,
    })),
  };
}
