import { vi } from "vitest";

export function mockRequest(overrides = {}) {
  return { params: {}, query: {}, headers: {}, body: {}, signal: undefined, ...overrides } as any;
}

export function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

export function mockNext() {
  return vi.fn();
}
