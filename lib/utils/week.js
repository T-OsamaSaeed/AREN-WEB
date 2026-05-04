export function getCurrentWeekKey(date = new Date()) {
  const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = targetDate.getUTCDay() || 7;
  targetDate.setUTCDate(targetDate.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((targetDate - yearStart) / 86400000) + 1) / 7);

  return `${targetDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}
