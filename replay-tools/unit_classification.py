"""AoE2 DE unit-class families used as engagement evidence.

The class IDs are an AoE2-native grouping layer. AoF uses them only when a replay
object carries an observed classId (currently strongest for initial objects).
Unknown later-spawned object type/class stays unknown rather than being guessed.

This module classifies evidence; it does not infer that an object was physically
fighting merely because it belongs to a military class.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Iterable

UNIT_CLASS_FAMILY_VERSION = "AOF_UNIT_CLASS_FAMILIES_V1"

CLASS_IDS_BY_FAMILY: dict[str, frozenset[int]] = {
    "infantry": frozenset({6}),
    "cavalry": frozenset({12, 47}),
    "archers": frozenset({0, 44}),
    "cavalry_archers": frozenset({36, 23}),
    "monks": frozenset({18, 43}),
    "civilian_trade_king": frozenset({4, 19, 59}),
    "ships": frozenset({21, 20, 22, 2, 53}),
    "siege": frozenset({13, 51, 54, 55, 35}),
    "buildings": frozenset({3, 27, 39, 49, 52, 60}),
}

FAMILY_BY_CLASS_ID = {
    class_id: family
    for family, class_ids in CLASS_IDS_BY_FAMILY.items()
    for class_id in class_ids
}

LAND_MILITARY_FAMILIES = {
    "infantry",
    "cavalry",
    "archers",
    "cavalry_archers",
    "monks",
    "siege",
}
KNOWN_NON_MILITARY_FAMILIES = {"civilian_trade_king", "buildings"}


def family_for_class_id(class_id: Any) -> str | None:
    try:
        return FAMILY_BY_CLASS_ID.get(int(class_id))
    except (TypeError, ValueError):
        return None


def _catalog_unit(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return {}
    row = (catalog.get("units") or {}).get(key)
    return row if isinstance(row, dict) else {}


def _ship_military_status(catalog: dict[str, Any], raw_id: Any) -> str:
    roles = set(_catalog_unit(catalog, raw_id).get("roleKeys") or [])
    if "water_military" in roles:
        return "military"
    if roles & {"economic_unit", "fishing_ship", "trade_unit", "transport_ship"}:
        return "non_military"
    return "unknown"


def military_status_for_family(
    family: str | None,
    *,
    catalog: dict[str, Any],
    raw_id: Any,
) -> str:
    if family in LAND_MILITARY_FAMILIES:
        return "military"
    if family in KNOWN_NON_MILITARY_FAMILIES:
        return "non_military"
    if family == "ships":
        return _ship_military_status(catalog, raw_id)
    return "unknown"


def build_initial_instance_classification(
    initial_objects: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
) -> dict[int, dict[str, Any]]:
    """Return replay-observed class metadata keyed by object instance ID."""
    result: dict[int, dict[str, Any]] = {}
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance_id = payload.get("instanceId")
        if not isinstance(instance_id, int):
            continue
        class_id = payload.get("classId")
        raw_id = payload.get("objectId")
        family = family_for_class_id(class_id)
        try:
            normalized_class_id = int(class_id)
        except (TypeError, ValueError):
            normalized_class_id = None
        result[instance_id] = {
            "instanceId": instance_id,
            "rawObjectId": raw_id,
            "classId": normalized_class_id,
            "family": family,
            "militaryStatus": military_status_for_family(
                family,
                catalog=catalog,
                raw_id=raw_id,
            ),
            "classEvidence": "replay_initial_object_class_id" if family is not None else "unresolved",
            "modelVersion": UNIT_CLASS_FAMILY_VERSION,
        }
    return result


def summarize_selected_instances(
    selected_ids: Iterable[int],
    *,
    classification_by_instance: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """Summarize distinct selected-object class evidence without inventing type."""
    ids = sorted({int(value) for value in selected_ids if isinstance(value, int)})
    families: Counter[str] = Counter()
    military = 0
    non_military = 0
    ambiguous = 0
    typed = 0
    typed_instance_ids: list[int] = []
    military_instance_ids: list[int] = []
    non_military_instance_ids: list[int] = []

    for instance_id in ids:
        info = classification_by_instance.get(instance_id)
        if not info or info.get("family") is None:
            continue
        typed += 1
        typed_instance_ids.append(instance_id)
        family = str(info["family"])
        families[family] += 1
        status = info.get("militaryStatus")
        if status == "military":
            military += 1
            military_instance_ids.append(instance_id)
        elif status == "non_military":
            non_military += 1
            non_military_instance_ids.append(instance_id)
        else:
            ambiguous += 1

    unknown = len(ids) - typed
    coverage = round(typed / len(ids) * 100, 1) if ids else None
    return {
        "classificationVersion": UNIT_CLASS_FAMILY_VERSION,
        "distinctObservedSelectedInstances": len(ids),
        "typedClassInstances": typed,
        "militaryClassInstances": military,
        "knownNonMilitaryClassInstances": non_military,
        "ambiguousClassInstances": ambiguous,
        "unknownClassInstances": unknown,
        "typedCoveragePercent": coverage,
        "familyCounts": {
            family: families.get(family, 0)
            for family in (
                "infantry",
                "cavalry",
                "archers",
                "cavalry_archers",
                "monks",
                "siege",
                "ships",
                "civilian_trade_king",
                "buildings",
            )
        },
        "typedInstanceIds": typed_instance_ids,
        "militaryInstanceIds": military_instance_ids,
        "knownNonMilitaryInstanceIds": non_military_instance_ids,
        "scope": (
            "distinct selected object instances observed in qualifying engagement commands; "
            "class IDs come from replay initial-object evidence when available. Unknown later-"
            "spawned objects remain unknown. Counts are command-selection footprint, not live army size."
        ),
    }
