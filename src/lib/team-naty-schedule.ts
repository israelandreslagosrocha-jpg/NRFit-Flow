/** Reglas de agenda oficiales de Team Naty, independientes de la interfaz. */
export function isValidIsoDate(input: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTeamNatyLiveDay(input: string): boolean {
  if (!isValidIsoDate(input)) return false;

  const date = new Date(`${input}T12:00:00Z`);

  const day = date.getUTCDay();
  return day === 1 || day === 3;
}
