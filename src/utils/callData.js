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
