export const ACTIVE_TEACHER_NAMES = [
  'GÖKHAN HOCA',
  'SAİKOU TEACHER',
  'AYŞEGÜL HOCA',
  'RABİA HOCA',
];

export function normalizeTeacherName(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

export function isActiveTeacherName(value) {
  const normalizedValue = normalizeTeacherName(value);
  return ACTIVE_TEACHER_NAMES.some((teacherName) => normalizeTeacherName(teacherName) === normalizedValue);
}
