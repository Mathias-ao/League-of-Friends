/** Controlled source/authority/opportunity evidence. NOT genuine replay bytes. */
import {createHash} from 'node:crypto';
import {createPracticalPersonalityPolicy,practicalSourceFingerprint} from '../../lib/engines/personalityV1/practicalPolicy.js';
import {PRACTICAL_POLICY as spec,PRACTICAL_POLICY_SHA256} from '../../lib/engines/personalityV1/practicalPolicyResource.js';
export const hash=v=>createHash('sha256').update(String(v)).digest('hex');
export const owner='p1';
export function sourceItem(n=1){
 const roster=[{playerId:owner,replaySlot:1,teamId:'1'},{playerId:'p2',replaySlot:2,teamId:'2'}];
 const participant={playerId:1,replaySlot:1,
  economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',resourcesCommitted:{total:13},coverage:{unpricedRequestCommands:0}}},
  military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',militarySpend:{resources:4,unpricedMilitaryCommandAmount:0},
   composition:{infantry:4,archers:0,cavalry:0},militaryUnitsTrained:{positiveQueueAmount:4,unknownAmountCommands:0},
   engagements:{engagementModelVersion:'AOF_ENGAGEMENT_STATISTICS_V4',raidEvidence:{initiatedEpisodes:[1,2].map(i=>({
    raidId:'raid'+i,modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:1,victimPlayerId:2,
    startedAtMs:i*100,endedAtMs:i*100+50,sourceEventIds:['raid-'+i]}))},engagementEvidence:{battles:[]}}},
  mapPresence:{modelVersion:'AOF_MAP_PRESENCE_V8',homeAnchor:{method:'initial_town_center'},
   buildingSectors:{classifiedPlacementCount:4,evidence:[1,2,3,4].map(i=>({buildingId:82,sector:i===4?'forward':'home',
    sourceEventId:'build-'+i,atMs:i*100,position:{x:10+i,y:30}}))},
   expansionZones:{status:'ok',count:2,eligibleRemoteBuildingCount:2,eligibleBuildingPlacementsInsideHomeRadius:4,
    zones:[1,2].map(i=>({zoneId:'zone'+i,buildings:[{sourceEventId:'remote'+i}]}))}}};
 const source={contract:'AOF_SOCIAL_V1_SHARED_1',matchId:'battle'+n,battleId:'battle'+n,gameId:'g1',eventId:'e',seasonId:'s',
  sourceHash:hash('original'+n),authorityRevision:hash('authority'+n),mappingDigest:hash('mapping'+n),
  eventAdmissionDigest:hash('event'),statisticsRevision:1,gameGuid:'guid-'+n,artifactRefs:[{kind:'STATISTICS',digest:hash('stats'+n),generation:'1'}],
  roster,outcome:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null}};
 return {source,match:{format:'ONE_V_ONE',opponentKind:'HUMAN',firstCompletedAt:{toMillis:()=>n*1000}},
  game:{gameNumber:1,players:roster.map(p=>({playerId:p.playerId,team:Number(p.teamId)}))},
  statistics:{entityCatalogVersion:'CONTROLLED_EXACT_CATALOG',scope:{observedUntilMs:2400000},participants:[participant],
   matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
    source:{replaySha256:source.sourceHash,gameBuild:185872},
    game:{observedDurationMs:2400000,durationMeaning:'observed_recording_interval_not_proven_full_game'},map:{id:9},
    rules:{mapId:{value:9,status:'DECODED'},startingAgeId:{value:0,status:'DECODED'},startingResourcesId:{value:0,status:'DECODED'}},
    players:roster.map(p=>({playerId:p.replaySlot,replaySlot:p.replaySlot,civilization:{rawId:p.replaySlot+1}})),
    diplomacy:{effectiveRuntimeStateQualified:false}},
   sharedEpisodeDelivery:{version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',sourceMode:'producer_unique_episodes',
    producerGroups:{battles:[],skirmishes:[],reinforcements:[]},playerRefs:[{replaySlot:1,playerId:1,groups:{battles:[]}}]}}};
}
export function review(item){return {
 sourceFingerprint:practicalSourceFingerprint(item),referenceId:'CONTROLLED_SOURCE_REVIEW',gameBuild:185872,completeInterval:true,
 costCatalog:{product:'AOE2_DE',version:item.statistics.entityCatalogVersion,sha256:hash('catalog'),referenceId:'CONTROLLED_APPLICABLE_CATALOG',gameBuild:185872},
 spatial:{version:'AOF_PERSONALITY_CONTEXT_PROOF_V1',status:'REVIEWED_SOURCE_CLASSIFICATION',referenceId:'CONTROLLED_SPATIAL_REVIEW',
  sourceHash:item.source.sourceHash,gameBuild:185872,mapId:9,startingAgeId:0,startingResourcesId:0,mapFamily:'LAND',startFamily:'STANDARD',
  durationBucket:{id:'CONTROLLED_OBSERVED_INTERVAL',lowerObservedMs:0,upperObservedMsExclusive:3600000,meaning:'OBSERVED_RECORDING_INTERVAL_ONLY'}},
 strategicBuildings:{gameBuild:185872,ids:[82],referenceId:'CONTROLLED_BUILDING_TAXONOMY',catalogSha256:hash('catalog'),catalogVersion:item.statistics.entityCatalogVersion,product:'AOE2_DE'},
 commandAttribution:{referenceId:'CONTROLLED_EPISODE_ATTRIBUTION',version:'AOF_RAID_V3_ENGAGEMENT_V4_ATTRIBUTION_1'},
 militaryFamilies:{opportunityKey:'BUILD_185872_CIV_2',families:['infantry','archers','cavalry'],referenceId:'CONTROLLED_AVAILABLE_OPPORTUNITY'},
 expansionSites:{referenceId:'CONTROLLED_ECONOMIC_SITE_REVIEW',version:'AOF_MAP_PRESENCE_V8_DISTINCT_SITES_1',catalogSha256:hash('catalog'),catalogVersion:item.statistics.entityCatalogVersion,product:'AOE2_DE'}
};}
export function policy(items){return createPracticalPersonalityPolicy(owner,items,Object.fromEntries(items.map(i=>[i.source.sourceHash,review(i)])));}
export function battle(item){return {battleId:item.source.battleId,gameIds:[item.source.gameId],gameManifestComplete:true,sources:[item]};}
export function runtimeRecord(project='demo-aof-native-player',sourceReviews={}){return {
 version:'AOF_PERSONALITY_PRIVATE_RUNTIME_1',status:'APPROVED',project,policyVersion:spec.policyVersion,configurationVersion:spec.configurationVersion,
 policySha256:PRACTICAL_POLICY_SHA256,policyApprovalRef:spec.approvalRef,visibility:'OWNER_ONLY',publicPublicationAllowed:false,officialWritesAllowed:false,
 runtimeApprovalRef:'CONTROLLED_EMULATOR_RELEASE_AUTHORIZATION',revision:1,sourceReviews};}
