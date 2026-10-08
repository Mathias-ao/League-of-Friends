import {HttpsError} from 'firebase-functions/v2/https';
export function competitionId(value:unknown,label:string):asserts value is string {
  if(typeof value!=='string'||!value.trim()||value.length>200||value.includes('/'))throw new HttpsError('invalid-argument','Invalid '+label+'.');
}
