import type { ChronicleEvent, ChronicleRelationshipTransition, ChronicleSignificance, ChronicleTrack } from "./chronicleEventEngine.js";
import type { PairSocialBeat, PairSocialEvidence } from "./pairSocialEvidence.js";
import {
  CHRONICLE_PHRASE_LIBRARY_VERSION,
  CHRONICLE_PHRASES_BY_GROUP,
  type ChroniclePhrase,
  type ChroniclePhraseGroup,
} from "./chroniclePhraseLibrary.js";

export const CHRONICLE_WRITER_VERSION = "AOF_CHRONICLE_WRITER_V1";

export interface PublishedChronicleEntry {
  writerVersion: typeof CHRONICLE_WRITER_VERSION;
  phraseLibraryVersion: typeof CHRONICLE_PHRASE_LIBRARY_VERSION;
  chronicleEventVersion: string;
  chronicleEventId: string;
  matchId: string;
  playedAtMs: number;
  significance: ChronicleSignificance;
  storyPatternId: string;
  fragmentIds: string[];
  title: string;
  text: string;
  sourceBeatIds: string[];
  sourceEvidenceEventIds: string[];
}

export interface ChronicleWriterInput {
  event: ChronicleEvent;
  socialEvidence: PairSocialEvidence;
}

interface PhraseMemory {
  recentIds: string[];
}

