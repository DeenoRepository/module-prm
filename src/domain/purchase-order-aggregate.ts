import {
  ApprovalTier,
  ApprovalDecision,
  ApprovalRecord,
  PurchaseOrderItem,
  DeliveryReceipt
} from './procurement-models.js';
import { ProcurementService } from './procurement-service.js';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_DELIVERED'
  | 'FULFILLED'
  | 'REJECTED'
  | 'CANCELLED';

export interface PurchaseOrderProps {
  id: string;
  orderNumber: string;
  vendor: string;
  totalAmount: number;
  currency?: string;
  status: PurchaseOrderStatus;
  requestedById: string;
  departmentId?: string | null;
  items?: PurchaseOrderItem[];
  approvalHistory?: ApprovalRecord[];
  deliveries?: DeliveryReceipt[];
  orderedAt?: Date | null;
  expectedDeliveryDate?: Date | null;
  fulfilledAt?: Date | null;
  rejectionReason?: string | null;
}

export interface PrmOutboxRecord {
  id: string;
  aggregateType: 'PurchaseOrder';
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  published: boolean;
}

export class PurchaseOrderAggregate {
  private _props: PurchaseOrderProps;
  private _outbox: PrmOutboxRecord[] = [];
  private _procurementService: ProcurementService;

  constructor(props: PurchaseOrderProps, procurementService?: ProcurementService) {
    this._props = {
      ...props,
      currency: props.currency ?? 'RUB',
      departmentId: props.departmentId ?? null,
      items: props.items ? [...props.items] : [],
      approvalHistory: props.approvalHistory ? [...props.approvalHistory] : [],
      deliveries: props.deliveries ? [...props.deliveries] : [],
      orderedAt: props.orderedAt ?? null,
      expectedDeliveryDate: props.expectedDeliveryDate ?? null,
      fulfilledAt: props.fulfilledAt ?? null,
      rejectionReason: props.rejectionReason ?? null
    };
    this._procurementService = procurementService ?? new ProcurementService();
  }

  static create(
    props: Omit<
      PurchaseOrderProps,
      'status' | 'approvalHistory' | 'deliveries' | 'orderedAt' | 'fulfilledAt' | 'rejectionReason'
    >
  ): PurchaseOrderAggregate {
    const aggregate = new PurchaseOrderAggregate({
      ...props,
      status: 'DRAFT',
      approvalHistory: [],
      deliveries: [],
      orderedAt: null,
      fulfilledAt: null,
      rejectionReason: null
    });

    aggregate.recordOutbox('prm.order.created', {
      orderId: props.id,
      orderNumber: props.orderNumber,
      vendor: props.vendor,
      totalAmount: props.totalAmount,
      requestedById: props.requestedById
    });

    return aggregate;
  }

  get props(): Readonly<PurchaseOrderProps> {
    return Object.freeze({ ...this._props });
  }

  get id(): string {
    return this._props.id;
  }

  get status(): PurchaseOrderStatus {
    return this._props.status;
  }

  get totalAmount(): number {
    return this._props.totalAmount;
  }

  get items(): readonly PurchaseOrderItem[] {
    return this._props.items ?? [];
  }

  get approvalHistory(): readonly ApprovalRecord[] {
    return this._props.approvalHistory ?? [];
  }

  get deliveries(): readonly DeliveryReceipt[] {
    return this._props.deliveries ?? [];
  }

  get outboxEvents(): readonly PrmOutboxRecord[] {
    return this._outbox;
  }

