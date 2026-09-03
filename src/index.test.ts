import { describe, it, expect, vi } from 'vitest';
import { PrmModule } from './index.js';

describe('PrmModule lifecycle and exports', () => {
  it('registers navigation in onInit', async () => {
    const registerNavigation = vi.fn();
    const ctx = { registerNavigation };

    await PrmModule.onInit(ctx);
    expect(registerNavigation).toHaveBeenCalledWith({
      id: 'prm-menu',
      title: 'Procurement & Requests',
      path: '/prm',
      permission: 'prm:order:read'
    });
  });

  it('runs onStart and onStop without errors', async () => {
    await expect(PrmModule.onStart()).resolves.toBeUndefined();
    await expect(PrmModule.onStop()).resolves.toBeUndefined();
  });
});
