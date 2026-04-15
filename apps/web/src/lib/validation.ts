import { z } from 'zod/v4';

/** 허용된 기본 루틴 키 */
export const ALLOWED_ROUTINE_KEYS = ['wake', 'lunch', 'sleep'] as const;
export type DefaultRoutineKey = (typeof ALLOWED_ROUTINE_KEYS)[number];

/** 커스텀 루틴 키: 영문소문자+숫자+하이픈, 3~30자 */
const customRoutineKeyPattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** routineKey: 기본 3종 또는 커스텀 패턴 */
export const routineKeySchema = z
  .string()
  .min(1)
  .refine(
    (val) =>
      (ALLOWED_ROUTINE_KEYS as readonly string[]).includes(val) ||
      customRoutineKeyPattern.test(val),
    { message: 'Invalid routine key' },
  );

/** YYYY-MM-DD 형식의 날짜 키 */
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date key format');

/** ISO 8601 날짜 문자열 (유효한 Date로 파싱 가능해야 함) */
export const isoDateStringSchema = z
  .string()
  .refine((val) => !Number.isNaN(new Date(val).getTime()), {
    message: 'Invalid ISO date string',
  });

/** UUID v4 형식 */
export const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'Invalid UUID',
);

/** 친구 코드: 6~8자 영문대문자+숫자 */
export const friendCodeSchema = z
  .string()
  .min(6)
  .max(8)
  .regex(/^[A-Z0-9]+$/, 'Invalid friend code');

// ─── API Request Body Schemas ───

export const challengeCompleteBodySchema = z.object({
  routineKey: routineKeySchema,
  doneAtIso: isoDateStringSchema,
});

export const proofPathBodySchema = z.object({
  dateKey: dateKeySchema,
  routineKey: routineKeySchema,
  proofImagePath: z.string().min(1),
});

export const friendRequestBodySchema = z.object({
  friendCode: z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .pipe(friendCodeSchema),
});

export const nudgeBodySchema = z.object({
  targetId: uuidSchema,
  routineKey: routineKeySchema,
});

/** Supabase Storage 경로에 사용할 수 있는 안전한 문자열인지 검증 */
export function sanitizeStoragePath(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}
