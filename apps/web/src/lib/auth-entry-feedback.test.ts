import { describe, it, expect } from 'vitest';
import { AUTH_ENTRY_FEEDBACK_KEY } from './auth-entry-feedback';

describe('auth-entry-feedback', () => {
  it('exports AUTH_ENTRY_FEEDBACK_KEY as a non-empty string', () => {
    expect(AUTH_ENTRY_FEEDBACK_KEY).toBe('routine-auth-just-signed-in');
  });
});
