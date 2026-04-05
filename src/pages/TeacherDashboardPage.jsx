import { useEffect, useState } from 'react';
import CallLogModal from '../components/CallLogModal';
import StateBlock from '../components/StateBlock';
import {
  getCallClassName,
  getCallDisplayName,
  getCallPhoneNumber,
  getCallRowKey,
  getCallStudentName,
} from '../utils/callData';

const DAY_DEFINITIONS = [
  { id: 'monday', label: 'Pazartesi', shortLabel: 'Pzt', aliases: ['monday', 'mon', 'bazartisi', 'bazar ertesi', 'bazarertesi', 'bazar ertəsi', 'luni', 'pazartesi'] },
  { id: 'tuesday', label: 'Salı', shortLabel: 'Sal', aliases: ['tuesday', 'tue', 'cersenbe axsami', 'cersenbeaxsami', 'çərşənbə axşamı', 'marti', 'sali', 'sali', 'salı'] },
  { id: 'wednesday', label: 'Çarşamba', shortLabel: 'Çar', aliases: ['wednesday', 'wed', 'cersenbe', 'çərşənbə', 'miercuri', 'carsamba', 'çarsamba', 'çarşamba'] },
  { id: 'thursday', label: 'Perşembe', shortLabel: 'Per', aliases: ['thursday', 'thu', 'cume axsami', 'cumeaxsami', 'cümə axşamı', 'joi', 'persembe', 'perşembe'] },
  { id: 'friday', label: 'Cuma', shortLabel: 'Cum', aliases: ['friday', 'fri', 'cume', 'cümə', 'vineri', 'cuma'] },
  { id: 'saturday', label: 'Cumartesi', shortLabel: 'Cmt', aliases: ['saturday', 'sat', 'senbe', 'şənbə', 'sambata', 'cumartesi'] },
  { id: 'sunday', label: 'Pazar', shortLabel: 'Paz', aliases: ['sunday', 'sun', 'bazar', 'duminica', 'pazar'] },
];

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveDay(dayValue) {
  const normalizedDay = normalizeText(dayValue);
  const matchedDefinition = DAY_DEFINITIONS.find((day) => day.aliases.includes(normalizedDay));

  if (matchedDefinition) {
    return {
      id: matchedDefinition.id,
      label: matchedDefinition.label,
      shortLabel: matchedDefinition.shortLabel,
      sortIndex: DAY_DEFINITIONS.findIndex((day) => day.id === matchedDefinition.id),
    };
  }

  return {
    id: normalizedDay || 'other',
    label: dayValue || 'Diğer',
    shortLabel: String(dayValue || 'Diğer').slice(0, 3),
    sortIndex: DAY_DEFINITIONS.length + 1,
  };
}

function groupClassesByDay(items) {
  const groupedDays = [];

  items.forEach((item) => {
    const resolvedDay = resolveDay(item.day);
    const existingGroup = groupedDays.find((group) => group.id === resolvedDay.id);

    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    groupedDays.push({
      id: resolvedDay.id,
      label: resolvedDay.label,
      shortLabel: resolvedDay.shortLabel,
      sortIndex: resolvedDay.sortIndex,
      items: [item],
    });
  });

  return groupedDays.sort((left, right) => left.sortIndex - right.sortIndex || left.label.localeCompare(right.label));
}

function getTodayScheduleDayId(referenceDate = new Date()) {
  const weekdayIds = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return weekdayIds[referenceDate.getDay()] || 'monday';
}

function getDefaultScheduleDayId(groupedDays) {
  if (groupedDays.length === 0) {
    return '';
  }

  const todayDayId = getTodayScheduleDayId();
  const todayGroup = groupedDays.find((group) => group.id === todayDayId);
  if (todayGroup) {
    return todayGroup.id;
  }

  if (todayDayId === 'sunday') {
    const mondayGroup = groupedDays.find((group) => group.id === 'monday');
    if (mondayGroup) {
      return mondayGroup.id;
    }
  }

  return groupedDays[0].id;
}

function getSafePhoneValue(phoneNumber) {
  return String(phoneNumber ?? '').trim();
}

