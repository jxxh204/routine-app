import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// ---------------------------------------------------------------------------
// Lazy-load expo-notifications (may be unavailable in some environments)
// ---------------------------------------------------------------------------
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // Notification features will be disabled
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const WEB_APP_URL = (process.env.MOBILE_WEB_APP_URL ?? process.env.EXPO_PUBLIC_WEB_APP_URL)?.trim();
const ALLOWED_HOSTS = (process.env.MOBILE_WEB_APP_ALLOWED_HOSTS ?? process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
const ONBOARDING_DONE_KEY = 'routine-app:onboarding-done:v1';
const ROUTINES_KEY = 'routine-app:routines:v1';
const NOTI_SETTINGS_KEY = 'routine-app:noti-settings:v1';
const COMPLETION_HISTORY_KEY = 'routine-app:completion-history:v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const CARD_RADIUS = 14;

const appTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: CARD_RADIUS,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#0EA5E9',
    onPrimary: '#ffffff',
    secondary: '#98989D',
    background: '#141414',
    surface: '#1C1C1E',
    surfaceVariant: '#2C2C2E',
    outline: 'rgba(255,255,255,0.08)',
    onSurface: '#F5F5F7',
    onSurfaceVariant: '#98989D',
    error: '#F472B6',
  },
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const defaultRoutines: Routine[] = [
  { id: 'wake', title: '기상 인증', startMinute: 9 * 60, endMinute: 11 * 60, isDefault: true },
  { id: 'lunch', title: '식사 인증', startMinute: 12 * 60 + 30, endMinute: 13 * 60 + 30, isDefault: true },
  { id: 'sleep', title: '취침 인증', startMinute: 23 * 60, endMinute: 2 * 60, isDefault: true },
];

const defaultNotiSettings: NotificationSettings = {
  enabled: true,
  wake: 9 * 60,
  lunch: 12 * 60 + 30,
  sleep: 23 * 60,
};

// ---------------------------------------------------------------------------
// Notification handler (safe — skips if module unavailable)
// ---------------------------------------------------------------------------
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // silently ignore
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatRange(startMinute: number, endMinute: number) {
  const start = minuteToHHMM(startMinute);
  const end = minuteToHHMM(endMinute);
  return startMinute < endMinute ? `${start} - ${end}` : `${start} - 다음날 ${end}`;
}

function getParsedUrl(url: string) {
  try { return new URL(url); } catch { return null; }
}

