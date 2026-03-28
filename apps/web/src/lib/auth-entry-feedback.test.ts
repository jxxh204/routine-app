import { describe, it, expect } from 'vitest';
import { AUTH_ENTRY_FEEDBACK_KEY, AUTH_MOCK_LOGIN_KEY } from './auth-entry-feedback';

describe('auth-entry-feedback', () => {
  it('exports AUTH_ENTRY_FEEDBACK_KEY as a non-empty string', () => {
    expect(AUTH_ENTRY_FEEDBACK_KEY).toBe('routine-auth-just-signed-in');
  });

  it('exports AUTH_MOCK_LOGIN_KEY as a non-empty string', () => {
    expect(AUTH_MOCK_LOGIN_KEY).toBe('routine-auth-mock-login');
  });

  it('keys are distinct', () => {
    expect(AUTH_ENTRY_FEEDBACK_KEY).not.toBe(AUTH_MOCK_LOGIN_KEY);
  });
});
