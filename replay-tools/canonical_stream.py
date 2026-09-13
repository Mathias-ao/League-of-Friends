"""Bounded framing around the pinned decoder; no resynchronization guesses."""
from __future__ import annotations

import io
import struct
from typing import BinaryIO, Iterator, Any

from mgz.fast import action, operation, start, save
from mgz.fast.enums import Operation, Action


class ExactReader:
    def __init__(self, handle: BinaryIO, end: int):
        self.handle, self.end = handle, end

    def read(self, size: int = -1) -> bytes:
        if size < -1:
            raise ValueError("Negative decoder read length")
        if size > self.end - self.tell():
            raise EOFError("Truncated operation")
        value = self.handle.read(size)
        if size >= 0 and len(value) != size:
            raise EOFError("Truncated operation")
        return value

    def tell(self) -> int:
        return self.handle.tell()

    def seek(self, offset: int, whence: int = 0) -> int:
        target = offset if whence == 0 else self.tell() + offset if whence == 1 else self.end + offset
        if target < 0 or target > self.end:
            raise EOFError("Decoder seek outside source")
        return self.handle.seek(target)


def frames(handle: BinaryIO, end: int) -> Iterator[tuple[str, Any, int, int, bytes, str | None]]:
    reader = ExactReader(handle, end)
    while reader.tell() < end:
        begin = reader.tell()
        try:
            code = struct.unpack('<I', reader.read(4))[0]
            try:
                kind = Operation(code)
            except ValueError as exc:
                raise ValueError(f"Unverified operation framing for opcode {code}") from exc
            if kind is Operation.ACTION:
                length = struct.unpack('<I', reader.read(4))[0]
                if length < 1:
                    raise ValueError("Invalid action length")
                reader.read(length)
                reader.read(4)  # sequence
                finish = reader.tell()
                reader.seek(begin)
                raw = reader.read(finish - begin)
                try:
                    action_type, payload = action(io.BytesIO(raw[4:]))
                    # Legacy ACTION/POSTGAME consumes the remaining stream.
                    if action_type is Action.POSTGAME:
                        tail = reader.read()
                        raw += tail
                        payload['bytes'] += tail
                except (ValueError, struct.error, IndexError, EOFError):
                    action_type, payload = Action.ERROR, {}
                yield 'ACTION', (action_type, payload), begin, reader.tell(), raw, None
                continue
            reader.seek(begin)
            if kind in (Operation.START, Operation.SAVE):
                reader.read(4)
                (start if kind is Operation.START else save)(reader)
                payload = None
            else:
                _, payload = operation(reader)
            finish = reader.tell()
            if finish <= begin:
                raise ValueError("Decoder made no forward progress")
            reader.seek(begin)
            raw = reader.read(finish - begin)
            yield kind.name, payload, begin, finish, raw, None
        except (EOFError, ValueError, RuntimeError, struct.error, IndexError) as exc:
            # Preserve the WHOLE unframed tail. Do not call an unknown tag SAVE,
            # hide EOFError, continue from an unverified boundary or omit bytes.
            handle.seek(begin)
            raw = handle.read(end - begin)
            yield 'UNKNOWN', None, begin, end, raw, f"{type(exc).__name__}: {exc}"
            return


def command_layout(raw_operation: bytes, action_name: str) -> dict[str, Any]:
    """Retain fields the DE >=71094 decoder reads then discards.

    Offsets below are independently exercised by byte fixtures. These are raw
    values, not assertions of acceptance, completion, or engine state.
    """
    if len(raw_operation) < 16:
        return {"layout": "unverified"}
    action_data = raw_operation[9:-4]
    player, length = struct.unpack_from('<bh', action_data)
    if length < 0 or length + 3 != len(action_data):
        return {"layout": "legacy_or_unverified"}
    raw = action_data[3:]
    result: dict[str, Any] = {"layout": "de_71094", "playerIdRaw": player, "payloadLengthRaw": length}
    try:
        if action_name == 'DE_QUEUE':
            selected, building, unit, amount = struct.unpack_from('<h4xhhh', raw)
            result.update(selectedCountRaw=selected, buildingTypeIdRaw=building,
                          unitIdRaw=unit, amountRaw=amount)
        elif action_name == 'RESEARCH':
            primary, selected, technology = struct.unpack_from('<Ihh5x', raw)
            ids = struct.unpack_from(f'<{selected}I', raw, 13)
            result.update(primaryObjectIdRaw=primary, selectedCountRaw=selected,
                          technologyIdRaw=technology, selectedBuildingIdsRaw=list(ids))
        elif action_name == 'GAME' and struct.unpack_from('<h', raw)[0] == 0:
            source, target, mode_float, mode = struct.unpack_from('<2xhhfb', raw, 2)
            result.update(sourcePlayerRaw=source, targetPlayerRaw=target,
                          modeFloatRaw=mode_float, modeRaw=mode)
        elif action_name == 'BUILD':
            selected, _, _, _, u2, u3, u4 = struct.unpack_from('<h2xffI8xhbb', raw)
            result.update(selectedCountRaw=selected, unknownInt16=u2, unknownByte1=u3, unknownByte2=u4)
        elif action_name in ('ORDER', 'MOVE'):
            result['selectedCountRaw'] = struct.unpack_from('<h', raw, 12)[0]
    except (struct.error, ValueError):
        result['layoutFieldsStatus'] = 'partial'
    return result
