import {useEffect,useRef,useState,type RefObject} from 'react';
import rubyUrl from '../assets/Scroll bar/ruby.png';

/** The body scrolls natively; the ruby is a fixed-size visual control within its reserved gutter. */
export function DialogRubyScrollbar({target}:{target:RefObject<HTMLDivElement|null>}){
  const railRef=useRef<HTMLDivElement>(null);
  const thumbRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{pointerY:number;scrollTop:number}|null>(null);
  const [metrics,setMetrics]=useState({visible:false,scroll:0,max:0,travel:0,thumb:86,top:72});
  useEffect(()=>{
    const el=target.current;
    if(!el)return;
    let frame=0;
    const measure=()=>{
      frame=0;
      const max=Math.max(0,el.scrollHeight-el.clientHeight);
      const thumb=thumbRef.current?.getBoundingClientRect().height||86;
      // The control starts hidden; measure the actual scroll viewport, not the hidden rail.
      const travel=Math.max(0,el.clientHeight-8-thumb);
      const top=el.parentElement?.querySelector('.modal-heading')?.getBoundingClientRect().height||72;
      const desktop=window.matchMedia('(min-width:700px) and (hover:hover) and (pointer:fine)').matches;
      const visible=desktop&&max>2&&travel>0;
      el.classList.toggle('ruby-dialog-scroll-active',visible);
      setMetrics({visible,scroll:el.scrollTop,max,travel,thumb,top});
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    observer.observe(el);
    const heading=el.parentElement?.querySelector('.modal-heading');
    if(heading)observer.observe(heading);
    for(const child of Array.from(el.children))observer.observe(child);
    if(railRef.current)observer.observe(railRef.current);
    if(thumbRef.current)observer.observe(thumbRef.current);
    window.addEventListener('resize',schedule);
    el.addEventListener('scroll',schedule,{passive:true});
    measure();
    return ()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize',schedule);
      el.removeEventListener('scroll',schedule);
      el.classList.remove('ruby-dialog-scroll-active');
    };
  },[target]);
  const scrollToPosition=(clientY:number)=>{
    const rect=railRef.current?.getBoundingClientRect();
    if(!rect||!metrics.travel||!metrics.max)return;
    const offset=Math.max(0,Math.min(metrics.travel,clientY-rect.top-metrics.thumb/2));
    target.current?.scrollTo({top:offset/metrics.travel*metrics.max,behavior:'instant'});
  };
  return <div className="ruby-dialog-scroll" data-visible={metrics.visible} aria-hidden={!metrics.visible} style={{top:metrics.top}}>
    <div className="ruby-dialog-scroll__rail" ref={railRef} onPointerDown={event=>{
      if(event.target===event.currentTarget)scrollToPosition(event.clientY);
    }}>
      <div className="ruby-dialog-scroll__thumb" ref={thumbRef}
        role="scrollbar" aria-label="Dialog scroll position" aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={metrics.max?Math.round(metrics.scroll/metrics.max*100):0}
        tabIndex={metrics.visible?0:-1}
        style={{transform:`translateY(${metrics.max?metrics.scroll/metrics.max*metrics.travel:0}px)`}}
        onPointerDown={event=>{
          if(event.button!==0)return;
          event.preventDefault();event.stopPropagation();
          dragRef.current={pointerY:event.clientY,scrollTop:target.current?.scrollTop||0};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event=>{
          const drag=dragRef.current;
          if(!drag||!metrics.travel)return;
          target.current?.scrollTo({top:drag.scrollTop+(event.clientY-drag.pointerY)/metrics.travel*metrics.max,behavior:'instant'});
        }}
        onPointerUp={event=>{
          dragRef.current=null;
          if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={()=>{dragRef.current=null;}}
        onKeyDown={event=>{
          const el=target.current;if(!el)return;
          const next=event.key==='ArrowDown'?el.scrollTop+48
            :event.key==='ArrowUp'?el.scrollTop-48
            :event.key==='PageDown'?el.scrollTop+el.clientHeight*.8
            :event.key==='PageUp'?el.scrollTop-el.clientHeight*.8
            :event.key==='Home'?0:event.key==='End'?metrics.max:null;
          if(next!==null){event.preventDefault();el.scrollTo({top:next,behavior:'instant'});}
        }}>
        <img src={rubyUrl} alt="" draggable={false}/>
      </div>
    </div>
  </div>;
}
