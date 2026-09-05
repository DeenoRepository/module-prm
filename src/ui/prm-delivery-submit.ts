export interface DeliveryDialogItem {
  requestItemId: string;
  nomenclatureId: string;
  name: string;
  unit: string;
  requestedQty: number;
  previouslyReceivedQty: number;
  receivedQty: number;
  actualPrice?: number | null;
}

export interface DeliveryDialogInput {
  idempotencyKey: string;
  supplierName: string;
  document: string;
  items: DeliveryDialogItem[];
}

export function getDeliveryProgress(item: Pick<DeliveryDialogItem, 'requestedQty' | 'receivedQty'>): number {
  if (item.requestedQty <= 0) return 0;
  return Math.min(100, (item.receivedQty / item.requestedQty) * 100);
}

export function getRemainingQuantity(item: Pick<DeliveryDialogItem, 'requestedQty' | 'previouslyReceivedQty'>): number {
  return Math.max(0, item.requestedQty - item.previouslyReceivedQty);
}

export function validateDeliveryDialog(input: DeliveryDialogInput): string | null {
  if (!input.idempotencyKey.trim()) return 'Не удалось сформировать ключ приёмки';
  const selected = input.items.filter((item) => item.receivedQty > 0);
  if (selected.length === 0) return 'Укажите количество хотя бы по одной позиции';
  if (selected.some((item) => item.receivedQty > getRemainingQuantity(item))) {
    return 'Принятое количество не может превышать остаток по заявке';
  }
  if (selected.some((item) => !Number.isFinite(item.receivedQty) || item.receivedQty <= 0)) {
    return 'Принятое количество должно быть больше нуля';
  }
  return null;
}

export function buildDeliveryPayload(input: DeliveryDialogInput) {
  return {
    idempotencyKey: input.idempotencyKey.trim(),
    supplierName: input.supplierName.trim() || undefined,
    document: input.document.trim() || undefined,
    items: input.items
      .filter((item) => item.receivedQty > 0)
      .map((item) => ({
        requestItemId: item.requestItemId,
        nomenclatureId: item.nomenclatureId,
        receivedQty: item.receivedQty,
        actualPrice: item.actualPrice ?? undefined,
      })),
  };
}
