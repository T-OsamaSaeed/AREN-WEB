'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandLogo from './BrandLogo';
import { PhoneIcon, WhatsAppIcon } from './Icons';
import { clearStoredTeacherName, getStoredTeacherName } from './TeacherLogin';
import {
  getAnnouncements,
  getTeacherCalls,
  getTeacherSchedule,
  logCallAction,
  saveWeeklyCallNote,
} from '../lib/data/academy';
import { getSupabaseDebugInfo } from '../lib/supabase/client';
import { getCurrentWeekKey } from '../lib/utils/week';

const TABS = [
  { id: 'classes', label: 'Dersler' },
  { id: 'calls', label: 'Aramalar' },
  { id: 'announcements', label: 'Duyurular' },
];

const DAY_ORDER = [
  { id: 'monday', label: 'Pazartesi', shortLabel: 'Pzt', aliases: ['monday', 'pazartesi', 'pzt'] },
  { id: 'tuesday', label: 'Salı', shortLabel: 'Sal', aliases: ['tuesday', 'sali', 'salı', 'sal'] },
  { id: 'wednesday', label: 'Çarşamba', shortLabel: 'Çar', aliases: ['wednesday', 'carsamba', 'çarşamba', 'çar'] },
  { id: 'thursday', label: 'Perşembe', shortLabel: 'Per', aliases: ['thursday', 'persembe', 'perşembe', 'per'] },
  { id: 'friday', label: 'Cuma', shortLabel: 'Cum', aliases: ['friday', 'cuma', 'cum'] },
  { id: 'saturday', label: 'Cumartesi', shortLabel: 'Cmt', aliases: ['saturday', 'cumartesi', 'cmt'] },
  { id: 'sunday', label: 'Pazar', shortLabel: 'Paz', aliases: ['sunday', 'pazar', 'paz'] },
];