  addItem(item: Omit<PurchaseOrderItem, 'id' | 'totalPrice'>): PurchaseOrderItem {
    if (this._props.status !== 'DRAFT') {
      throw new Error('Items can only be added to DRAFT orders');
    }
    if (item.quantity <= 0) {
      throw new Error('Item quantity must be positive');
    }
    if (item.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    const newItem: PurchaseOrderItem = {
      ...item,
      id: crypto.randomUUID(),
      totalPrice: item.quantity * item.unitPrice
    };

    this._props.items?.push(newItem);
    this._props.totalAmount = (this._props.items ?? []).reduce((acc, i) => acc + i.totalPrice, 0);

    return newItem;
  }

  submit(): void {
    if (this._props.status !== 'DRAFT') {
      throw new Error('Only DRAFT orders can be submitted');
    }
    if ((this._props.items ?? []).length === 0 && this._props.totalAmount <= 0) {
      throw new Error('Cannot submit order with no items or zero total amount');
    }

    const requiredTier = this._procurementService.determineApprovalTier(this._props.totalAmount);
    this._props.status = 'SUBMITTED';

    this.recordOutbox('prm.order.submitted', {
      orderId: this._props.id,
      totalAmount: this._props.totalAmount,
      requiredApprovalTier: requiredTier
    });
  }

  recordApproval(
    approverId: string,
    approverName: string,
    tier: ApprovalTier,
    decision: ApprovalDecision,
    comments?: string | null
  ): void {
    if (this._props.status !== 'SUBMITTED') {
      throw new Error(`Only SUBMITTED orders can be reviewed. Current status: ${this._props.status}`);
    }

    if (!this._procurementService.isAuthorizedForAmount(tier, this._props.totalAmount)) {
      throw new Error(
        `Approval tier "${tier}" lacks authority to approve order totaling ${this._props.totalAmount}`
      );
    }

    const record: ApprovalRecord = {
      id: crypto.randomUUID(),
      tier,
      approverId,
      approverName,
      decision,
      comments: comments ?? null,
      timestamp: new Date()
    };

    this._props.approvalHistory?.push(record);

    if (decision === 'APPROVED') {
      this._props.status = 'APPROVED';
      this.recordOutbox('prm.order.approved', {
        orderId: this._props.id,
        totalAmount: this._props.totalAmount,
        tier,
        approverName
      });
    } else {
      this._props.status = 'REJECTED';
      this._props.rejectionReason = comments ?? 'Rejected by approver';
      this.recordOutbox('prm.order.rejected', {
        orderId: this._props.id,
        tier,
        approverName,
        reason: this._props.rejectionReason
      });
    }
  }

  dispatchToVendor(expectedDeliveryDate?: Date | null): void {
    if (this._props.status !== 'APPROVED') {
      throw new Error(`Only APPROVED orders can be dispatched to vendor. Current status: ${this._props.status}`);
    }

    this._props.status = 'ORDERED';
    this._props.orderedAt = new Date();
    this._props.expectedDeliveryDate = expectedDeliveryDate ?? null;

    this.recordOutbox('prm.order.ordered', {
      orderId: this._props.id,
      vendor: this._props.vendor,
      orderedAt: this._props.orderedAt.toISOString(),
      expectedDeliveryDate: this._props.expectedDeliveryDate?.toISOString() ?? null
    });
  }

  recordDelivery(
    receiptInput: Omit<DeliveryReceipt, 'id' | 'orderId' | 'receivedAt'> & { receivedAt?: Date }
  ): DeliveryReceipt {
    if (this._props.status !== 'ORDERED' && this._props.status !== 'PARTIALLY_DELIVERED') {
      throw new Error('Deliveries can only be recorded for ORDERED or PARTIALLY_DELIVERED orders');
    }

    const receipt: DeliveryReceipt = {
      id: crypto.randomUUID(),
      orderId: this._props.id,
      receiptNumber: receiptInput.receiptNumber,
      receivedAt: receiptInput.receivedAt ?? new Date(),
      receivedById: receiptInput.receivedById,
      itemsReceived: [...receiptInput.itemsReceived],
      supplierRating: receiptInput.supplierRating,
      notes: receiptInput.notes ?? null
    };

    this._props.deliveries?.push(receipt);

    // Evaluate fulfillment status against total ordered quantities
    const totalOrdered = (this._props.items ?? []).reduce((acc, i) => acc + i.quantity, 0);
    const totalReceived = (this._props.deliveries ?? []).flatMap(d => d.itemsReceived)
      .filter(i => i.condition === 'ACCEPTED')
      .reduce((acc, i) => acc + i.quantityReceived, 0);

    if (totalReceived >= totalOrdered && totalOrdered > 0) {
      this._props.status = 'FULFILLED';
      this._props.fulfilledAt = receipt.receivedAt;
      this.recordOutbox('prm.order.fulfilled', {
        orderId: this._props.id,
        totalOrdered,
        totalReceived,
        fulfilledAt: receipt.receivedAt.toISOString()
      });
    } else {
      this._props.status = 'PARTIALLY_DELIVERED';
      this.recordOutbox('prm.order.delivery_received', {
        orderId: this._props.id,
        receiptNumber: receipt.receiptNumber,
        itemsReceivedCount: receipt.itemsReceived.length,
        supplierRating: receipt.supplierRating
      });
    }

    return receipt;
  }

  cancel(reason: string): void {
    if (this._props.status === 'FULFILLED') {
      throw new Error('Cannot cancel already fulfilled order');
    }
    if (this._props.status === 'CANCELLED') {
      throw new Error('Order is already cancelled');
    }

    this._props.status = 'CANCELLED';
    this.recordOutbox('prm.order.cancelled', {
      orderId: this._props.id,
      reason
    });
  }

  private recordOutbox(eventType: string, payload: Record<string, unknown>): void {
    this._outbox.push({
      id: crypto.randomUUID(),
      aggregateType: 'PurchaseOrder',
      aggregateId: this._props.id,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
      published: false
    });
  }
}
