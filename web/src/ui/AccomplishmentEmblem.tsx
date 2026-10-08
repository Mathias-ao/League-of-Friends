import {useId} from 'react';
import type {ShowcaseEmblem} from '../domain/eventRoundoffShowcase';

/** Original compact heraldic silhouettes. Shared gold engraving, no external sprite dependency. */
export const ACCOMPLISHMENT_EMBLEMS:Record<ShowcaseEmblem,string>={
  crown:'M5 26 3 11l8 6 5-12 5 12 8-6-2 15ZM6 29h20v3H6Z M2 7h4v4H2ZM14 1h4v4h-4ZM26 7h4v4h-4Z',
  laurel:'M15 30C5 27 2 17 6 7c-5 3-5 8-3 10 1 5 4 10 10 12ZM17 30c10-3 13-13 9-23 5 3 5 8 3 10-1 5-4 10-10 12ZM7 11C2 9 3 5 7 3l1 7Zm-2 9c-5-1-6-5-4-8l5 6Zm4 7c-6 0-8-3-7-6l7 4Zm16-16c5-2 4-6 0-8l-1 7Zm2 9c5-1 6-5 4-8l-5 6Zm-4 7c6 0 8-3 7-6l-7 4ZM16 7l3 6 6 1-5 5 1 7-5-3-5 3 1-7-5-5 6-1Z',
  axes:'M4 2l7 2 3 6-5 4-5-5-3-1Zm2 6 23 21-2 2L4 10ZM28 2l-7 2-3 6 5 4 5-5 3-1Zm-2 6L3 29l2 2 23-21Z',
  shield:'M16 2 28 7v10c-1 6-6 11-12 15C10 28 5 23 4 17V7Zm-1 5v18h2V7ZM8 13v2h16v-2Z',
  swords:'M3 2l7 4 12 15-2 2L6 10Zm15 18 2-2 7 7-2 2Zm5 7 3-3 5 5-3 3ZM29 2l-7 4L10 21l2 2L26 10ZM14 20l-2-2-7 7 2 2Zm-5 7-3-3-5 5 3 3Z',
  coins:'M3 8a10 4 0 0 1 20 0 10 4 0 0 1-20 0Zm0 3c6 4 14 4 20 0v4c-6 4-14 4-20 0Zm0 7c4 3 9 4 13 3v4c-4 1-9 0-13-3Zm15-1a7 10 0 1 1 0 1Zm7 2h-2v9h2v-2h2v-2h-2v-2h2v-2h-2Z',
  castle:'M4 2h4v4h4V2h4v4h4V2h4v10H4ZM6 13h16v16h5v3H2v-3h4Zm6 16h4v-8a2 2 0 0 0-4 0ZM25 8h3v7h-3Z',
  tower:'M6 4h4v4h4V1h4v7h4V4h4v10H6Zm3 11h14l2 17H7Zm5 15h4v-8h-4ZM14 16v3h4v-3Z',
  helmet:'M5 17C5 5 11 1 17 1c7 1 12 7 12 16l-8 4v11l-7-4-2-8H5Zm1 1 5 3 2 9-9-5Zm9-7v4l12-2v-3ZM15 18v7h2v-8ZM16 3v6h2V3Z',
  wheat:'M15 32h2V4h-2Zm1-20C9 9 8 5 10 3c4 1 6 4 6 9Zm0 7C8 17 6 13 8 10c5 0 8 4 8 9Zm0 8C7 25 4 20 6 17c5 0 9 4 10 10Zm1-15c7-3 8-7 6-9-4 1-6 4-6 9Zm0 7c8-2 10-6 8-9-5 0-8 4-8 9Zm0 8c9-2 12-7 10-10-5 0-9 4-10 10ZM15 2l1-2 2 2-1 4Z',
  villager:'M12 8a5 5 0 1 1 10 0 5 5 0 1 1-10 0ZM9 17l5-4h6l4 8-3 1-3-6v10l4 6h-5l-3-5-3 5H7l5-10v-5l-5 7-3-2Zm18-5h2v20h-2Zm-3 0V7h8v5Z',
  settlement:'M2 16 9 8l7 8H13v13H5V16Zm9 13v-8H7v8ZM15 10l8-8 8 8h-3v14h-9V10Zm8 11h3v-7h-3ZM1 30h30v2H1Z',
  banner:'M6 1h3v31H6ZM10 3h20l-5 7 5 7H10Zm5 3v8h2V6ZM3 30h10v2H3Z',
  compass:'M16 0l3 9 8-4-4 8 9 3-9 3 4 8-8-4-3 9-3-9-8 4 4-8-9-3 9-3-4-8 8 4Zm0 9-5 12 10-10ZM16 13l-2 5 4-4Z',
  hourglass:'M6 1h20v3H6Zm0 28h20v3H6ZM9 5h14v4l-5 7 5 7v5H9v-5l5-7-5-7Zm3 2v2l4 5 4-5V7ZM12 26h8l-4-7Z',
  hand:'M6 14c-2-2-4 0-3 3l6 10 2 5h13l3-8V10c0-3-3-3-3 0v7h-1V5c0-3-3-3-3 0v12h-1V3c0-3-3-3-3 0v14h-1V6c0-3-3-3-3 0v13Z',
  pickaxe:'M3 9C9 0 24 0 31 9l-2 2C22 6 12 6 5 11ZM17 5l3 2L9 32l-4-2ZM22 21l8 4-1 7H17l-3-6Z',
};
export function AccomplishmentEmblem({kind}:{kind:ShowcaseEmblem}){
  const id=useId().replaceAll(':','');
  return <svg className="event-accomplishment-emblem" viewBox="0 0 34 34" aria-hidden="true" focusable="false" data-emblem={kind}>
    <defs><linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".75" y2="1"><stop offset="0" stopColor="#ead6a6"/><stop offset=".45" stopColor="#c4a061"/><stop offset="1" stopColor="#846337"/></linearGradient></defs>
    <path d={ACCOMPLISHMENT_EMBLEMS[kind]??ACCOMPLISHMENT_EMBLEMS.laurel} transform="translate(1 1)" fill={`url(#${id}-gold)`} fillRule="evenodd" stroke="#ebd2a0" strokeWidth=".28"/>
  </svg>;
}
