/** Experimental selective native evidence view for StatisticsExperience only.
 *
 * Not a complete reconstruction, provenance migration or social-scoring input.
 * It exposes the original per-player episode groups by referencing each unique
 * producer episode's *small body*, without expanding the huge shared arrays.
 *
 * Existing projectStatistics/augmentSeasonShowcase only need episode metadata,
 * classification, timing and participants for the read model. Detailed social
 * audits or full Battle detail must use a separately authenticated evidence
 * consumer; never treat this selective view as complete source material.
 */
const DIRECT_VERSION = 'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL';
const PRODUCER_GROUPS = new Set([
  'skirmishes', 'battles', 'reinforcements',
  'defensiveAssists', 'cooperativeAttacks',
]);
const REF = /^([a-zA-Z]+)\/(0|[1-9][0-9]*)$/;

type Bag = Record<string, any>;
const object=(v:unknown):Bag|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Bag:null;

export function nativeStatisticsExperienceInput(raw:unknown):Bag {
  const source=object(raw),layer=object(source?.sharedEpisodeDelivery);
  if(!source||!layer||layer.version!==DIRECT_VERSION)throw new Error('Unsupported native statistics delivery format.');
  const registry=object(layer.producerGroups);
  if(!registry||Object.keys(registry).length!==PRODUCER_GROUPS.size||
     [...PRODUCER_GROUPS].some(name=>!Array.isArray(registry[name])))
    throw new Error('Incomplete native producer registry.');
  if(!Array.isArray(source.participants)||!Array.isArray(layer.playerRefs)||
     source.participants.length!==layer.playerRefs.length)
    throw new Error('Native statistics player count mismatch.');

  // Every native reference resolves to an existing producer-owned episode body.
  // No shared sourceEventIds, interaction edges or detailed evidence is expanded.
  const cache = new Map<string,Bag>();
  const resolve=(reference:unknown):Bag=>{
    if(typeof reference!=='string')throw new Error('Invalid native episode reference.');
    const parsed=REF.exec(reference);
    if(!parsed||!PRODUCER_GROUPS.has(parsed[1]))throw new Error('Unknown native producer episode.');
    if(cache.has(reference))return cache.get(reference)!;
    const rows=registry[parsed[1]] as unknown[];
    const index=Number(parsed[2]);
    if(!Number.isSafeInteger(index)||index>=rows.length)throw new Error('Missing native producer episode.');
    const stored=object(rows[index]),body=object(stored?.body);
    if(!body)throw new Error('Malformed native producer episode.');
    // Shared large fields are deliberately unavailable in this selective view.
    cache.set(reference,body);
    return body;
  };
  const participants=source.participants.map((participant:unknown,index:number)=>{
    const player=object(participant),row=object(layer.playerRefs[index]);
    if(!player||!row||row.playerId!==player.playerId||row.replaySlot!==player.replaySlot)
      throw new Error('Native player identity/reference binding changed.');
    const military=object(player.military),engagements=object(military?.engagements),groups=object(row.groups);
    if(!military||!engagements||!groups||engagements.engagementEvidence!==undefined)
      throw new Error('Malformed or already hydrated native player.');
    const evidence:Bag={};
    for(const [key,refs] of Object.entries(groups)){
      if(!Array.isArray(refs)||!refs.every(ref=>typeof ref==='string'))
        throw new Error('Malformed native player episode group.');
      evidence[key]=refs.map(resolve);
    }
    for(const required of ['skirmishes','battles','greatBattles',
                           'defensiveAssistsGiven','cooperativeAttacks'])
      if(!Array.isArray(evidence[required]))throw new Error('Missing required native player episode group.');
    return {...player,military:{...military,engagements:{...engagements,engagementEvidence:evidence}}};
  });
  return {...source,participants};
}
