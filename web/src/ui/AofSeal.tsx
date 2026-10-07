import type {CSSProperties} from 'react';
import fullSeal from '../assets/brand/seal/aof-seal-full.png';
import simpleSeal from '../assets/brand/seal/aof-seal-simple.png';
import markSeal from '../assets/brand/seal/aof-seal-mark.svg';

export type AofSealVariant='full'|'simple'|'mark';
export type AofSealTone='ceremonial'|'quiet'|'faint';

const sources:Record<AofSealVariant,string>={
  full:fullSeal,
  simple:simpleSeal,
  mark:markSeal
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
