import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Ajv2020} from 'ajv/dist/2020.js';
import {SOCIAL_V1_CONTRACT,SOCIAL_V1_SCHEMA_SHA256,assertRecordInvariants,
  type RecordType,type SocialV1Records} from './socialV1.js';

const bytes=readFileSync(new URL('./socialV1.schema.json',import.meta.url));
if(createHash('sha256').update(bytes).digest('hex')!==SOCIAL_V1_SCHEMA_SHA256)
  throw new Error('SHARED_1 runtime schema/declaration mismatch');
const validate=new Ajv2020({strict:false,strictNumbers:true}).compile(JSON.parse(bytes.toString('utf8')));
/** Structure + cross-field invariants. Admission/approval remains server-owned. */
export function validateSharedRecord<K extends RecordType>(kind:K,value:unknown):SocialV1Records[K]{
  if(!validate({contract:SOCIAL_V1_CONTRACT,recordType:kind,value}))
    throw new Error('Invalid SHARED_1 '+kind);
  assertRecordInvariants(kind,value as SocialV1Records[K]);
  return value as SocialV1Records[K];
}
