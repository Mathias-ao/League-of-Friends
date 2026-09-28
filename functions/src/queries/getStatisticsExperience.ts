import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {callableOptions} from '../config/runtime.js';
import {collectStatistics} from '../services/statisticsExperienceProjection.js';
import type {StatisticsScope} from '../engines/statisticsExperience.js';

export const getStatisticsExperience=onCall<StatisticsScope>({...callableOptions,timeoutSeconds:120,memory:'512MiB'},async request=>{
  await requireLeaguePlayer(request);
  const scope:StatisticsScope={};
  for(const key of ['seasonId','eventId','matchId'] as const){
    const value=request.data?.[key];
    if(value!==undefined){if(typeof value!=='string'||!value.trim()||value.length>200||value.includes('/'))throw new HttpsError('invalid-argument',`Invalid ${key}.`);scope[key]=value.trim();}
  }
  if(Object.keys(scope).length!==1)throw new HttpsError('invalid-argument','Choose exactly one Season, Event, or Battle.');
  return collectStatistics(scope,undefined,true);
});