function normalizeDay(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveDay(value) {
  const normalizedValue = normalizeDay(value);
  const match = DAY_ORDER.find((day) => day.aliases.some((alias) => normalizeDay(alias) === normalizedValue));
  return match || { id: normalizedValue || 'other', label: value || 'Diğer', shortLabel: String(value || 'Diğer').slice(0, 3) };
}

function getTodayDayId() {
  const dayIds = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayIds[new Date().getDay()] || 'monday';
}

function groupScheduleByDay(items) {
  const groups = new Map();

  items.forEach((item) => {
    const resolvedDay = resolveDay(item.day);
    if (!groups.has(resolvedDay.id)) {
      groups.set(resolvedDay.id, {
        ...resolvedDay,
        items: [],
        sortIndex: DAY_ORDER.findIndex((day) => day.id === resolvedDay.id),
      });
    }

    groups.get(resolvedDay.id).items.push(item);
  });

  return [...groups.values()].sort((left, right) => {
    const leftIndex = left.sortIndex === -1 ? 99 : left.sortIndex;
    const rightIndex = right.sortIndex === -1 ? 99 : right.sortIndex;
    return leftIndex - rightIndex;
  });
}

function formatDateLabel() {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
}

function formatTime(item) {
  if (item.time_slot) {
    return item.time_slot.replace(/:/g, '.');
  }

  const startTime = String(item.start_time || '').replace(/:00$/, '').replace(/:/g, '.');
  const endTime = String(item.end_time || '').replace(/:00$/, '').replace(/:/g, '.');
  return [startTime, endTime].filter(Boolean).join(' - ') || 'Saat yok';
}

function getSessionTypeLabel(value) {
  const normalizedValue = normalizeDay(value);
  if (['private', 'ozel', 'özel'].includes(normalizedValue)) {
    return 'Özel ders';
  }

  if (['group', 'grup'].includes(normalizedValue)) {
    return 'Grup';
  }

  return value || 'Ders';
}

function getStatusLabel(status) {
  if (status === 'note') return 'Not var';
  if (status === 'whatsapp_clicked') return 'WhatsApp tıklandı';
  if (status === 'call_clicked') return 'Arama tıklandı';
  return 'Aranmadı';
}

function getPhoneHref(phoneNumber) {
  const cleanedPhone = String(phoneNumber || '').replace(/[^\d+]/g, '');
  return cleanedPhone ? `tel:${cleanedPhone}` : '';
}

function getWhatsAppHref(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '').replace(/^00/, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function getErrorMessage(error, prefix) {
  const message = error?.message || JSON.stringify(error);
  return `${prefix}: ${message}`;
}

export default function DashboardClient() {
  const router = useRouter();
  const [teacherName, setTeacherName] = useState('');
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [calls, setCalls] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [pageStatus, setPageStatus] = useState('loading');
  const [pageError, setPageError] = useState('');
  const [rowStatus, setRowStatus] = useState({});
  const [debugState, setDebugState] = useState({
    lastResult: '',
    lastError: '',
  });
  const weekKey = getCurrentWeekKey();
  const supabaseDebugInfo = getSupabaseDebugInfo();
  const groupedClasses = useMemo(() => groupScheduleByDay(classes), [classes]);
  const selectedDay = groupedClasses.find((group) => group.id === selectedDayId) || groupedClasses[0];

  useEffect(() => {
    const storedTeacherName = getStoredTeacherName();
    if (!storedTeacherName) {
      router.replace('/');
      return;
    }

    setTeacherName(storedTeacherName);
  }, [router]);

  useEffect(() => {
    if (!teacherName) {
      return;
    }

    loadDashboardData(teacherName);
  }, [teacherName]);

  useEffect(() => {
    if (groupedClasses.length === 0) {
      setSelectedDayId('');
      return;
    }

    if (!groupedClasses.some((group) => group.id === selectedDayId)) {
      const todayGroup = groupedClasses.find((group) => group.id === getTodayDayId());
      const mondayGroup = groupedClasses.find((group) => group.id === 'monday');
      setSelectedDayId(todayGroup?.id || mondayGroup?.id || groupedClasses[0].id);
    }
  }, [groupedClasses, selectedDayId]);

  async function loadDashboardData(currentTeacherName) {
    setPageStatus('loading');
    setPageError('');

    try {
      const [scheduleRows, callRows, announcementRows] = await Promise.all([
        getTeacherSchedule(currentTeacherName),
        getTeacherCalls(currentTeacherName, weekKey),
        getAnnouncements(),
      ]);

      setClasses(scheduleRows);
      setCalls(callRows);
      setAnnouncements(announcementRows);
      setPageStatus('ready');
    } catch (error) {
      setPageStatus('error');
      setPageError(error.message || 'Veriler yüklenemedi.');
    }
  }

  function updateCallRow(id, patch) {
    setCalls((currentCalls) =>
      currentCalls.map((call) => (call.id === id ? { ...call, ...patch } : call)),
    );
  }

  async function handleSaveNote(call) {
    const statusKey = `${call.id}:note`;
    setRowStatus((current) => ({ ...current, [statusKey]: { type: 'loading', message: 'Kaydediliyor...' } }));
    setDebugState({ lastResult: '', lastError: '' });

    try {
      const result = await saveWeeklyCallNote(
        teacherName,
        call.student_name,
        call.phone_number,
        weekKey,
        call.note || '',
      );
      setRowStatus((current) => ({ ...current, [statusKey]: { type: 'success', message: 'Not kaydedildi' } }));
      setDebugState({ lastResult: JSON.stringify(result), lastError: '' });
      updateCallRow(call.id, { weekly_status: call.note ? 'note' : call.weekly_status });
    } catch (error) {
      const message = getErrorMessage(error, 'Not kaydedilemedi');
      setRowStatus((current) => ({ ...current, [statusKey]: { type: 'error', message } }));
      setDebugState({ lastResult: '', lastError: message });
    }
  }

  async function handleContactAction(call, actionType) {
    const statusKey = `${call.id}:${actionType}`;
    const successMessage = actionType === 'call' ? 'Arama kaydedildi' : 'WhatsApp kaydedildi';
    const errorPrefix = actionType === 'call' ? 'Arama kaydedilemedi' : 'WhatsApp kaydedilemedi';
    const destinationHref = actionType === 'call'
      ? getPhoneHref(call.phone_number)
      : getWhatsAppHref(call.phone_number);

    setRowStatus((current) => ({ ...current, [statusKey]: { type: 'loading', message: 'Kaydediliyor...' } }));
    setDebugState({ lastResult: '', lastError: '' });

    try {
      const result = await logCallAction(
        teacherName,
        call.student_name,
        call.phone_number,
        weekKey,
        actionType,
      );
      setRowStatus((current) => ({ ...current, [statusKey]: { type: 'success', message: successMessage } }));
      setDebugState({ lastResult: JSON.stringify(result), lastError: '' });
      updateCallRow(call.id, {
        weekly_status: call.note ? 'note' : `${actionType}_clicked`,
        last_action_type: actionType,
        last_action_time: new Date().toISOString(),
      });

      if (destinationHref) {
        window.location.href = destinationHref;
      }
    } catch (error) {
      const message = getErrorMessage(error, errorPrefix);
      setRowStatus((current) => ({ ...current, [statusKey]: { type: 'error', message } }));
      setDebugState({ lastResult: '', lastError: message });
    }
  }

  async function handleDebugWrite() {
    setDebugState({ lastResult: '', lastError: '' });

    try {
      const result = await logCallAction(
        teacherName,
        'DEBUG TEST STUDENT',
        '0000000000',
        weekKey,
        'call',
      );
      setDebugState({ lastResult: `Debug write success: ${JSON.stringify(result)}`, lastError: '' });
    } catch (error) {
      setDebugState({ lastResult: '', lastError: `Debug write failed: ${error.message || JSON.stringify(error)}` });
    }
  }

  function handleLogout() {
    clearStoredTeacherName();
    router.replace('/');
  }

  if (!teacherName || pageStatus === 'loading') {
    return (
      <main className="dashboard-shell shell">
        <p className="status">Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell shell">
      <header className="teacher-header">
        <div className="teacher-brand">
          <div className="header-logo-badge">
            <BrandLogo />
          </div>
          <div>
            <h1 className="teacher-name">{teacherName}</h1>
            <p className="teacher-date">{formatDateLabel()}</p>
          </div>
        </div>
        <button className="button button-primary logout-button" onClick={handleLogout} type="button">
          Çıkış yap
        </button>
      </header>

      {pageError ? <p className="status status-error">{pageError}</p> : null}

      {activeTab === 'classes' ? (
        <section className="content-card">
          <div className="content-header">
            <div>
              <p className="section-kicker">Dersler</p>
              <h2 className="section-title">Haftalık ders programı</h2>
            </div>
            <button className="button button-ghost" onClick={() => loadDashboardData(teacherName)} type="button">
              Yenile
            </button>
          </div>

          <div className="day-tabs">
            {groupedClasses.map((group) => (
              <button
                className={`day-tab ${selectedDay?.id === group.id ? 'active' : ''}`}
                key={group.id}
                onClick={() => setSelectedDayId(group.id)}
                type="button"
              >
                {group.shortLabel}
              </button>
            ))}
          </div>

          <div className="stack">
            {(selectedDay?.items || []).map((item) => (
              <article className="lesson-card" key={item.id}>
                <div className="time-badge">{formatTime(item)}</div>
                <div className="stack">
                  <h3 className="card-title">{item.subject}</h3>
                  <p className="status">{item.class_or_student}</p>
                  <span className="soft-pill">{getSessionTypeLabel(item.session_type)}</span>
                  {item.notes ? <p className="status">{item.notes}</p> : null}
                </div>
              </article>
            ))}
            {classes.length === 0 ? <p className="status">Bu öğretmen için ders bulunamadı.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'calls' ? (
        <section className="content-card">
          <div className="content-header">
            <div>
              <p className="section-kicker">Aramalar</p>
              <h2 className="section-title">Arama listesi</h2>
            </div>
            <button className="button button-ghost" onClick={() => loadDashboardData(teacherName)} type="button">
              Yenile
            </button>
          </div>

          <div className="debug-box">
            <span>Current teacher used for saving: {teacherName}</span>
            <span>Current week_key: {weekKey}</span>
            <span>Supabase URL exists: {supabaseDebugInfo.hasUrl ? 'yes' : 'no'}</span>
            <span>Supabase anon key exists: {supabaseDebugInfo.hasAnonKey ? 'yes' : 'no'}</span>
            <span>URL preview: {supabaseDebugInfo.urlPreview}</span>
            <span>Last save result: {debugState.lastResult || 'No result yet'}</span>
            <span>Last error: {debugState.lastError || 'No error'}</span>
            <button className="button button-ghost" onClick={handleDebugWrite} type="button">
              Test Supabase Write
            </button>
          </div>

          <div className="stack">
            {calls.map((call) => {
              const noteStatus = rowStatus[`${call.id}:note`];
              const callStatus = rowStatus[`${call.id}:call`];
              const whatsappStatus = rowStatus[`${call.id}:whatsapp`];

              return (
                <article className="student-card" key={call.id}>
                  <div className="student-card-top">
                    <div className="stack">
                      <h3 className="card-title">{call.student_name}</h3>
                      <p className="status">{call.phone_number || 'Telefon numarası yok'}</p>
                      <span className={`status-pill ${call.weekly_status !== 'not_called' ? 'done' : ''}`}>
                        {getStatusLabel(call.weekly_status)}
                      </span>
                    </div>
                    <div className="student-actions">
                      <button className="icon-button" onClick={() => handleContactAction(call, 'call')} title="Ara" type="button">
                        <PhoneIcon />
                      </button>
                      <button className="icon-button" onClick={() => handleContactAction(call, 'whatsapp')} title="WhatsApp" type="button">
                        <WhatsAppIcon />
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="textarea"
                    onChange={(event) => updateCallRow(call.id, { note: event.target.value })}
                    placeholder="Notunuzu buraya yazın"
                    rows={2}
                    value={call.note || ''}
                  />
                  <div className="note-footer">
                    <p className={`status ${noteStatus?.type === 'error' ? 'status-error' : ''} ${noteStatus?.type === 'success' ? 'status-success' : ''}`}>
                      {noteStatus?.message || callStatus?.message || whatsappStatus?.message || ''}
                    </p>
                    <button className="button button-ghost" onClick={() => handleSaveNote(call)} type="button">
                      Kaydet
                    </button>
                  </div>
                </article>
              );
            })}
            {calls.length === 0 ? <p className="status">Bu öğretmen için atanmış arama yok.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'announcements' ? (
        <section className="content-card">
          <div className="content-header">
            <div>
              <p className="section-kicker">Duyurular</p>
              <h2 className="section-title">Son duyurular</h2>
            </div>
            <button className="button button-ghost" onClick={() => loadDashboardData(teacherName)} type="button">
              Yenile
            </button>
          </div>

          <div className="stack">
            {announcements.map((announcement) => (
              <article className="announcement-card" key={announcement.id}>
                <span className="soft-pill">{announcement.date || new Date(announcement.created_at).toLocaleDateString('tr-TR')}</span>
                <h3 className="card-title">{announcement.title}</h3>
                <p className="status">{announcement.body}</p>
              </article>
            ))}
            {announcements.length === 0 ? <p className="status">Henüz duyuru yok.</p> : null}
          </div>
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Panel bölümleri">
        {TABS.map((tab) => (
          <button
            className={activeTab === tab.id ? 'active' : ''}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
