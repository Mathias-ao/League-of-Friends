import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export function BattleOverlay({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{
    const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;
    dialog.showModal();
    return ()=>{if(dialog.open)dialog.close();previous?.focus();};
  },[]);
  return <dialog ref={ref} className={'battle-overlay '+(wide?'wide':'')} aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <header><h2 id={id}>{title}</h2><button aria-label={`Close ${title}`} onClick={onClose}><X size={20}/></button></header>
    <div className="battle-overlay-body">{children}</div>
  </dialog>;
}
