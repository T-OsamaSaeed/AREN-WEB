import { supabase as supabaseClient } from '../lib/supabase/client';
import {
  clonePlaceholderData,
  placeholderAnnouncements,
  placeholderCalls,
  placeholderClasses,
  placeholderTeachers,
} from '../lib/supabase/placeholders';
import { getCurrentWeekKey } from '../utils/week';

const LOCAL_CALL_TRACKING_KEY = 'aren-academy-call-tracking';

function normalizeTeacherName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function getSafeTeacherName(teacherName) {
  return String(teacherName || '').trim();
}

function getTeacherName(item) {
  return item?.teacher_name || item?.teacher || item?.name || '';
}

function filterActiveTeachers(items) {
  return items
    .filter((item) => item?.is_active !== false)
    .map((item) => ({
      ...item,
      is_active: true,
    }));
}

function matchesTeacherName(item, teacherName) {
  return normalizeTeacherName(getTeacherName(item)) === normalizeTeacherName(teacherName);
}

function makeWeeklyCallKey({ teacher_name, student_name, week_key }) {
  return [
    normalizeTeacherName(teacher_name),
    normalizeTeacherName(student_name),
    week_key || getCurrentWeekKey(),
  ].join('::');
}

function readLocalCallTracking() {
  if (typeof window === 'undefined') {
    return {
      actions: [],
      notes: {},
    };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_CALL_TRACKING_KEY) || '{}');
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
    };
  } catch {
    return {
      actions: [],
      notes: {},
    };
  }
}

function writeLocalCallTracking(nextTracking) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCAL_CALL_TRACKING_KEY, JSON.stringify(nextTracking));
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

function formatTimeForSchedule(value) {
  const safeValue = String(value || '').trim();
  return safeValue.replace(/:00$/, '').replace(/:/g, '.');
}

function normalizeScheduleSession(item) {
  const startTime = formatTimeForSchedule(item.start_time);
  const endTime = formatTimeForSchedule(item.end_time);
  const generatedTimeSlot = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime;

  return {
    ...item,
    time: item.time_slot || item.time || generatedTimeSlot,
    class_name: item.class_or_student || item.class_name || item.className || '',
  };
}

function getFallbackTeachers() {
  return filterActiveTeachers(clonePlaceholderData(placeholderTeachers));
}

function getFallbackSchedule(teacherName) {
  const safeTeacherName = getSafeTeacherName(teacherName);

  return clonePlaceholderData(placeholderClasses)
    .filter((item) => matchesTeacherName(item, safeTeacherName));
}

function getFallbackCalls(teacherName) {
  const safeTeacherName = getSafeTeacherName(teacherName);

  return mergeLocalWeeklyTracking(
    clonePlaceholderData(placeholderCalls).filter((item) => matchesTeacherName(item, safeTeacherName)),
    safeTeacherName,
  );
}

function getFallbackAnnouncements() {
  return clonePlaceholderData(placeholderAnnouncements);
}

function warnAndUseFallback(label, error, fallbackData) {
  console.warn(`[Supabase] ${label} failed. Emergency placeholder fallback used.`, error);
  return fallbackData;
}

function throwFriendlyDataError(message, error) {
  console.warn('[Supabase] Data load failed without fallback.', error);
  throw new Error(message);
}

function mergeLocalWeeklyTracking(items, teacherName) {
  const currentWeekKey = getCurrentWeekKey();
  const tracking = readLocalCallTracking();

  return items.map((item) => {
    const studentName = item.student_name || item.studentName || item.class_name || '';
    const weeklyKey = makeWeeklyCallKey({
      teacher_name: teacherName,
      student_name: studentName,
      week_key: currentWeekKey,
    });
    const note = tracking.notes[weeklyKey]?.note ?? item.note ?? item.notes ?? '';
    const latestAction = [...tracking.actions]
      .reverse()
      .find((action) => makeWeeklyCallKey(action) === weeklyKey);

    return {
      ...item,
      note,
      notes: note,
      week_key: currentWeekKey,
      weekly_status: getWeeklyStatusFromNoteAndAction(note, latestAction?.action_type),
      last_action_type: latestAction?.action_type || '',
      last_action_at: latestAction?.action_time || latestAction?.created_at || '',
    };
  });
}

