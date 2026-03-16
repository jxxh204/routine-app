import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  MD3DarkTheme,
  Provider as PaperProvider,
  Modal,
  Portal,
  Snackbar,
  Switch,
  Text,
  TextInput,
  type MD3Theme,
} from 'react-native-paper';
import { WebView } from 'react-native-webview';

import { getMonthMatrix, hhmmToMinute, minuteToHHMM, toDateKey } from './src/lib/date-time';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
const ALLOWED_HOSTS = (process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

const ONBOARDING_DONE_KEY = 'routine-app:onboarding-done:v1';
const ROUTINES_KEY = 'routine-app:routines:v1';
const NOTI_SETTINGS_KEY = 'routine-app:noti-settings:v1';
const COMPLETION_HISTORY_KEY = 'routine-app:completion-history:v1';

type TabKey = 'today' | 'calendar' | 'settings';

type Routine = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  isDefault: boolean;
};

type NotificationSettings = {
  enabled: boolean;
  wake: number;
  lunch: number;
  sleep: number;
};

type CompletedRoutine = {
  id: string;
  title: string;
  doneAt?: string;
};

type CompletionHistory = Record<string, CompletedRoutine[]>;

const CARD_RADIUS = 14;

const appTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: CARD_RADIUS,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#7cffb2',
    onPrimary: '#0f1115',
    secondary: '#c4cfda',
    background: '#0f1115',
    surface: '#161b21',
    surfaceVariant: '#1f2730',
    outline: '#334050',
    onSurface: '#f5f7fa',
    onSurfaceVariant: '#9aa4af',
    error: '#ff9ba8',
  },
};

const defaultRoutines: Routine[] = [
  { id: 'wake', title: '기상 인증', startMinute: 9 * 60, endMinute: 11 * 60, isDefault: true },
  {
    id: 'lunch',
    title: '식사 인증',
    startMinute: 12 * 60 + 30,
    endMinute: 13 * 60 + 30,
    isDefault: true,
  },
  { id: 'sleep', title: '취침 인증', startMinute: 23 * 60, endMinute: 2 * 60, isDefault: true },
];

