/** Upload policy: ordinary league replay remains LEGACY; native is a separate
 * staging/demo-only explicit admin operation with a stricter source extension. */
export function assertRecordingUploadFile(fileName:string,size:number,mode:'LEGACY'|'NATIVE_VALIDATION_V1'){
  const allowed=mode==='NATIVE_VALIDATION_V1'?/\.aoe2record$/i:/\.(aoe2record|mgz)$/i;
  if(typeof fileName!=='string'||!allowed.test(fileName)||!Number.isSafeInteger(size)||
     size<1||size>32*1024*1024)
    throw new Error('Choose a supported non-empty recording smaller than 32 MiB.');
}