async function mergeSupabaseWeeklyTracking(items, teacherName, supabase) {
  const currentWeekKey = getCurrentWeekKey();
  const studentNames = items
    .map((item) => item.student_name || item.studentName || item.class_name || '')
    .filter(Boolean);

  if (items.length === 0 || studentNames.length === 0) {
    return items;
  }

  try {
    const [notesResult, actionsResult] = await Promise.all([
      supabase
        .from('weekly_call_notes')
        .select('*')
        .eq('teacher_name', teacherName)
        .eq('week_key', currentWeekKey)
        .in('student_name', studentNames),
      supabase
        .from('call_activity_log')
        .select('*')
        .eq('teacher_name', teacherName)
        .eq('week_key', currentWeekKey)
        .in('student_name', studentNames)
        .order('action_time', { ascending: false }),
    ]);

    if (notesResult.error || actionsResult.error) {
      throw notesResult.error || actionsResult.error;
    }

    return items.map((item) => {
      const studentName = item.student_name || item.studentName || item.class_name || '';
      const weeklyKey = makeWeeklyCallKey({
        teacher_name: teacherName,
        student_name: studentName,
        week_key: currentWeekKey,
      });
      const weeklyNote = (notesResult.data || []).find((note) => makeWeeklyCallKey(note) === weeklyKey);
      const latestAction = (actionsResult.data || []).find((action) => makeWeeklyCallKey(action) === weeklyKey);
      const note = weeklyNote?.note ?? item.note ?? item.notes ?? '';

      return {
        ...item,
        note,
        notes: note,
        week_key: currentWeekKey,
        weekly_status: getWeeklyStatusFromNoteAndAction(note, latestAction?.action_type),
        last_action_type: latestAction?.action_type || '',
        last_action_at: latestAction?.action_time || latestAction?.created_at || '',
      };
    });
  } catch (error) {
    console.warn('[Supabase] Weekly call tracking could not be merged yet.', error);
    return items.map((item) => ({
      ...item,
      week_key: currentWeekKey,
      weekly_status: getWeeklyStatusFromNoteAndAction(item.note ?? item.notes, item.last_action_type),
    }));
  }
}

function createReportRowKey(item) {
  return makeWeeklyCallKey({
    teacher_name: item.teacher_name,
    student_name: item.student_name,
    week_key: item.week_key,
  });
}

function getReportStatus(note, latestActionType) {
  if (String(note || '').trim()) {
    return 'Not var';
  }

  if (latestActionType === 'whatsapp') {
    return 'WhatsApp tıklandı';
  }

  if (latestActionType === 'call') {
    return 'Arama tıklandı';
  }

  return 'Aranmadı';
}

export async function getTeachers() {
  const supabase = supabaseClient;
  const fallbackTeachers = getFallbackTeachers();

  if (!supabase) {
    return fallbackTeachers;
  }

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .order('teacher_name', { ascending: true });

  if (error) {
    return warnAndUseFallback('Teachers query', error, fallbackTeachers);
  }

  return filterActiveTeachers(data || fallbackTeachers);
}

export async function getTeacherSchedule(teacherName) {
  const supabase = supabaseClient;
  const safeTeacherName = getSafeTeacherName(teacherName);
  const fallbackSchedule = getFallbackSchedule(safeTeacherName);

  if (!supabase) {
    return fallbackSchedule;
  }

  const { data, error } = await supabase
    .from('schedule_sessions')
    .select('*')
    .eq('teacher_name', safeTeacherName)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    return warnAndUseFallback('Schedule query', error, fallbackSchedule);
  }

  return (data || fallbackSchedule).map(normalizeScheduleSession);
}

