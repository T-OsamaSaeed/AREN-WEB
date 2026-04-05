export const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbwR7vZolZnGn3TgrDtfmGFUkqmSQS9vRnEGDH_7IHuRPCmjKXcXx9Tu2Cnjom0n0x28/exec';

function buildUrl(action, params = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function requestJson(url, options = {}, allowPlainText = false) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error('Akademi servisi şu anda kullanılamıyor.');
  }

  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (allowPlainText) {
      return { message: text };
    }

    throw new Error('Akademi servisi beklenmeyen bir yanıt verdi.');
  }
}

function getArray(payload, preferredKeys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of preferredKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  for (const key of preferredKeys) {
    if (Array.isArray(payload?.data?.[key])) {
      return payload.data[key];
    }
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function toFormBody(values) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });

  return params.toString();
}

export async function fetchTeachers() {
  const payload = await requestJson(buildUrl('teachers'));
  return getArray(payload, ['teachers']);
}

export async function fetchClasses(teacherName) {
  const payload = await requestJson(
    buildUrl('classes', {
      teacher_name: teacherName,
    }),
  );

  return getArray(payload, ['classes']);
}

export async function fetchAssignedCalls(teacherName) {
  const payload = await requestJson(
    buildUrl('callsAssigned', {
      teacher_name: teacherName,
    }),
  );

  return getArray(payload, ['calls', 'callsAssigned']);
}

export async function fetchAnnouncements() {
  const payload = await requestJson(buildUrl('announcements'));
  return getArray(payload, ['announcements']);
}

export async function saveCall(payload) {
  return requestJson(
    API_BASE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: toFormBody(payload),
    },
    true,
  );
}
