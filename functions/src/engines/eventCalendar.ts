/** Calendar rules use the Event's IANA timezone, never the server timezone. */
export const DEFAULT_EVENT_TIMEZONE = 'Europe/Copenhagen';
export function eventTimezone(value = DEFAULT_EVENT_TIMEZONE): string {
  new Intl.DateTimeFormat('en', {timeZone: value}).format(0);
  return value;
}
function parts(at: number, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
    .formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function endOfEventDay(startsAtMs:number, timezone=DEFAULT_EVENT_TIMEZONE):number {
  eventTimezone(timezone);
  const p=parts(startsAtMs,timezone);
  const localMidnight=Date.UTC(p.year,p.month-1,p.day+1);
  let utc=localMidnight;
  for(let attempt=0;attempt<4;attempt++) {
    const q=parts(utc,timezone);
    const displayed=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second);
    const next=utc+(localMidnight-displayed);
    if(next===utc)return utc;
    utc=next;
  }
  throw new Error('Could not resolve Event midnight in this timezone.');
}
