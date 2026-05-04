export function getWeekKey(referenceDate = new Date()) {
  const date = new Date(Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  ));
  const dayNumber = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

export function getCurrentWeekKey(referenceDate = new Date()) {
  return getWeekKey(referenceDate);
}
