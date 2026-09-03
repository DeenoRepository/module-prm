import { z } from 'zod';

export const ApprovalTierSchema = z.enum([
  'DEPARTMENT_HEAD',
  'CHIEF_ENGINEER',
  'FINANCE_DIRECTOR',
  'CEO'
]);

export type ApprovalTier = z.infer<typeof ApprovalTierSchema>;

export const ApprovalDecisionSchema = z.enum(['APPROVED', 'REJECTED']);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalRecordSchema = z.object({
  id: z.string().uuid(),
  tier: ApprovalTierSchema,
  approverId: z.string().uuid(),
  approverName: z.string().min(1).max(100),
  decision: ApprovalDecisionSchema,
  comments: z.string().max(255).nullable().optional(),
  timestamp: z.coerce.date().default(() => new Date())
});

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const PurchaseOrderItemSchema = z.object({
  id: z.string().uuid(),
  nomenclatureId: z.string().uuid(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  quantity: z.number().positive(),
  unit: z.string().default('pcs'),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  requestedDeliveryDate: z.coerce.date().nullable().optional()
});

export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;

export const ItemDeliveryConditionSchema = z.enum(['ACCEPTED', 'DAMAGED', 'DEFECTIVE']);
export type ItemDeliveryCondition = z.infer<typeof ItemDeliveryConditionSchema>;

export const DeliveryReceiptItemSchema = z.object({
  nomenclatureId: z.string().uuid(),
  quantityReceived: z.number().positive(),
  condition: ItemDeliveryConditionSchema.default('ACCEPTED'),
  notes: z.string().max(255).nullable().optional()
});

export type DeliveryReceiptItem = z.infer<typeof DeliveryReceiptItemSchema>;

export const DeliveryReceiptSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  receiptNumber: z.string().min(1).max(50),
  receivedAt: z.coerce.date().default(() => new Date()),
  receivedById: z.string().uuid(),
  itemsReceived: z.array(DeliveryReceiptItemSchema).min(1),
  supplierRating: z.number().int().min(1).max(5).default(5),
  notes: z.string().max(500).nullable().optional()
});

export type DeliveryReceipt = z.infer<typeof DeliveryReceiptSchema>;
