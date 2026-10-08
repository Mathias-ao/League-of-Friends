import {useEffect,useRef,useState,type RefObject} from 'react';
import rubyUrl from '../assets/Scroll bar/ruby.png';

/** Custom visual scrollbar for the existing native-scrolling Event/Battle dialog. */
export function DialogRubyScrollbar({target}:{target:RefObject<HTMLDialogElement|null>}){
  const railRef=useRef<HTMLDivElement>(null);
  const thumbRef=useRef<HTMLDivElement>(null);
  const dragging=useRef<{pointerY:number;scrollTop:number}|null>(null);
  const [state,setState]=useState({visible:false,top:0,right:0,height:0,scroll:0,max:0,travel:0,thumb:86});
  useEffect(()=>{
    const el=target.current;
    if(!el)return;
    let frame=0;
    const measure=()=>{
      frame=0;
      const rect=el.getBoundingClientRect();
      const max=Math.max(0,el.scrollHeight-el.clientHeight);
      const height=Math.max(0,el.clientHeight-20);
      const thumb=thumbRef.current?.getBoundingClientRect().height||86;
      const desktop=window.matchMedia('(min-width:700px) and (hover:hover) and (pointer:fine)').matches;
      const visible=desktop&&max>2&&height>thumb;
      el.classList.toggle('ruby-dialog-scroll-active',visible);
      setState({visible,top:rect.top+10,right:window.innerWidth-rect.right+3,height,scroll:el.scrollTop,max,travel:Math.max(0,height-thumb),thumb});
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    observer.observe(el);
    if(el.firstElementChild)observer.observe(el.firstElementChild);
    const modalBody=el.querySelector('.modal-body');
    if(modalBody)observer.observe(modalBody);
    if(thumbRef.current)observer.observe(thumbRef.current);
    el.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    measure();
    return ()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      el.classList.remove('ruby-dialog-scroll-active');
    };
  },[target]);
  const jump=(y:number)=>{
    if(!state.travel||!state.max)return;
    const rect=railRef.current?.getBoundingClientRect();
    if(!rect)return;
    const offset=Math.max(0,Math.min(state.travel,y-rect.top-state.thumb/2));
    target.current?.scrollTo({top:offset/state.travel*state.max,behavior:'instant'});
  };
  return <div className="ruby-dialog-scroll" data-visible={state.visible} aria-hidden={!state.visible}
    style={{top:state.top,right:state.right,height:state.height}}>
    <div className="ruby-dialog-scroll__rail" ref={railRef}
      onPointerDown={event=>{if(event.target===event.currentTarget)jump(event.clientY);}}>
      <div className="ruby-dialog-scroll__thumb" ref={thumbRef}
        role="scrollbar" aria-label="Dialog scroll position" aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={state.max?Math.round(state.scroll/state.max*100):0}
        tabIndex={state.visible?0:-1}
        style={{transform:`translateY(${state.max?state.scroll/state.max*state.travel:0}px)`}}
        onPointerDown={event=>{
          if(event.button!==0)return;
          event.preventDefault();event.stopPropagation();
          dragging.current={pointerY:event.clientY,scrollTop:target.current?.scrollTop||0};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event=>{
          if(!dragging.current||!state.travel)return;
          target.current?.scrollTo({top:dragging.current.scrollTop+(event.clientY-dragging.current.pointerY)/state.travel*state.max,behavior:'instant'});
        }}
        onPointerUp={event=>{
          dragging.current=null;
          if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={()=>{dragging.current=null;}}
        onKeyDown={event=>{
          const el=target.current;
          if(!el)return;
          const y=event.key==='ArrowDown'?el.scrollTop+48
            :event.key==='ArrowUp'?el.scrollTop-48
            :event.key==='PageDown'?el.scrollTop+el.clientHeight*.8
            :event.key==='PageUp'?el.scrollTop-el.clientHeight*.8
            :event.key==='Home'?0:event.key==='End'?state.max:null;
          if(y!==null){event.preventDefault();el.scrollTo({top:y,behavior:'instant'});}
        }}>
        <img src={rubyUrl} alt="" draggable={false}/>
      </div>
    </div>
  </div>;
}
