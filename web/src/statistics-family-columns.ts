function normalizeFamilyRows(){
  document.querySelectorAll<HTMLTableElement>('table.sx-hall-v2-table').forEach(table=>{
    const columnCount=table.tHead?.rows[0]?.cells.length??0;
    if(columnCount<2)return;
    table.querySelectorAll<HTMLTableRowElement>('tr.sx-family-row').forEach(row=>{
      const band=row.querySelector<HTMLTableCellElement>('td.sx-family-band');
      if(!band)return;
      const fragment=document.createDocumentFragment();
      for(let index=1;index<columnCount;index+=1){
        const cell=document.createElement('td');
        cell.className='sx-family-band-cell';
        cell.setAttribute('aria-hidden','true');
        fragment.append(cell);
      }
      band.replaceWith(fragment);
    });
  });
}

let scheduled=false;
function scheduleNormalize(){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(()=>{
    scheduled=false;
    normalizeFamilyRows();
  });
}

const observer=new MutationObserver(scheduleNormalize);
observer.observe(document.documentElement,{childList:true,subtree:true});
scheduleNormalize();
