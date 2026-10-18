/** Test-only SSR/JSDOM bridge. Private input is stdin/in-memory only.
 * This is not a browser installation, layout, compositor-paint or p95 proof.
 */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {pathToFileURL} from 'node:url';
import {BattleStatistics} from '../src/ui/BattleStatistics.tsx';
import {createUploadCapture} from '../../scripts/upload-staging-observer.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
export async function renderDiagnosticWitness({receipt,dataset,expected}){
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(receipt?.diagnosticTraceId??'')&&receipt.diagnosticTraceId.length===36,'Missing opaque receipt UUID');
  const games=dataset?.games?.filter(g=>g.matchId===expected.matchId&&g.gameId===expected.gameId)??[];
  check(games.length===1,'Missing or ambiguous authenticated Game');
  const game=games[0];
  check(game.sourceHash===expected.sourceSha256&&game.revision===expected.revision,'Source/revision mismatch');
  const markup=renderToStaticMarkup(React.createElement(BattleStatistics,{game,preview:false,provisional:!game.eligible,openPlayer:()=>{}}));
  const dom=new JSDOM(markup,{pretendToBeVisual:true});
  try{
    const sourceBound=()=>{
      const ledger=dom.window.document.querySelector('.battle-ledger');
      return ledger?.getAttribute('data-aof-match-id')===expected.matchId&&ledger.getAttribute('data-aof-game-id')===expected.gameId&&
        ledger.getAttribute('data-aof-source')===expected.sourceSha256&&ledger.getAttribute('data-aof-revision')===String(expected.revision)&&
        ledger.getAttribute('data-aof-preview')==='false';
    };
    check(sourceBound(),'Rendered source/revision fence missing');
    const table=dom.window.document.querySelector('.battle-ledger-table');
    const usable=!!table&&[...table.querySelectorAll('.sx-value-button')].some(cell=>!/^(?:—|N\/A|\s*)$/.test(cell.textContent.trim()));
    check(usable,'No usable rendered measurement');
    const capture=createUploadCapture({...expected,mode:'compact'},()=>dom.window.performance.now());
    capture.commit();capture.uploadStarted({auto:true,auth:true});capture.uploadReturned({result:receipt});capture.statisticsReturned({result:dataset});
    // These are real JSDOM callbacks, explicitly not browser frame/paint proof.
    await new Promise(resolve=>dom.window.requestAnimationFrame(()=>dom.window.requestAnimationFrame(resolve)));
    check(sourceBound(),'Rendered source changed between JSDOM callbacks');
    capture.observeDom({table:usable,docket:false,sourceBound:sourceBound(),frame:true});
    const report=capture.report();
    check(report.uploadMatched&&report.sourceMatched&&report.sourceMatchedVisibleFrameMs!==null&&report.diagnosticTraceId===receipt.diagnosticTraceId,'Observer receipt/frame contract did not match');
    return {diagnosticTraceId:receipt.diagnosticTraceId,authenticatedReceiptContractMatched:true,sourceRevisionRendered:true,
      nonPreviewRendered:true,usableStatisticsRendered:true,observerReceiptFrameContractMatched:true,
      ssrJsdomOnly:true,browserClickObserved:false,browserLayoutObserved:false,compositorPaintObserved:false,p95Established:false};
  }finally{dom.window.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const chunks=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;if(size>4*1024*1024)throw Error('Private input bound exceeded');chunks.push(chunk);}
    const result=await renderDiagnosticWitness(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch{process.stderr.write('Diagnostic render witness failed; private payload omitted.\n');process.exitCode=1;}
}
