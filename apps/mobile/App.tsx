import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  IconButton,
  MD3DarkTheme,
  Provider as PaperProvider,
  Snackbar,
  Text,
  type MD3Theme,
} from 'react-native-paper';
import { WebView } from 'react-native-webview';

import { minuteToHHMM } from './src/lib/date-time';

const WEB_APP_URL = (process.env.MOBILE_WEB_APP_URL ?? process.env.EXPO_PUBLIC_WEB_APP_URL)?.trim();
const ALLOWED_HOSTS = (process.env.MOBILE_WEB_APP_ALLOWED_HOSTS ?? process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
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
  proofImage?: string;
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

function isAuthPath(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

function isOAuthNavigationUrl(rawUrl: string) {
  const parsed = getParsedUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  const oauthHosts = [
    'supabase.co',
    'kakao.com',
    'accounts.kakao.com',
    'appleid.apple.com',
    'accounts.google.com',
  ];

  return oauthHosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
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

function getDurationMinute(startMinute: number, endMinute: number) {
  if (endMinute > startMinute) return endMinute - startMinute;
  if (endMinute < startMinute) return 24 * 60 - startMinute + endMinute;
  return 60;
}

async function scheduleDefaultNotifications(settings: NotificationSettings, routines: Routine[]) {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of existing) {
    if (item.content.data?.source === 'default-routine') {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  if (!settings.enabled) return;

  const list = routines.map((routine) => ({
    key: routine.id,
    title: `${routine.title} 인증 시간`,
    body: `${formatRange(routine.startMinute, routine.endMinute)} 사이에 ${routine.title} 인증을 해주세요.`,
    minute: routine.startMinute,
    durationMinute: getDurationMinute(routine.startMinute, routine.endMinute),
  }));

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


function getWebviewCompletionSyncScript() {
  return `
    (function() {
      var PREFIX = 'routine-challenge-v1:';
      var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

      function toHistory() {
        var result = {};
        for (var i = 0; i < localStorage.length; i += 1) {
          var key = localStorage.key(i);
          if (!key || key.indexOf(PREFIX) !== 0) continue;

          var dateKey = key.slice(PREFIX.length);
          if (!DATE_RE.test(dateKey)) continue;

          try {
            var raw = localStorage.getItem(key);
            if (!raw) continue;
            var list = JSON.parse(raw);
            if (!Array.isArray(list)) continue;

            var done = list
              .filter(function(item) { return item && item.doneByMe; })
              .map(function(item) {
                return {
                  id: String(item.id || ''),
                  title: String(item.title || '루틴'),
                  doneAt: item.doneAt ? String(item.doneAt) : undefined,
                  proofImage: item.proofImage ? String(item.proofImage) : undefined,
                };
              });

            if (done.length > 0) {
              result[dateKey] = done;
            }
          } catch (e) {
            // ignore parse errors per key
          }
        }
        return result;
      }

      function send() {
        try {
          var payload = {
            source: 'routine-webview',
            type: 'completion-history',
            history: toHistory(),
          };
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (e) {
          // ignore runtime errors
        }
      }

      send();
      window.addEventListener('storage', send);
      setInterval(send, 15000);
    })();
    true;
  `;
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

      const [settings, routines] = await Promise.all([loadNotiSettings(), loadRoutines()]);
      await scheduleDefaultNotifications(settings, routines);
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
  const [currentWebPath, setCurrentWebPath] = useState('/today');

  const [routines, setRoutines] = useState<Routine[]>(defaultRoutines);
  const [completionHistory, setCompletionHistory] = useState<CompletionHistory>({});

  const [settings, setSettings] = useState<NotificationSettings>(defaultNotiSettings);
  const [statusMsg, setStatusMsg] = useState('');
  const didRestoreNotificationsRef = useRef(false);

  const parsedUrl = useMemo(() => (WEB_APP_URL ? getParsedUrl(WEB_APP_URL) : null), []);

  const handleWebviewPathUpdate = useCallback((url: string) => {
    const parsed = getParsedUrl(url);
    if (!parsed) return;
    setCurrentWebPath(parsed.pathname || '/');
  }, []);

  const isAuthScreen = isAuthPath(currentWebPath);

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
      setBooting(false);
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!booting) {
      void saveRoutines(routines);
    }
  }, [routines, booting]);

  useEffect(() => {
    if (!booting) {
      void AsyncStorage.setItem(COMPLETION_HISTORY_KEY, JSON.stringify(completionHistory));
    }
  }, [completionHistory, booting]);

  useEffect(() => {
    if (booting || !onboardingDone || didRestoreNotificationsRef.current) return;

    const ensureNotificationSchedules = async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;

      await scheduleDefaultNotifications(settings, routines);
      didRestoreNotificationsRef.current = true;
      setStatusMsg(settings.enabled ? '알림 스케줄을 복구했어요.' : '알림이 꺼져 있어 스케줄을 생성하지 않았어요.');
    };

    void ensureNotificationSchedules();
  }, [booting, onboardingDone, settings]);

  if (!WEB_APP_URL) {
    return <AppError title="환경변수 누락" detail="MOBILE_WEB_APP_URL 또는 EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요." />;
  }

  if (!isAllowedUrl(WEB_APP_URL)) {
    return (
      <AppError
        title="보안 설정 오류"
        detail="HTTPS URL 및 허용 도메인(MOBILE_WEB_APP_ALLOWED_HOSTS 또는 EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS)을 확인해 주세요."
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

  const toggleNotifications = async (enabled: boolean) => {
    const next = { ...settings, enabled };
    setSettings(next);
    await saveNotiSettings(next);
    await scheduleDefaultNotifications(next, routines);
    setStatusMsg(enabled ? '알림을 켰어요.' : '알림을 껐어요.');
  };

  const renderWebRoute = (path: '/today' | '/calendar' | '/settings') => {
    const pageUrl = `${parsedUrl?.origin ?? ''}${path}`;

    return (
      <WebView
        style={styles.webview}
        source={{ uri: pageUrl }}
        startInLoadingState
        originWhitelist={['https://*']}
        onNavigationStateChange={(navState) => {
          handleWebviewPathUpdate(navState.url);
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedUrl(request.url)) return true;

          // OAuth 진행 중에는 WebView 내부에서 provider 왕복을 허용해 세션이 앱 WebView에 반영되게 유지
          if (isAuthScreen && isOAuthNavigationUrl(request.url)) return true;

          void Linking.openURL(request.url);
          return false;
        }}
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7cffb2" />
          </View>
        )}
        injectedJavaScript={getWebviewCompletionSyncScript()}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data ?? '{}') as {
              source?: string;
              type?: string;
              history?: CompletionHistory;
              action?: 'open-settings' | 'request-notification-permission' | 'toggle-notification';
              enabled?: boolean;
            };

            if (payload.source === 'routine-webview' && payload.type === 'completion-history' && payload.history) {
              setCompletionHistory(payload.history);
              return;
            }

            if (payload.source === 'routine-web' && payload.type === 'native-action') {
              if (payload.action === 'open-settings') {
                void Linking.openSettings();
                return;
              }

              if (payload.action === 'request-notification-permission') {
                void Notifications.requestPermissionsAsync().then((perm) => {
                  setStatusMsg(perm.granted ? '알림 권한이 허용됐어요.' : '알림 권한이 꺼져 있어요.');
                });
                return;
              }

              if (payload.action === 'toggle-notification' && typeof payload.enabled === 'boolean') {
                void toggleNotifications(payload.enabled);
              }
            }
          } catch {
            // no-op
          }
        }}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {!isAuthScreen ? (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Routine Challenge</Text>
          <Text style={styles.headerSub}>
            {activeTab === 'today' ? '오늘 인증' : activeTab === 'calendar' ? '캘린더' : '알림/권한 설정'}
          </Text>
        </View>
      ) : null}

      <View style={styles.body}>
        {renderWebRoute(activeTab === 'today' ? '/today' : activeTab === 'calendar' ? '/calendar' : '/settings')}
      </View>

      {!isAuthScreen ? <View style={[styles.tabBar, { bottom: 16 + Math.max(insets.bottom, 0) }]}>
        {[
          { key: 'today' as const, label: '오늘', icon: 'check-circle' },
          { key: 'calendar' as const, label: '캘린더', icon: 'calendar' },
          { key: 'settings' as const, label: '설정', icon: 'cog' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, active ? styles.tabItemActive : undefined]}
              onPress={() => setActiveTab(tab.key)}
            >
              <IconButton
                icon={tab.icon}
                size={18}
                style={styles.tabIconBtn}
                iconColor={active ? '#ffffff' : '#a6afbb'}
              />
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : undefined]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View> : null}

      <Snackbar
        visible={Boolean(statusMsg)}
        onDismiss={() => setStatusMsg('')}
        duration={2500}
        style={[
          styles.toast,
          { marginBottom: isAuthScreen ? 12 + Math.max(insets.bottom, 0) : 12 + 48 + 16 + Math.max(insets.bottom, 0) },
        ]}
      >
        <Text style={styles.toastText}>{statusMsg}</Text>
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
    paddingBottom: 140,
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
    gap: 4,
  },
  calendarWeekLabel: {
    width: '13.5%',
    textAlign: 'center',
    color: '#8e99a7',
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarCell: {
    width: '13.5%',
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
  calendarCellToday: {
    borderColor: '#7cffb2',
    borderWidth: 2,
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
  calendarThumb: {
    marginTop: 8,
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#0b0d10',
  },
  tabBar: {
    position: 'absolute',
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
    height: 48,
    borderRadius: 48,
    backgroundColor: '#181d24',
    borderWidth: 1,
    borderColor: '#262d37',
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  tabItemActive: {
    backgroundColor: '#323943',
  },
  tabIconBtn: {
    margin: 0,
    width: 20,
    height: 20,
  },
  tabLabel: {
    marginTop: 1,
    fontSize: 11,
    color: '#a6afbb',
    lineHeight: 12,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  toast: {
    backgroundColor: '#1f2730',
    borderRadius: CARD_RADIUS,
  },
  toastText: {
    color: '#ffffff',
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
