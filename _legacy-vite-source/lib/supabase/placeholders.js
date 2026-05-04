export const placeholderTeachers = [
  {
    teacher_name: 'GÖKHAN HOCA',
    subject: 'Matematik / Akıl Oyunları / Mental Aritmetik',
    is_active: true,
  },
  {
    teacher_name: 'SAİKOU TEACHER',
    subject: 'İngilizce',
    is_active: true,
  },
  {
    teacher_name: 'AYŞEGÜL HOCA',
    subject: 'Fen-Bilim',
    is_active: true,
  },
  {
    teacher_name: 'RABİA HOCA',
    subject: 'Çalışma Salonu / Support / Aramalar',
    is_active: true,
  },
  {
    teacher_name: 'ZEYNA HOCA',
    subject: '',
    is_active: false,
  },
  {
    teacher_name: 'ELİF HOCA',
    subject: '',
    is_active: false,
  },
];

export const placeholderClasses = [
  {
    teacher_name: 'GÖKHAN HOCA',
    day: 'monday',
    time: '09.00 - 09.40',
    subject: 'Matematik',
    class_name: 'Özel ders',
    session_type: 'private',
  },
  {
    teacher_name: 'GÖKHAN HOCA',
    day: 'monday',
    time: '09.50 - 10.30',
    subject: 'Matematik',
    class_name: 'Grup',
    session_type: 'group',
  },
  {
    teacher_name: 'GÖKHAN HOCA',
    day: 'tuesday',
    time: '14.30 - 15.05',
    subject: 'Fen',
    class_name: 'Özel ders',
    session_type: 'private',
  },
  {
    teacher_name: 'SAİKOU TEACHER',
    day: 'monday',
    time: '11.00 - 11.40',
    subject: 'İngilizce',
    class_name: 'Grup',
    session_type: 'group',
  },
  {
    teacher_name: 'AYŞEGÜL HOCA',
    day: 'wednesday',
    time: '13.00 - 13.40',
    subject: 'Fen-Bilim',
    class_name: 'Grup',
    session_type: 'group',
  },
  {
    teacher_name: 'RABİA HOCA',
    day: 'thursday',
    time: '15.00 - 15.40',
    subject: 'Çalışma Salonu',
    class_name: 'Support',
    session_type: 'group',
  },
];

export const placeholderCalls = [
  {
    teacher_name: 'GÖKHAN HOCA',
    student_name: 'Zeynep Oğuz',
    class_name: 'Özel ders',
    phone_number: '5068733830',
    note: '',
  },
  {
    teacher_name: 'GÖKHAN HOCA',
    student_name: 'Robin Yıldırım',
    class_name: 'Grup',
    phone_number: '5537856447',
    note: '',
  },
  {
    teacher_name: 'GÖKHAN HOCA',
    student_name: 'Amina Azra',
    class_name: 'Özel ders',
    phone_number: '5415341093',
    note: '',
  },
  {
    teacher_name: 'RABİA HOCA',
    student_name: 'Destek Öğrencisi',
    class_name: 'Aramalar',
    phone_number: '',
    note: '',
  },
];

export const placeholderAnnouncements = [
  {
    title: 'Toplantı hatırlatması',
    body: 'Bu veriler geçici yer tutucudur. Supabase bağlantısı eklendiğinde gerçek duyurular burada görünecek.',
    date: '2026-05-02',
  },
];

export function clonePlaceholderData(data) {
  return JSON.parse(JSON.stringify(data));
}
