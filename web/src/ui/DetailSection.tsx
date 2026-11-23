export interface DetailSectionState {status:'loading'|'ready'|'error';error?:string;retry:()=>void;request?:()=>void;}
export function DetailLoadState({label,error,retry}:{label:string;error?:string;retry:()=>void}){
  return <section aria-label={label} aria-busy={!error}>
    <p role={error?'alert':'status'}>{error?`${label} could not be loaded. ${error}`:`Loading ${label.toLowerCase()}…`}</p>
    {error&&<button type="button" onClick={retry}>Retry {label.toLowerCase()}</button>}
  </section>;
}
