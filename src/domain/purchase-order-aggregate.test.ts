import { describe, it, expect } from 'vitest';
import { PurchaseOrderAggregate } from './purchase-order-aggregate.js';

describe('PurchaseOrderAggregate Domain & Outbox (TDD)', () => {
  it('creates purchase order in DRAFT state and emits creation event', () => {
    const po = PurchaseOrderAggregate.create({
      id: 'PO-501',
      vendor: 'Industrial Parts LLC',
      totalAmount: 45000
    });

    expect(po.props.status).toBe('DRAFT');
    expect(po.outboxEvents[0].eventType).toBe('prm.order.created');
  });

  it('submits, approves and fulfills purchase order with outbox events', () => {
    const po = PurchaseOrderAggregate.create({
      id: 'PO-502',
      vendor: 'Global Bearings Inc',
      totalAmount: 120000
    });

    po.submit();
    expect(po.props.status).toBe('SUBMITTED');

    po.approve('Director Smirnov');
    expect(po.props.status).toBe('APPROVED');
    expect(po.props.approvedBy).toBe('Director Smirnov');

    po.markReceived();
    expect(po.props.status).toBe('FULFILLED');
    expect(po.outboxEvents.some(e => e.eventType === 'prm.order.received')).toBe(true);
  });
});
