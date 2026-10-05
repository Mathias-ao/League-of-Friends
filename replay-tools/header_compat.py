"""Scoped DE 68.9 header compatibility over the pinned mgz-fast decoder.

Older recordings use the upstream decoder unchanged. Scenario/trigger layouts
are based on the retained fixture and AoE2ScenarioParser DE 1.59 structures;
see docs/replay-foundation/save-68_9-compatibility.md for qualification limits.
No process-global monkeypatching: the threaded upload worker is safe to reuse.
"""
from __future__ import annotations

import struct
from mgz.fast import header as upstream
from mgz.util import Version

HEADER_COMPAT_VERSION = "AOF_DE_HEADER_COMPAT_V1"


class SectionReader:
    def __init__(self, stream):
        self.stream = stream
        self.end = len(stream.getbuffer())

    def read(self, size):
        if size < 0 or size > self.end - self.stream.tell():
            raise RuntimeError("DE 68.9 scenario field exceeds retained header")
        return self.stream.read(size)

    def value(self, fmt):
        return struct.unpack(fmt, self.read(struct.calcsize(fmt)))[0]

    def count(self):
        value = self.value('<I')
        if value > (self.end - self.stream.tell()) // 4:
            raise RuntimeError("DE 68.9 scenario count exceeds retained header")
        return value

    def string(self, fmt='<I'):
        return self.read(self.value(fmt))

    def separator(self):
        if self.value('<i') != -99:
            raise RuntimeError("DE 68.9 scenario separator mismatch")


def parse_scenario_68_9(stream):
    r = SectionReader(stream)
    scenario_version = r.value('<f')
    if round(scenario_version, 2) != 1.59:
        raise RuntimeError("DE 68.9 scenario version is not qualified (expected 1.59)")
    r.read(8 + 16 * 256 + 16 * 4)
    for _ in range(16):
        r.read(8)
        upstream.de_string(stream)
        upstream.de_string(stream)
        r.read(4)
    r.read(1 + 4 + 64 + 68)
    filename = r.string('<H')
    r.read(24)
    instructions = r.string('<H')
    for _ in range(9):
        r.string('<H')
    # Background bitmap header, then 32 strings and 16 AI names.
    picture_version = r.value('<I')
    width, height = r.value('<I'), r.value('<i')
    r.read(2)
    if width != 0 or height != 0:
        raise RuntimeError("DE 68.9 embedded scenario bitmap is not qualified")
    for _ in range(48):
        r.string('<H')
    # Unlike upstream's fixed 196-byte skip, AI script text is length-prefixed.
    for _ in range(16):
        r.read(8)
        r.string()
    r.read(16)
    r.separator()
    r.read(16 * 28)  # Initial scenario resources, not current economic state.
    r.separator()
    r.read(40 + 16 * 16 * 4 + 11520)
    r.separator()
    r.read(16 * 4 + 4)
    for _ in range(3):  # Disabled technologies / units / buildings.
        counts = [r.count() for _ in range(16)]
        r.read(sum(counts) * 4)
    r.read(12 + 16 * 4 + 12)
    map_id = r.value('<i')
    r.read(16)
    declared_trigger_count = r.count()
    # Upstream also locates the trigger section by its version anchor. Require
    # a unique supported anchor; never let a missing anchor become offset 7.
    begin = stream.tell()
    remainder = stream.getbuffer()[begin:].tobytes()
    anchor = struct.pack('<d', 5.0)
    offset = remainder.find(anchor)
    if offset < 0 or remainder.find(anchor, offset + 1) >= 0:
        raise RuntimeError("DE 68.9 trigger 5.0 anchor missing or ambiguous")
    stream.seek(begin + offset + 8)
    r.read(1)
    count = r.count()
    if count != declared_trigger_count:
        raise RuntimeError("DE 68.9 scenario trigger counts disagree")
    trigger_names = []
    for _ in range(count):
        r.read(27)
        r.string()
        trigger_names.append(r.string())
        r.string()
        effects = r.count()
        for _ in range(effects):
            fields = r.read(340)
            if struct.unpack_from('<i', fields, 4)[0] != 83:
                raise RuntimeError("DE 68.9 trigger effect layout is not qualified")
            selected = struct.unpack_from('<i', fields, 24)[0]
            if selected < -1:
                raise RuntimeError("DE 68.9 trigger selection count is invalid")
            r.string()
            r.string()
            r.read(max(0, selected) * 4)
            r.string()
            r.string()
        r.read(effects * 4)
        conditions = r.count()
        for _ in range(conditions):
            fields = r.read(144)
            if struct.unpack_from('<i', fields, 4)[0] != 34:
                raise RuntimeError("DE 68.9 trigger condition layout is not qualified")
            r.string()
        r.read(conditions * 4)
    order = struct.unpack(f'<{count}I', r.read(count * 4))
    if sorted(order) != list(range(count)):
        raise RuntimeError("DE 68.9 trigger order is invalid")
    return dict(map_id=map_id, difficulty_id=None, instructions=instructions,
                scenario_filename=filename, scenario_version=round(scenario_version, 2),
                trigger_version=5.0, trigger_names=trigger_names,
                unparsedTailByteOffset=stream.tell())


def parse(data):
    start = data.tell()
    header = upstream.decompress(data)
    version, game, save, log = upstream.parse_version(header, data)
    if version is not Version.DE or save != 68.9:
        data.seek(start)
        return upstream.parse(data)
    de = upstream.parse_de(header, version, save)
    hd = upstream.parse_hd(header, version, save)
    metadata, count = upstream.parse_metadata(header, save)
    map_ = upstream.parse_map(header, version, save)
    players, mod, device = upstream.parse_players(header, count, version, save)
    scenario = parse_scenario_68_9(header)
    if not scenario['scenario_filename'].strip(b'\x00'):
        # Existing standard-map 68.9 fixtures already decode through the pinned
        # path. Keep their canonical/statistics inputs exactly unchanged.
        data.seek(start)
        return upstream.parse(data)
    # The custom-scenario extension after triggers is not the legacy lobby.
    # Retain it in raw header evidence; do not publish plausible-looking garbage.
    return dict(version=version, game_version=game, save_version=save, log_version=log,
                players=players, map=map_, de=de, hd=hd, mod=de.get('dlc_ids'),
                metadata=metadata, scenario=scenario, lobby={}, device=device,
                aofHeaderCompatibility={"version": HEADER_COMPAT_VERSION,
                    "unavailableFields": ["lobby"],
                    "retainedHeaderTailByteOffset": scenario['unparsedTailByteOffset']})
