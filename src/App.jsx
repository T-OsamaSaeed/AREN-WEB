import { useEffect, useRef, useState } from 'react';
import {
  getNotificationState,
  getWebPushSubscription,
  readNotificationPayload,
  requestNotificationPermission,
  subscribeToForegroundMessages,
} from './services/notifications';
import LandingPage from './pages/LandingPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import {
  getCallNoteValue,
  getCallPhoneNumber,
  getCallRowKey,
  getCallStudentName,
} from './utils/callData';
import {
  getAnnouncements,
  getTeacherCalls,
  getTeacherSchedule,
  getTeachers,
  logCallAction,
  saveNotificationSubscription,
  saveWeeklyCallNote,
} from './services/api';
import { getCurrentWeekKey } from './utils/week';

const STORAGE_KEY = 'aren-academy-teacher-name';
const GOKHAN_DEBUG_TARGET_KEY = '__gokhan_debug_write__';
const GOKHAN_DEBUG_TEACHER_NAME = 'GÖKHAN HOCA';
const ANNOUNCEMENTS_POLL_INTERVAL_MS = 15000;
const CLASSES_POLL_INTERVAL_MS = 30000;
const CALLS_POLL_INTERVAL_MS = 30000;
const AUTO_REFRESH_COOLDOWN_MS = 5000;
const NOTIFICATION_BACKEND_TIMEOUT_MS = 12000;
const PWA_ICON_VERSION = 'aren-brand-9';
const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}logo.jpeg?v=${PWA_ICON_VERSION}`;

function createAsyncState() {
  return {
    status: 'idle',
    data: [],
    error: '',
    updatedAt: null,
  };
}

function normalizeValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getTeacherName(teacher) {
  return teacher?.teacher_name || teacher?.name || teacher?.teacher || '';
}

function getLoggedInTeacherNameForWrite(teacher) {
  return getTeacherName(teacher).trim();
}

function getWriteErrorMessage(error, fallbackMessage) {
  const supabaseError = error?.supabaseError || error;
  const exactMessage = [
    supabaseError?.message,
    supabaseError?.details,
    supabaseError?.hint,
    supabaseError?.code,
  ].filter(Boolean).join(' | ');

  return exactMessage ? `${fallbackMessage}: ${exactMessage}` : fallbackMessage;
}

function stringifyWriteDebugValue(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createCallWriteDebugDetails({
  teacherName,
  studentName,
  phoneNumber,
  weekKey,
  result = '',
  error = '',
}) {
  return {
    teacherName,
    studentName,
    phoneNumber,
    weekKey,
    lastSupabaseResult: stringifyWriteDebugValue(result),
    lastSupabaseError: stringifyWriteDebugValue(error),
  };
}

function getWeeklyStatusFromAction(actionType) {
  if (actionType === 'call') {
    return 'call_clicked';
  }

  if (actionType === 'whatsapp') {
    return 'whatsapp_clicked';
  }

  return 'not_called';
}

function getWeeklyStatusFromNoteAndAction(note, actionType) {
  return String(note || '').trim()
    ? 'note'
    : getWeeklyStatusFromAction(actionType);
}

function openTrackedContactLink(destinationHref) {
  if (!destinationHref || typeof window === 'undefined') {
    return;
  }

  window.location.href = destinationHref;
}

function createMessagingDebugDetails(overrides = {}) {
  return {
    permissionStatus: typeof Notification === 'undefined' ? 'default' : Notification.permission,
    backendSaveSucceeded: null,
    backendResponseText: '',
    ...overrides,
  };
}

function createMessagingState(overrides = {}) {
  return {
    status: 'idle',
    supported: true,
    permission: typeof Notification === 'undefined' ? 'default' : Notification.permission,
    enabled: false,
    error: '',
    debugMessage: '',
    lastStep: '',
    debugDetails: createMessagingDebugDetails(),
    ...overrides,
  };
}

function getMessagingErrorText(reason) {
  if (reason === 'unsupported') {
    return 'Bu cihaz web push bildirimlerini desteklemiyor.';
  }

  if (reason === 'permission-denied') {
    return 'Bildirim izni tarayıcı ayarlarından kapatılmış.';
  }

  if (reason === 'permission-not-granted') {
    return 'Bildirimler için önce izin verilmesi gerekiyor.';
  }

  if (reason === 'missing-token') {
    return 'Bildirim belirteci şu anda alınamadı.';
  }

  if (reason === 'missing-vapid-public-key') {
    return 'Bildirim anahtarı henüz yapılandırılmadı.';
  }

  if (reason === 'device-failed') {
    return 'Bildirimler bu cihazda etkinleştirilemedi.';
  }

  return 'Bildirimler bu cihazda etkinleştirilemedi.';
}

function getRealErrorMessage(error, fallback = 'Bildirimler bu cihazda etkinleştirilemedi.') {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function withTimeout(promise, label, timeoutMs = NOTIFICATION_BACKEND_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${label} zaman aşımına uğradı.`));
      }, timeoutMs);
    }),
  ]);
}

