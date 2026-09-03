export * from './domain/procurement-service.js';
export * from './domain/purchase-order-aggregate.js';

export const PrmModule = {
  id: 'module-prm',
  version: '1.0.0',
  async onInit(ctx: any) {
    ctx.registerNavigation({
      id: 'prm-menu',
      title: 'Procurement & Requests',
      path: '/prm',
      permission: 'prm:request:read'
    });
  },
  async onStart() {},
  async onStop() {}
};
