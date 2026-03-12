import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
const ALLOWED_HOSTS = (process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

const ONBOARDING_DONE_KEY = 'routine-app:onboarding-done:v1';
const ROUTINES_KEY = 'routine-app:routines:v1';
const NOTI_SETTINGS_KEY = 'routine-app:noti-settings:v1';

type TabKey = 'today' | 'routines' | 'settings';

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

function minuteToHHMM(minute: number) {
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function hhmmToMinute(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

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
    },
    {
      key: 'lunch',
      title: '🍽️ 식사 인증 시간',
      body: '12:30~13:30 사이에 식사 인증을 해주세요.',
      minute: settings.lunch,
    },
    {
      key: 'sleep',
      title: '🌙 취침 인증 시간',
      body: '23:00~02:00 사이에 취침 인증을 해주세요.',
      minute: settings.sleep,
    },
  ];

  for (const item of list) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: { source: 'default-routine', routine: item.key },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(item.minute / 60),
        minute: item.minute % 60,
      },
    });
  }
}

function AppError({ title, detail }: { title: string; detail: string }) {
  return (
    <SafeAreaView style={styles.container}>
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.onboardingWrap}>
        <Text style={styles.onboardingTitle}>루틴 챌린지 시작하기</Text>
        <Text style={styles.onboardingDesc}>{message}</Text>

        <View style={styles.card}>
          <Text style={styles.bullet}>• 기본 알림 3개 자동 등록 (09:00 / 12:30 / 23:00)</Text>
          <Text style={styles.bullet}>• 잠금화면/백그라운드에서도 알림 수신</Text>
          <Text style={styles.bullet}>• 커스텀 루틴 추가해도 기본 3개는 항상 유지</Text>
        </View>

        <Pressable style={styles.primaryBtn} onPress={requestPermission} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? '처리 중...' : '알림 권한 허용하고 시작'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => void Linking.openSettings()}>
          <Text style={styles.secondaryBtnText}>설정 열기</Text>
        </Pressable>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  const [routines, setRoutines] = useState<Routine[]>(defaultRoutines);
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
      const [done, loadedRoutines, loadedSettings] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_DONE_KEY),
        loadRoutines(),
        loadNotiSettings(),
      ]);

      setOnboardingDone(done === '1');
      setRoutines(loadedRoutines);
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
      <SafeAreaView style={styles.container}>
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

  const renderRoutines = () => (
    <ScrollView contentContainerStyle={styles.bodyScroll}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>루틴 추가/수정</Text>
        <TextInput
          style={styles.input}
          placeholder="루틴 제목"
          placeholderTextColor="#6f7b89"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <View style={styles.row}>
          <TextInput
            style={styles.inputTime}
            placeholder="09:00"
            placeholderTextColor="#6f7b89"
            value={newStart}
            onChangeText={setNewStart}
          />
          <Text style={styles.separator}>~</Text>
          <TextInput
            style={styles.inputTime}
            placeholder="10:00"
            placeholderTextColor="#6f7b89"
            value={newEnd}
            onChangeText={setNewEnd}
          />
        </View>

        {editingId ? (
          <Pressable style={styles.primaryBtn} onPress={applyEditRoutine}>
            <Text style={styles.primaryBtnText}>수정 저장</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={addRoutine}>
            <Text style={styles.primaryBtnText}>커스텀 루틴 추가</Text>
          </Pressable>
        )}
      </View>

      {routines.map((routine) => (
        <View key={routine.id} style={styles.routineCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.routineTitle}>{routine.title}</Text>
            <Text style={styles.routineMeta}>{formatRange(routine.startMinute, routine.endMinute)}</Text>
            <Text style={styles.routineMeta}>{routine.isDefault ? '기본 루틴' : '커스텀 루틴'}</Text>
          </View>
          {!routine.isDefault ? (
            <View style={styles.actionCol}>
              <Pressable style={styles.secondaryBtnSmall} onPress={() => startEditRoutine(routine.id)}>
                <Text style={styles.secondaryBtnText}>수정</Text>
              </Pressable>
              <Pressable style={styles.dangerBtnSmall} onPress={() => removeRoutine(routine.id)}>
                <Text style={styles.dangerBtnText}>삭제</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.bodyScroll}>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>알림 사용</Text>
          <Switch value={settings.enabled} onValueChange={(value) => void toggleNotifications(value)} />
        </View>
        <Text style={styles.routineMeta}>잠금화면/백그라운드에서 루틴 시간 알림을 받습니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>기본 알림 시간</Text>
        <TextInput style={styles.input} value={wakeInput} onChangeText={setWakeInput} placeholder="09:00" placeholderTextColor="#6f7b89" />
        <TextInput style={styles.input} value={lunchInput} onChangeText={setLunchInput} placeholder="12:30" placeholderTextColor="#6f7b89" />
        <TextInput style={styles.input} value={sleepInput} onChangeText={setSleepInput} placeholder="23:00" placeholderTextColor="#6f7b89" />
        <Pressable style={styles.primaryBtn} onPress={() => void saveNotificationConfig()}>
          <Text style={styles.primaryBtnText}>알림 설정 저장</Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondaryBtn} onPress={() => void Linking.openSettings()}>
        <Text style={styles.secondaryBtnText}>시스템 설정 열기</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Routine Challenge</Text>
        <Text style={styles.headerSub}>
          {activeTab === 'today' ? '오늘 인증' : activeTab === 'routines' ? '루틴 관리' : '알림/권한 설정'}
        </Text>
      </View>

      <View style={styles.body}>
        {activeTab === 'today' ? renderToday() : null}
        {activeTab === 'routines' ? renderRoutines() : null}
        {activeTab === 'settings' ? renderSettings() : null}
      </View>

      <View style={styles.tabBar}>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('today')}>
          <Text style={[styles.tabText, activeTab === 'today' ? styles.tabTextActive : null]}>오늘</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('routines')}>
          <Text style={[styles.tabText, activeTab === 'routines' ? styles.tabTextActive : null]}>루틴</Text>
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' ? styles.tabTextActive : null]}>설정</Text>
        </Pressable>
      </View>

      {statusMsg ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{statusMsg}</Text>
        </View>
      ) : null}

      <StatusBar style="light" />
    </SafeAreaView>
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28303a',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#f5f7fa',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#11151a',
    borderWidth: 1,
    borderColor: '#2a333f',
    borderRadius: 10,
    color: '#f5f7fa',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputTime: {
    flex: 1,
    backgroundColor: '#11151a',
    borderWidth: 1,
    borderColor: '#2a333f',
    borderRadius: 10,
    color: '#f5f7fa',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  separator: {
    color: '#93a0af',
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#1f3a2d',
    borderWidth: 1,
    borderColor: '#2e664d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#7cffb2',
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#334050',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  secondaryBtnSmall: {
    borderWidth: 1,
    borderColor: '#334050',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  secondaryBtnText: {
    color: '#c4cfda',
    fontWeight: '600',
  },
  dangerBtnSmall: {
    borderWidth: 1,
    borderColor: '#5b3139',
    backgroundColor: '#2b1a1f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#ff9ba8',
    fontWeight: '600',
  },
  routineCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#161b21',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28303a',
    padding: 12,
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
    width: 72,
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabBar: {
    height: 62,
    borderTopWidth: 1,
    borderTopColor: '#20242a',
    backgroundColor: '#13171c',
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#7f8b98',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#7cffb2',
  },
  toast: {
    position: 'absolute',
    bottom: 74,
    left: 16,
    right: 16,
    backgroundColor: '#1f2730',
    borderWidth: 1,
    borderColor: '#334050',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toastText: {
    color: '#d9e2ec',
    fontSize: 12,
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
  },
});