function createSectionRefreshTracker() {
  return {
    inFlight: false,
    lastRefreshAt: 0,
  };
}

function App() {
  const [teacherInput, setTeacherInput] = useState('');
  const [teachersState, setTeachersState] = useState({
    status: 'loading',
    data: [],
    error: '',
  });
  const [activeTeacher, setActiveTeacher] = useState(null);
  const [activeSection, setActiveSection] = useState('classes');
  const [classesState, setClassesState] = useState(createAsyncState());
  const [callsState, setCallsState] = useState(createAsyncState());
  const [announcementsState, setAnnouncementsState] = useState(createAsyncState());
  const [entryError, setEntryError] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [selectedCallKey, setSelectedCallKey] = useState('');
  const [callDraft, setCallDraft] = useState('');
  const [callDraftInitial, setCallDraftInitial] = useState('');
  const [callSaveState, setCallSaveState] = useState({
    status: 'idle',
    error: '',
  });
  const [messagingState, setMessagingState] = useState(createMessagingState());
  const sectionRefreshRefs = useRef({
    classes: createSectionRefreshTracker(),
    calls: createSectionRefreshTracker(),
    announcements: createSectionRefreshTracker(),
  });
  const pushUnsubscribeRef = useRef(() => {});

  useEffect(() => {
    initializeTeachers();
  }, []);

  useEffect(() => {
    const isStandalone = typeof window !== 'undefined'
      && (
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true
      );

    console.info('[App] Standalone mode detected', {
      standalone: isStandalone,
    });
  }, []);

  useEffect(() => {
    if (!activeTeacher) {
      return;
    }

    refreshDashboardData({
      teacherName: getTeacherName(activeTeacher),
      showLoading: true,
    });
  }, [activeTeacher]);

  useEffect(() => {
    if (!activeTeacher) {
      setMessagingState(createMessagingState());
      return undefined;
    }

    const teacherName = getTeacherName(activeTeacher);
    const refreshAllSections = (force = false) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      refreshSectionData('classes', teacherName, {
        preserveData: true,
        force,
      });
      refreshSectionData('calls', teacherName, {
        preserveData: true,
        force,
      });
      refreshSectionData('announcements', teacherName, {
        preserveData: true,
        force,
      });
    };

    const announcementsIntervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      refreshSectionData('announcements', teacherName, {
        preserveData: true,
      });
    }, ANNOUNCEMENTS_POLL_INTERVAL_MS);

    const classesIntervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      refreshSectionData('classes', teacherName, {
        preserveData: true,
      });
    }, CLASSES_POLL_INTERVAL_MS);

    const callsIntervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      refreshSectionData('calls', teacherName, {
        preserveData: true,
      });
    }, CALLS_POLL_INTERVAL_MS);

    const handleWindowFocus = () => {
      refreshAllSections(true);
    };

    const handleOnline = () => {
      refreshAllSections(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllSections(true);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(announcementsIntervalId);
      window.clearInterval(classesIntervalId);
      window.clearInterval(callsIntervalId);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTeacher]);

  useEffect(() => {
    if (!activeTeacher) {
      pushUnsubscribeRef.current?.();
      pushUnsubscribeRef.current = () => {};
      setMessagingState(createMessagingState());
      return undefined;
    }

    let isCancelled = false;
    const teacherName = getTeacherName(activeTeacher);

    async function initializeNotifications() {
      const notificationState = await getNotificationState();
      if (isCancelled) {
        return;
      }

      if (!notificationState.supported) {
        setMessagingState(createMessagingState({
          status: 'unsupported',
          supported: false,
          permission: notificationState.permission,
          error: getMessagingErrorText('unsupported'),
        }));
        return;
      }

      if (notificationState.permission === 'granted') {
        const registrationResult = await syncNotificationsForTeacher(teacherName, {
          silent: true,
        });
        if (!isCancelled && registrationResult.enabled) {
          await bindForegroundPushListener(teacherName);
        }
        return;
      }

      setMessagingState(createMessagingState({
        status: notificationState.permission === 'denied' ? 'permission-denied' : 'idle',
        supported: true,
        permission: notificationState.permission,
        error: notificationState.permission === 'denied'
          ? getMessagingErrorText('permission-denied')
          : '',
      }));
    }

    initializeNotifications();

    return () => {
      isCancelled = true;
      pushUnsubscribeRef.current?.();
      pushUnsubscribeRef.current = () => {};
    };
  }, [activeTeacher]);

  async function initializeTeachers() {
    setTeachersState({
      status: 'loading',
      data: [],
      error: '',
    });

    try {
      const teachers = await getTeachers();
      setTeachersState({
        status: 'success',
        data: teachers,
        error: '',
      });

      const savedTeacherName = window.localStorage.getItem(STORAGE_KEY);
      if (!savedTeacherName) {
        return;
      }

      const matchedTeacher = findTeacher(savedTeacherName, teachers);
      if (matchedTeacher) {
        setActiveTeacher(matchedTeacher);
        setTeacherInput(getTeacherName(matchedTeacher));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      setTeachersState({
        status: 'error',
        data: [],
        error: error.message || 'Öğretmen listesi şu anda yüklenemedi.',
      });
    }
  }

  function findTeacher(name, teachers = teachersState.data) {
    const normalizedInput = normalizeValue(name);
    return teachers.find((teacher) => normalizeValue(getTeacherName(teacher)) === normalizedInput) || null;
  }

  async function refreshDashboardData({
    teacherName,
    preserveData = false,
    showLoading = false,
  }) {
    if (!teacherName) {
      return;
    }

    try {
      await Promise.all([
        refreshSectionData('classes', teacherName, { preserveData, showLoading, force: true }),
        refreshSectionData('calls', teacherName, { preserveData, showLoading, force: true }),
        refreshSectionData('announcements', teacherName, { preserveData, showLoading, force: true }),
      ]);
    } catch {
      // Section-specific loaders already keep existing UI data and error states safe.
    }
  }

  async function refreshSectionData(sectionName, teacherName, options = {}) {
    const {
      preserveData = false,
      showLoading = false,
      force = false,
    } = options;

    const tracker = sectionRefreshRefs.current[sectionName];

    if (!tracker) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false && !showLoading) {
      return;
    }

    const now = Date.now();
    if (tracker.inFlight) {
      return;
    }

    if (!force && now - tracker.lastRefreshAt < AUTO_REFRESH_COOLDOWN_MS) {
      return;
    }

    tracker.inFlight = true;
    tracker.lastRefreshAt = now;

    if (showLoading) {
      if (sectionName === 'classes') {
        setClassesState((currentState) => ({
          status: 'loading',
          data: [],
          error: '',
          updatedAt: currentState.updatedAt ?? null,
        }));
      }

      if (sectionName === 'calls') {
        setCallsState((currentState) => ({
          status: 'loading',
          data: [],
          error: '',
          updatedAt: currentState.updatedAt ?? null,
        }));
      }

      if (sectionName === 'announcements') {
        setAnnouncementsState((currentState) => ({
          status: 'loading',
          data: [],
          error: '',
          updatedAt: currentState.updatedAt ?? null,
        }));
      }
    }

    try {
      if (sectionName === 'classes') {
        await loadClasses(teacherName, { preserveData });
      }

      if (sectionName === 'calls') {
        await loadCalls(teacherName, { preserveData });
      }

      if (sectionName === 'announcements') {
        await loadAnnouncements({ preserveData });
      }
    } finally {
      tracker.inFlight = false;
      tracker.lastRefreshAt = Date.now();
    }
  }

  async function loadClasses(teacherName, options = {}) {
    const { preserveData = false } = options;

    try {
      const classes = await getTeacherSchedule(teacherName);
      setClassesState({
        status: 'success',
        data: classes,
        error: '',
        updatedAt: Date.now(),
      });
    } catch (error) {
      setClassesState((currentState) => ({
        status: 'error',
        data: preserveData ? currentState.data : [],
        error: error.message || 'Dersler şu anda yüklenemedi.',
        updatedAt: currentState.updatedAt ?? null,
      }));
    }
  }

  async function loadCalls(teacherName, options = {}) {
    const { preserveData = false } = options;

    try {
      const calls = await getTeacherCalls(teacherName);
      setCallsState({
        status: 'success',
        data: calls,
        error: '',
        updatedAt: Date.now(),
      });
    } catch (error) {
      setCallsState((currentState) => ({
        status: 'error',
        data: preserveData ? currentState.data : [],
        error: error.message || 'Aramalar şu anda yüklenemedi.',
        updatedAt: currentState.updatedAt ?? null,
      }));
    }
  }

  async function loadAnnouncements(options = {}) {
    const { preserveData = false } = options;

    try {
      const announcements = await getAnnouncements();

      setAnnouncementsState({
        status: 'success',
        data: announcements,
        error: '',
        updatedAt: Date.now(),
      });
    } catch (error) {
      setAnnouncementsState((currentState) => ({
        status: 'error',
        data: preserveData ? currentState.data : [],
        error: error.message || 'Duyurular şu anda yüklenemedi.',
        updatedAt: currentState.updatedAt ?? null,
      }));
    }
  }

  async function showForegroundPushNotification(pushMessage) {
    if (
      typeof window === 'undefined'
      || !('Notification' in window)
      || Notification.permission !== 'granted'
    ) {
      return;
    }

    const notificationTitle = pushMessage.title || 'Yeni duyuru';
    const notificationBody = pushMessage.body || 'Aren Academy panelinde yeni bir bildirim var.';
    const appIconUrl = new URL(
      `${import.meta.env.BASE_URL}pwa-192.png?v=${PWA_ICON_VERSION}`,
      window.location.href,
    ).toString();

    try {
      new Notification(notificationTitle, {
        body: notificationBody,
        icon: appIconUrl,
        tag: `${notificationTitle}::${notificationBody}`,
      });
    } catch {
      // If notifications fail, avoid interrupting normal dashboard use.
    }
  }

  async function syncNotificationsForTeacher(teacherName, options = {}) {
    const { requestPermission = false, silent = false } = options;
    let currentStep = 'Bildirim durumu kontrol ediliyor';
    const notificationState = await getNotificationState();
    const debugDetails = createMessagingDebugDetails({
      permissionStatus: notificationState.permission,
    });

    console.info('[Notifications] Checking Notification permission', {
      permission: notificationState.permission,
      supported: notificationState.supported,
      standalone: notificationState.standalone,
      teacherName,
    });

    if (!notificationState.supported) {
      setMessagingState(createMessagingState({
        status: 'unsupported',
        supported: false,
        permission: notificationState.permission,
        error: getMessagingErrorText('unsupported'),
        debugMessage: 'Bu cihazda web push desteği bulunamadı.',
        lastStep: currentStep,
        debugDetails,
      }));
      return { enabled: false };
    }

    let permission = notificationState.permission;

    if (requestPermission && permission === 'default') {
      currentStep = 'Bildirim izni isteniyor';
      console.info('[Notifications] Button clicked');
      console.info('[Notifications] Asking the user for permission after a button click.');
      setMessagingState(createMessagingState({
        status: 'loading',
        supported: true,
        permission,
        debugMessage: 'Bildirim izni isteniyor...',
        lastStep: currentStep,
        debugDetails: {
          ...debugDetails,
          permissionStatus: permission,
        },
      }));
      permission = await requestNotificationPermission();
    }

    if (permission !== 'granted') {
      const errorText = getMessagingErrorText(permission === 'denied' ? 'permission-denied' : 'permission-not-granted');
      setMessagingState(createMessagingState({
        status: permission === 'denied' ? 'permission-denied' : 'permission-required',
        supported: true,
        permission,
        error: errorText,
        debugMessage: `Son durum: izin = ${permission}`,
        lastStep: 'Bildirim izni tamamlanamadı',
        debugDetails: {
          ...debugDetails,
          permissionStatus: permission,
        },
      }));
      return { enabled: false };
    }

    try {
      currentStep = 'Web push aboneliği hazırlanıyor';
      console.info('[Notifications] Preparing browser push subscription');

      if (!silent) {
        setMessagingState(createMessagingState({
          status: 'loading',
          supported: true,
          permission,
          debugMessage: 'Bildirim aboneliği hazırlanıyor...',
          lastStep: currentStep,
          debugDetails: {
            ...debugDetails,
            permissionStatus: permission,
          },
        }));
      }

      currentStep = 'Web push aboneliği isteniyor';
      console.info('[Notifications] Requesting browser push subscription', {
        hasVapidKey: true,
      });
      const subscriptionResult = await withTimeout(
        getWebPushSubscription(),
        'Bildirim aboneliği hazırlama',
      );

      if (!subscriptionResult.ok) {
        const errorText = getMessagingErrorText(subscriptionResult.reason);
        setMessagingState(createMessagingState({
          status: 'error',
          supported: true,
          permission,
          error: errorText,
          debugMessage: `Son adım: ${currentStep}`,
          lastStep: currentStep,
          debugDetails: {
            ...debugDetails,
            permissionStatus: permission,
            backendSaveSucceeded: false,
          },
        }));
        return { enabled: false };
      }

      currentStep = 'Bildirim aboneliği Supabase için hazırlanıyor';
      console.info('[Notifications] Saving browser push subscription placeholder', {
        teacherName,
      });
      setMessagingState(createMessagingState({
        status: 'loading',
        supported: true,
        permission,
        debugMessage: 'Bildirim aboneliği hazırlanıyor...',
        lastStep: currentStep,
        debugDetails,
      }));

      const backendResult = await withTimeout(
        saveNotificationSubscription({
          teacher_name: teacherName,
          endpoint: subscriptionResult.endpoint,
          keys: subscriptionResult.keys,
          subscription: subscriptionResult.subscription.toJSON(),
        }),
        'Bildirim aboneliğini kaydetme',
      );

      console.info('[Notifications] Backend success', {
        teacherName,
        responseText: backendResult.text,
      });

      setMessagingState(createMessagingState({
        status: 'enabled',
        supported: true,
        permission,
        enabled: true,
        debugMessage: 'Bildirimler başarıyla etkinleştirildi.',
        lastStep: 'Bildirimler etkin',
        debugDetails: {
          ...debugDetails,
          backendSaveSucceeded: true,
          backendResponseText: backendResult.text || '(Boş yanıt)',
        },
      }));
      return {
        enabled: true,
        subscription: subscriptionResult.subscription,
      };
    } catch (error) {
      const realError = getRealErrorMessage(error);
      console.error('[Notifications] Notification enable flow failed', {
        step: currentStep,
        error,
      });
      console.error('[Notifications] Backend failure / final error message', realError);
      setMessagingState(createMessagingState({
        status: 'error',
        supported: true,
        permission,
        error: realError,
        debugMessage: `Son adım: ${currentStep}`,
        lastStep: currentStep,
        debugDetails: {
          ...debugDetails,
          permissionStatus: permission,
          backendSaveSucceeded: false,
          backendResponseText: error?.responseText || '',
        },
      }));
      return { enabled: false };
    }
  }

  async function bindForegroundPushListener(teacherName) {
    pushUnsubscribeRef.current?.();
    pushUnsubscribeRef.current = await subscribeToForegroundMessages(async (payload) => {
      const pushMessage = readNotificationPayload(payload);
      if (
        pushMessage.teacherName
        && normalizeValue(pushMessage.teacherName) !== normalizeValue(teacherName)
      ) {
        return;
      }

      await showForegroundPushNotification(pushMessage);
      refreshDashboardData({
        teacherName,
        preserveData: true,
      });
    });
  }

  async function handleEnableNotifications() {
    if (!activeTeacher || messagingState.status === 'loading') {
      return;
    }

    console.info('[Notifications] Enable button clicked from dashboard UI');
    const teacherName = getTeacherName(activeTeacher);
    const registrationResult = await syncNotificationsForTeacher(teacherName, {
      requestPermission: true,
    });

    if (registrationResult.enabled) {
      await bindForegroundPushListener(teacherName);
    }
  }

  function handleTeacherInputChange(value) {
    setTeacherInput(value);
    if (entryError) {
      setEntryError('');
    }
  }

  function handleEnterTeacher() {
    const trimmedName = teacherInput.trim();

    if (!trimmedName) {
      setEntryError('Devam etmek için adınızı girin.');
      return;
    }

    if (teachersState.status !== 'success') {
      setEntryError('Öğretmen verileri hâlâ yükleniyor. Lütfen biraz sonra tekrar deneyin.');
      return;
    }

    const matchedTeacher = findTeacher(trimmedName);

    if (!matchedTeacher) {
      setEntryError('Bu öğretmen adı bulunamadı. Lütfen yazımı kontrol edip tekrar deneyin.');
      return;
    }

    setEntryError('');
    setActiveTeacher(matchedTeacher);
    setActiveSection('classes');
    window.localStorage.setItem(STORAGE_KEY, getTeacherName(matchedTeacher));
  }

  async function handleSwitchTeacher() {
    if (callSaveState.status === 'loading') {
      return;
    }

    const saved = await persistSelectedCallNote();
    if (!saved) {
      return;
    }

    pushUnsubscribeRef.current?.();
    pushUnsubscribeRef.current = () => {};

    setActiveTeacher(null);
    setActiveSection('classes');
    setTeacherInput('');
    setEntryError('');
    setClassesState(createAsyncState());
    setCallsState(createAsyncState());
    setAnnouncementsState(createAsyncState());
    setSelectedCall(null);
    setSelectedCallKey('');
    setCallDraft('');
    setCallDraftInitial('');
    setCallSaveState({
      status: 'idle',
      error: '',
    });
    setMessagingState(createMessagingState());
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function handleSectionChange(nextSection) {
    if (nextSection === activeSection || callSaveState.status === 'loading') {
      return;
    }

    const saved = await persistSelectedCallNote();
    if (!saved) {
      return;
    }

    setActiveSection(nextSection);

    if (nextSection !== 'calls') {
      resetCallEditor();
      setCallSaveState({
        status: 'idle',
        error: '',
      });
    }
  }

  function resetCallEditor() {
    setSelectedCall(null);
    setSelectedCallKey('');
    setCallDraft('');
    setCallDraftInitial('');
  }

  function updateCallTrackingInState(targetCallKey, patchOrFactory) {
    setCallsState((currentState) => ({
      ...currentState,
      data: currentState.data.map((item, index) => {
        if (getCallRowKey(item, index) !== targetCallKey) {
          return item;
        }

        const patch = typeof patchOrFactory === 'function'
          ? patchOrFactory(item)
          : patchOrFactory;

        return {
          ...item,
          ...patch,
        };
      }),
    }));
  }

  function updateCallNoteInState(targetCallKey, note) {
    updateCallTrackingInState(targetCallKey, (item) => ({
      note,
      notes: note,
      weekly_status: getWeeklyStatusFromNoteAndAction(note, item.last_action_type),
    }));
  }

  async function persistSelectedCallNote() {
    if (!selectedCall || !activeTeacher) {
      return true;
    }

    const nextNote = callDraft.trim();
    const previousNote = callDraftInitial.trim();
    if (nextNote === previousNote) {
      return true;
    }
    const teacherName = getLoggedInTeacherNameForWrite(activeTeacher);
    const studentName = getCallStudentName(selectedCall);
    const phoneNumber = getCallPhoneNumber(selectedCall);
    const weekKey = getCurrentWeekKey();
    const debugDetails = createCallWriteDebugDetails({
      teacherName,
      studentName,
      phoneNumber,
      weekKey,
    });

    setCallSaveState({
      status: 'loading',
      error: '',
      message: 'Kaydediliyor...',
      targetKey: selectedCallKey,
      debugDetails,
    });

    try {
      const result = await saveWeeklyCallNote(
        teacherName,
        studentName,
        phoneNumber,
        weekKey,
        nextNote,
      );
      console.log('Note save UI success:', result);

      updateCallNoteInState(selectedCallKey, nextNote);
      setCallDraftInitial(nextNote);
      setCallSaveState({
        status: 'success',
        error: '',
        message: 'Not kaydedildi',
        targetKey: selectedCallKey,
        debugDetails: createCallWriteDebugDetails({
          teacherName,
          studentName,
          phoneNumber,
          weekKey,
          result,
        }),
      });
      return true;
    } catch (error) {
      console.error('Note save UI error:', error);
      const exactErrorMessage = getWriteErrorMessage(error, 'Not kaydedilemedi');
      setCallSaveState({
        status: 'error',
        error: exactErrorMessage,
        message: exactErrorMessage,
        targetKey: selectedCallKey,
        debugDetails: createCallWriteDebugDetails({
          teacherName,
          studentName,
          phoneNumber,
          weekKey,
          error,
        }),
      });
      return false;
    }
  }

  async function handleCallAction(call, callKey, actionType, destinationHref) {
    if (!activeTeacher) {
      return false;
    }

    const teacherName = getLoggedInTeacherNameForWrite(activeTeacher);
    const studentName = getCallStudentName(call);
    const phoneNumber = getCallPhoneNumber(call);
    const createdAt = new Date().toISOString();
    const weekKey = getCurrentWeekKey();
    const debugDetails = createCallWriteDebugDetails({
      teacherName,
      studentName,
      phoneNumber,
      weekKey,
    });

    setCallSaveState({
      status: 'loading',
      error: '',
      message: actionType === 'call' ? 'Arama kaydediliyor...' : 'WhatsApp kaydediliyor...',
      targetKey: callKey,
      debugDetails,
    });

    try {
      console.log('[Aramalar] logCallAction starting', {
        teacherName,
        studentName,
        phoneNumber,
        weekKey,
        actionType,
      });
      const result = await logCallAction(
        teacherName,
        studentName,
        phoneNumber,
        weekKey,
        actionType,
      );
      console.log('Call action UI success:', result);
      console.log('[Aramalar] logCallAction succeeded', {
        teacherName,
        studentName,
        weekKey,
        actionType,
      });

      updateCallTrackingInState(callKey, (currentCall) => ({
        last_action_type: actionType,
        last_action_at: createdAt,
        week_key: weekKey,
        weekly_status: getWeeklyStatusFromNoteAndAction(getCallNoteValue(currentCall), actionType),
      }));
      setCallSaveState((currentState) =>
        currentState.targetKey === callKey
          ? {
            status: 'success',
            error: '',
            message: actionType === 'call' ? 'Arama kaydedildi' : 'WhatsApp kaydedildi',
            targetKey: callKey,
            debugDetails: createCallWriteDebugDetails({
              teacherName,
              studentName,
              phoneNumber,
              weekKey,
              result,
            }),
          }
          : currentState,
      );
      openTrackedContactLink(destinationHref);
      return true;
    } catch (error) {
      console.error('Call action UI error:', error);
      const exactErrorMessage = getWriteErrorMessage(
        error,
        actionType === 'call' ? 'Arama kaydedilemedi' : 'WhatsApp kaydedilemedi',
      );
      setCallSaveState({
        status: 'error',
        error: exactErrorMessage,
        message: exactErrorMessage,
        targetKey: callKey,
        debugDetails: createCallWriteDebugDetails({
          teacherName,
          studentName,
          phoneNumber,
          weekKey,
          error,
        }),
      });
      return false;
    }
  }

  async function handleTestGokhanWrite() {
    const weekKey = getCurrentWeekKey();
    const studentName = 'DEBUG GÖKHAN STUDENT';
    const phoneNumber = '05000000000';

    setCallSaveState({
      status: 'loading',
      error: '',
      message: 'GÖKHAN test kaydı gönderiliyor...',
      targetKey: GOKHAN_DEBUG_TARGET_KEY,
      debugDetails: createCallWriteDebugDetails({
        teacherName: GOKHAN_DEBUG_TEACHER_NAME,
        studentName,
        phoneNumber,
        weekKey,
      }),
    });

    try {
      console.log('[Aramalar] Test GÖKHAN Write starting', {
        teacherName: GOKHAN_DEBUG_TEACHER_NAME,
        studentName,
        phoneNumber,
        weekKey,
        actionType: 'call',
      });

      const result = await logCallAction(
        GOKHAN_DEBUG_TEACHER_NAME,
        studentName,
        phoneNumber,
        weekKey,
        'call',
      );

      console.log('[Aramalar] Test GÖKHAN Write succeeded', {
        teacherName: GOKHAN_DEBUG_TEACHER_NAME,
        weekKey,
      });

      setCallSaveState({
        status: 'success',
        error: '',
        message: 'Arama kaydedildi',
        targetKey: GOKHAN_DEBUG_TARGET_KEY,
        debugDetails: createCallWriteDebugDetails({
          teacherName: GOKHAN_DEBUG_TEACHER_NAME,
          studentName,
          phoneNumber,
          weekKey,
          result,
        }),
      });
      return true;
    } catch (error) {
      console.error('[Aramalar] Test GÖKHAN Write failed.', error);
      const exactErrorMessage = getWriteErrorMessage(error, 'Arama kaydedilemedi');
      setCallSaveState({
        status: 'error',
        error: exactErrorMessage,
        message: exactErrorMessage,
        targetKey: GOKHAN_DEBUG_TARGET_KEY,
        debugDetails: createCallWriteDebugDetails({
          teacherName: GOKHAN_DEBUG_TEACHER_NAME,
          studentName,
          phoneNumber,
          weekKey,
          error,
        }),
      });
      return false;
    }
  }

  async function saveCallNoteNow(call, callKey, nextNote) {
    if (!activeTeacher) {
      return false;
    }

    const teacherName = getLoggedInTeacherNameForWrite(activeTeacher);
    const studentName = getCallStudentName(call);
    const phoneNumber = getCallPhoneNumber(call);
    const weekKey = getCurrentWeekKey();
    const debugDetails = createCallWriteDebugDetails({
      teacherName,
      studentName,
      phoneNumber,
      weekKey,
    });

    setCallSaveState({
      status: 'loading',
      error: '',
      message: 'Kaydediliyor...',
      targetKey: callKey,
      debugDetails,
    });

    try {
      console.log('[Aramalar] saveWeeklyCallNote starting', {
        teacherName,
        studentName,
        phoneNumber,
        weekKey,
      });
      const result = await saveWeeklyCallNote(
        teacherName,
        studentName,
        phoneNumber,
        weekKey,
        nextNote,
      );
      console.log('Note save UI success:', result);
      console.log('[Aramalar] saveWeeklyCallNote succeeded', {
        teacherName,
        studentName,
        weekKey,
      });

      updateCallNoteInState(callKey, nextNote);
      setCallSaveState({
        status: 'success',
        error: '',
        message: 'Not kaydedildi',
        targetKey: callKey,
        debugDetails: createCallWriteDebugDetails({
          teacherName,
          studentName,
          phoneNumber,
          weekKey,
          result,
        }),
      });
      return true;
    } catch (error) {
      console.error('Note save UI error:', error);
      const exactErrorMessage = getWriteErrorMessage(error, 'Not kaydedilemedi');
      setCallSaveState({
        status: 'error',
        error: exactErrorMessage,
        message: exactErrorMessage,
        targetKey: callKey,
        debugDetails: createCallWriteDebugDetails({
          teacherName,
          studentName,
          phoneNumber,
          weekKey,
          error,
        }),
      });
      return false;
    }
  }

  function handleCallNoteChange(call, callKey, nextNote) {
    if (!activeTeacher) {
      return;
    }

    updateCallNoteInState(callKey, nextNote);
    setCallSaveState({
      status: 'idle',
      error: '',
      message: '',
      targetKey: callKey,
    });
  }

  async function handleOpenCallModal(call, callKey) {
    if (callSaveState.status === 'loading') {
      return;
    }

    const saved = await persistSelectedCallNote();
    if (!saved) {
      return;
    }

    if (selectedCallKey === callKey) {
      resetCallEditor();
      setCallSaveState({
        status: 'idle',
        error: '',
      });
      return;
    }

    const initialNote = getCallNoteValue(call);
    setSelectedCall(call);
    setSelectedCallKey(callKey);
    setCallDraft(initialNote);
    setCallDraftInitial(initialNote);
    setCallSaveState({
      status: 'idle',
      error: '',
    });
  }

  async function handleRetrySection(sectionName) {
    if (!activeTeacher) {
      return;
    }

    if (callSaveState.status === 'loading') {
      return;
    }

    const saved = await persistSelectedCallNote();
    if (!saved) {
      return;
    }

    const teacherName = getTeacherName(activeTeacher);
    refreshSectionData(sectionName, teacherName, {
      force: true,
      showLoading: true,
    });
  }

  return (
    <>
      {activeTeacher ? (
        <TeacherDashboardPage
          activeSection={activeSection}
          announcementsState={announcementsState}
          callDraft={callDraft}
          callSaveState={callSaveState}
          callsState={callsState}
          classesState={classesState}
          debugWriteState={callSaveState.targetKey === GOKHAN_DEBUG_TARGET_KEY ? callSaveState : null}
          isGokhanTeacher={getLoggedInTeacherNameForWrite(activeTeacher) === GOKHAN_DEBUG_TEACHER_NAME}
          logoSrc={BRAND_LOGO_SRC}
          messagingState={messagingState}
          onCallAction={handleCallAction}
          onCallDraftChange={setCallDraft}
          onCallNoteChange={handleCallNoteChange}
          onCallNoteSave={saveCallNoteNow}
          onEnableNotifications={handleEnableNotifications}
          onOpenCallModal={handleOpenCallModal}
          onRetryAnnouncements={() => handleRetrySection('announcements')}
          onRetryCalls={() => handleRetrySection('calls')}
          onRetryClasses={() => handleRetrySection('classes')}
          onSectionChange={handleSectionChange}
          onSwitchTeacher={handleSwitchTeacher}
          onTestGokhanWrite={handleTestGokhanWrite}
          selectedCallKey={selectedCallKey}
          teacherName={getTeacherName(activeTeacher)}
          teacherNameForSaving={getLoggedInTeacherNameForWrite(activeTeacher)}
        />
      ) : (
        <LandingPage
          entryError={entryError}
          isTeachersLoading={teachersState.status === 'loading'}
          logoSrc={BRAND_LOGO_SRC}
          onEnter={handleEnterTeacher}
          onRetryTeachers={initializeTeachers}
          onTeacherInputChange={handleTeacherInputChange}
          teacherInput={teacherInput}
          teachersError={teachersState.error}
        />
      )}
    </>
  );
}

export default App;
