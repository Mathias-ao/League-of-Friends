"""Extraction-run provenance, coverage, and replay-free evidence projections."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
from importlib.metadata import distribution
import json
from pathlib import Path
import uuid

from canonical_io import (ROOT, SCHEMA_VERSION, ConformanceError, artifact_ref, json_bytes,
                          read_json, sha256, iter_store, validate_bundle, validate_schema,
                          schema_validator, write_gzip)
from jsonschema import Draft202012Validator, FormatChecker
from canonical_projector import CompactProjector

EXPORTER_VERSION = "AOF_CANONICAL_EXTRACTOR_V1"


def code_digest(paths: list[tuple[str, Path]]) -> str:
    digest = hashlib.sha256()
    for name, path in sorted(paths):
        digest.update(name.encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def version_bundle() -> dict[str, str]:
    decoder = distribution('mgz-fast')
    decoder_paths = [(str(p), Path(decoder.locate_file(p))) for p in decoder.files if str(p).endswith('.py')]
    return {'exporterVersion': EXPORTER_VERSION,
            'exporterCodeSha256': code_digest([(p.name, p) for p in ROOT.glob('*.py')]),
            'decoderDistribution': 'mgz-fast', 'decoderVersion': decoder.version,
            'decoderCodeSha256': code_digest(decoder_paths), 'canonicalSchemaVersion': SCHEMA_VERSION,
            'schemaSha256': sha256(ROOT / 'canonical-replay-v1.schema.json'),
            'entityDataVersion': 'RAW_AOE2_IDS_V1',
            'compatibilityRegistrySha256': sha256(ROOT / 'compatibility.json')}


def compatibility(header: dict) -> dict:
    registry = read_json(ROOT / 'compatibility.json')
    versions = version_bundle()
    decoder_matches = (versions['decoderVersion'] == registry['decoder']['version'] and
                       versions['decoderCodeSha256'] == registry['decoder']['codeSha256'])
    candidates = [item for item in registry['tuples'] if decoder_matches
                  if (item['saveVersion'], item['gameBuild']) == (header['save_version'], header.get('de', {}).get('build'))]
    return {'status': 'fixture_regression_only' if candidates else 'unverified_tuple',
            'fixtureIds': candidates[0]['fixtureIds'] if candidates else [],
            'unqualifiedCapabilities': registry['unqualifiedCapabilities']}


def coverage_report(body: dict, header: dict, players: list[dict]) -> dict:
    status = 'available' if compatibility(header)['status'] == 'fixture_regression_only' else 'unsupported_version'
    return {'coverageVersion': 'AOF_COVERAGE_V1',
            'chunkPolicy': {'version': 'AOF_CHUNKS_V1', 'maxRecords': 10000,
                            'maxUncompressedBytes': 8388608, 'singleOversizedRecord': 'retain_without_truncation'},
            'framing': {'status': 'complete' if body['bodyParseComplete'] else 'partial',
                        'operationCounts': body['operationCounts'],
                        'unknownActionCounts': body['unknownActionCounts']},
            'decoding': {'status': 'partial', 'decodeStatusCounts': body['decodeStatusCounts'],
                         'recognizedActionPercent': body['decodeCoveragePercent'],
                         'byteAccounting': 'whole_frames_retained_unread_spans_not_instrumented'},
            'clock': {'basis': 'sum_of_observed_sync_increments', 'observedUntilMs': body['durationMs'],
                      'restoreTimeRaw': header.get('map', {}).get('restore_time'),
                      'gameElapsedOriginQualified': False},
            'participants': [p['replaySlot'] for p in players],
            'capabilities': {
                'queueRequests': {'status': status, 'scope': 'decoded_commands_only', 'completion': 'not_observable'},
                'researchRequests': {'status': status, 'scope': 'decoded_commands_only', 'completion': 'not_observable'},
                'buildingPlacements': {'status': status, 'scope': 'decoded_commands_only', 'completion': 'not_observable'},
                'directedDiplomacyCommands': {'status': status, 'scope': 'encoded_actor_target_and_mode_only',
                                             'effectiveStance': 'insufficient_evidence'},
                'observedAgeReached': {'status': 'insufficient_evidence', 'reason': 'System-message authenticity/language qualification pending; raw structured messages retained.'},
                'initialObjects': {'status': 'insufficient_evidence', 'reason': 'Decoded observations retained; dependency uses object search and skips some classes.'},
                'entityNormalization': {'status': 'insufficient_evidence', 'reason': 'Raw IDs preserved; catalog is not qualified against replay patch/data mods.'},
                'matchResult': {'status': 'not_observable', 'reason': 'Independent result resolver is outside extraction; EOF is not a winner or completion.'},
                'fullGameMetricTotals': {'status': 'insufficient_evidence', 'reason': 'Recorded interval and semantic coverage do not establish the complete game.'}},
            'warnings': [
                {'code': 'PARTIAL_DECODE', 'message': 'Raw frames retained for all operations, including discarded/unknown fields.'},
                {'code': 'HEADER_SEMANTICS_UNQUALIFIED', 'message': 'Lobby values and inferred map height are candidate values; the complete decoded header and raw prefix remain available.'},
                {'code': 'RELATION_STATE_UNQUALIFIED', 'message': 'Initial diplomacy and lobby teams remain raw. Directed commands do not establish a mutual alliance or successful stance change.'},
                {'code': 'NO_SOURCE_DELETION', 'message': 'Local verification is not remote persistence verification. The source file is never deleted by this CLI.'}]}


def field_claims() -> dict:
    """Field rules override coarser event-level evidence, with explicit scopes."""
    return {'claimVersion': 'AOF_FIELD_CLAIMS_V1', 'claims': [
        {'scope': 'body_events', 'field': '/timestampMs', 'classification': 'B',
         'methodVersion': 'AOF_SYNC_CLOCK_V1', 'sources': ['preceding clock.sync /payload/incrementMs'],
         'assumptions': ['local observed segment; restore offset and full-game origin unqualified']},
        {'scope': 'initial_map', 'field': '/height', 'classification': 'B',
         'methodVersion': 'AOF_MAP_HEIGHT_V1', 'sources': ['decoded map.dimension', 'decoded map.tiles count'],
         'assumptions': ['complete rectangular tile list from pinned decoder; no square fallback']},
        {'scope': 'body_events', 'field': '/payload/_rawOperationBase64', 'classification': 'A',
         'methodVersion': EXPORTER_VERSION, 'sources': ['original-file byteOffset/byteLength'], 'assumptions': []},
        {'scope': 'de_71094_queue_commands', 'field': '/payload/amount', 'classification': 'A',
         'methodVersion': 'AOF_DE_COMMAND_FIELDS_V1', 'sources': ['raw signed int16 amount'],
         'assumptions': ['encoded request quantity only; no acceptance, completion or cancellation allocation claim']},
        {'scope': 'de_71094_research_commands', 'field': '/payload/technology_id', 'classification': 'A',
         'methodVersion': 'AOF_DE_COMMAND_FIELDS_V1', 'sources': ['raw research command'],
         'assumptions': ['request only; raw selectedBuildingIds retained separately from primary object ID']},
        {'scope': 'de_71094_build_commands', 'field': '/position', 'classification': 'A',
         'methodVersion': 'AOF_DE_COMMAND_FIELDS_V1', 'sources': ['raw build x/y floats'],
         'assumptions': ['placement/order only; no completed building claim']},
        {'scope': 'de_71094_diplomacy_commands', 'field': '/targetPlayerId', 'classification': 'A',
         'methodVersion': 'AOF_DE_COMMAND_FIELDS_V1', 'sources': ['raw directed target player'],
         'assumptions': ['no symmetry; raw mode and duplicate embedded source/mode fields retained; effective state unqualified']}
    ]}


def stage_run(directory: Path, manifest: dict, header: dict, prefix: bytes,
              body: dict, players: list[dict], safe_header: dict) -> dict:
    raw = write_gzip(directory / 'header-prefix.bin.gz', prefix)
    decoded = write_gzip(directory / 'decoded-header.json.gz', json_bytes(safe_header))
    report = coverage_report(body, header, players)
    (directory / 'coverage-report.json').write_bytes(json_bytes(report))
    (directory / 'field-claims.json').write_bytes(json_bytes(field_claims()))
    run = {'contractVersion': 'AOF_EXTRACTION_V1', 'extractionRunId': str(uuid.uuid4()),
           'createdAt': manifest['source']['parsedAt'], 'state': 'staged',
           'sourceSha256': manifest['source']['sha256'], 'versions': version_bundle(),
           'canonicalManifest': artifact_ref(directory / 'canonical-replay.json', 'identity'),
           'headerEvidence': {'rawPrefix': raw, 'decodedHeader': decoded,
                              'bodyByteOffset': len(prefix), 'offsetDomain': 'original_file'},
           'coverageReport': artifact_ref(directory / 'coverage-report.json', 'identity'),
           'fieldClaims': artifact_ref(directory / 'field-claims.json', 'identity'),
           'retention': {'policy': 'temporary_until_verified_canonical_persistence',
                         'sourceDeletionEligible': False, 'persistenceVerified': False},
           'binding': {'status': 'unbound', 'leagueMatchId': None, 'leagueGameId': None,
                       'participantIdentityNamespace': 'replay_slot'},
           'compatibility': compatibility(header)}
    (directory / 'extraction-manifest.json').write_bytes(json_bytes(run))
    return run


def _fast_artifact_check(directory: Path, ref: dict, label: str) -> None:
    """Cheap same-process publication check: path safety, existence and byte length."""
    uri = ref.get('uri')
    if not isinstance(uri, str) or not uri or Path(uri).name != uri or '\\' in uri:
        raise ConformanceError(f"{label}: invalid local artifact URI")
    path = directory / uri
    if path.is_symlink() or not path.is_file():
        raise ConformanceError(f"{label}: missing or non-regular artifact {uri}")
    if path.stat().st_size != ref.get('byteLength'):
        raise ConformanceError(f"{label}: artifact byte length mismatch {uri}")


def _fast_store_check(directory: Path, store: dict, label: str) -> None:
    chunks = store.get('chunks')
    if not isinstance(chunks, list):
        raise ConformanceError(f"{label}: missing chunk list")
    declared_total = store.get('recordCount')
    if type(declared_total) is not int or declared_total < 0:
        raise ConformanceError(f"{label}: invalid record count")
    total = 0
    expected_first = 0
    for index, ref in enumerate(chunks):
        _fast_artifact_check(directory, ref, f"{label}[{index}]")
        count = ref.get('recordCount')
        first = ref.get('firstOrdinal')
        last = ref.get('lastOrdinal')
        if type(count) is not int or count <= 0:
            raise ConformanceError(f"{label}[{index}]: invalid chunk record count")
        if first != expected_first or last != first + count - 1:
            raise ConformanceError(f"{label}[{index}]: non-contiguous ordinal metadata")
        total += count
        expected_first = last + 1
    if total != declared_total:
        raise ConformanceError(f"{label}: chunk totals do not match recordCount")


def seal_local_fast(directory: Path, run: dict) -> None:
    """Fast development seal; exhaustive event conformance remains a separate audit."""
    manifest = read_json(directory / 'canonical-replay.json')
    validate_schema(manifest, schema_validator(), 'manifest')
    run_schema = read_json(ROOT / 'extraction-manifest-v1.schema.json')
    validate_schema(run, Draft202012Validator(run_schema, format_checker=FormatChecker()), 'run')
    if run.get('state') != 'staged':
        raise ConformanceError('Fast seal requires a staged extraction run')
    if run.get('sourceSha256') != manifest.get('source', {}).get('sha256'):
        raise ConformanceError('Fast seal source identity mismatch')
    if run.get('canonicalManifest', {}).get('sha256') != sha256(directory / 'canonical-replay.json'):
        raise ConformanceError('Fast seal canonical manifest changed after staging')

    report = read_json(directory / 'coverage-report.json')
    if report.get('framing', {}).get('status') != 'complete':
        raise ConformanceError('Fast seal refuses an incomplete framed body')

    _fast_artifact_check(directory, run['headerEvidence']['rawPrefix'], 'header raw prefix')
    _fast_artifact_check(directory, run['headerEvidence']['decodedHeader'], 'decoded header')
    _fast_artifact_check(directory, run['fieldClaims'], 'field claims')
    _fast_store_check(directory, manifest['factStore'], 'factStore')
    _fast_store_check(directory, manifest['initialState']['objectStore'], 'initial object store')
    _fast_store_check(directory, manifest['initialState']['map']['terrainStore'], 'terrain store')

    report['fastSeal'] = {
        'sealVersion': 'AOF_FAST_SEAL_V1',
        'status': 'passed',
        'scope': 'same-process structural publication checks only; no event-by-event schema validation, raw-byte replay reconstruction, or whole-store semantic reconciliation',
        'fullConformanceRequiredForVerifiedLocal': True,
    }
    (directory / 'coverage-report.json').write_bytes(json_bytes(report))
    run['coverageReport'] = artifact_ref(directory / 'coverage-report.json', 'identity')
    run['state'] = 'sealed_local_fast'
    (directory / 'extraction-manifest.json').write_bytes(json_bytes(run))


def seal_local(directory: Path, run: dict) -> None:
    validation = validate_bundle(directory)
    report = read_json(directory / 'coverage-report.json')
    report['validation'] = validation
    (directory / 'coverage-report.json').write_bytes(json_bytes(report))
    run['coverageReport'] = artifact_ref(directory / 'coverage-report.json', 'identity')
    run['state'] = 'verified_local'
    (directory / 'extraction-manifest.json').write_bytes(json_bytes(run))

def project_bundle(directory: Path, *, validate: bool = True) -> dict:
    if validate:
        validate_bundle(directory)
    manifest = read_json(directory / 'canonical-replay.json')
    run = read_json(directory / 'extraction-manifest.json')
    projector = CompactProjector({p['playerId'] for p in manifest['participants']})
    for event in iter_store(directory, manifest['factStore']):
        projector.consume(event)
    body = projector.finish()
    return {'schemaVersion': 'AOF_CANONICAL_PROJECTION_V2', 'sourceSha256': manifest['source']['sha256'],
            'extractionRunId': run['extractionRunId'],
            'canonicalManifestSha256': run['canonicalManifest']['sha256'],
            'sourceCanonicalSchemaVersion': manifest['schemaVersion'],
            'scope': 'observed_decoded_commands', 'body': body,
            'fundamentals': fundamentals(body),
            'coverage': read_json(directory / 'coverage-report.json')}


def fundamentals(body: dict) -> dict:
    """Small exact evidence totals; changing windows or taxonomies needs no replay.

    Diplomacy timelines contain COMMANDED raw modes and preserve tied-event
    source order; neither symmetric relations nor successful changes are inferred.
    """
    quantities, queue_counts, research, builds = defaultdict(Counter), defaultdict(Counter), defaultdict(Counter), defaultdict(Counter)
    missing = Counter()
    for event in body['productionEvents']:
        player, unit, amount = str(event['replaySlot']), str(event['unitId']), event['signedAmount']
        queue_counts[player][unit] += 1
        if amount is None:
            missing[player] += 1
        else:
            quantities[player][unit] += max(0, amount)
    for event in body['researchEvents']:
        research[str(event['replaySlot'])][str(event['technologyId'])] += 1
    for event in body['buildEvents']:
        builds[str(event['replaySlot'])][str(event['buildingId'])] += 1
    directed = defaultdict(list)
    for event in body['diplomacyEvents']:
        directed[f"{event['replaySlot']}->{event['targetReplaySlot']}"].append(event)
    age_requests = [e for e in body['researchEvents'] if e['technologyId'] in (101, 102, 103)]
    return {'fundamentalsVersion': 'AOF_COMMAND_FUNDAMENTALS_V2',
            'queueCommandCountsByPlayerAndRawUnit': dict(queue_counts),
            'positiveQueueAmountsByPlayerAndRawUnit': dict(quantities),
            'queueCommandsWithUnknownAmountByPlayer': dict(missing),
            'researchCommandCountsByPlayerAndRawTechnology': dict(research),
            'buildingPlacementCountsByPlayerAndRawBuilding': dict(builds),
            'ageAdvanceRequestCandidates': {'events': age_requests, 'basis': 'research_ids_101_102_103',
                'qualification': 'decoded research requests; repeated clicks may refer to one intended start'},
            'ageAdvanceStarted': {'status': 'insufficient_evidence', 'events': []},
            'observedAgeReached': {'status': 'insufficient_evidence', 'events': []},
            'projectedAgeCompletion': {'status': 'not_observable', 'events': []},
            'directedDiplomacyCommandTimelines': dict(directed)}


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate/project canonical bundles without a replay or decoder.')
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--out', type=Path, help='Write canonical command fundamentals and compact compatibility body.')
    parser.add_argument('--full-audit', action='store_true', help='Run exhaustive conformance and upgrade the run to verified_local.')
    args = parser.parse_args()
    if args.full_audit:
        run = read_json(args.bundle / 'extraction-manifest.json')
        seal_local(args.bundle, run)
        print(json.dumps(validate_bundle(args.bundle), indent=2))
    elif args.out:
        args.out.write_bytes(json_bytes(project_bundle(args.bundle)))
        print(f'Wrote canonical projection to {args.out}')
    else:
        print(json.dumps(validate_bundle(args.bundle), indent=2))


if __name__ == '__main__':
    main()
