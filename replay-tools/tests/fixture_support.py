"""Artificial wire fixtures: exercise framing/layout, not AoE2 engine semantics."""
import copy
import json
from pathlib import Path
import struct
from unittest.mock import patch

from mgz.fast.enums import Action
import parse_replay

PREFIX = b'AOFFIX01' + struct.pack('<6I', 500, 0, 0, 0, 0, 0)


def action(code, actor, payload, sequence=1):
    data = struct.pack('<bh', actor, len(payload)) + payload
    return struct.pack('<II', 1, len(data) + 1) + bytes([code]) + data + struct.pack('<I', sequence)


def queue(amount, *, actor=1, producers=(100, 101), unit=83, extra=b''):
    data = struct.pack('<h4xhhh', len(producers), 109, unit, amount)
    data += struct.pack(f'<{len(producers)}I', *producers) + extra
    return action(Action.DE_QUEUE.value, actor, data)


def diplomacy(actor, target, mode):
    return action(Action.GAME.value, actor, struct.pack('<h2xhhfb', 0, actor, target, float(mode), mode))


def controlled_body():
    research = struct.pack('<Ihh5xII', 100, 2, 101, 100, 101)
    build = struct.pack('<h2xffI8xhbbI', 1, 0.0, 1.25, 87, 7, 8, 9, 200)
    chat = json.dumps({'player': 1, 'channel': 0, 'message': 'advanced to the Castle Age.',
                       'messageAGP': 'Player: advanced to the Castle Age.', 'tauntNumber': -1}).encode()
    order = struct.pack('<Iffh4x', 999, -1.0, 0.0, -1)
    return b''.join([
        struct.pack('<II', 2, 100), queue(5, extra=b'\xde\xad'), queue(-2), queue(0),
        action(Action.MAKE.value, 1, struct.pack('<H6xh', 109, 83)),
        action(Action.RESEARCH.value, 1, research), action(Action.BUILD.value, 1, build),
        diplomacy(1, 2, 3), diplomacy(2, 1, 0), diplomacy(1, 2, 0),
        action(Action.ORDER.value, 1, order), action(200, 1, b'\xab\xcd\xef'),
        action(Action.DE_UNKNOWN_37.value, 1, b'\xff\x00\xfe'),
        struct.pack('<IffI', 3, 0.0, 2.5, 123),
        struct.pack('<III', 4, 0, len(chat)) + chat,
    ])


def header():
    def player(number, obj):
        return {'number': number, 'name': f'Fixture {number}', 'civilization_id': number,
                'color_id': number, 'diplomacy': [0, 3, 3], 'objects': [obj]}
    def obj(instance, object_id, x, y):
        return {'instance_id': instance, 'object_id': object_id, 'class_id': 70, 'index': 0,
                'position': {'x': x, 'y': y}, 'uninterpreted': b'\x00\xff'}
    return {'save_version': 68.0, 'log_version': 5, 'game_version': 'VER 9.4',
            'players': [player(1, obj(100, 109, 0, 0)), player(2, obj(101, 109, 1, 2))],
            'map': {'dimension': 2, 'tiles': [(0, 0), (1, 0), (2, 1), (-1, 2), (3, 1), (4, 0)], 'restore_time': 0},
            'metadata': {'owner_id': 1, 'speed': 1.7}, 'de': {'build': 180059, 'guid': 'fixture-guid',
            'players': [], 'lock_teams': False}, 'lobby': {'lock_teams': False}, 'scenario': {}}


def export_fixture(directory: Path, *, body=None, fixture_header=None, chunk_records=3, seal_mode='full'):
    source = directory / 'controlled.bin'
    source.write_bytes(PREFIX + (controlled_body() if body is None else body))
    bundle = directory / 'canonical'
    def read_header(handle):
        handle.seek(8)
        return copy.deepcopy(header() if fixture_header is None else fixture_header)
    writer = parse_replay.EventWriter
    with patch.object(parse_replay, 'parse_header', side_effect=read_header), \
         patch.object(parse_replay, 'preflight_source'), \
         patch.object(parse_replay, 'JsonlGzipWriter', side_effect=lambda p: writer(p, max_records=chunk_records)):
        adapter = parse_replay.build_payload(source, bundle, seal_mode=seal_mode)
    return source, bundle, adapter
