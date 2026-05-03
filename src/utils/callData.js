function cleanValue(value) {
  return String(value ?? '').trim();
}

function firstNonEmptyValue(...values) {
  return values.map(cleanValue).find(Boolean) || '';
}

export function isLikelyPhoneNumber(value) {
  const digits = cleanValue(value).replace(/\D/g, '');
  return digits.length >= 7;
}

export function getCallStudentName(call) {
  const directName = firstNonEmptyValue(call?.student_name, call?.studentName);
  if (directName) {
    return directName;
  }

  const classValue = firstNonEmptyValue(call?.class_name, call?.className);
  if (classValue && !isLikelyPhoneNumber(classValue)) {
    return classValue;
  }

  return '';
}

export function getCallDisplayName(call) {
  return getCallStudentName(call) || 'İsim yok';
}

export function getCallNoteValue(call) {
  return firstNonEmptyValue(call?.note, call?.notes);
}

export function getCallWeeklyStatusValue(call) {
  if (getCallNoteValue(call)) {
    return 'note';
  }

  const rawStatus = cleanValue(call?.weekly_status || call?.weeklyStatus || call?.status)
    .toLowerCase();

  if (['note', 'not_var', 'has_note'].includes(rawStatus)) {
    return 'note';
  }

  if (['whatsapp_clicked', 'whatsapp', 'whatsapp tiklandi', 'whatsapp tıklandı'].includes(rawStatus)) {
    return 'whatsapp_clicked';
  }

  if (['call_clicked', 'call', 'arama tiklandi', 'arama tıklandı'].includes(rawStatus)) {
    return 'call_clicked';
  }

  const lastActionType = cleanValue(call?.last_action_type || call?.lastActionType || call?.action_type)
    .toLowerCase();

  if (lastActionType === 'whatsapp') {
    return 'whatsapp_clicked';
  }

  if (lastActionType === 'call') {
    return 'call_clicked';
  }

  return 'not_called';
}

export function getCallWeeklyStatusLabel(call) {
  const statusValue = getCallWeeklyStatusValue(call);

  if (statusValue === 'note') {
    return 'Not var';
  }

  if (statusValue === 'whatsapp_clicked') {
    return 'WhatsApp tıklandı';
  }

  if (statusValue === 'call_clicked') {
    return 'Arama tıklandı';
  }

  return 'Aranmadı';
}

export function getCallClassName(call) {
  const classValue = firstNonEmptyValue(call?.class_name, call?.className);
  const studentName = getCallStudentName(call);

  if (!classValue || classValue === studentName || isLikelyPhoneNumber(classValue)) {
    return '';
  }

  return classValue;
}

export function getCallPhoneNumber(call) {
  const directPhone = firstNonEmptyValue(call?.phone_number, call?.phoneNumber);
  if (directPhone) {
    return directPhone;
  }

  const subjectValue = firstNonEmptyValue(call?.subject);
  if (subjectValue && isLikelyPhoneNumber(subjectValue)) {
    return subjectValue;
  }

  const classValue = firstNonEmptyValue(call?.class_name, call?.className);
  if (classValue && isLikelyPhoneNumber(classValue)) {
    return classValue;
  }

  return '';
}

export function getCallSubject(call) {
  const subjectValue = firstNonEmptyValue(call?.subject);
  if (!subjectValue || isLikelyPhoneNumber(subjectValue)) {
    return '';
  }

  return subjectValue;
}

export function getCallRowKey(call, index) {
  return [
    index,
    getCallDisplayName(call),
    getCallClassName(call),
    getCallPhoneNumber(call),
  ].join('::');
}
