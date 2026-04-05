import { useEffect, useRef, useState } from 'react';
import LandingPage from './pages/LandingPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import {
  getCallClassName,
  getCallNoteValue,
  getCallPhoneNumber,
  getCallRowKey,
  getCallStudentName,
  getCallSubject,
} from './utils/callData';
import {
  fetchAnnouncements,
  fetchAssignedCalls,
  fetchClasses,
  fetchTeachers,
  saveCall,
} from './services/api';

const STORAGE_KEY = 'aren-academy-teacher-name';
const SEEN_ANNOUNCEMENTS_KEY = 'aren-academy-seen-announcements';
const DASHBOARD_POLL_INTERVAL_MS = 60000;
const AUTO_REFRESH_COOLDOWN_MS = 5000;
const PWA_ICON_VERSION = 'alran-brand-5';
const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}logo.jpeg?v=${PWA_ICON_VERSION}`;

function createAsyncState() {
  return {
    status: 'idle',
    data: [],
    error: '',
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

function createAnnouncementFingerprint(item) {
  return [
    item?.id,
    item?.announcement_id,
    item?.title,
    item?.date || item?.created_at || item?.createdAt,
    item?.body,
  ]
    .map((value) => String(value ?? '').trim())
    .join('::');
}

function getAnnouncementTimestamp(item) {
  const parsedDate = Date.parse(item?.date || item?.created_at || item?.createdAt || '');
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function readSeenAnnouncementKeys() {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const savedValue = window.localStorage.getItem(SEEN_ANNOUNCEMENTS_KEY);
    if (!savedValue) {
      return new Set();
    }

    const parsedValue = JSON.parse(savedValue);
    return Array.isArray(parsedValue) ? new Set(parsedValue.filter(Boolean)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenAnnouncementKeys(keys) {
  if (typeof window === 'undefined') {
    return;
  }

  const serializedKeys = JSON.stringify(Array.from(keys).slice(-120));
  window.localStorage.setItem(SEEN_ANNOUNCEMENTS_KEY, serializedKeys);
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
  const seenAnnouncementKeysRef = useRef(readSeenAnnouncementKeys());
  const refreshInFlightRef = useRef(false);
  const lastAutoRefreshAtRef = useRef(0);

  useEffect(() => {
    initializeTeachers();
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
      return undefined;
    }

    const teacherName = getTeacherName(activeTeacher);
    requestNotificationAccess();

    const runAutoRefresh = () => {
      const now = Date.now();
      if (refreshInFlightRef.current || now - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
        return;
      }

      lastAutoRefreshAtRef.current = now;
      refreshDashboardData({
        teacherName,
        notifyAnnouncements: true,
        preserveData: true,
      });
    };

    const intervalId = window.setInterval(() => {
      runAutoRefresh();
    }, DASHBOARD_POLL_INTERVAL_MS);

    const handleWindowFocus = () => {
      runAutoRefresh();
    };

    const handleOnline = () => {
      runAutoRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runAutoRefresh();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTeacher]);

  async function initializeTeachers() {
    setTeachersState({
      status: 'loading',
      data: [],
      error: '',
    });

    try {
      const teachers = await fetchTeachers();
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
    notifyAnnouncements = false,
    preserveData = false,
    showLoading = false,
  }) {
    if (!teacherName || refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (showLoading) {
      setClassesState({
        status: 'loading',
        data: [],
        error: '',
      });
      setCallsState({
        status: 'loading',
        data: [],
        error: '',
      });
      setAnnouncementsState({
        status: 'loading',
        data: [],
        error: '',
      });
    }

    try {
      await Promise.all([
        loadClasses(teacherName, { preserveData }),
        loadCalls(teacherName, { preserveData }),
        loadAnnouncements({ notifyNew: notifyAnnouncements, preserveData }),
      ]);
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  async function loadClasses(teacherName, options = {}) {
    const { preserveData = false } = options;

    try {
      const classes = await fetchClasses(teacherName);
      setClassesState({
        status: 'success',
        data: classes,
        error: '',
      });
    } catch (error) {
      setClassesState((currentState) => ({
        status: 'error',
        data: preserveData ? currentState.data : [],
        error: error.message || 'Dersler şu anda yüklenemedi.',
      }));
    }
  }

  async function loadCalls(teacherName, options = {}) {
    const { preserveData = false } = options;

    try {
      const calls = await fetchAssignedCalls(teacherName);
      setCallsState({
        status: 'success',
        data: calls,
        error: '',
      });
    } catch (error) {
      setCallsState((currentState) => ({
        status: 'error',
        data: preserveData ? currentState.data : [],
        error: error.message || 'Aramalar şu anda yüklenemedi.',
      }));
    }
  }

  async function loadAnnouncements(options = {}) {
    const { notifyNew = false, preserveData = false } = options;

    try {
      const announcements = await fetchAnnouncements();
      const currentAnnouncementKeys = new Set(
        announcements
          .map((item) => createAnnouncementFingerprint(item))
          .filter(Boolean),
      );
      const newAnnouncements = announcements
        .filter((item) => {
          const fingerprint = createAnnouncementFingerprint(item);
          return fingerprint && !seenAnnouncementKeysRef.current.has(fingerprint);
        })
        .sort((left, right) => getAnnouncementTimestamp(right) - getAnnouncementTimestamp(left));

      setAnnouncementsState({
        status: 'success',
        data: announcements,
        error: '',
      });

      if (notifyNew && newAnnouncements.length > 0) {
        await showAnnouncementNotification(newAnnouncements[0]);
      }

      seenAnnouncementKeysRef.current = currentAnnouncementKeys;
      writeSeenAnnouncementKeys(currentAnnouncementKeys);
    } catch (error) {
      setAnnouncementsState((currentState) => ({
        status: 'error',
        data: preserveData || notifyNew ? currentState.data : [],
        error: error.message || 'Duyurular şu anda yüklenemedi.',
      }));
    }
  }

  async function requestNotificationAccess() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'default') {
      return;
    }

    try {
      await Notification.requestPermission();
    } catch {
      // Keep the dashboard usable even if the browser blocks the prompt.
    }
  }

  async function showAnnouncementNotification(announcement) {
    if (
      typeof window === 'undefined'
      || !('Notification' in window)
      || Notification.permission !== 'granted'
    ) {
      return;
    }

    const notificationTitle = announcement?.title?.trim() || 'Yeni duyuru';
    const notificationBody = announcement?.body?.trim() || 'Alran Academy paneline yeni bir duyuru eklendi.';
    const appIconUrl = new URL(
      `${import.meta.env.BASE_URL}pwa-192.png?v=${PWA_ICON_VERSION}`,
      window.location.href,
    ).toString();

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration?.showNotification) {
          await registration.showNotification(notificationTitle, {
            body: notificationBody,
            icon: appIconUrl,
            badge: appIconUrl,
            tag: createAnnouncementFingerprint(announcement),
            data: {
              url: window.location.href,
            },
          });
          return;
        }
      }

      new Notification(notificationTitle, {
        body: notificationBody,
        icon: appIconUrl,
        tag: createAnnouncementFingerprint(announcement),
      });
    } catch {
      // If notifications fail, avoid interrupting normal dashboard use.
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

  function handleSwitchTeacher() {
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
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function resetCallEditor() {
    setSelectedCall(null);
    setSelectedCallKey('');
    setCallDraft('');
    setCallDraftInitial('');
  }

  function updateCallNoteInState(targetCallKey, note) {
    setCallsState((currentState) => ({
      ...currentState,
      data: currentState.data.map((item, index) =>
        getCallRowKey(item, index) === targetCallKey
          ? { ...item, note, notes: note }
          : item,
      ),
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

    setCallSaveState({
      status: 'loading',
      error: '',
    });

    try {
      await saveCall({
        action: 'saveCall',
        teacher_name: getTeacherName(activeTeacher),
        student_name: getCallStudentName(selectedCall),
        class_name: getCallClassName(selectedCall),
        subject: getCallSubject(selectedCall),
        phone_number: getCallPhoneNumber(selectedCall),
        contact_type: 'Call',
        result: 'Answered',
        note: nextNote,
      });

      updateCallNoteInState(selectedCallKey, nextNote);
      setCallDraftInitial(nextNote);
      setCallSaveState({
        status: 'idle',
        error: '',
      });
      return true;
    } catch (error) {
      setCallSaveState({
        status: 'error',
        error: error.message || 'Arama notu şu anda kaydedilemedi.',
      });
      return false;
    }
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

  function handleRetrySection(sectionName) {
    if (!activeTeacher) {
      return;
    }

    const teacherName = getTeacherName(activeTeacher);

    if (sectionName === 'classes') {
      loadClasses(teacherName);
    }

    if (sectionName === 'calls') {
      loadCalls(teacherName);
    }

    if (sectionName === 'announcements') {
      loadAnnouncements();
    }
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
          logoSrc={BRAND_LOGO_SRC}
          onCallDraftChange={setCallDraft}
          onOpenCallModal={handleOpenCallModal}
          onRetryAnnouncements={() => handleRetrySection('announcements')}
          onRetryCalls={() => handleRetrySection('calls')}
          onRetryClasses={() => handleRetrySection('classes')}
          onSectionChange={setActiveSection}
          onSwitchTeacher={handleSwitchTeacher}
          selectedCallKey={selectedCallKey}
          teacherName={getTeacherName(activeTeacher)}
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
