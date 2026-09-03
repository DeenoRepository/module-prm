export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'FULFILLED' | 'REJECTED';

export interface PurchaseOrderProps {
  id: string;
  vendor: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  approvedBy?: string;
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

  constructor(props: PurchaseOrderProps) {
    this._props = { ...props };
  }

  static create(props: Omit<PurchaseOrderProps, 'status'>): PurchaseOrderAggregate {
    const aggregate = new PurchaseOrderAggregate({
      ...props,
      status: 'DRAFT'
    });

    aggregate.recordOutbox('prm.order.created', {
      orderId: props.id,
      totalAmount: props.totalAmount,
      vendor: props.vendor
    });

    return aggregate;
  }

  get props(): Readonly<PurchaseOrderProps> {
    return Object.freeze({ ...this._props });
  }

  get outboxEvents(): readonly PrmOutboxRecord[] {
    return this._outbox;
  }

  submit(): void {
    if (this._props.status !== 'DRAFT') {
      throw new Error('Only DRAFT orders can be submitted');
    }
    this._props.status = 'SUBMITTED';
  }

  approve(approver: string): void {
    if (this._props.status !== 'SUBMITTED') {
      throw new Error('Only SUBMITTED orders can be approved');
    }
    this._props.status = 'APPROVED';
    this._props.approvedBy = approver;

    this.recordOutbox('prm.order.approved', {
      orderId: this._props.id,
      totalAmount: this._props.totalAmount,
      approvedBy: approver
    });
  }

  markReceived(): void {
    if (this._props.status !== 'APPROVED') {
      throw new Error('Only APPROVED orders can be fulfilled/received');
    }
    this._props.status = 'FULFILLED';
    this.recordOutbox('prm.order.received', {
      orderId: this._props.id,
      vendor: this._props.vendor
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
