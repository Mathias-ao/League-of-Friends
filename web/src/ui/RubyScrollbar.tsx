import {useEffect, useRef, useState} from 'react';
import rubyUrl from '../assets/Scroll bar/ruby.png';

/**
 * A fixed-size ruby is a visual control for the document's native scroll position.
 * Native scrolling remains in charge of wheel, touch, keyboard and anchor navigation.
 */
export function RubyScrollbar(){
  const railRef=useRef<HTMLDivElement>(null);
  const thumbRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{startY:number;startScroll:number}|null>(null);
  const [metrics,setMetrics]=useState({scroll:0,maxScroll:0,travel:0,thumbHeight:64});

  useEffect(()=>{
    const root=document.documentElement;
    const body=document.body;
    let frame=0;
    const measure=()=>{
      frame=0;
      const maxScroll=Math.max(0,root.scrollHeight-window.innerHeight);
      const rail=railRef.current;
      const thumb=thumbRef.current;
      const thumbHeight=thumb?.getBoundingClientRect().height||64;
      setMetrics({
        scroll:Math.min(maxScroll,Math.max(0,window.scrollY)),
        maxScroll,
        travel:Math.max(0,(rail?.clientHeight||0)-thumbHeight),
        thumbHeight
      });
      root.classList.toggle('ruby-scrollbar-enabled',maxScroll>1);
    };
    const schedule=()=>{
      if(!frame)frame=requestAnimationFrame(measure);
    };
    const resizeObserver=new ResizeObserver(schedule);
    resizeObserver.observe(root);
    resizeObserver.observe(body);
    if(railRef.current)resizeObserver.observe(railRef.current);
    if(thumbRef.current)resizeObserver.observe(thumbRef.current);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    measure();
    return ()=>{
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      root.classList.remove('ruby-scrollbar-enabled');
    };
  },[]);

  const scrollToRailPosition=(clientY:number)=>{
    const rail=railRef.current;
    if(!rail||metrics.maxScroll<=0||metrics.travel<=0)return;
    const rect=rail.getBoundingClientRect();
    const desired=Math.max(0,Math.min(metrics.travel,clientY-rect.top-metrics.thumbHeight/2));
    window.scrollTo({top:(desired/metrics.travel)*metrics.maxScroll,behavior:'instant'});
  };

  return <div className="ruby-scrollbar" aria-hidden={metrics.maxScroll<=0} data-visible={metrics.maxScroll>0}>
    <div className="ruby-scrollbar__rail" ref={railRef}
      onPointerDown={event=>{
        if(event.target===event.currentTarget)scrollToRailPosition(event.clientY);
      }}>
      <div className="ruby-scrollbar__thumb" ref={thumbRef}
        role="scrollbar" aria-label="Page scroll position" aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={metrics.maxScroll?Math.round(metrics.scroll/metrics.maxScroll*100):0}
        tabIndex={metrics.maxScroll>0?0:-1}
        style={{transform:`translateY(${metrics.maxScroll?metrics.scroll/metrics.maxScroll*metrics.travel:0}px)`}}
        onPointerDown={event=>{
          if(event.button!==0)return;
          event.preventDefault();
          dragRef.current={startY:event.clientY,startScroll:window.scrollY};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event=>{
          const drag=dragRef.current;
          if(!drag||metrics.travel<=0)return;
          window.scrollTo({top:drag.startScroll+(event.clientY-drag.startY)/metrics.travel*metrics.maxScroll,behavior:'instant'});
        }}
        onPointerUp={event=>{
          dragRef.current=null;
          if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={()=>{dragRef.current=null;}}
        onKeyDown={event=>{
          const step=48;
          const next=event.key==='ArrowDown'?window.scrollY+step
            :event.key==='ArrowUp'?window.scrollY-step
            :event.key==='PageDown'?window.scrollY+window.innerHeight*.8
            :event.key==='PageUp'?window.scrollY-window.innerHeight*.8
            :event.key==='Home'?0
            :event.key==='End'?metrics.maxScroll:null;
          if(next!==null){
            event.preventDefault();
            window.scrollTo({top:next,behavior:'instant'});
          }
        }}>
        <img src={rubyUrl} alt="" draggable={false}/>
      </div>
    </div>
  </div>;
}
