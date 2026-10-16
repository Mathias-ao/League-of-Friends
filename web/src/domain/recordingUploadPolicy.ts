/** AUTO preserves file compatibility; the server chooses the explicitly gated
 * ordinary native route. Admin validation remains a separate stricter operation. */
export function assertRecordingUploadFile(fileName:string,size:number,mode:'AUTO'|'LEGACY'|'NATIVE_VALIDATION_V1'){
  const allowed=mode==='NATIVE_VALIDATION_V1'?/\.aoe2record$/i:/\.(aoe2record|mgz)$/i;
  if(typeof fileName!=='string'||!allowed.test(fileName)||!Number.isSafeInteger(size)||
     size<1||size>32*1024*1024)
    throw new Error('Choose a supported non-empty recording smaller than 32 MiB.');
}
