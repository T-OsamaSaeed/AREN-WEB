import { ACTIVE_TEACHER_NAMES } from '../constants/teachers';
import { getSupabaseAdminClient } from '../supabase/server';
import { getCurrentWeekKey } from '../utils/week';

function assertAdminPassword(password) {
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    throw new Error('ADMIN_PASSWORD is not configured.');
  }

  if (password !== expectedPassword) {
    throw new Error('Admin password is incorrect.');
  }
}

function getRowKey(item, weekKey) {
  return `${item.teacher_name}::${item.student_name}::${item.week_key || weekKey}`.toLocaleLowerCase('tr-TR');
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

export async function getAdminWeeklyReport(weekKey = getCurrentWeekKey()) {
  const supabase = getSupabaseAdminClient();
  const [assignmentsResult, notesResult, actionsResult] = await Promise.all([
    supabase
      .from('call_assignments')
      .select('*')
      .eq('is_active', true)
      .in('teacher_name', ACTIVE_TEACHER_NAMES)
      .order('teacher_name', { ascending: true })
      .order('student_name', { ascending: true }),
    supabase
      .from('weekly_call_notes')
      .select('*')
      .eq('week_key', weekKey)
      .in('teacher_name', ACTIVE_TEACHER_NAMES),
    supabase
      .from('call_activity_log')
      .select('*')
      .eq('week_key', weekKey)
      .in('teacher_name', ACTIVE_TEACHER_NAMES)
      .order('action_time', { ascending: false }),
  ]);

  const queryError = assignmentsResult.error || notesResult.error || actionsResult.error;
  if (queryError) {
    throw queryError;
  }

  const rowsByKey = new Map();

  (assignmentsResult.data || []).forEach((assignment) => {
    const key = getRowKey({ ...assignment, week_key: weekKey }, weekKey);
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
    const key = getRowKey(note, weekKey);
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
    const key = getRowKey(action, weekKey);
    const currentRow = rowsByKey.get(key) || {
      teacher_name: action.teacher_name,
      student_name: action.student_name,
      phone_number: action.phone_number || '',
      week_key: action.week_key,
      note: '',
      call_count: 0,
      whatsapp_count: 0,
      last_action_type: '',
      last_action_time: '',
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
    summary_by_teacher: ACTIVE_TEACHER_NAMES.map((teacherName) => {
      const teacherRows = rows.filter((row) => row.teacher_name === teacherName);

      return {
        teacher_name: teacherName,
        total_assigned_calls: teacherRows.length,
        total_call_actions: teacherRows.reduce((sum, row) => sum + row.call_count, 0),
        total_whatsapp_actions: teacherRows.reduce((sum, row) => sum + row.whatsapp_count, 0),
        total_notes: teacherRows.filter((row) => String(row.note || '').trim()).length,
        not_contacted_students: teacherRows.filter((row) => !row.last_action_type && !String(row.note || '').trim()).length,
      };
    }),
  };
}

export async function createAnnouncement(date, title, body) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      date: date || new Date().toISOString().slice(0, 10),
      title,
      body,
    })
    .select();

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Supabase returned no data after creating announcement');
  }

  return data[0];
}

export function verifyAdminPassword(password) {
  assertAdminPassword(password);
}
