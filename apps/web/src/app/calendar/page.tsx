'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';

import { AuthRequired } from '@/components/auth-required';
import { PageShell } from '@/components/ui';
import { getMonthMatrix, parseHistoryEntries, toDateKey, type DoneItem } from '@/lib/calendar-history';
import { readProofImage } from '@/lib/proof-image-store';
import { getProofImageUrl } from '@/lib/proof-image-upload';
import { supabase } from '@/lib/supabase';
import { FriendCalendarDetail } from '@/components/friend-calendar-detail';

const STORAGE_PREFIX = 'routine-challenge-v1:';

function getRoutineTypeLabel(id: string) {
  if (id === 'wake' || id === 'lunch' || id === 'sleep') return '기본';
  return '커스텀';
}

function readHistory() {
  if (typeof window === 'undefined') return [] as Array<{ date: string; items: DoneItem[] }>;

  const entries: Array<{ key: string; value: string | null }> = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    entries.push({ key, value: window.localStorage.getItem(key) });
  }

  return parseHistoryEntries(entries, STORAGE_PREFIX);
}

export default function CalendarPage() {
  const [history] = useState(() => readHistory());
  const byDate = useMemo(() => new Map(history.map((row) => [row.date, row.items])), [history]);

  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateKey(new Date()));
  const [proofByItemKey, setProofByItemKey] = useState<Record<string, string>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setMyUserId(data.user?.id ?? null);
    });
  }, []);

  const days = useMemo(() => getMonthMatrix(month), [month]);
  const monthTitle = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const selectedItems = useMemo(
    () => (selectedDate ? byDate.get(selectedDate) ?? [] : []),
    [selectedDate, byDate],
  );
  const selectedProofCount = useMemo(
    () =>
      selectedItems.filter((item) => {
        const key = selectedDate ? `${selectedDate}:${item.id}` : '';
        return Boolean(item.proofImage || (key && proofByItemKey[key]));
      }).length,
    [selectedDate, selectedItems, proofByItemKey],
  );
  const monthDoneCount = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
    return history
      .filter((entry) => entry.date.startsWith(prefix))
      .reduce((acc, entry) => acc + entry.items.length, 0);
  }, [history, month]);

  useEffect(() => {
    if (!selectedDate || selectedItems.length === 0) return;

    let cancelled = false;

    const hydrateProofImages = async () => {
      const nextEntries = await Promise.all(
        selectedItems.map(async (item) => {
          const itemKey = `${selectedDate}:${item.id}`;
          // 1. 로컬(IndexedDB) 우선
          const localImage = item.proofImage ?? (await readProofImage(selectedDate, item.id).catch(() => null));
          if (localImage) return [itemKey, localImage] as const;
          // 2. 서버(Supabase Storage) fallback — proofImagePath가 있으면 사용, 없으면 규칙 기반 경로
          const storagePath = item.proofImagePath ?? (myUserId ? `${myUserId}/${selectedDate}/${item.id}.jpg` : null);
          if (storagePath) {
            const serverUrl = await getProofImageUrl(storagePath).catch(() => null);
            if (serverUrl) return [itemKey, serverUrl] as const;
          }
          return null;
        }),
      );

      if (cancelled) return;

      setProofByItemKey((prev) => {
        const merged = { ...prev };
        for (const entry of nextEntries) {
          if (!entry) continue;
          merged[entry[0]] = entry[1];
        }
        return merged;
      });
    };

    void hydrateProofImages();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedItems, myUserId]);

  return (
    <AuthRequired>
      <PageShell>
        <section className="grid gap-ds-section-gap">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-ds-text-faint uppercase">
                HISTORY
              </p>
              <h1 className="mt-ds-tight mb-0 text-[22px] font-semibold tracking-tight text-ds-text">
                캘린더
              </h1>
            </div>
{/* '오늘으로' 버튼 삭제: 하단 네비로 이동 가능 + 라우팅 복귀 시 상태 초기화 버그 유발 */}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ds-surface rounded-ds-md pad-item flex flex-col gap-ds-tight">
              <span className="text-[20px] font-bold text-ds-text">{monthDoneCount}</span>
              <span className="text-[11px] text-ds-text-faint font-medium">이번 달 완료</span>
            </div>
            <div className="bg-ds-surface rounded-ds-md pad-item flex flex-col gap-ds-tight">
              <span className="text-[20px] font-bold text-ds-text">{history.length}</span>
              <span className="text-[11px] text-ds-text-faint font-medium">기록된 날짜</span>
            </div>
          </div>

          {/* Month nav */}
          <div className="flex justify-between items-center">
            <Button
              type="text"
              size="small"
              onClick={() => {
                setSelectedDate(null);
                setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              className="!text-[14px] !px-[10px] !py-[6px]"
            >
              ←
            </Button>
            <span className="text-[16px] font-semibold text-ds-text">{monthTitle}</span>
            <Button
              type="text"
              size="small"
              onClick={() => {
                setSelectedDate(null);
                setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}
              className="!text-[14px] !px-[10px] !py-[6px]"
            >
              →
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="bg-ds-surface rounded-ds-lg pad-card">
            <div className="grid grid-cols-7 gap-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} className="text-center text-ds-text-faint text-[11px] font-medium pb-1">
                  {w}
                </div>
              ))}

              {days.map((date) => {
                const key = toDateKey(date);
                const count = byDate.get(key)?.length ?? 0;
                const inMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
                const isSelected = selectedDate === key;
                const isEnabled = inMonth && count > 0;

                return (
                  <button
                    key={key}
                    className={`
                      flex flex-col items-center justify-center gap-[3px] min-h-[44px]
                      border-0 rounded-ds-sm p-1 transition-colors duration-150
                      ${!inMonth ? 'opacity-20' : ''}
                      ${isEnabled ? 'bg-ds-surface-strong cursor-pointer' : 'bg-transparent cursor-default opacity-40'}
                      ${isSelected ? 'bg-ds-accent-soft outline outline-2 -outline-offset-2 outline-ds-accent' : ''}
                    `}
                    onClick={() => isEnabled && setSelectedDate(key)}
                    disabled={!isEnabled}
                  >
                    <span className="text-[14px] font-medium text-ds-text">
                      {inMonth ? date.getDate() : ''}
                    </span>
                    {count > 0 && inMonth ? (
                      <span className="w-1 h-1 rounded-ds-pill bg-ds-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          {selectedDate ? (
            <div className="bg-ds-surface rounded-ds-lg pad-card grid gap-ds-card-gap">
              <div className="flex justify-between items-center">
                <span className="text-[15px] font-semibold text-ds-text">{selectedDate}</span>
                <div className="flex gap-ds-inline">
                  <span className="inline-flex items-center h-[22px] rounded-ds-pill px-2 text-[11px] font-medium bg-ds-green-soft text-ds-green">
                    {selectedItems.length}개 완료
                  </span>
                  {selectedProofCount > 0 ? (
                    <span className="inline-flex items-center h-[22px] rounded-ds-pill px-2 text-[11px] font-medium bg-ds-blue-soft text-ds-blue">
                      {selectedProofCount}장 인증
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedItems.length === 0 ? (
                <p className="m-0 text-ds-text-faint text-[13px]">완료 내역이 없습니다.</p>
              ) : (
                <div className="grid gap-ds-inline">
                  {selectedItems.map((item) => {
                    const image = selectedDate ? proofByItemKey[`${selectedDate}:${item.id}`] ?? item.proofImage : item.proofImage;

                    return (
                      <article
                        key={`${selectedDate}-${item.id}-${item.doneAt ?? ''}`}
                        className="bg-ds-surface-strong rounded-ds-md pad-item grid gap-ds-inline"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="m-0 text-[14px] font-medium text-ds-text">
                              {item.title ?? item.id}
                            </p>
                            <p className="mt-ds-tight mb-0 text-[12px] text-ds-text-faint">
                              {item.doneAt ?? '시간 미기록'}
                            </p>
                          </div>
                          <span className="inline-flex items-center h-5 rounded-ds-pill px-[7px] text-[10px] font-medium bg-ds-accent-soft text-ds-accent shrink-0">
                            {getRoutineTypeLabel(item.id)}
                          </span>
                        </div>
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- base64 proof image
                          <img
                            src={image}
                            alt="인증"
                            className="w-14 h-14 rounded-ds-sm object-cover"
                          />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* 친구 인증 내역 */}
              <FriendCalendarDetail dateKey={selectedDate} />
            </div>
          ) : (
            <p className="m-0 text-ds-text-faint text-[13px] text-center">
              캘린더에서 날짜를 선택하면 완료 루틴을 확인할 수 있어요.
            </p>
          )}
        </section>
      </PageShell>
    </AuthRequired>
  );
}