export async function getTeacherCalls(teacherName) {
  const supabase = supabaseClient;
  const safeTeacherName = getSafeTeacherName(teacherName);
  const fallbackCalls = getFallbackCalls(safeTeacherName);

  console.log('[Supabase] call_assignments load starting', {
    teacher_name: safeTeacherName,
  });

  if (!supabase) {
    console.log('[Supabase] call_assignments load skipped because Supabase client is missing', {
      teacher_name: safeTeacherName,
    });
    return fallbackCalls;
  }

  const { data, error } = await supabase
    .from('call_assignments')
    .select('*')
    .eq('teacher_name', safeTeacherName)
    .eq('is_active', true)
    .order('student_name', { ascending: true });

  if (error) {
    return warnAndUseFallback('Call assignments query', error, fallbackCalls);
  }

  console.log('[Supabase] call_assignments load succeeded', {
    teacher_name: safeTeacherName,
    count: (data || []).length,
  });

  return mergeSupabaseWeeklyTracking(data || fallbackCalls, safeTeacherName, supabase);
}

export async function saveWeeklyCallNote(teacherName, studentName, phoneNumber, weekKey, note) {
  const supabase = supabaseClient;
  const teacherNameToSave = getSafeTeacherName(teacherName);
  const studentNameToSave = String(studentName || '').trim();
  const phoneNumberToSave = phoneNumber || '';
  const weekKeyToSave = weekKey || getCurrentWeekKey();
  const noteToSave = note || '';

  console.log('[Supabase] weekly_call_notes upsert starting', {
    teacher_name: teacherNameToSave,
    student_name: studentNameToSave,
    phone_number: phoneNumberToSave,
    week_key: weekKeyToSave,
    note: noteToSave,
  });

  if (!supabase) {
    throw new Error('Supabase client is missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase
    .from("weekly_call_notes")
    .upsert(
      {
        teacher_name: teacherNameToSave,
        student_name: studentNameToSave,
        phone_number: phoneNumberToSave,
        week_key: weekKeyToSave,
        note: noteToSave,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "teacher_name,student_name,week_key"
      }
    )
    .select();

  console.log("saveWeeklyCallNote result:", { data, error });

  if (error) {
    console.error("saveWeeklyCallNote error:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("Supabase returned no data after saving note");
  }

  return data;
}

export async function logCallAction(teacherName, studentName, phoneNumber, weekKey, actionType) {
  const supabase = supabaseClient;
  const teacherNameToSave = getSafeTeacherName(teacherName);
  const studentNameToSave = String(studentName || '').trim();
  const phoneNumberToSave = phoneNumber || '';
  const weekKeyToSave = weekKey || getCurrentWeekKey();
  const actionPayload = {
    teacher_name: teacherNameToSave,
    student_name: studentNameToSave,
    phone_number: phoneNumberToSave,
    week_key: weekKeyToSave,
    action_type: actionType,
    action_time: new Date().toISOString(),
  };

  if (!['call', 'whatsapp'].includes(actionType)) {
    throw new Error('Geçersiz arama işlemi.');
  }

  console.log('[Supabase] call_activity_log insert starting', actionPayload);

  if (!supabase) {
    throw new Error('Supabase client is missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase
    .from('call_activity_log')
    .insert(actionPayload)
    .select();

  console.log('logCallAction result:', { data, error });

  if (error) {
    console.error('logCallAction error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Supabase returned no data after saving call action');
  }

  return data;
}

export async function getAnnouncements() {
  const supabase = supabaseClient;
  const fallbackAnnouncements = getFallbackAnnouncements();

  if (!supabase) {
    return fallbackAnnouncements;
  }

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return warnAndUseFallback('Announcements query', error, fallbackAnnouncements);
  }

  return data || fallbackAnnouncements;
}

export async function getAdminWeeklyCallReport(weekKey = getCurrentWeekKey()) {
  const supabase = supabaseClient;

  if (!supabase) {
    throwFriendlyDataError('Haftalık arama raporu için Supabase bağlantısı gerekiyor.');
  }

  const [assignmentsResult, notesResult, actionsResult] = await Promise.all([
    supabase
      .from('call_assignments')
      .select('*')
      .eq('is_active', true)
      .order('teacher_name', { ascending: true })
      .order('student_name', { ascending: true }),
    supabase
      .from('weekly_call_notes')
      .select('*')
      .eq('week_key', weekKey),
    supabase
      .from('call_activity_log')
      .select('*')
      .eq('week_key', weekKey)
      .order('action_time', { ascending: false }),
  ]);

  const queryError = assignmentsResult.error || notesResult.error || actionsResult.error;
  if (queryError) {
    throwFriendlyDataError('Haftalık arama raporu şu anda yüklenemedi.', queryError);
  }

  const rowsByKey = new Map();

  (assignmentsResult.data || []).forEach((assignment) => {
    const key = createReportRowKey({
      ...assignment,
      week_key: weekKey,
    });
    rowsByKey.set(key, {
      teacher_name: assignment.teacher_name,
      student_name: assignment.student_name,
      phone_number: assignment.phone_number || '',
      week_key: weekKey,
      note: '',
      call_count: 0,
      whatsapp_count: 0,
      last_action_type: '',
      last_action_time: '',
      weekly_status: 'Aranmadı',
    });
  });

  (notesResult.data || []).forEach((note) => {
    const key = createReportRowKey(note);
    const currentRow = rowsByKey.get(key) || {
      teacher_name: note.teacher_name,
      student_name: note.student_name,
      phone_number: note.phone_number || '',
      week_key: note.week_key,
      call_count: 0,
      whatsapp_count: 0,
      last_action_type: '',
      last_action_time: '',
    };

    rowsByKey.set(key, {
      ...currentRow,
      note: note.note || '',
      weekly_status: getReportStatus(note.note, currentRow.last_action_type),
    });
  });

  (actionsResult.data || []).forEach((action) => {
    const key = createReportRowKey(action);
    const currentRow = rowsByKey.get(key) || {
      teacher_name: action.teacher_name,
      student_name: action.student_name,
      phone_number: action.phone_number || '',
      week_key: action.week_key,
      note: '',
      call_count: 0,
      whatsapp_count: 0,
    };
    const isNewestAction = !currentRow.last_action_time
      || new Date(action.action_time) > new Date(currentRow.last_action_time);
    const nextLastActionType = isNewestAction ? action.action_type : currentRow.last_action_type;

    rowsByKey.set(key, {
      ...currentRow,
      phone_number: currentRow.phone_number || action.phone_number || '',
      call_count: currentRow.call_count + (action.action_type === 'call' ? 1 : 0),
      whatsapp_count: currentRow.whatsapp_count + (action.action_type === 'whatsapp' ? 1 : 0),
      last_action_type: nextLastActionType,
      last_action_time: isNewestAction ? action.action_time : currentRow.last_action_time,
      weekly_status: getReportStatus(currentRow.note, nextLastActionType),
    });
  });

  const rows = [...rowsByKey.values()].sort((left, right) =>
    left.teacher_name.localeCompare(right.teacher_name, 'tr')
    || left.student_name.localeCompare(right.student_name, 'tr'),
  );

  return {
    week_key: weekKey,
    generated_at: new Date().toISOString(),
    rows,
    totals: {
      students: rows.length,
      calls: rows.reduce((sum, row) => sum + row.call_count, 0),
      whatsapps: rows.reduce((sum, row) => sum + row.whatsapp_count, 0),
      notes: rows.filter((row) => String(row.note || '').trim()).length,
    },
  };
}

export async function saveNotificationSubscription(payload) {
  const supabase = supabaseClient;

  if (!supabase) {
    console.info('[Supabase] Notification subscription save is waiting for Supabase configuration.');
    return {
      ok: true,
      text: 'Supabase bağlantısı hazır değil. Bildirim kaydı daha sonra bağlanacak.',
      data: null,
      requestBody: payload,
    };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      teacher_name: payload.teacher_name,
      endpoint: payload.endpoint,
      subscription: payload.subscription,
    }, {
      onConflict: 'endpoint',
    })
    .select()
    .single();

  if (error) {
    const saveError = new Error('Bildirim kaydı şu anda kaydedilemedi.');
    saveError.responseText = error.message;
    throw saveError;
  }

  return {
    ok: true,
    text: 'Supabase push subscription saved.',
    data,
    requestBody: payload,
  };
}
