const LEDGER_SELECTOR='.sx-hall-v2-scroll';
const SCROLL_VAR='--sx-ledger-scroll-x';

function syncLedgerScroll(element:HTMLElement){
  element.style.setProperty(SCROLL_VAR,`${element.scrollLeft}px`);
}

function syncAllLedgers(){
  document.querySelectorAll<HTMLElement>(LEDGER_SELECTOR).forEach(syncLedgerScroll);
}

document.addEventListener('scroll',event=>{
  const target=event.target;
  if(target instanceof HTMLElement&&target.matches(LEDGER_SELECTOR))syncLedgerScroll(target);
},true);

const observer=new MutationObserver(syncAllLedgers);
observer.observe(document.documentElement,{childList:true,subtree:true});
queueMicrotask(syncAllLedgers);
