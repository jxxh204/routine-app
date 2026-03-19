const FRIEND_CODE_RE = /^[A-Z0-9]{6,8}$/;

export function normalizeFriendCode(raw: string) {
  return raw.trim().toUpperCase();
}

export function isValidFriendCode(raw: string) {
  return FRIEND_CODE_RE.test(normalizeFriendCode(raw));
}