function getPhoneDigits(phoneNumber) {
  const digits = getSafePhoneValue(phoneNumber).replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function getTelHref(phoneNumber) {
  const cleanedPhone = getSafePhoneValue(phoneNumber).replace(/[^\d+]/g, '');
  return cleanedPhone ? `tel:${cleanedPhone}` : '';
}

function getWhatsAppHref(phoneNumber) {
  const digits = getPhoneDigits(phoneNumber);
  return digits ? `https://wa.me/${digits}` : '';
}

function getContactHref(studentName, phoneNumber) {
  const safeName = studentName || 'Kişi';
  const safePhone = getSafePhoneValue(phoneNumber);

  if (!safePhone) {
    return '';
  }

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${safeName}`,
    `TEL;TYPE=CELL:${safePhone}`,
    'END:VCARD',
  ].join('\n');

  return `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`;
}

function IconButtonLink({ href, label, onClick, download, children }) {
  if (!href) {
    return (
      <span aria-disabled="true" className="quick-action quick-action--disabled" title={`${label} kullanılamıyor`}>
        {children}
      </span>
    );
  }

  return (
    <a
      className="quick-action"
      download={download}
      href={href}
      onClick={onClick}
      rel="noreferrer"
      target={href.startsWith('http') ? '_blank' : undefined}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {children}
    </a>
  );
}

function AddContactIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path d="M15.5 8.2a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M7.5 16.2a4.6 4.6 0 0 1 9 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M18.5 8.5V15.5M22 12h-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function CallActionIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M7.45 4.5h2.5l1.25 3.82-1.74 1.53a13.08 13.08 0 0 0 4.69 4.69l1.53-1.74L19.5 14.05v2.38A1.87 1.87 0 0 1 17.45 18.3A13.8 13.8 0 0 1 5.7 6.55A1.87 1.87 0 0 1 7.45 4.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path d="M14.75 6.25a4.25 4.25 0 0 1 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
      <path d="M14.75 3.75a6.75 6.75 0 0 1 5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M12 3.8c4.5 0 8.15 3.47 8.15 7.76c0 4.29-3.65 7.76-8.15 7.76c-1.18 0-2.3-.24-3.31-.68l-3.73.89l1.03-3.4a7.48 7.48 0 0 1-1.15-3.98c0-4.29 3.65-7.76 8.15-7.76Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.65"
      />
      <path
        d="M9.28 8.98c.12-.29.31-.45.56-.45h.74c.19 0 .36.12.42.3l.59 1.61c.06.16.02.34-.1.46l-.64.67a6.46 6.46 0 0 0 2.63 2.62l.66-.63a.55.55 0 0 1 .51-.12l1.63.58c.18.07.3.23.3.43v.75c0 .25-.15.44-.39.56c-.52.24-1.09.33-1.65.24c-1.45-.23-2.89-.99-4.17-2.26c-1.28-1.28-2.05-2.72-2.27-4.18c-.08-.54 0-1.11.18-1.58Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
    </svg>
  );
}

function ClassesIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <path d="M8 3.5v3M16 3.5v3M4 9h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <rect height="15" rx="4" stroke="currentColor" strokeWidth="1.7" width="16" x="4" y="5" />
      <path d="M8.25 12.25h3.25M8.25 15.25h2M13.75 12.25h2M13.75 15.25h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function CallsSectionIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <path
        d="M9.1 7.9h1.7l.94 2.9l-1.16 1.13a10.78 10.78 0 0 0 2.53 2.53l1.13-1.16l2.9.94v1.7c0 .76-.62 1.36-1.39 1.32A10.9 10.9 0 0 1 7.78 9.29c-.04-.77.56-1.39 1.32-1.39Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="M14.6 8.1a3.3 3.3 0 0 1 1.3 1.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M15 5.9a5.55 5.55 0 0 1 3.1 3.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function AnnouncementIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <path d="M4.5 13V9.5c0-1.1.9-2 2-2H8l7-2.75v13.5L8 15.5H6.5c-1.1 0-2-.9-2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M15 8.75a4.2 4.2 0 0 1 0 5.5M17.2 7a6.55 6.55 0 0 1 0 9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M8.6 15.7l1.3 3.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

const SECTION_ITEMS = [
  { id: 'classes', label: 'Dersler', Icon: ClassesIcon },
  { id: 'calls', label: 'Aramalar', Icon: CallsSectionIcon },
  { id: 'announcements', label: 'Duyurular', Icon: AnnouncementIcon },
];

function formatDate(dateString) {
  const parsedDate = Date.parse(dateString || '');

  if (Number.isNaN(parsedDate)) {
    return dateString || 'Tarih yok';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function sortAnnouncements(items) {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left?.date || left?.created_at || left?.createdAt || '');
    const rightDate = Date.parse(right?.date || right?.created_at || right?.createdAt || '');

    if (Number.isNaN(leftDate) && Number.isNaN(rightDate)) {
      return 0;
    }

    if (Number.isNaN(leftDate)) {
      return 1;
    }

    if (Number.isNaN(rightDate)) {
      return -1;
    }

    return rightDate - leftDate;
  });
}

function formatTimeBadge(timeValue) {
  const safeTime = String(timeValue ?? '').trim();

  if (!safeTime) {
    return 'Saat yok';
  }

  const parts = safeTime.split('-').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `${parts[0]}-\n${parts[1]}`;
  }

  return safeTime;
}

function getTimeSortValue(timeValue) {
  const normalizedTime = String(timeValue ?? '').trim().toLowerCase();

  if (!normalizedTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [startTime] = normalizedTime.split(/\s*[-–—]\s*/);
  const timeInMinutes = parseTimeToMinutes(startTime);

  return timeInMinutes ?? Number.MAX_SAFE_INTEGER;
}

function parseTimeToMinutes(timeValue) {
  const normalizedTime = String(timeValue ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, ':');

  if (!normalizedTime) {
    return null;
  }

  const match = normalizedTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  }

  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function getClassEndTimeValue(timeValue) {
  const safeTime = String(timeValue ?? '').trim();
  if (!safeTime) {
    return '';
  }

  const parts = safeTime.split(/\s*[-–—]\s*/).filter(Boolean);
  return parts[1] || parts[0] || '';
}

function isClassCompleted(dayId, timeValue, referenceDate) {
  if (!referenceDate || dayId !== getTodayScheduleDayId(referenceDate)) {
    return false;
  }

  const classEndTime = parseTimeToMinutes(getClassEndTimeValue(timeValue));
  if (classEndTime == null) {
    return false;
  }

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  return currentMinutes >= classEndTime;
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

function getSessionTypeLabel(sessionType) {
  const normalizedSessionType = normalizeText(sessionType);

  if (!normalizedSessionType) {
    return 'Grup';
  }

  if (['private', 'private class', 'one to one', 'onetoone', 'ozel', 'özel', 'individual'].includes(normalizedSessionType)) {
    return 'Özel ders';
  }

  if (['group', 'group class', 'grup'].includes(normalizedSessionType)) {
    return 'Grup';
  }

  return String(sessionType);
}

function TeacherDashboardPage({
  activeSection,
  announcementsState,
  callDraft,
  callSaveState,
  callsState,
  classesState,
  logoSrc,
  onCallDraftChange,
  onOpenCallModal,
  onRetryAnnouncements,
  onRetryCalls,
  onRetryClasses,
  onSectionChange,
  onSwitchTeacher,
  selectedCallKey,
  teacherName,
}) {
  const groupedDays = groupClassesByDay(classesState.data);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const orderedAnnouncements = sortAnnouncements(announcementsState.data);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (groupedDays.length === 0) {
      setSelectedDayId('');
      return;
    }

    if (!groupedDays.some((group) => group.id === selectedDayId)) {
      setSelectedDayId(getDefaultScheduleDayId(groupedDays));
    }
  }, [groupedDays, selectedDayId]);

  const selectedDay = groupedDays.find((group) => group.id === selectedDayId) || groupedDays[0] || null;
  const orderedSelectedClasses = selectedDay
    ? [...selectedDay.items].sort((left, right) => getTimeSortValue(left.time) - getTimeSortValue(right.time))
    : [];
  const todayLabel = formatTodayLabel();

  function handleRowKeyDown(event, callItem, rowKey) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenCallModal(callItem, rowKey);
    }
  }

  return (
    <main className="page-shell page-shell--dashboard">
      <header className="teacher-header">
        <div className="teacher-header__brand">
          <div className="teacher-header__logo-frame">
            <img alt="Aren Academy logosu" className="academy-logo" src={logoSrc} />
          </div>
          <div className="teacher-header__info">
            <h1>{teacherName}</h1>
            <p className="teacher-header__date">{todayLabel}</p>
          </div>
        </div>
        <div className="teacher-header__action-frame">
          <button
            className="teacher-header__change-text"
            onClick={onSwitchTeacher}
            title="Çıkış yap"
            type="button"
          >
            Çıkış yap
          </button>
        </div>
      </header>

      <nav aria-label="Panel bölümleri" className="dashboard-switcher">
        {SECTION_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`dashboard-switcher__item ${activeSection === id ? 'dashboard-switcher__item--active' : ''}`}
            onClick={() => onSectionChange(id)}
            type="button"
          >
            <span className="dashboard-switcher__icon">
              <Icon />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {activeSection === 'classes' ? (
        <section className="content-card content-card--classes">
          <div className="content-card__header">
            <div>
              <span className="section-kicker">Dersler</span>
              <h2>Haftalık ders programı</h2>
            </div>
            <button className="button button-ghost" onClick={onRetryClasses} type="button">
              Yenile
            </button>
          </div>

          <StateBlock
            emptyMessage="Bu öğretmen için ders bulunamadı."
            emptyTitle="Henüz ders yok"
            onRetry={onRetryClasses}
            state={classesState}
          >
            <div className="classes-board">
              <div className="day-tabs">
                {groupedDays.map((group) => (
                  <button
                    key={group.id}
                    className={`day-tabs__item ${selectedDay?.id === group.id ? 'day-tabs__item--active' : ''}`}
                    onClick={() => setSelectedDayId(group.id)}
                    type="button"
                  >
                    {group.shortLabel || group.label}
                  </button>
                ))}
              </div>

              {selectedDay ? (
                <div className="classes-board__surface">
                  <div className="class-list">
                    {orderedSelectedClasses.map((item, index) => {
                      const isCompleted = selectedDay
                        ? isClassCompleted(selectedDay.id, item.time, currentDateTime)
                        : false;

                      return (
                        <article
                          className={`class-row-item ${isCompleted ? 'class-row-item--completed' : ''}`}
                          key={`${item.class_name || item.className || 'class'}-${index}`}
                        >
                          <div className="class-row-item__time-badge">{formatTimeBadge(item.time)}</div>
                          <div className="class-row-item__main">
                            <div className="class-row-item__content">
                              <h3>{item.subject || 'Ders adı yok'}</h3>
                              <p>{item.class_name || item.className || 'Sınıf adı yok'}</p>
                              <span className="class-row-item__group-pill">
                                {getSessionTypeLabel(item.session_type || item.sessionType)}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </StateBlock>
        </section>
      ) : null}

      {activeSection === 'calls' ? (
        <section className="content-card content-card--content-only">
          <div className="content-card__header">
            <div>
              <span className="section-kicker">Aramalar</span>
              <h2>Arama listesi</h2>
            </div>
            <button className="button button-ghost" onClick={onRetryCalls} type="button">
              Yenile
            </button>
          </div>

          <div className="content-card__surface-shell">
            <StateBlock
              emptyMessage="Şu anda atanmış arama yok."
              emptyTitle="Henüz arama yok"
              onRetry={onRetryCalls}
              state={callsState}
            >
              <div className="call-list">
                {callsState.data.map((item, index) => {
                  const studentName = getCallStudentName(item);
                  const studentDisplayName = getCallDisplayName(item);
                  const className = getCallClassName(item);
                  const phoneNumber = getCallPhoneNumber(item);
                  const contactFileName = studentName || `kisi-${index + 1}`;
                  const rowKey = getCallRowKey(item, index);
                  const isEditorOpen = selectedCallKey === rowKey;

                  return (
                    <div className={`call-list__item ${isEditorOpen ? 'call-list__item--expanded' : ''}`} key={`${studentDisplayName}-${index}`}>
                      <article
                        aria-expanded={isEditorOpen}
                        className="call-row"
                        onClick={() => onOpenCallModal(item, rowKey)}
                        onKeyDown={(event) => handleRowKeyDown(event, item, rowKey)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="call-row__content">
                          <h3>{studentDisplayName}</h3>
                          {className ? <p>{className}</p> : null}
                          <span>{phoneNumber || 'Telefon numarası yok'}</span>
                        </div>

                        <div className="call-row__actions">
                          <IconButtonLink
                            download={`${contactFileName}.vcf`}
                            href={getContactHref(studentName, phoneNumber)}
                            label="Kişilere ekle"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <AddContactIcon />
                          </IconButtonLink>
                          <IconButtonLink
                            href={getTelHref(phoneNumber)}
                            label="Ara"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <CallActionIcon />
                          </IconButtonLink>
                          <IconButtonLink
                            href={getWhatsAppHref(phoneNumber)}
                            label="WhatsApp"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <WhatsAppIcon />
                          </IconButtonLink>
                        </div>
                      </article>
                      {isEditorOpen ? (
                        <CallLogModal
                          call={item}
                          noteValue={callDraft}
                          onNoteChange={onCallDraftChange}
                          saveState={callSaveState}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </StateBlock>
          </div>
        </section>
      ) : null}

      {activeSection === 'announcements' ? (
        <section className="content-card content-card--content-only">
          <div className="content-card__header">
            <div>
              <span className="section-kicker">Duyurular</span>
              <h2>Son duyurular</h2>
            </div>
            <button className="button button-ghost" onClick={onRetryAnnouncements} type="button">
              Yenile
            </button>
          </div>

          <div className="content-card__surface-shell">
            <StateBlock
              emptyMessage="Şu anda duyuru yok."
              emptyTitle="Henüz duyuru yok"
              onRetry={onRetryAnnouncements}
              state={announcementsState}
            >
              <div className="announcement-list">
                {orderedAnnouncements.map((item, index) => (
                  <article
                    key={`${item.title || 'announcement'}-${index}`}
                    className="announcement-card"
                  >
                    <span className="soft-pill">{formatDate(item.date || item.created_at || item.createdAt)}</span>
                    <h3>{item.title || 'Başlıksız duyuru'}</h3>
                    <p>{item.body || 'Duyuru metni yok.'}</p>
                  </article>
                ))}
              </div>
            </StateBlock>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default TeacherDashboardPage;
