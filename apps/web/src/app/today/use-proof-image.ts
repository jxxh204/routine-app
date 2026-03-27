import { type ChangeEvent, type Dispatch, type SetStateAction, useRef, useState, useEffect } from 'react';
import { formatKoreanTime, getNowMinute, isInTimeWindow } from '@/lib/routine-time';
import { readProofImage, saveProofImage } from '@/lib/proof-image-store';
import type { Routine } from './types';
import { getTodayDateKey } from './constants';
import { saveCertificationToSupabase } from './use-supabase-sync';

export function useProofImage(
  routines: Routine[],
  setRoutines: Dispatch<SetStateAction<Routine[]>>,
  setSyncMessage: Dispatch<SetStateAction<string>>,
  refreshFromSupabase: () => Promise<void>,
) {
  const [pendingCaptureRoutineId, setPendingCaptureRoutineId] = useState<string | null>(null);
  const [thumbMenuRoutineId, setThumbMenuRoutineId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbLongPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const dateKey = getTodayDateKey();

    const hydrateProofImages = async () => {
      const imagePairs = await Promise.all(
        routines
          .filter((routine) => routine.doneByMe)
          .map(async (routine) => ({
            id: routine.id,
            image: await readProofImage(dateKey, routine.id).catch(() => null),
          })),
      );

      const imageMap = new Map(imagePairs.filter((item) => item.image).map((item) => [item.id, item.image as string]));
      if (imageMap.size === 0) return;

      setRoutines((prev) =>
        prev.map((routine) => {
          const image = imageMap.get(routine.id);
          if (!image || routine.proofImage === image) return routine;
          return { ...routine, proofImage: image };
        }),
      );
    };

    void hydrateProofImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (thumbLongPressTimerRef.current) {
        window.clearTimeout(thumbLongPressTimerRef.current);
      }
    };
  }, []);

  const finalizePhotoCertification = async (routineId: string, imageDataUrl: string) => {
    const now = new Date();
    const doneAtText = formatKoreanTime(now);
    const dateKey = getTodayDateKey();
    const target = routines.find((routine) => routine.id === routineId);

    await saveProofImage(dateKey, routineId, imageDataUrl).catch(() => {});

    setRoutines((prev) =>
      prev.map((routine) =>
        routine.id === routineId
          ? { ...routine, doneByMe: true, doneAt: doneAtText, proofImage: imageDataUrl }
          : routine,
      ),
    );

    setPendingCaptureRoutineId(null);

    if (!target) {
      setSyncMessage('로컬 저장 완료');
      return;
    }

    if (!target.isDefault) {
      setSyncMessage('사진 인증 저장 완료');
      return;
    }

    try {
      const ok = await saveCertificationToSupabase(target.id, now.toISOString());
      setSyncMessage(ok ? '사진 인증 + Supabase 저장 완료' : '사진 인증 로컬 저장 완료 (Supabase 미연동)');
      if (ok) void refreshFromSupabase();
    } catch {
      setSyncMessage('사진 인증 로컬 저장 완료 (Supabase 저장 중 오류)');
    }
  };

  const openCameraForRoutine = (id: string) => {
    const target = routines.find((routine) => routine.id === id);
    if (!target) return;

    const nowMin = getNowMinute();
    const inWindow = isInTimeWindow(nowMin, target.startMinute, target.endMinute);
    if (!inWindow || target.doneByMe) return;

    setPendingCaptureRoutineId(id);
    fileInputRef.current?.click();
  };

  const retakeRoutinePhoto = (id: string) => {
    setThumbMenuRoutineId(null);
    setPendingCaptureRoutineId(id);
    fileInputRef.current?.click();
  };

  const startThumbLongPress = (id: string) => {
    if (thumbLongPressTimerRef.current) {
      window.clearTimeout(thumbLongPressTimerRef.current);
    }
    thumbLongPressTimerRef.current = window.setTimeout(() => {
      setThumbMenuRoutineId(id);
    }, 420);
  };

  const cancelThumbLongPress = () => {
    if (thumbLongPressTimerRef.current) {
      window.clearTimeout(thumbLongPressTimerRef.current);
      thumbLongPressTimerRef.current = null;
    }
  };

  const onPickPhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!pendingCaptureRoutineId) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      await finalizePhotoCertification(pendingCaptureRoutineId, result);
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  return {
    pendingCaptureRoutineId,
    thumbMenuRoutineId,
    setThumbMenuRoutineId,
    previewImage,
    setPreviewImage,
    fileInputRef,
    openCameraForRoutine,
    finalizePhotoCertification,
    onPickPhotoFile,
    retakeRoutinePhoto,
    startThumbLongPress,
    cancelThumbLongPress,
  };
}
