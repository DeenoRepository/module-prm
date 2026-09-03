import { describe, it, expect } from 'vitest';
import { PurchaseOrderAggregate } from './purchase-order-aggregate.js';

describe('PurchaseOrderAggregate', () => {
  const baseOrder = {
    id: 'po-100',
    orderNumber: 'PO-2026-001',
    vendor: 'Industrial Hydraulics Inc.',
    totalAmount: 0,
    requestedById: 'user-requester'
  };

  it('creates purchase order in DRAFT status with outbox event', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);

    expect(aggregate.id).toBe('po-100');
    expect(aggregate.status).toBe('DRAFT');
    expect(aggregate.items.length).toBe(0);
    expect(aggregate.approvalHistory.length).toBe(0);
    expect(aggregate.deliveries.length).toBe(0);
    expect(aggregate.outboxEvents.length).toBe(1);
    expect(aggregate.outboxEvents[0].eventType).toBe('prm.order.created');
  });

  it('adds items and updates total amount', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);

    const item1 = aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'PUMP-SEAL-50',
      name: 'Mechanical Seal 50mm',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 200
    });

    expect(item1.totalPrice).toBe(1000);
    expect(aggregate.totalAmount).toBe(1000);

    const item2 = aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000002',
      sku: 'HYDR-VALVE-10',
      name: 'Relief Valve 10bar',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 1500
    });

    expect(item2.totalPrice).toBe(3000);
    expect(aggregate.totalAmount).toBe(4000);
  });

  it('throws when adding items with invalid prices or outside DRAFT state', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);

    expect(() => aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'ITEM-1',
      name: 'Item 1',
      quantity: 0,
      unit: 'pcs',
      unitPrice: 100
    })).toThrow('quantity must be positive');

    expect(() => aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'ITEM-1',
      name: 'Item 1',
      quantity: 1,
      unit: 'pcs',
      unitPrice: -50
    })).toThrow('cannot be negative');

    const orderToSubmit = PurchaseOrderAggregate.create(baseOrder);
    orderToSubmit.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'ITEM-1',
      name: 'Item 1',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100
    });
    orderToSubmit.submit();
    expect(() => orderToSubmit.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'ITEM-2',
      name: 'Item 2',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100
    })).toThrow('only be added to DRAFT orders');
  });

  it('submits order and records outbox event with tier info', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    expect(() => aggregate.submit()).toThrow('Cannot submit order with no items');

    aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'VALVE-10',
      name: 'Valve',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 2500 // total: 5000 -> CHIEF_ENGINEER tier
    });

    aggregate.submit();
    expect(aggregate.status).toBe('SUBMITTED');
    expect(() => aggregate.submit()).toThrow('Only DRAFT orders can be submitted');

    const submitEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.submitted');
    expect(submitEvent).toBeDefined();
    expect(submitEvent?.payload.requiredApprovalTier).toBe('CHIEF_ENGINEER');
  });

  it('approves order when tier is sufficient and records approved outbox event', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    expect(() => aggregate.recordApproval(
      '00000000-0000-0000-0000-000000000099',
      'Dept Head John',
      'DEPARTMENT_HEAD',
      'APPROVED'
    )).toThrow('Only SUBMITTED orders can be reviewed');

    aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'VALVE-10',
      name: 'Valve',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 2500 // total: 5000
    });
    aggregate.submit();

    // Department head only has up to 1000 authority
    expect(() => aggregate.recordApproval(
      '00000000-0000-0000-0000-000000000099',
      'Dept Head John',
      'DEPARTMENT_HEAD',
      'APPROVED'
    )).toThrow('Approval tier "DEPARTMENT_HEAD" lacks authority');

    // Chief Engineer has up to 10000 authority
    aggregate.recordApproval(
      '00000000-0000-0000-0000-000000000088',
      'Chief Engineer Alex',
      'CHIEF_ENGINEER',
      'APPROVED',
      'Approved for Q2 planned overhaul'
    );

    expect(aggregate.status).toBe('APPROVED');
    expect(aggregate.approvalHistory.length).toBe(1);
    expect(aggregate.approvalHistory[0].decision).toBe('APPROVED');

    const approvedEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.approved');
    expect(approvedEvent).toBeDefined();
    expect(approvedEvent?.payload.approverName).toBe('Chief Engineer Alex');
  });

  it('rejects order and records rejection reason', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'BOLT-10',
      name: 'Bolt',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 10 // total: 100
    });
    aggregate.submit();

    aggregate.recordApproval(
      '00000000-0000-0000-0000-000000000099',
      'Dept Head John',
      'DEPARTMENT_HEAD',
      'REJECTED',
      'Budget freeze in effect'
    );

    expect(aggregate.status).toBe('REJECTED');
    expect(aggregate.props.rejectionReason).toBe('Budget freeze in effect');

    const rejectedEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.rejected');
    expect(rejectedEvent).toBeDefined();
  });

  it('dispatches approved order to vendor and records ordered outbox event', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    expect(() => aggregate.dispatchToVendor()).toThrow('Only APPROVED orders can be dispatched');

    aggregate.addItem({
      nomenclatureId: '00000000-0000-0000-0000-000000000001',
      sku: 'BOLT-10',
      name: 'Bolt',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 10
    });
    aggregate.submit();
    aggregate.recordApproval(
      '00000000-0000-0000-0000-000000000099',
      'Dept Head John',
      'DEPARTMENT_HEAD',
      'APPROVED'
    );

    const expectedDate = new Date('2026-07-01');
    aggregate.dispatchToVendor(expectedDate);

    expect(aggregate.status).toBe('ORDERED');
    expect(aggregate.props.expectedDeliveryDate).toEqual(expectedDate);

    const orderedEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.ordered');
    expect(orderedEvent).toBeDefined();
    expect(orderedEvent?.payload.vendor).toBe('Industrial Hydraulics Inc.');
  });

  it('records partial and full deliveries and updates status accordingly', () => {
    const nomId = '00000000-0000-0000-0000-000000000001';
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    expect(() => aggregate.recordDelivery({
      receiptNumber: 'REC-ERR',
      receivedById: '00000000-0000-0000-0000-000000000005',
      itemsReceived: [],
      supplierRating: 5
    })).toThrow('Deliveries can only be recorded for ORDERED or PARTIALLY_DELIVERED');

    aggregate.addItem({
      nomenclatureId: nomId,
      sku: 'PUMP-50',
      name: 'Pump',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 500
    });
    aggregate.submit();
    aggregate.recordApproval('00000000-0000-0000-0000-000000000088', 'Alex', 'CHIEF_ENGINEER', 'APPROVED');
    aggregate.dispatchToVendor();

    // Partial delivery (6 out of 10)
    aggregate.recordDelivery({
      receiptNumber: 'REC-001',
      receivedById: '00000000-0000-0000-0000-000000000005',
      itemsReceived: [{ nomenclatureId: nomId, quantityReceived: 6, condition: 'ACCEPTED' }],
      supplierRating: 5
    });

    expect(aggregate.status).toBe('PARTIALLY_DELIVERED');
    expect(aggregate.deliveries.length).toBe(1);

    // Final delivery (4 out of 10)
    aggregate.recordDelivery({
      receiptNumber: 'REC-002',
      receivedById: '00000000-0000-0000-0000-000000000005',
      itemsReceived: [{ nomenclatureId: nomId, quantityReceived: 4, condition: 'ACCEPTED' }],
      supplierRating: 4
    });

    expect(aggregate.status).toBe('FULFILLED');
    expect(aggregate.props.fulfilledAt).not.toBeNull();

    const fulfilledEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.fulfilled');
    expect(fulfilledEvent).toBeDefined();
    expect(fulfilledEvent?.payload.totalReceived).toBe(10);

    // Cannot cancel fulfilled order
    expect(() => aggregate.cancel('late cancel')).toThrow('Cannot cancel already fulfilled order');
  });

  it('cancels order and prevents cancellation of fulfilled or already cancelled orders', () => {
    const aggregate = PurchaseOrderAggregate.create(baseOrder);
    aggregate.cancel('Supplier went out of business');
    expect(aggregate.status).toBe('CANCELLED');

    const cancelEvent = aggregate.outboxEvents.find(e => e.eventType === 'prm.order.cancelled');
    expect(cancelEvent).toBeDefined();

    expect(() => aggregate.cancel('already cancelled')).toThrow('Order is already cancelled');
  });
});
