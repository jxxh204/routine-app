import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
const ALLOWED_HOSTS = (process.env.EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

const ONBOARDING_DONE_KEY = 'routine-app:onboarding-done:v1';

type TabKey = 'today' | 'routines' | 'settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  if (ALLOWED_HOSTS.length === 0) {
    return true;
  }

  return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

async function ensureDefaultRoutineNotifications() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();

  for (const item of existing) {
    if (item.content.data?.source === 'default-routine') {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ 기상 인증 시간',
      body: '09:00~11:00 사이에 기상 인증을 해주세요.',
      data: { source: 'default-routine', routine: 'wake' },
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍽️ 식사 인증 시간',
      body: '12:30~13:30 사이에 식사 인증을 해주세요.',
      data: { source: 'default-routine', routine: 'lunch' },
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 12, minute: 30 },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌙 취침 인증 시간',
      body: '23:00~02:00 사이에 취침 인증을 해주세요.',
      data: { source: 'default-routine', routine: 'sleep' },
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 23, minute: 0 },
  });
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

      await ensureDefaultRoutineNotifications();
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.onboardingWrap}>
        <Text style={styles.onboardingTitle}>루틴 챌린지 시작하기</Text>
        <Text style={styles.onboardingDesc}>{message}</Text>

        <View style={styles.bulletBox}>
          <Text style={styles.bullet}>• 기본 알림 3개가 자동 등록돼요 (09:00 / 12:30 / 23:00)</Text>
          <Text style={styles.bullet}>• 잠금화면/백그라운드에서도 알림이 와요</Text>
          <Text style={styles.bullet}>• 커스텀 루틴을 추가해도 기본 3개는 항상 유지돼요</Text>
        </View>

        <Pressable style={styles.primaryBtn} onPress={requestPermission} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? '처리 중...' : '알림 권한 허용하고 시작'}</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={styles.secondaryBtnText}>설정 열기</Text>
        </Pressable>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  const parsed = useMemo(() => (WEB_APP_URL ? getParsedUrl(WEB_APP_URL) : null), []);

  useEffect(() => {
    const bootstrap = async () => {
      const done = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
      setOnboardingDone(done === '1');
      setBooting(false);
    };

    void bootstrap();
  }, []);

  if (!WEB_APP_URL) {
    return (
      <AppError
        title="환경변수 누락"
        detail="EXPO_PUBLIC_WEB_APP_URL 을 설정해 주세요."
      />
    );
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

  const base = `${parsed?.origin ?? ''}`;
  const pagePath = activeTab === 'today' ? '/today' : '/today';
  const pageUrl = `${base}${pagePath}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Routine Challenge</Text>
      </View>

      <WebView
        style={styles.webview}
        source={{ uri: pageUrl }}
        startInLoadingState
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedUrl(request.url)) {
            return true;
          }
          void Linking.openURL(request.url);
          return false;
        }}
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7cffb2" />
          </View>
        )}
      />

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
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#20242a',
    backgroundColor: '#13171c',
  },
  headerTitle: {
    color: '#f5f7fa',
    fontSize: 16,
    fontWeight: '700',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f1115',
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 16,
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
  bulletBox: {
    backgroundColor: '#161b21',
    borderWidth: 1,
    borderColor: '#28303a',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  bullet: {
    color: '#d3dbe4',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#1f3a2d',
    borderWidth: 1,
    borderColor: '#2e664d',
    borderRadius: 10,
    paddingVertical: 14,
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
  },
  secondaryBtnText: {
    color: '#c4cfda',
    fontWeight: '600',
  },
});