interface TemplateContext {
  A: string;
  B: string;
  SOURCE: string;
  TARGET: string;
  THIRD: string;
  N: string;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function playerName(names: Record<number, string>, playerId: number | null, fallback: string): string {
  if (playerId == null) return fallback;
  const name = names[playerId]?.trim();
  return name || fallback;
}

function render(template: string, context: TemplateContext): string {
  return template.replace(/\{(A|B|SOURCE|TARGET|THIRD|N)\}/g, (_match, token: keyof TemplateContext) => context[token]);
}

function pickPhrase(
  group: ChroniclePhraseGroup,
  seed: string,
  memory: PhraseMemory,
  usedInEntry: Set<string>,
): ChroniclePhrase {
  const all = [...(CHRONICLE_PHRASES_BY_GROUP.get(group) ?? [])];
  if (!all.length) throw new Error(`Chronicle phrase group ${group} is empty.`);
  const recent = new Set(memory.recentIds);
  let candidates = all.filter((phrase) => !recent.has(phrase.id) && !usedInEntry.has(phrase.id));
  if (!candidates.length) candidates = all.filter((phrase) => !usedInEntry.has(phrase.id));
  if (!candidates.length) candidates = all;
  const selected = candidates[stableHash(`${CHRONICLE_WRITER_VERSION}|${seed}|${group}`) % candidates.length];
  usedInEntry.add(selected.id);
  memory.recentIds.push(selected.id);
  if (memory.recentIds.length > 28) memory.recentIds.splice(0, memory.recentIds.length - 28);
  return selected;
}

function titleGroup(event: ChronicleEvent): ChroniclePhraseGroup {
  return `TITLE_${event.titleKey}`;
}

function openingGroup(event: ChronicleEvent): ChroniclePhraseGroup {
  if (event.concepts.includes("PREVIOUS_MEETING_MIXED")) return "CALLBACK_PREVIOUS_MIXED";
  if (event.concepts.includes("PREVIOUS_MEETING_ALLIED")) return "CALLBACK_PREVIOUS_ALLIED";
  if (event.concepts.includes("PREVIOUS_MEETING_HOSTILE")) return "CALLBACK_PREVIOUS_HOSTILE";
  return event.concepts.includes("FIRST_MEETING") ? "OPEN_FIRST_MEETING" : "OPEN_REPEAT_MEETING";
}

function alignmentGroup(event: ChronicleEvent): ChroniclePhraseGroup {
  if (event.alignment === "ALLIANCE") return "ALIGNMENT_ALLIANCE";
  if (event.alignment === "HOSTILITY") return "ALIGNMENT_HOSTILITY";
  if (event.alignment === "NEUTRALITY") return "ALIGNMENT_NEUTRALITY";
  if (event.alignment === "MIXED") return "ALIGNMENT_MIXED";
  return "ALIGNMENT_UNKNOWN";
}

function beatGroup(beat: PairSocialBeat): ChroniclePhraseGroup | null {
  switch (beat.type) {
    case "MUTUAL_ALLIANCE_FORMED": return "DIPLOMACY_ALLIANCE_FORMED";
    case "MUTUAL_ALLIANCE_ENDED": return "DIPLOMACY_ALLIANCE_ENDED";
    case "ONE_SIDED_ALLIANCE_BEGAN": return "DIPLOMACY_ONE_SIDED_ALLIANCE";
    case "CONFLICTED_DIPLOMACY_BEGAN": return "DIPLOMACY_CONFLICTED";
    case "DIRECT_CONTEST": return "ACTION_DIRECT_CONTEST";
    case "RAID_PRESSURE": return "ACTION_RAID_PRESSURE";
    case "FORWARD_ENCROACHMENT": return "ACTION_FORWARD_ENCROACHMENT";
    case "ENEMY_BASE_CONTACT": return "ACTION_ENEMY_BASE_CONTACT";
    case "MATERIAL_SUPPORT": return "ACTION_MATERIAL_SUPPORT";
    case "ALLY_REINFORCEMENT": return "ACTION_ALLY_REINFORCEMENT";
    case "DEFENSIVE_ASSIST": return "ACTION_DEFENSIVE_ASSIST";
    case "COOPERATIVE_ATTACK": return beat.thirdPartyPlayerId == null ? null : "ACTION_COOPERATIVE_ATTACK";
    case "COINCIDENT_THIRD_PARTY_PRESSURE": return beat.thirdPartyPlayerId == null ? null : "ACTION_THIRD_PARTY_PRESSURE";
    case "NO_QUALIFYING_OPPOSITION_CONTACT": return "ABSENCE_OPPOSITION_CONTACT";
    case "NO_QUALIFYING_ALLIED_COOPERATION": return "ABSENCE_ALLIED_COOPERATION";
    default: return null;
  }
}

function transitionGroup(transition: ChronicleRelationshipTransition): ChroniclePhraseGroup | null {
  const track = transition.track;
  if (transition.kind === "ESTABLISHED") return `RELATIONSHIP_ESTABLISHED_${track}` as ChroniclePhraseGroup;
  if (transition.kind === "STAGE_ADVANCED" || transition.kind === "HISTORICAL_PEAK") return `RELATIONSHIP_ADVANCED_${track}` as ChroniclePhraseGroup;
  if (transition.kind === "DORMANT" && (track === "RIVALRY" || track === "HOSTILITY")) return `RELATIONSHIP_DORMANT_${track}` as ChroniclePhraseGroup;
  if (transition.kind === "REACTIVATED" && (track === "RIVALRY" || track === "HOSTILITY")) return `RELATIONSHIP_REACTIVATED_${track}` as ChroniclePhraseGroup;
  if (transition.kind === "WEAKENED" && track === "BOND") return "RELATIONSHIP_WEAKENED_BOND";
  return null;
}

function maximumBeatSentences(significance: ChronicleSignificance): number {
  if (significance === "TURNING_POINT") return 3;
  if (significance === "LANDMARK") return 2;
  if (significance === "NOTABLE") return 2;
  return 0;
}

function maximumTransitionSentences(significance: ChronicleSignificance): number {
  if (significance === "TURNING_POINT") return 2;
  if (significance === "LANDMARK") return 1;
  return 0;
}

function contextFor(
  event: ChronicleEvent,
  beat: PairSocialBeat | null,
  names: Record<number, string>,
): TemplateContext {
  const a = playerName(names, event.playerOneId, `Player ${event.playerOneId}`);
  const b = playerName(names, event.playerTwoId, `Player ${event.playerTwoId}`);
  return {
    A: a,
    B: b,
    SOURCE: playerName(names, beat?.sourcePlayerId ?? null, a),
    TARGET: playerName(names, beat?.targetPlayerId ?? null, b),
    THIRD: playerName(names, beat?.thirdPartyPlayerId ?? null, "the third player"),
    N: String(event.encounterNumber),
  };
}

function chooseCoda(event: ChronicleEvent): ChroniclePhraseGroup | null {
  if (event.concepts.includes("FIRST_MUTUAL_ALLIANCE")) return "CODA_FIRST_ALLIANCE";
  if (event.concepts.includes("FIRST_RECORDED_COOPERATION")) return "CODA_FIRST_COOPERATION";
  if (event.concepts.includes("FIRST_RECORDED_PRESSURE")) return "CODA_FIRST_PRESSURE";
  if (event.encounterNumber >= 3 && event.significance !== "RECORD") return "CODA_ENCOUNTER_NUMBER";
  return null;
}

function storyPattern(
  event: ChronicleEvent,
  beatSentenceCount: number,
  transitionSentenceCount: number,
  hasCoda: boolean,
): string {
  const callback = event.concepts.some((concept) => concept.startsWith("PREVIOUS_MEETING_")) ? "CALLBACK" : "OPEN";
  const alignment = event.alignment;
  return `${event.significance}_${callback}_${alignment}_B${beatSentenceCount}_R${transitionSentenceCount}_${hasCoda ? "CODA" : "NO_CODA"}_V1`;
}

function appendPhrase(
  sentences: string[],
  fragments: string[],
  group: ChroniclePhraseGroup,
  seed: string,
  context: TemplateContext,
  memory: PhraseMemory,
  used: Set<string>,
): void {
  const phrase = pickPhrase(group, seed, memory, used);
  fragments.push(phrase.id);
  sentences.push(render(phrase.template, context));
}

function validateInput(input: ChronicleWriterInput): void {
  if (input.event.matchId !== input.socialEvidence.matchId) {
    throw new Error(`Chronicle writer input ${input.event.matchId} has mismatched social evidence.`);
  }
  if (
    input.event.playerOneId !== input.socialEvidence.playerOneId ||
    input.event.playerTwoId !== input.socialEvidence.playerTwoId
  ) throw new Error(`Chronicle writer input ${input.event.matchId} has mismatched pair identity.`);
}

export function writeChronicleHistory(
  inputs: ChronicleWriterInput[],
  playerNames: Record<number, string>,
): PublishedChronicleEntry[] {
  const ordered = [...inputs].sort((left, right) =>
    left.event.playedAtMs - right.event.playedAtMs || left.event.matchId.localeCompare(right.event.matchId),
  );
  const memory: PhraseMemory = { recentIds: [] };
  const result: PublishedChronicleEntry[] = [];

  for (const input of ordered) {
    validateInput(input);
    const event = input.event;
    const evidenceById = new Map(input.socialEvidence.beats.map((beat) => [beat.beatId, beat]));
    const used = new Set<string>();
    const fragments: string[] = [];
    const body: string[] = [];
    const baseContext = contextFor(event, null, playerNames);

    const titlePhrase = pickPhrase(titleGroup(event), `${event.eventId}|title`, memory, used);
    fragments.push(titlePhrase.id);
    const title = render(titlePhrase.template, baseContext);

    appendPhrase(body, fragments, openingGroup(event), `${event.eventId}|opening`, baseContext, memory, used);

    const significantDiplomacyBeat = event.primaryBeatIds
      .map((beatId) => evidenceById.get(beatId))
      .find((beat) => beat && ["MUTUAL_ALLIANCE_FORMED", "MUTUAL_ALLIANCE_ENDED", "ONE_SIDED_ALLIANCE_BEGAN", "CONFLICTED_DIPLOMACY_BEGAN"].includes(beat.type));

    if (event.significance !== "RECORD" || !significantDiplomacyBeat) {
      appendPhrase(body, fragments, alignmentGroup(event), `${event.eventId}|alignment`, baseContext, memory, used);
    }

    const primaryBeats = event.primaryBeatIds
      .map((beatId) => evidenceById.get(beatId))
      .filter((beat): beat is PairSocialBeat => beat != null && beatGroup(beat) != null);
    const maxBeats = maximumBeatSentences(event.significance);
    let beatSentenceCount = 0;
    for (const beat of primaryBeats) {
      if (beatSentenceCount >= maxBeats) break;
      const group = beatGroup(beat);
      if (!group) continue;
      appendPhrase(
        body,
        fragments,
        group,
        `${event.eventId}|beat|${beat.beatId}|${beatSentenceCount}`,
        contextFor(event, beat, playerNames),
        memory,
        used,
      );
      beatSentenceCount += 1;
    }

    const maxTransitions = maximumTransitionSentences(event.significance);
    let transitionSentenceCount = 0;
    for (const transition of event.relationshipTransitions) {
      if (transitionSentenceCount >= maxTransitions) break;
      const group = transitionGroup(transition);
      if (!group) continue;
      appendPhrase(
        body,
        fragments,
        group,
        `${event.eventId}|relationship|${transition.track}|${transition.kind}|${transitionSentenceCount}`,
        baseContext,
        memory,
        used,
      );
      transitionSentenceCount += 1;
    }

    const coda = chooseCoda(event);
    const includeCoda = coda != null && event.significance !== "RECORD";
    if (coda && includeCoda) {
      appendPhrase(body, fragments, coda, `${event.eventId}|coda`, baseContext, memory, used);
    }

    result.push({
      writerVersion: CHRONICLE_WRITER_VERSION,
      phraseLibraryVersion: CHRONICLE_PHRASE_LIBRARY_VERSION,
      chronicleEventVersion: event.schemaVersion,
      chronicleEventId: event.eventId,
      matchId: event.matchId,
      playedAtMs: event.playedAtMs,
      significance: event.significance,
      storyPatternId: storyPattern(event, beatSentenceCount, transitionSentenceCount, includeCoda),
      fragmentIds: fragments,
      title,
      text: body.join(" "),
      sourceBeatIds: [...event.sourceBeatIds],
      sourceEvidenceEventIds: [...event.sourceEvidenceEventIds],
    });
  }

  return result;
}

export function relationshipTrackName(track: ChronicleTrack): string {
  if (track === "RIVALRY") return "Rivalry";
  if (track === "HOSTILITY") return "Hostility";
  return "Bond";
}