const defaultNotiSettings: NotificationSettings = {
  enabled: true,
  wake: 9 * 60,
  lunch: 12 * 60 + 30,
  sleep: 23 * 60,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function formatRange(startMinute: number, endMinute: number) {
  const start = minuteToHHMM(startMinute);
  const end = minuteToHHMM(endMinute);
  if (startMinute < endMinute) return `${start} - ${end}`;
  return `${start} - 다음날 ${end}`;
}

function getParsedUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isAllowedUrl(rawUrl: string) {
  const parsed = getParsedUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol !== 'https:') return false;
  if (ALLOWED_HOSTS.length === 0) return true;
  return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

function mergeWithDefaults(raw: Routine[]) {
  const custom = raw.filter((routine) => !['wake', 'lunch', 'sleep'].includes(routine.id));
  return [...defaultRoutines, ...custom];
}

async function loadRoutines() {
  try {
    const raw = await AsyncStorage.getItem(ROUTINES_KEY);
    if (!raw) return defaultRoutines;
    const parsed = JSON.parse(raw) as Routine[];
    return mergeWithDefaults(parsed);
  } catch {
    return defaultRoutines;
  }
}

async function saveRoutines(routines: Routine[]) {
  await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

async function loadNotiSettings() {
  try {
    const raw = await AsyncStorage.getItem(NOTI_SETTINGS_KEY);
    if (!raw) return defaultNotiSettings;
    const parsed = JSON.parse(raw) as NotificationSettings;
    return { ...defaultNotiSettings, ...parsed };
  } catch {
    return defaultNotiSettings;
  }
}

async function saveNotiSettings(settings: NotificationSettings) {
  await AsyncStorage.setItem(NOTI_SETTINGS_KEY, JSON.stringify(settings));
}

async function loadCompletionHistory() {
  try {
    const raw = await AsyncStorage.getItem(COMPLETION_HISTORY_KEY);
    if (!raw) return {} as CompletionHistory;
    return JSON.parse(raw) as CompletionHistory;
  } catch {
    return {} as CompletionHistory;
  }
}

function buildReminderMinutes(startMinute: number, durationMinute: number, intervalMinute = 30) {
  const results: number[] = [];
  for (let offset = intervalMinute; offset < durationMinute; offset += intervalMinute) {
    results.push((startMinute + offset) % (24 * 60));
  }
  return results;
}

async function scheduleDefaultNotifications(settings: NotificationSettings) {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of existing) {
    if (item.content.data?.source === 'default-routine') {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  if (!settings.enabled) return;

  const list = [
    {
      key: 'wake',
      title: '⏰ 기상 인증 시간',
      body: '09:00~11:00 사이에 기상 인증을 해주세요.',
      minute: settings.wake,
      durationMinute: 120,
    },
    {
      key: 'lunch',
      title: '🍽️ 식사 인증 시간',
      body: '12:30~13:30 사이에 식사 인증을 해주세요.',
      minute: settings.lunch,
      durationMinute: 60,
    },
    {
      key: 'sleep',
      title: '🌙 취침 인증 시간',
      body: '23:00~02:00 사이에 취침 인증을 해주세요.',
      minute: settings.sleep,
      durationMinute: 180,
    },
  ] as const;

  for (const item of list) {
    const reminderMinutes = buildReminderMinutes(item.minute, item.durationMinute);

    const scheduleAt = async (minute: number, isReminder: boolean) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isReminder ? `${item.title} (리마인드)` : item.title,
          body: isReminder
            ? '아직 인증완료가 아니라면 지금 인증해 주세요. 30분 후 다시 알려드릴게요.'
            : item.body,
          data: {
            source: 'default-routine',
            routine: item.key,
            kind: isReminder ? 'reminder' : 'first',
          },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(minute / 60),
          minute: minute % 60,
        },
      });
    };

    await scheduleAt(item.minute, false);
    for (const reminderMinute of reminderMinutes) {
      await scheduleAt(reminderMinute, true);
    }
  }
}

