import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {EVENT_SHOWCASE_CATALOGUE} from '../src/domain/eventRoundoffShowcase';
import {ACCOMPLISHMENT_EMBLEMS,AccomplishmentEmblem} from '../src/ui/AccomplishmentEmblem';

test('every ranked accomplishment has a decorative emblem with an isolated gold gradient',()=>{
  const types=[...new Set(EVENT_SHOWCASE_CATALOGUE.map(row=>row.emblem))];
  for(const type of types)assert.ok(ACCOMPLISHMENT_EMBLEMS[type],type);
  const markup=renderToStaticMarkup(React.createElement('div',null,types.map(type=>React.createElement(AccomplishmentEmblem,{kind:type,key:type}))));
  const dom=new JSDOM(markup),svgs=[...dom.window.document.querySelectorAll('svg')];
  assert.equal(svgs.length,types.length);
  const gradients=[...dom.window.document.querySelectorAll('linearGradient')].map(g=>g.id);
  assert.equal(new Set(gradients).size,types.length);
  for(const svg of svgs){assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('focusable'),'false');assert.ok(svg.querySelector('path')?.getAttribute('fill')?.includes(svg.querySelector('linearGradient')!.id));}
  dom.window.close();
});
