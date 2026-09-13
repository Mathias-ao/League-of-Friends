"""Compatibility report projected solely from canonical parser facts.

Queue quantities remain signed raw amounts. Missing/zero/negative quantities
are never converted to a request for one unit. No trained/completed claims.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

PROJECTOR_VERSION = "AOF_COMPACT_PROJECTOR_V1"


class CompactProjector:
    def __init__(self, slots: set[int]):
        self.slots = slots
        self.operations, self.actions, self.unknown = Counter(), Counter(), Counter()
        self.decodes = Counter()
        self.player_actions = defaultdict(Counter)
        self.player_seconds = defaultdict(Counter)
        self.build_counts = defaultdict(Counter)
        self.keys = defaultdict(Counter)
        self.duration = 0
        self.complete = True
        self.events = {key: [] for key in ('buildEvents', 'wallEvents', 'productionEvents', 'researchEvents',
                       'marketEvents', 'tributeEvents', 'diplomacyEvents', 'flareEvents', 'resignations')}

    def consume(self, event: dict[str, Any]) -> None:
        op, name, p = event['sourceOperation'], event.get('sourceActionName') or 'ERROR', event['payload']
        self.operations[op] += 1
        self.decodes[event['decode']['status']] += 1
        self.duration = event['timestampMs']
        if op == 'UNKNOWN':
            self.complete = False
        if op != 'ACTION':
            return
        self.actions[name] += 1
        for key in p:
            if not key.startswith('_'):
                self.keys[name][key] += 1
        if event['decode']['status'] == 'unknown_action':
            self.unknown[str(event.get('sourceActionCode'))] += 1
        actor = event.get('actorPlayerId')
        if actor not in self.slots:
            return
        at = event['timestampMs']
        self.player_actions[actor][name] += 1
        self.player_seconds[actor][at // 1000] += 1
        base = {'replaySlot': actor, 'atMs': at, 'sourceEventId': event['eventId']}
        ids = event.get('objectInstanceIds', [])
        pos, end = event.get('position') or {}, event.get('endPosition') or {}
        def add(key: str, **values: Any) -> None:
            self.events[key].append({**base, **values})
        if name == 'RESIGN':
            add('resignations')
        elif name == 'RESEARCH':
            add('researchEvents', technologyId=p.get('technology_id'), producerObjectIds=ids)
        elif name == 'BUILD':
            if p.get('building_id') is not None:
                self.build_counts[actor][str(p['building_id'])] += 1
            add('buildEvents', buildingId=p.get('building_id'), builderObjectIds=ids, x=pos.get('x'), y=pos.get('y'))
        elif name == 'WALL':
            add('wallEvents', buildingId=p.get('building_id'), builderObjectIds=ids,
                x=pos.get('x'), y=pos.get('y'), xEnd=end.get('x'), yEnd=end.get('y'))
        elif name in ('QUEUE', 'DE_QUEUE', 'MULTIQUEUE', 'MAKE'):
            amount = p.get('amount') if type(p.get('amount')) is int else None
            add('productionEvents', commandType=name, unitId=p.get('unit_id'), amount=amount,
                signedAmount=amount, requestedAmountPositive=max(0, amount) if amount is not None else None,
                amountStatus='decoded_raw' if amount is not None else 'insufficient_evidence',
                buildingId=p.get('building_id'), producerObjectIds=ids)
        elif name in ('BUY', 'SELL'):
            add('marketEvents', type=name, resourceId=p.get('resource_id'), amount=p.get('amount'), marketObjectIds=ids)
        elif name in ('TRIBUTE', 'DE_TRIBUTE'):
            add('tributeEvents', targetReplaySlot=event.get('targetPlayerId'), resourceId=p.get('resource_id'),
                **{k: p.get(k) for k in ('amount', 'fee', 'food', 'wood', 'gold', 'stone')})
        if event['eventType'] == 'command.diplomacy_change':
            add('diplomacyEvents', targetReplaySlot=event.get('targetPlayerId'), diplomacyMode=p.get('diplomacy_mode'),
                commandId=p.get('command_id'), operationOrdinal=event['operationOrdinal'])
        if name == 'FLARE':
            add('flareEvents', x=pos.get('x'), y=pos.get('y'), targets=p.get('targets', []))

    def finish(self) -> dict[str, Any]:
        total = sum(self.actions.values())
        decoded = total - sum(self.unknown.values())
        return {'projectorVersion': PROJECTOR_VERSION, 'durationMs': self.duration,
                'durationBasis': 'sum_of_observed_sync_increments',
                'totalActions': total, 'totalSyncOperations': self.operations['SYNC'],
                'bodyParseComplete': self.complete, 'decodeCoveragePercent': round(decoded / total * 100, 3) if total else 0,
                'decodeCoverageMeaning': 'recognized_action_fraction_not_semantic_coverage',
                'operationCounts': dict(sorted(self.operations.items())), 'allActionCounts': dict(sorted(self.actions.items())),
                'unknownActionCounts': dict(sorted(self.unknown.items())), 'decodeStatusCounts': dict(sorted(self.decodes.items())),
                'cameraPointsTotal': self.operations['VIEWLOCK'], 'chatOperationsTotal': self.operations['CHAT'],
                'actionPayloadKeys': {k: dict(sorted(v.items())) for k, v in sorted(self.keys.items())},
                'actionCountsByPlayer': {str(k): dict(sorted(v.items())) for k, v in sorted(self.player_actions.items())},
                'actionSecondsByPlayer': {str(k): [{'second': s, 'count': n} for s, n in sorted(v.items())]
                                         for k, v in sorted(self.player_seconds.items())},
                'buildCountsByPlayer': {str(k): dict(sorted(v.items())) for k, v in sorted(self.build_counts.items())},
                **self.events}