function isAllowedUrl(rawUrl: string) {
  const parsed = getParsedUrl(rawUrl);
  if (!parsed || parsed.protocol !== 'https:') return false;
  if (ALLOWED_HOSTS.length === 0) return true;
  return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

function isAuthPath(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

function isOAuthNavigationUrl(rawUrl: string) {
  const parsed = getParsedUrl(rawUrl);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  const oauthHosts = ['supabase.co', 'kakao.com', 'accounts.kakao.com', 'appleid.apple.com', 'accounts.google.com'];
  return oauthHosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function mergeWithDefaults(raw: Routine[]) {
  const custom = raw.filter((r) => !['wake', 'lunch', 'sleep'].includes(r.id));
  return [...defaultRoutines, ...custom];
}

async function loadRoutines() {
  try {
    const raw = await AsyncStorage.getItem(ROUTINES_KEY);
    if (!raw) return defaultRoutines;
    return mergeWithDefaults(JSON.parse(raw) as Routine[]);
  } catch { return defaultRoutines; }
}

async function saveRoutines(routines: Routine[]) {
  await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

async function loadNotiSettings() {
  try {
    const raw = await AsyncStorage.getItem(NOTI_SETTINGS_KEY);
    if (!raw) return defaultNotiSettings;
    return { ...defaultNotiSettings, ...(JSON.parse(raw) as NotificationSettings) };
  } catch { return defaultNotiSettings; }
}

async function saveNotiSettings(settings: NotificationSettings) {
  await AsyncStorage.setItem(NOTI_SETTINGS_KEY, JSON.stringify(settings));
}

async function loadCompletionHistory() {
  try {
    const raw = await AsyncStorage.getItem(COMPLETION_HISTORY_KEY);
    if (!raw) return {} as CompletionHistory;
    return JSON.parse(raw) as CompletionHistory;
  } catch { return {} as CompletionHistory; }
}

// ---------------------------------------------------------------------------
// Notification scheduling (safe — all calls guarded)
// ---------------------------------------------------------------------------
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
  // Early bail if notifications module is unavailable
  if (!Notifications) return;

  const triggerType = Notifications.SchedulableTriggerInputTypes?.DAILY;
  if (triggerType == null) return; // API not available

  try {
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
        await Notifications!.scheduleNotificationAsync({
          content: {
            title: isReminder ? `${item.title} (리마인드)` : item.title,
            body: isReminder
              ? '아직 인증완료가 아니라면 지금 인증해 주세요. 30분 후 다시 알려드릴게요.'
              : item.body,
            data: { source: 'default-routine', routine: item.key, kind: isReminder ? 'reminder' : 'first' },
            sound: 'default',
          },
          trigger: { type: triggerType, hour: Math.floor(minute / 60), minute: minute % 60 },
        });
      };

      await scheduleAt(item.minute, false);
      for (const rm of reminderMinutes) await scheduleAt(rm, true);
    }
  } catch (err) {
    console.warn('[scheduleDefaultNotifications]', err);
  }
}

// ---------------------------------------------------------------------------
// WebView bridge script
// ---------------------------------------------------------------------------
function getWebviewCompletionSyncScript() {
  return `
    (function() {
      var PREFIX = 'routine-challenge-v1:';
      var DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
      function post(p) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(p)); } catch(e) {} }
      function toHistory() {
        var r = {};
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k || k.indexOf(PREFIX) !== 0) continue;
          var dk = k.slice(PREFIX.length);
          if (!DATE_RE.test(dk)) continue;
          try {
            var raw = localStorage.getItem(k); if (!raw) continue;
            var list = JSON.parse(raw); if (!Array.isArray(list)) continue;
            var done = list.filter(function(x){return x&&x.doneByMe}).map(function(x){
              return {id:String(x.id||''),title:String(x.title||'루틴'),doneAt:x.doneAt?String(x.doneAt):undefined,proofImage:x.proofImage?String(x.proofImage):undefined};
            });
            if (done.length > 0) r[dk] = done;
          } catch(e) {}
        }
        return r;
      }
      function sendHistory() { post({source:'routine-webview',type:'completion-history',history:toHistory()}); }
      function sendRoute() { post({source:'routine-webview',type:'route-path',path:window.location.pathname||'/'}); }
      var oPS = history.pushState; history.pushState = function(){ oPS.apply(history,arguments); sendRoute(); };
      var oRS = history.replaceState; history.replaceState = function(){ oRS.apply(history,arguments); sendRoute(); };
      window.addEventListener('popstate', sendRoute);
      window.addEventListener('hashchange', sendRoute);
      window.addEventListener('storage', sendHistory);
      sendRoute(); sendHistory();
      setInterval(sendHistory, 15000);
      setInterval(sendRoute, 1000);
    })();
    true;
  `;
}

// ---------------------------------------------------------------------------
// Error UI
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
function Onboarding({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('알림 권한을 허용하면 잠금화면/백그라운드에서도 루틴 시간을 놓치지 않아요.');

  const requestPermission = async () => {
    setBusy(true);
    try {
      if (!Notifications) {
        // No notification module — skip, proceed to app
        await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
        onDone();
        return;
      }

      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted ? current : await Notifications.requestPermissionsAsync();

      if (!permission.granted) {
        setMessage('알림 권한이 꺼져 있어요. [설정]에서 알림을 켜주세요.');
        return;
      }

      const [notiSettings, routines] = await Promise.all([loadNotiSettings(), loadRoutines()]);
      await scheduleDefaultNotifications(notiSettings, routines);
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
      onDone();
    } catch (err) {
      console.warn('[requestPermission]', err);
      // Don't block user — proceed anyway
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

        <Button mode="contained" buttonColor="#0EA5E9" textColor="#ffffff" onPress={requestPermission} loading={busy} disabled={busy}>
          {busy ? '처리 중...' : '알림 권한 허용하고 시작'}
        </Button>

        <Button mode="outlined" textColor="#98989D" onPress={() => void Linking.openSettings()}>
          설정 열기
        </Button>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Main app content
// ---------------------------------------------------------------------------
function AppContent() {
  // ── Hooks (ALL hooks must come first, before any early return) ──────────
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
  const isAuthScreen = isAuthPath(currentWebPath);

  const handleWebviewPathUpdate = useCallback((url: string) => {
    const parsed = getParsedUrl(url);
    if (parsed) setCurrentWebPath(parsed.pathname || '/');
  }, []);

  // Sync activeTab with web path
  useEffect(() => {
    if (currentWebPath.startsWith('/calendar')) setActiveTab('calendar');
    else if (currentWebPath.startsWith('/settings')) setActiveTab('settings');
    else if (currentWebPath.startsWith('/today') || isAuthScreen) setActiveTab('today');
  }, [currentWebPath, isAuthScreen]);

  // Bootstrap
  useEffect(() => {
    void (async () => {
      const [done, r, s, h] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_DONE_KEY), loadRoutines(), loadNotiSettings(), loadCompletionHistory(),
      ]);
      setOnboardingDone(done === '1');
      setRoutines(r);
      setSettings(s);
      setCompletionHistory(h);
      setBooting(false);
    })();
  }, []);

  // Persist routines
  useEffect(() => { if (!booting) void saveRoutines(routines); }, [routines, booting]);

  // Persist completion history
  useEffect(() => { if (!booting) void AsyncStorage.setItem(COMPLETION_HISTORY_KEY, JSON.stringify(completionHistory)); }, [completionHistory, booting]);

  // Restore notification schedules
  useEffect(() => {
    if (booting || !onboardingDone || didRestoreNotificationsRef.current || !Notifications) return;
    void (async () => {
      try {
        const perm = await Notifications!.getPermissionsAsync();
        if (!perm.granted) return;
        await scheduleDefaultNotifications(settings, routines);
        didRestoreNotificationsRef.current = true;
      } catch (err) { console.warn('[restoreNotifications]', err); }
    })();
  }, [booting, onboardingDone, settings, routines]);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    try {
      const next = { ...settings, enabled };
      setSettings(next);
      await saveNotiSettings(next);
      await scheduleDefaultNotifications(next, routines);
      setStatusMsg(enabled ? '알림을 켰어요.' : '알림을 껐어요.');
    } catch (err) {
      console.warn('[toggleNotifications]', err);
      setStatusMsg('알림 설정 변경 중 오류가 발생했어요.');
    }
  }, [settings, routines]);

  const handleWebMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const p = JSON.parse(event.nativeEvent.data ?? '{}') as Record<string, unknown>;

      if (p.source === 'routine-webview' && p.type === 'route-path' && typeof p.path === 'string') {
        setCurrentWebPath(p.path);
        return;
      }
      if (p.source === 'routine-webview' && p.type === 'completion-history' && p.history) {
        setCompletionHistory(p.history as CompletionHistory);
        return;
      }
      if (p.source === 'routine-web' && p.type === 'native-action') {
        if (p.action === 'open-settings') { void Linking.openSettings(); return; }
        if (p.action === 'request-notification-permission') {
          if (Notifications) {
            void Notifications.requestPermissionsAsync()
              .then((perm) => setStatusMsg(perm.granted ? '알림 권한이 허용됐어요.' : '알림 권한이 꺼져 있어요.'))
              .catch(() => setStatusMsg('알림 권한 요청 중 오류가 발생했어요.'));
          }
          return;
        }
        if (p.action === 'toggle-notification' && typeof p.enabled === 'boolean') {
          void toggleNotifications(p.enabled);
        }
      }
    } catch { /* no-op */ }
  }, [toggleNotifications]);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    if (isAllowedUrl(request.url)) return true;
    if (isAuthScreen && isOAuthNavigationUrl(request.url)) return true;
    void Linking.openURL(request.url);
    return false;
  }, [isAuthScreen]);

  const webviewProps = useMemo(() => ({
    originWhitelist: ['https://*'] as string[],
    startInLoadingState: true,
    injectedJavaScript: getWebviewCompletionSyncScript(),
    onMessage: handleWebMessage,
    onShouldStartLoadWithRequest: handleShouldStartLoad,
    renderLoading: () => (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    ),
  }), [handleWebMessage, handleShouldStartLoad]);

  // ── Early returns (NO hooks below this line) ────────────────────────────

  if (!WEB_APP_URL) {
    return <AppError title="환경변수 누락" detail="MOBILE_WEB_APP_URL 또는 EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요." />;
  }

  if (!isAllowedUrl(WEB_APP_URL)) {
    return <AppError title="보안 설정 오류" detail="HTTPS URL 및 허용 도메인을 확인해 주세요." />;
  }

  if (booting) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingDone) {
    return <Onboarding onDone={() => setOnboardingDone(true)} />;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const tabs: Array<{ key: TabKey; path: string }> = [
    { key: 'today', path: '/today' },
    { key: 'calendar', path: '/calendar' },
    { key: 'settings', path: '/settings' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={[styles.body, !isAuthScreen ? styles.bodyWithTabBarInset : undefined]}>
        {tabs.map((tab) => (
          <View
            key={tab.key}
            style={[styles.webviewLayer, activeTab === tab.key ? styles.webviewVisible : styles.webviewHidden]}
            pointerEvents={activeTab === tab.key ? 'auto' : 'none'}
          >
            <WebView
              style={styles.webview}
              source={{ uri: `${parsedUrl?.origin ?? ''}${tab.path}` }}
              onNavigationStateChange={(navState) => {
                if (activeTab === tab.key) handleWebviewPathUpdate(navState.url);
              }}
              {...webviewProps}
            />
          </View>
        ))}
      </View>

      {!isAuthScreen && (
        <View style={[styles.tabBar, { bottom: 8 + Math.max(insets.bottom, 0) }]}>
          {([
            { key: 'today' as const, label: '오늘', icon: 'check-circle' },
            { key: 'calendar' as const, label: '캘린더', icon: 'calendar' },
            { key: 'settings' as const, label: '설정', icon: 'cog' },
          ]).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={[styles.tabItem, active && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)}>
                <IconButton icon={tab.icon} size={20} style={styles.tabIconBtn} iconColor={active ? '#0EA5E9' : '#636366'} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Snackbar
        visible={Boolean(statusMsg)}
        onDismiss={() => setStatusMsg('')}
        duration={2500}
        style={[styles.toast, { marginBottom: isAuthScreen ? 12 + Math.max(insets.bottom, 0) : 80 + Math.max(insets.bottom, 0) }]}
      >
        <Text style={styles.toastText}>{statusMsg}</Text>
      </Snackbar>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AppError title="앱 오류 발생" detail={`앱을 다시 시작해주세요.\n\n${this.state.error?.message ?? '알 수 없는 오류'}`} />
        </View>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Root — SafeAreaProvider + ErrorBoundary MUST wrap everything
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <PaperProvider theme={appTheme}>
          <AppContent />
        </PaperProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  body: { flex: 1 },
  bodyWithTabBarInset: { paddingBottom: 72 },
  webviewLayer: { ...StyleSheet.absoluteFillObject },
  webviewVisible: { opacity: 1 },
  webviewHidden: { opacity: 0 },
  webview: { flex: 1, backgroundColor: '#141414' },
  card: { backgroundColor: '#1C1C1E', borderRadius: CARD_RADIUS, overflow: 'hidden' },
  tabBar: {
    position: 'absolute', alignSelf: 'center', width: '88%', maxWidth: 380, height: 56, borderRadius: 28,
    backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  tabItem: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  tabItemActive: { backgroundColor: 'rgba(14, 165, 233, 0.12)' },
  tabIconBtn: { margin: 0, width: 22, height: 22 },
  tabLabel: { marginTop: 1, fontSize: 10, color: '#636366', fontWeight: '500', lineHeight: 12 },
  tabLabelActive: { color: '#0EA5E9', fontWeight: '600' },
  toast: { backgroundColor: '#2C2C2E', borderRadius: CARD_RADIUS },
  toastText: { color: '#ffffff' },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: '#F5F5F7' },
  errorText: { fontSize: 14, color: '#98989D', textAlign: 'center' },
  onboardingWrap: { paddingHorizontal: 24, paddingTop: 48, gap: 16, paddingBottom: 32 },
  onboardingTitle: { fontSize: 28, fontWeight: '800', color: '#F5F5F7' },
  onboardingDesc: { color: '#98989D', fontSize: 14, lineHeight: 20 },
  bullet: { color: '#F5F5F7', fontSize: 13, lineHeight: 18, marginBottom: 6 },
});
