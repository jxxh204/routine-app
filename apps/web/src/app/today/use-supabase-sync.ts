import { useCallback, useEffect } from 'react';
import { formatKoreanTime } from '@/lib/routine-time';
import { supabase } from '@/lib/supabase';
import type { Routine } from './types';
import { buddyUserId, getTodayDateKey } from './constants';

export async function getAuthHeaders() {
  if (!supabase) return null;

  const [{ data: userRes }, { data: sessionRes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const userId = userRes.user?.id;
  const accessToken = sessionRes.session?.access_token;
  if (!userId || !accessToken) return null;

  return {
    userId,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function syncTodayFromSupabase(baseRoutines: Routine[]) {
  const auth = await getAuthHeaders();
  if (!auth) return null;

  const today = getTodayDateKey();

  const myResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs?user_id=eq.${auth.userId}&challenge_date=eq.${today}`,
    { headers: auth.headers },
  );

  if (!myResponse.ok) return null;

  const myRows = (await myResponse.json()) as Array<{
    routine_key: string;
    done_at: string | null;
  }>;

  let buddyRows: Array<{ routine_key: string }> = [];

  if (buddyUserId) {
    const buddyResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs?select=routine_key&user_id=eq.${buddyUserId}&challenge_date=eq.${today}`,
      { headers: auth.headers },
    );

    if (buddyResponse.ok) {
      buddyRows = (await buddyResponse.json()) as Array<{ routine_key: string }>;
    }
  }

  return baseRoutines.map((routine) => {
    if (!routine.isDefault) {
      return { ...routine, doneByBuddy: false };
    }

    const myRow = myRows.find((item) => item.routine_key === routine.id);
    const buddyDone = buddyRows.some((item) => item.routine_key === routine.id);

    return {
      ...routine,
      doneByMe: Boolean(myRow),
      doneByBuddy: buddyDone,
      doneAt: myRow?.done_at ? formatKoreanTime(new Date(myRow.done_at)) : routine.doneAt,
    };
  });
}

export async function saveCertificationToSupabase(routineKey: string, doneAtIso: string) {
  const auth = await getAuthHeaders();
  if (!auth) return false;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs`,
    {
      method: 'POST',
      headers: {
        ...auth.headers,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: auth.userId,
        challenge_date: getTodayDateKey(),
        routine_key: routineKey,
        done_at: doneAtIso,
      }),
    },
  );

  return response.ok;
}

export function useSupabaseSync(
  routines: Routine[],
  setRoutines: React.Dispatch<React.SetStateAction<Routine[]>>,
  setSyncMessage: React.Dispatch<React.SetStateAction<string>>,
) {
  const refreshFromSupabase = useCallback(async () => {
    setRoutines((prev) => prev);

    const synced = await syncTodayFromSupabase(routines);

    if (!synced) {
      setSyncMessage('로컬 저장 모드 (로그인 시 Supabase 동기화)');
      return;
    }

    setRoutines(synced);
    setSyncMessage('Supabase 동기화됨');
  }, [routines, setRoutines, setSyncMessage]);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refreshFromSupabase();
    }, 0);

    const fallbackPolling = setInterval(() => {
      void refreshFromSupabase();
    }, 60_000);

    let cleanupRealtime: (() => void) | null = null;

    const setupRealtime = async () => {
      const client = supabase;
      if (!client) return;

      const auth = await getAuthHeaders();
      if (!auth) return;

      const channel = client
        .channel(`challenge-logs-${auth.userId}-${getTodayDateKey()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'challenge_logs',
            filter: `challenge_date=eq.${getTodayDateKey()}`,
          },
          () => {
            void refreshFromSupabase();
          },
        )
        .subscribe();

      cleanupRealtime = () => {
        void client.removeChannel(channel);
      };
    };

    void setupRealtime();

    return () => {
      clearTimeout(kickoff);
      clearInterval(fallbackPolling);
      cleanupRealtime?.();
    };
  }, [refreshFromSupabase]);

  return { refreshFromSupabase };
}
