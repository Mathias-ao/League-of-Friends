"""Interpret DE lobby groups for statistics without changing retained raw facts.

The DE wire encoding is 0=empty, 1=no team, n>1=team n-1. Legacy
hand-authored statistics inputs without DE build provenance retain their
existing team convention. This is lobby grouping, not effective diplomacy.
"""
from __future__ import annotations

TEAM_CONTEXT_VERSION = 'AOF_DE_LOBBY_TEAM_CONTEXT_V1'


def statistics_team_context(manifest: dict) -> dict:
    build = (manifest.get('source') or {}).get('gameBuild')
    if type(build) is not int:
        return manifest
    participants = []
    for player in manifest.get('participants', []):
        raw = player.get('lobbyTeamId')
        participants.append({**player, 'lobbyTeamId': raw if type(raw) is int and raw > 1 else None})
    return {**manifest, 'participants': participants}
