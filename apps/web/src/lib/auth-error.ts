export function resolveAuthFailureMessage(error: string | null, errorDescription: string | null) {
  const normalizedError = (error ?? '').toLowerCase();
  const normalizedDesc = (errorDescription ?? '').toLowerCase();

  if (
    normalizedError === 'access_denied' ||
    normalizedDesc.includes('cancel') ||
    normalizedDesc.includes('canceled') ||
    normalizedDesc.includes('cancelled')
  ) {
    return '로그인이 취소되었어요. 원하시면 다시 시도해 주세요.';
  }

  if (normalizedError || normalizedDesc) {
    return '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
  }

  return '';
}
