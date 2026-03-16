// ============================================================
// MSW Test Server — Mock Service Worker server for Jest tests
// ============================================================

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create server with default handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test (to remove any per-test overrides)
afterEach(() => server.resetHandlers());

// Clean up server after all tests
afterAll(() => server.close());
