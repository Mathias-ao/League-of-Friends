import type {CSSProperties} from 'react';
export type AofSealVariant='full'|'simple'|'mark';
export type AofSealTone='ceremonial'|'quiet'|'faint';

const sources:Record<AofSealVariant,string>={
  full:new URL('../assets/brand/seal/aof-seal-full.png',import.meta.url).href,
  simple:new URL('../assets/brand/seal/aof-seal-simple.png',import.meta.url).href,
  mark:new URL('../assets/brand/seal/aof-seal-mark.png',import.meta.url).href
};

export function AofSeal({
  variant='full',
  tone='quiet',
  size=96,
  animate=false,
  className=''
}:{
  variant?:AofSealVariant;
  tone?:AofSealTone;
  size?:number;
  animate?:boolean;
  className?:string;
}){
  const style={'--aof-seal-size':`${size}px`} as CSSProperties;
  return <span
    className={`aof-seal aof-seal--${variant} aof-seal--${tone}${animate?' aof-seal--breathing':''}${className?' '+className:''}`}
    style={style}
    aria-hidden="true"
  >
    <img src={sources[variant]} alt="" draggable={false}/>
  </span>;
}
