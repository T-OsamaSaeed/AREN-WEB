import { ACTIVE_TEACHER_NAMES } from '../constants/teachers';
import { getSupabaseBrowserClient } from '../supabase/client';
import { getCurrentWeekKey } from '../utils/week';

function requireSupabaseClient() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error('Supabase client is missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

function throwIfError(error, fallbackMessage) {
  if (!error) {
    return;
  }

  throw new Error(`${fallbackMessage}: ${error.message || JSON.stringify(error)}`);
}

function getStatusFromNoteAndAction(note, actionType) {
  if (String(note || '').trim()) {
    return 'note';
  }

  if (actionType === 'whatsapp') {
    return 'whatsapp_clicked';
  }

  if (actionType === 'call') {
    return 'call_clicked';
  }

  return 'not_called';
}

function makeStudentKey(teacherName, studentName, weekKey) {
  return `${teacherName}::${studentName}::${weekKey}`.toLocaleLowerCase('tr-TR');
}

export async function getTeachers() {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .in('teacher_name', ACTIVE_TEACHER_NAMES)
    .order('teacher_name', { ascending: true });

  throwIfError(error, 'Öğretmen listesi yüklenemedi');
  return data || [];
}

export async function getTeacherSchedule(teacherName) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('schedule_sessions')
    .select('*')
    .eq('teacher_name', teacherName)
    .eq('is_active', true)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });

  throwIfError(error, 'Dersler yüklenemedi');
  return data || [];
}

export async function getTeacherCalls(teacherName, weekKey = getCurrentWeekKey()) {
  const supabase = requireSupabaseClient();
  const { data: assignments, error: assignmentsError } = await supabase
    .from('call_assignments')
    .select('*')
    .eq('teacher_name', teacherName)
    .eq('is_active', true)
    .order('student_name', { ascending: true });

  throwIfError(assignmentsError, 'Arama listesi yüklenemedi');

  const studentNames = (assignments || []).map((item) => item.student_name).filter(Boolean);
  if (studentNames.length === 0) {
    return [];
  }

  const [notesResult, actionsResult] = await Promise.all([
    supabase
      .from('weekly_call_notes')
      .select('*')
      .eq('teacher_name', teacherName)
      .eq('week_key', weekKey)
      .in('student_name', studentNames),
    supabase
      .from('call_activity_log')
      .select('*')
      .eq('teacher_name', teacherName)
      .eq('week_key', weekKey)
      .in('student_name', studentNames)
      .order('action_time', { ascending: false }),
  ]);

  throwIfError(notesResult.error, 'Haftalık notlar yüklenemedi');
  throwIfError(actionsResult.error, 'Arama hareketleri yüklenemedi');

  const notesByKey = new Map();
  (notesResult.data || []).forEach((note) => {
    notesByKey.set(makeStudentKey(note.teacher_name, note.student_name, note.week_key), note);
  });

  const latestActionsByKey = new Map();
  (actionsResult.data || []).forEach((action) => {
    const key = makeStudentKey(action.teacher_name, action.student_name, action.week_key);
    if (!latestActionsByKey.has(key)) {
      latestActionsByKey.set(key, action);
    }
  });

  return (assignments || []).map((assignment) => {
    const key = makeStudentKey(teacherName, assignment.student_name, weekKey);
    const note = notesByKey.get(key);
    const latestAction = latestActionsByKey.get(key);

    return {
      ...assignment,
      week_key: weekKey,
      note: note?.note || '',
      weekly_status: getStatusFromNoteAndAction(note?.note, latestAction?.action_type),
      last_action_type: latestAction?.action_type || '',
      last_action_time: latestAction?.action_time || '',
    };
  });
}

export async function saveWeeklyCallNote(teacherName, studentName, phoneNumber, weekKey, note) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('weekly_call_notes')
    .upsert(
      {
        teacher_name: teacherName,
        student_name: studentName,
        phone_number: phoneNumber || '',
        week_key: weekKey,
        note: note || '',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'teacher_name,student_name,week_key',
      },
    )
    .select();

  console.log('saveWeeklyCallNote result:', { data, error });

  if (error) {
    console.error('saveWeeklyCallNote error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Supabase returned no data after saving note');
  }

  return data;
}

export async function logCallAction(teacherName, studentName, phoneNumber, weekKey, actionType) {
  if (!['call', 'whatsapp'].includes(actionType)) {
    throw new Error('Invalid call action type');
  }

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('call_activity_log')
    .insert({
      teacher_name: teacherName,
      student_name: studentName,
      phone_number: phoneNumber || '',
      week_key: weekKey,
      action_type: actionType,
      action_time: new Date().toISOString(),
    })
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
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  throwIfError(error, 'Duyurular yüklenemedi');
  return data || [];
}