function AppError({ title, detail }: { title: string; detail: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorText}>{detail}</Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('알림 권한을 허용하면 잠금화면/백그라운드에서도 루틴 시간을 놓치지 않아요.');

  const requestPermission = async () => {
    setBusy(true);
    try {
      const current = await Notifications.getPermissionsAsync();
      const permission =
        current.granted ? current : await Notifications.requestPermissionsAsync();

      if (!permission.granted) {
        setMessage('알림 권한이 꺼져 있어요. [설정]에서 알림을 켜주세요.');
        return;
      }

      const settings = await loadNotiSettings();
      await scheduleDefaultNotifications(settings);
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.onboardingWrap}>
        <Text style={styles.onboardingTitle}>루틴 챌린지 시작하기</Text>
        <Text style={styles.onboardingDesc}>{message}</Text>

        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text style={styles.bullet}>• 기본 알림 + 미인증 시 30분 간격 리마인드 자동 등록</Text>
            <Text style={styles.bullet}>• 잠금화면/백그라운드에서도 알림 수신</Text>
            <Text style={styles.bullet}>• 커스텀 루틴 추가해도 기본 3개는 항상 유지</Text>
          </Card.Content>
        </Card>

        <Button mode="contained" buttonColor="#1f3a2d" textColor="#7cffb2" onPress={requestPermission} loading={busy} disabled={busy}>
          {busy ? '처리 중...' : '알림 권한 허용하고 시작'}
        </Button>

        <Button mode="outlined" textColor="#c4cfda" onPress={() => void Linking.openSettings()}>
          설정 열기
        </Button>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  const [routines, setRoutines] = useState<Routine[]>(defaultRoutines);
  const [completionHistory, setCompletionHistory] = useState<CompletionHistory>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<NotificationSettings>(defaultNotiSettings);
  const [wakeInput, setWakeInput] = useState('09:00');
  const [lunchInput, setLunchInput] = useState('12:30');
  const [sleepInput, setSleepInput] = useState('23:00');
  const [statusMsg, setStatusMsg] = useState('');

  const parsedUrl = useMemo(() => (WEB_APP_URL ? getParsedUrl(WEB_APP_URL) : null), []);

  useEffect(() => {
    const bootstrap = async () => {
      const [done, loadedRoutines, loadedSettings, loadedHistory] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_DONE_KEY),
        loadRoutines(),
        loadNotiSettings(),
        loadCompletionHistory(),
      ]);

      setOnboardingDone(done === '1');
      setRoutines(loadedRoutines);
      setCompletionHistory(loadedHistory);
      setSettings(loadedSettings);
      setWakeInput(minuteToHHMM(loadedSettings.wake));
      setLunchInput(minuteToHHMM(loadedSettings.lunch));
      setSleepInput(minuteToHHMM(loadedSettings.sleep));
      setBooting(false);
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!booting) {
      void saveRoutines(routines);
    }
  }, [routines, booting]);

  if (!WEB_APP_URL) {
    return <AppError title="환경변수 누락" detail="EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요." />;
  }

  if (!isAllowedUrl(WEB_APP_URL)) {
    return (
      <AppError
        title="보안 설정 오류"
        detail="HTTPS URL 및 허용 도메인(EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS)을 확인해 주세요."
      />
    );
  }

  if (booting) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7cffb2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return <Onboarding onDone={() => setOnboardingDone(true)} />;
  }

  const addRoutine = () => {
    const title = newTitle.trim();
    const startMinute = hhmmToMinute(newStart);
    const endMinute = hhmmToMinute(newEnd);

    if (!title || startMinute === null || endMinute === null) {
      setStatusMsg('루틴 제목/시간 형식을 확인해 주세요.');
      return;
    }

    setRoutines((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        title,
        startMinute,
        endMinute,
        isDefault: false,
      },
    ]);

    setNewTitle('');
    setStatusMsg('커스텀 루틴이 추가됐어요.');
  };

  const startEditRoutine = (id: string) => {
    const routine = routines.find((item) => item.id === id);
    if (!routine || routine.isDefault) return;

    setEditingId(id);
    setNewTitle(routine.title);
    setNewStart(minuteToHHMM(routine.startMinute));
    setNewEnd(minuteToHHMM(routine.endMinute));
  };

  const applyEditRoutine = () => {
    if (!editingId) return;

    const title = newTitle.trim();
    const startMinute = hhmmToMinute(newStart);
    const endMinute = hhmmToMinute(newEnd);

    if (!title || startMinute === null || endMinute === null) {
      setStatusMsg('수정값을 확인해 주세요.');
      return;
    }

    setRoutines((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? { ...item, title, startMinute, endMinute }
          : item,
      ),
    );

    setEditingId(null);
    setNewTitle('');
    setStatusMsg('커스텀 루틴이 수정됐어요.');
  };

  const removeRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((item) => item.isDefault || item.id !== id));
    setStatusMsg('커스텀 루틴을 삭제했어요.');
  };

  const saveNotificationConfig = async () => {
    const wake = hhmmToMinute(wakeInput);
    const lunch = hhmmToMinute(lunchInput);
    const sleep = hhmmToMinute(sleepInput);

    if (wake === null || lunch === null || sleep === null) {
      setStatusMsg('알림 시간 형식(HH:MM)을 확인해 주세요.');
      return;
    }

    const next: NotificationSettings = {
      ...settings,
      wake,
      lunch,
      sleep,
    };

    setSettings(next);
    await saveNotiSettings(next);
    await scheduleDefaultNotifications(next);
    setStatusMsg(next.enabled ? '알림 시간이 저장됐어요.' : '알림이 꺼져 있어요.');
  };

  const toggleNotifications = async (enabled: boolean) => {
    const next = { ...settings, enabled };
    setSettings(next);
    await saveNotiSettings(next);
    await scheduleDefaultNotifications(next);
    setStatusMsg(enabled ? '알림을 켰어요.' : '알림을 껐어요.');
  };

  const renderToday = () => {
    const pageUrl = `${parsedUrl?.origin ?? ''}/today`;

    return (
      <WebView
        style={styles.webview}
        source={{ uri: pageUrl }}
        startInLoadingState
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedUrl(request.url)) return true;
          void Linking.openURL(request.url);
          return false;
        }}
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7cffb2" />
          </View>
        )}
      />
    );
  };

  const renderCalendar = () => {
    const days = getMonthMatrix(calendarMonth);
    const monthTitle = `${calendarMonth.getFullYear()}년 ${calendarMonth.getMonth() + 1}월`;

    const onPressDay = (date: Date) => {
      const key = toDateKey(date);
      setSelectedDateKey(key);
      setCalendarModalVisible(true);
    };

    const selectedDoneList = selectedDateKey ? (completionHistory[selectedDateKey] ?? []) : [];

    return (
      <ScrollView contentContainerStyle={styles.bodyScroll}>
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <View style={styles.calendarHeaderRow}>
              <Button mode="text" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>이전</Button>
              <Text style={styles.sectionTitle}>{monthTitle}</Text>
              <Button mode="text" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>다음</Button>
            </View>

            <View style={styles.calendarWeekRow}>
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <Text key={w} style={styles.calendarWeekLabel}>{w}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {days.map((date) => {
                const key = toDateKey(date);
                const inMonth = date.getMonth() === calendarMonth.getMonth();
                const doneCount = completionHistory[key]?.length ?? 0;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.calendarCell,
                      !inMonth ? styles.calendarCellDim : undefined,
                      doneCount > 0 ? styles.calendarCellDone : undefined,
                    ]}
                    onPress={() => onPressDay(date)}
                  >
                    <Text style={styles.calendarDateText}>{date.getDate()}</Text>
                    {doneCount > 0 ? <Text style={styles.calendarDoneDot}>완료 {doneCount}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        <Portal>
          <Modal
            visible={calendarModalVisible}
            onDismiss={() => setCalendarModalVisible(false)}
            contentContainerStyle={styles.calendarModalWrap}
          >
            <Text style={styles.sectionTitle}>{selectedDateKey ?? '-'} 완료 루틴</Text>
            {selectedDoneList.length === 0 ? (
              <Text style={styles.routineMeta}>해당일 완료된 루틴이 없습니다.</Text>
            ) : (
              selectedDoneList.map((item) => (
                <View key={`${item.id}-${item.doneAt ?? ''}`} style={styles.calendarDoneItem}>
                  <Text style={styles.routineTitle}>{item.title}</Text>
                  <Text style={styles.routineMeta}>{item.doneAt ?? '완료 시간 미기록'}</Text>
                </View>
              ))
            )}
            <Button mode="contained" onPress={() => setCalendarModalVisible(false)}>
              닫기
            </Button>
          </Modal>
        </Portal>
      </ScrollView>
    );
  };

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.bodyScroll}>
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <View style={styles.switchRow}>
            <Text style={styles.sectionTitle}>알림 사용</Text>
            <Switch value={settings.enabled} onValueChange={(value) => void toggleNotifications(value)} />
          </View>
          <Text style={styles.routineMeta}>잠금화면/백그라운드에서 루틴 시간 알림을 받습니다.</Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>기본 알림 시간</Text>
          <TextInput mode="outlined" style={styles.paperInput} value={wakeInput} onChangeText={setWakeInput} placeholder="09:00" />
          <TextInput mode="outlined" style={styles.paperInput} value={lunchInput} onChangeText={setLunchInput} placeholder="12:30" />
          <TextInput mode="outlined" style={styles.paperInput} value={sleepInput} onChangeText={setSleepInput} placeholder="23:00" />
          <Button mode="contained" onPress={() => void saveNotificationConfig()}>알림 설정 저장</Button>
        </Card.Content>
      </Card>

      <Button mode="outlined" textColor="#c4cfda" style={styles.settingsButton} onPress={() => void Linking.openSettings()}>
        시스템 설정 열기
      </Button>
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Routine Challenge</Text>
        <Text style={styles.headerSub}>
          {activeTab === 'today' ? '오늘 인증' : activeTab === 'calendar' ? '캘린더' : '알림/권한 설정'}
        </Text>
      </View>

      <View style={styles.body}>
        {activeTab === 'today' ? renderToday() : null}
        {activeTab === 'calendar' ? renderCalendar() : null}
        {activeTab === 'settings' ? renderSettings() : null}
      </View>

      <View style={[styles.tabBar, { height: 62 + Math.max(insets.bottom, 8), paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Button mode={activeTab === 'today' ? 'contained-tonal' : 'text'} onPress={() => setActiveTab('today')} style={styles.tabBtn} compact>오늘</Button>
        <Button mode={activeTab === 'calendar' ? 'contained-tonal' : 'text'} onPress={() => setActiveTab('calendar')} style={styles.tabBtn} compact>캘린더</Button>
        <Button mode={activeTab === 'settings' ? 'contained-tonal' : 'text'} onPress={() => setActiveTab('settings')} style={styles.tabBtn} compact>설정</Button>
      </View>

      <Snackbar
        visible={Boolean(statusMsg)}
        onDismiss={() => setStatusMsg('')}
        duration={2500}
        style={[styles.toast, { marginBottom: 16 + 62 + Math.max(insets.bottom, 8) }]}
      >
        {statusMsg}
      </Snackbar>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <PaperProvider theme={appTheme}>
      <AppContent />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#20242a',
    backgroundColor: '#13171c',
  },
  headerTitle: {
    color: '#f5f7fa',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    marginTop: 4,
    color: '#8e99a7',
    fontSize: 12,
  },
  body: {
    flex: 1,
  },
  bodyScroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  card: {
    backgroundColor: '#161b21',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: '#f5f7fa',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  separator: {
    color: '#93a0af',
    fontSize: 16,
  },
  routineCard: {
    backgroundColor: '#161b21',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  routineCardContent: {
    flexDirection: 'row',
    gap: 10,
  },
  routineTitle: {
    color: '#f5f7fa',
    fontSize: 15,
    fontWeight: '700',
  },
  routineMeta: {
    color: '#9aa4af',
    fontSize: 12,
    marginTop: 4,
  },
  actionCol: {
    width: 88,
    justifyContent: 'center',
    gap: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calendarWeekLabel: {
    width: '14.2857%',
    textAlign: 'center',
    color: '#8e99a7',
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b3138',
    backgroundColor: '#11151a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  calendarCellDim: {
    opacity: 0.45,
  },
  calendarCellDone: {
    borderColor: '#2e664d',
    backgroundColor: '#1b2a22',
  },
  calendarDateText: {
    color: '#e7edf4',
    fontSize: 13,
    fontWeight: '600',
  },
  calendarDoneDot: {
    marginTop: 2,
    color: '#7cffb2',
    fontSize: 10,
  },
  calendarModalWrap: {
    marginHorizontal: 20,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#2b3138',
    backgroundColor: '#161b21',
    padding: 16,
    gap: 10,
  },
  calendarDoneItem: {
    borderWidth: 1,
    borderColor: '#2b3138',
    borderRadius: 10,
    backgroundColor: '#11151a',
    padding: 10,
    marginBottom: 6,
  },
  tabBar: {
    height: 62,
    borderTopWidth: 1,
    borderTopColor: '#20242a',
    backgroundColor: '#13171c',
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
  },
  toast: {
    backgroundColor: '#1f2730',
    borderRadius: CARD_RADIUS,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#f5f7fa',
  },
  errorText: {
    fontSize: 14,
    color: '#9aa4af',
    textAlign: 'center',
  },
  onboardingWrap: {
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 16,
    paddingBottom: 32,
  },
  onboardingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f5f7fa',
  },
  onboardingDesc: {
    color: '#9aa4af',
    fontSize: 14,
    lineHeight: 20,
  },
  bullet: {
    color: '#d3dbe4',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  paperInput: {
    marginBottom: 10,
    backgroundColor: '#11151a',
  },
  paperInputTime: {
    flex: 1,
    backgroundColor: '#11151a',
  },
  settingsButton: {
    marginHorizontal: 8,
  },
});
