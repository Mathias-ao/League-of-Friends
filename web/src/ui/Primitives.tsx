import {useEffect,useRef,type ReactNode} from 'react';
import {X,Shield,Swords,Flag,Crown} from 'lucide-react';
import {Player,type PlayerRecord} from '../domain/league';
export function Sigil({kind='team',size=28}:{kind?:string;size?:number}){
  const Icon=kind==='duel'?Swords:kind==='ffa'?Crown:kind==='flag'?Flag:Shield;
  return <span className="sigil"><Icon size={size} strokeWidth={1.3}/></span>;
}
export function Avatar({player,large=false}:{player:PlayerRecord;large?:boolean}){
  return <span className={'avatar '+(large?'large':'')} aria-hidden="true">{new Player(player).initials}</span>;
}
export function Empty({title,children,icon='team'}:{title:string;children:ReactNode;icon?:string}){
  return <div className="empty"><Sigil kind={icon} size={36}/><h3>{title}</h3><p>{children}</p></div>;
}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const el=ref.current!,previous=document.activeElement as HTMLElement|null;
    el.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{el.close();document.body.style.overflow=old;previous?.focus();};
  },[]);
  return <dialog ref={ref} className={'modal '+(wide?'wide':'')} onCancel={onClose} aria-labelledby="dialog-title" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
export function DateLabel({value}:{value:string|null|undefined}){
  if(!value||!Number.isFinite(Date.parse(value)))return <>Date to be announced</>;
  return <>{new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(value))}</>;
}
export function Roster({players}:{players:PlayerRecord[]}){
  return <div className="roster">{players.map(p=><span key={p.playerId}><Avatar player={p}/>{p.steamName}</span>)}{!players.length&&<p className="muted">No confirmed players yet.</p>}</div>;
}
