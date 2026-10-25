"""#163 adapter only. No grade formula, rule selection or key substitution."""
from int_c1_preview import (load_preview_request, prepare_preview_inputs,
                            preview_from_analysis, require)
from social_v1_metric_grade_candidates import prepare_social_metric_grade_candidates

VERSION = 'AOF_INT_C2A_WORKER_PREVIEW_1'

def preview_candidates_from_analysis(*, snapshot, statistics, analysis, historical_order):
    require(historical_order == {'leagueOrderKey':None,
            'gameNumber':historical_order.get('gameNumber'), 'order':'UNKNOWN'},
            'C2A_HISTORICAL_ORDER_NOT_ADMITTED')
    prepared = prepare_preview_inputs(snapshot=snapshot, statistics=statistics, analysis=analysis)
    context, measurements = prepared
    legacy = preview_from_analysis(snapshot=snapshot,statistics=statistics,analysis=analysis,
        historical_order=historical_order,_prepared=prepared)
    producer = prepare_social_metric_grade_candidates(statistics=statistics,context=context,
        source_measurements=measurements,action_events=analysis['actionEvents'],
        game_scope={k:snapshot[k] for k in ('battleId','gameId','gameGuid','authorityRevision')})
    refs = set()
    for g in producer['candidateEpisodeGroups']:
        refs.update(g['sourceEventIds']);refs.update(g['opportunity']['sourceEventIds'])
        for c in g['counterevidenceCandidates']:refs.update(c['sourceEventIds'])
    for g in producer['neutralPlacementContexts']+producer['neutralTributeRequestContexts']:
        refs.add(g['sourceEventId'])
    require(len(refs)<=20000,'C2A_SOURCE_WITNESS_BUDGET_EXCEEDED')
    witnesses = {e['eventId']:{'sourceEventId':e['eventId'],'actorReplaySlot':e['actorPlayerId'],
        'atMs':e['timestampMs'],'operationOrdinal':e.get('operationOrdinal'),
        'action':e.get('sourceActionName')} for e in analysis['actionEvents'] if e['eventId'] in refs}
    require(set(witnesses)==refs,'C2A_ORIGINAL_WITNESS_MISSING')
    contexts = [{'descriptorId':o['observationId'],'sourceDeedId':o['sourceDeedId'],
        'actorReplaySlot':o['fromReplayPlayerId'],'counterpartReplaySlot':o['toReplayPlayerId'],
        'windowStartMs':o['preEntryRequestedActivity']['windowStartMs'],
        'windowEndExclusiveMs':o['preEntryRequestedActivity']['windowEndExclusiveMs'],
        'sourceEventIds':o['preEntryRequestedActivity']['sourceEventIds'],
        'priorSameDeeds':o['priorDirectedEpisodeCandidates']['sameDirectionSourceDeedIds'],
        'priorOppositeDeeds':o['priorDirectedEpisodeCandidates']['oppositeDirectionSourceDeedIds']}
        for o in measurements['observations']]
    return {'version':VERSION,'legacy':legacy,'producer':producer,'priorContexts':contexts,
        'sourceWitnesses':[witnesses[k] for k in sorted(witnesses)]}

def process_candidates_preview(request):
    return preview_candidates_from_analysis(**load_preview_request(request))
