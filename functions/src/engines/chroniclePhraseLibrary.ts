import type { ChronicleTitleKey } from "./chronicleEventEngine.js";

export const CHRONICLE_PHRASE_LIBRARY_VERSION = "AOF_CHRONICLE_PHRASES_V1";

export type ChroniclePhraseGroup =
  | `TITLE_${ChronicleTitleKey}`
  | "OPEN_FIRST_MEETING"
  | "OPEN_REPEAT_MEETING"
  | "CALLBACK_PREVIOUS_ALLIED"
  | "CALLBACK_PREVIOUS_HOSTILE"
  | "CALLBACK_PREVIOUS_MIXED"
  | "ALIGNMENT_ALLIANCE"
  | "ALIGNMENT_HOSTILITY"
  | "ALIGNMENT_NEUTRALITY"
  | "ALIGNMENT_MIXED"
  | "ALIGNMENT_UNKNOWN"
  | "DIPLOMACY_ALLIANCE_FORMED"
  | "DIPLOMACY_ALLIANCE_ENDED"
  | "DIPLOMACY_ONE_SIDED_ALLIANCE"
  | "DIPLOMACY_CONFLICTED"
  | "ACTION_DIRECT_CONTEST"
  | "ACTION_RAID_PRESSURE"
  | "ACTION_FORWARD_ENCROACHMENT"
  | "ACTION_ENEMY_BASE_CONTACT"
  | "ACTION_MATERIAL_SUPPORT"
  | "ACTION_ALLY_REINFORCEMENT"
  | "ACTION_DEFENSIVE_ASSIST"
  | "ACTION_COOPERATIVE_ATTACK"
  | "ACTION_THIRD_PARTY_PRESSURE"
  | "ABSENCE_OPPOSITION_CONTACT"
  | "ABSENCE_ALLIED_COOPERATION"
  | "RELATIONSHIP_ESTABLISHED_RIVALRY"
  | "RELATIONSHIP_ESTABLISHED_HOSTILITY"
  | "RELATIONSHIP_ESTABLISHED_BOND"
  | "RELATIONSHIP_ADVANCED_RIVALRY"
  | "RELATIONSHIP_ADVANCED_HOSTILITY"
  | "RELATIONSHIP_ADVANCED_BOND"
  | "RELATIONSHIP_DORMANT_RIVALRY"
  | "RELATIONSHIP_DORMANT_HOSTILITY"
  | "RELATIONSHIP_REACTIVATED_RIVALRY"
  | "RELATIONSHIP_REACTIVATED_HOSTILITY"
  | "RELATIONSHIP_WEAKENED_BOND"
  | "CODA_ENCOUNTER_NUMBER"
  | "CODA_FIRST_ALLIANCE"
  | "CODA_FIRST_COOPERATION"
  | "CODA_FIRST_PRESSURE";

export interface ChroniclePhrase {
  id: string;
  group: ChroniclePhraseGroup;
  template: string;
}

function phrases(group: ChroniclePhraseGroup, templates: string[]): ChroniclePhrase[] {
  return templates.map((template, index) => ({
    id: `${group.toLowerCase()}.${String(index + 1).padStart(2, "0")}`,
    group,
    template,
  }));
}

const TITLE_LIBRARY: Record<ChronicleTitleKey, string[]> = {
  FIRST_MEETING: [
    "First meeting", "The record begins", "Their first crossing", "First encounter", "The opening entry",
    "Where the record starts", "The first chapter", "A shared field", "Their history begins", "The first account",
  ],
  ALLIANCE_AND_RUPTURE: [
    "Alliance and rupture", "Banners joined, banners divided", "A brief alignment", "Alliance broken", "From alliance to opposition",
    "A changing field", "The alliance turns", "Joined and divided", "A temporary accord", "The broken alignment",
  ],
  ALLIANCE_FORMED: [
    "Under one banner", "An alliance formed", "Banners aligned", "A mutual alliance", "A new alignment",
    "The sides converge", "An accord on the field", "Alliance recorded", "A shared cause", "The banners meet",
  ],
  ALLIANCE_UNDER_STRAIN: [
    "After the alliance", "The alignment gives way", "Banners divided again", "The alliance ends", "Opposition returns",
    "The common banner passes", "From accord to contest", "The field divides", "The alignment breaks", "Old opposition returns",
  ],
  CONTEST: [
    "Across the battlefield", "Direct contest", "Their paths cross", "Opposing lines", "The contest continues",
    "Another confrontation", "Meeting in battle", "The field between them", "A direct encounter", "Banners opposed",
  ],
  PRESSURE: [
    "Pressure brought to bear", "Across the frontier", "Pressure on the field", "Toward the enemy ground", "A directed advance",
    "The pressure mounts", "Forward pressure", "The contest reaches home ground", "A closer contest", "Pressure between them",
  ],
  COOPERATION: [
    "Fighting together", "Under the same banner", "Aid on the field", "A shared effort", "Cooperation recorded",
    "The common cause", "Support between them", "Side by side", "Aid exchanged", "A joint effort",
  ],
  DIPLOMATIC_SHIFT: [
    "Banners in motion", "A change of stance", "Diplomacy shifts", "The alignment changes", "Changing relations",
    "A divided stance", "Uneven diplomacy", "The diplomatic record turns", "A shifting field", "Relations in motion",
  ],
  QUIET_OPPOSITION: [
    "Distant enemies", "Opposed at a distance", "No direct contest", "A quiet opposition", "Across separate fronts",
    "Opposed without contact", "The contest falls quiet", "Separate battle lines", "No meeting of arms", "Distance between them",
  ],
  RELATIONSHIP_TURNING_POINT: [
    "A turning point", "The relationship changes", "A new chapter", "The old course alters", "A marked change",
    "The record turns", "A consequential meeting", "The balance shifts", "The history deepens", "A lasting entry",
  ],
  RECORDED_MEETING: [
    "Another meeting", "A further entry", "Their paths cross again", "Another shared Battle", "The record continues",
    "A new entry", "Another chapter", "Their history continues", "A further encounter", "Once more on the field",
  ],
};

const BODY_LIBRARY: Array<[ChroniclePhraseGroup, string[]]> = [
  ["OPEN_FIRST_MEETING", [
    "The recorded history of {A} and {B} began in this Battle.",
    "This Battle opened the recorded history between {A} and {B}.",
    "Here the Chronicle first records {A} and {B} on the same field.",
    "Their shared record begins here, with {A} and {B} in the same Battle.",
    "This was the first recorded Battle shared by {A} and {B}.",
    "The Chronicle begins their history with this meeting.",
    "Their first recorded encounter entered the Chronicle here.",
    "This field supplied the first entry in their shared history.",
    "No earlier Battle between {A} and {B} appears in the league record.",
    "The league record first brings {A} and {B} together here.",
    "Their recorded history starts with this Battle.",
    "This was encounter one in the Chronicle of {A} and {B}.",
  ]],
  ["OPEN_REPEAT_MEETING", [
    "{A} and {B} met again in the league record.",
    "Their shared history continued with another Battle.",
    "The Chronicle records another meeting between {A} and {B}.",
    "Once more, {A} and {B} appeared on the same field.",
    "Another Battle added to the history between {A} and {B}.",
    "Their paths crossed again in recorded play.",
    "The pair returned to the same Battle once more.",
    "A further encounter extended their shared record.",
    "Their Chronicle gained another entry in this Battle.",
    "This Battle renewed the recorded history between them.",
    "{A} and {B} entered another shared chapter.",
    "Their league history brought them together again.",
  ]],
  ["CALLBACK_PREVIOUS_ALLIED", [
    "Their previous recorded meeting had found them in alliance.",
    "They had last shared a Battle while aligned with one another.",
    "Their preceding entry placed them on the same side of the diplomatic record.",
    "The last time they met, the Chronicle recorded an alliance between them.",
    "Their previous Battle had included a mutual alliance.",
    "They returned after a meeting in which their banners had aligned.",
    "The preceding chapter had seen them allied.",
    "Their last recorded alignment had been cooperative rather than hostile.",
    "They had most recently met under an alliance.",
    "The previous entry in their history had placed them together rather than apart.",
    "Their latest shared history before this Battle contained an alliance.",
    "They came to this Battle after previously standing in mutual alliance.",
  ]],
  ["CALLBACK_PREVIOUS_HOSTILE", [
    "Their previous recorded meeting had placed them in hostility.",
    "They had last met with hostile diplomacy between them.",
    "The preceding chapter had found them opposed.",
    "Their last Battle together had carried a hostile alignment.",
    "They returned after a meeting spent on hostile terms.",
    "The previous entry in their Chronicle recorded opposition between them.",
    "Their most recent shared field had set them against one another.",
    "They had last appeared in the record as opponents.",
    "The Chronicle last left them on hostile sides.",
    "Their prior meeting had been one of opposition.",
    "This Battle followed a previous hostile encounter between them.",
    "Their last recorded alignment had been against one another.",
  ]],
  ["CALLBACK_PREVIOUS_MIXED", [
    "Their previous Battle had already seen diplomacy change between them.",
    "The preceding entry had contained more than one alignment between them.",
    "Their last meeting had not kept a single diplomatic shape.",
    "They returned after a Battle of changing relations.",
    "The previous chapter had moved between alliance and opposition.",
    "Their preceding Battle had left a mixed diplomatic record.",
    "Their last shared field had seen the relationship change during play.",
    "The Chronicle had last recorded shifting diplomacy between them.",
    "Their previous encounter had already crossed diplomatic lines.",
    "This meeting followed another in which their alignment had changed.",
  ]],
  ["ALIGNMENT_ALLIANCE", [
    "Mutual alliance was recorded between {A} and {B} during the Battle.",
    "For the recorded period, {A} and {B} stood in mutual alliance.",
    "The diplomacy record placed {A} and {B} in alliance.",
    "Their banners were mutually aligned during this encounter.",
    "The Battle contained a mutual alliance between them.",
    "AoF recorded {A} and {B} as mutual allies during the encounter.",
    "Their diplomacy converged into a mutual alliance.",
    "Both directions of the diplomacy record marked an alliance between them.",
    "They shared a mutual alliance on the field.",
    "The recorded diplomacy joined {A} and {B} as allies.",
    "Their alignment was mutual rather than one-sided.",
    "This encounter placed them together in the diplomacy record.",
  ]],
  ["ALIGNMENT_HOSTILITY", [
    "The diplomacy record placed {A} and {B} on hostile terms.",
    "Hostile alignment separated {A} and {B} during the Battle.",
    "They spent the encounter on opposing diplomatic terms.",
    "The recorded diplomacy set them against one another.",
    "{A} and {B} were recorded in hostile alignment.",
    "The Battle placed hostility between their banners.",
    "Their diplomacy marked opposition during the encounter.",
    "The record kept {A} and {B} on hostile sides.",
    "They entered this chapter as diplomatic opponents.",
    "Their alignment remained hostile across the recorded encounter.",
    "The field found them on opposing diplomatic terms.",
    "Their recorded stance was one of opposition.",
  ]],
  ["ALIGNMENT_NEUTRALITY", [
    "The diplomacy record kept {A} and {B} mutually neutral.",
    "Neither direction of their diplomacy moved beyond neutrality.",
    "They remained mutually neutral during the recorded encounter.",
    "The Battle recorded neutral relations between {A} and {B}.",
    "Their diplomacy remained neutral.",
    "The pair shared the field without leaving mutual neutrality.",
    "The diplomatic record between them stayed neutral.",
    "Their recorded stance remained neutral in both directions.",
    "No allied or hostile stance replaced their mutual neutrality.",
    "The Chronicle records a neutral alignment between them.",
  ]],
  ["ALIGNMENT_MIXED", [
    "Their diplomacy did not keep a single shape throughout the Battle.",
    "The alignment between {A} and {B} changed during the encounter.",
    "More than one diplomatic state was recorded between them.",
    "Their banners did not remain fixed on one side of the diplomatic record.",
    "The Battle carried changing diplomacy between {A} and {B}.",
    "Their relationship on the field crossed diplomatic states during play.",
    "The diplomacy timeline changed course before the Battle was over.",
    "Their alignment shifted within the same Battle.",
    "This encounter cannot be reduced to a single allied or hostile stance.",
    "The record shows their diplomacy changing during the Battle.",
    "Their diplomatic positions moved before the encounter ended.",
    "The field saw more than one alignment between them.",
  ]],
  ["ALIGNMENT_UNKNOWN", [
    "The available diplomacy evidence is not complete enough to assign a full alignment between them.",
    "AoF cannot establish their complete diplomatic alignment from the available evidence.",
    "The Chronicle retains this meeting without guessing at missing diplomacy evidence.",
    "Their shared Battle is recorded, while part of the diplomacy evidence remains unavailable.",
    "The evidence does not support a complete diplomatic account for this encounter.",
    "The meeting is known; the full alignment is not.",
    "The Chronicle records the encounter without filling gaps in the diplomacy timeline.",
    "Their Battle is retained even though the complete diplomatic state cannot be established.",
  ]],
  ["DIPLOMACY_ALLIANCE_FORMED", [
    "During the Battle, their diplomacy became a mutual alliance.",
    "The two directed stances converged into a mutual alliance.",
    "A mutual alliance formed between {A} and {B} during play.",
    "Their diplomacy shifted until both players marked the other as an ally.",
    "The Battle saw {A} and {B} enter mutual alliance.",
    "Their separate diplomacy settings came into mutual alignment.",
    "Before the Battle ended, the pair reached a mutual alliance.",
    "The diplomacy timeline records a mutual alliance forming between them.",
    "Both sides eventually carried an allied stance toward the other.",
    "Their alignment became mutual alliance during the encounter.",
    "The record shows their banners becoming mutually aligned.",
    "A two-way alliance appeared in the diplomacy timeline.",
  ]],
  ["DIPLOMACY_ALLIANCE_ENDED", [
    "The mutual alliance ended before the Battle was over.",
    "Their alliance ceased to be mutual during the encounter.",
    "The diplomacy timeline records the end of their mutual alliance.",
    "Their shared alliance did not persist to the end of the Battle.",
    "Before the field was settled, the mutual alignment between them ended.",
    "One of the directed stances changed, ending the mutual alliance.",
    "The pair left mutual alliance during the Battle.",
    "Their diplomacy moved away from mutual alliance before the encounter ended.",
    "The alliance recorded between them later came to an end.",
    "The Battle contains both their alliance and its ending.",
    "Their banners ceased to be mutually aligned.",
    "The recorded alliance was temporary within this Battle.",
  ]],
  ["DIPLOMACY_ONE_SIDED_ALLIANCE", [
    "For part of the Battle, only one directed stance marked the other as an ally.",
    "The diplomacy record briefly showed an alliance in one direction only.",
    "Their alignment became one-sided rather than mutual.",
    "One player marked the other as an ally without a matching allied stance in return.",
    "The timeline records an asymmetric alliance between them.",
    "Their diplomacy was allied in one direction and not the other.",
    "A one-sided allied stance appeared between {A} and {B}.",
    "The pair did not immediately share the same allied stance.",
    "Their diplomacy diverged into a one-sided alliance.",
    "Only one side of the diplomacy edge carried an allied stance at that point.",
  ]],
  ["DIPLOMACY_CONFLICTED", [
    "At one point, one side marked alliance while the other marked hostility.",
    "Their directed diplomacy briefly pointed in opposite directions: ally and enemy.",
    "The timeline records conflicting allied and hostile stances between them.",
    "Their diplomacy became directly asymmetric, with alliance in one direction and hostility in the other.",
    "The two directed stances opposed one another at that point in the Battle.",
    "One banner carried an allied stance while the other carried an enemy stance.",
    "Their diplomacy entered a conflicted state rather than a mutual alignment.",
    "The record shows ally and enemy stances existing simultaneously between them.",
    "Their diplomatic settings briefly disagreed at the strongest level.",
    "The pair occupied opposing directed stances before the next change.",
  ]],
  ["ACTION_DIRECT_CONTEST", [
    "Qualifying direct contest was recorded between {SOURCE} and {TARGET}.",
    "{SOURCE} and {TARGET} became directly involved against one another.",
    "The Battle recorded direct engagement between {SOURCE} and {TARGET}.",
    "Their interaction included a qualifying direct contest.",
    "Direct engagement placed {SOURCE} and {TARGET} in the same contest.",
    "AoF recorded qualifying direct interaction between them.",
    "The pair met in direct engagement during the Battle.",
    "Their paths crossed in a qualifying direct contest.",
    "The evidence records direct opposition between {SOURCE} and {TARGET}.",
    "A direct engagement between them entered the Battle record.",
    "Their meeting included qualifying direct military interaction.",
    "The record shows {SOURCE} and {TARGET} directly contesting one another.",
  ]],
  ["ACTION_RAID_PRESSURE", [
    "{SOURCE} brought qualifying raid pressure toward {TARGET}.",
    "The Battle recorded a raid-pressure episode from {SOURCE} toward {TARGET}.",
    "Qualifying pressure from {SOURCE} reached the area of {TARGET}.",
    "{SOURCE} directed a qualifying raid episode toward {TARGET}.",
    "The evidence records raid pressure running from {SOURCE} to {TARGET}.",
    "A qualifying raid-pressure window was attributed to {SOURCE} against {TARGET}.",
    "{TARGET} became the target of a qualifying pressure episode from {SOURCE}.",
    "The pair's history gained a directed raid-pressure episode from {SOURCE}.",
    "AoF recorded qualifying raid activity from {SOURCE} toward {TARGET}.",
    "The Battle contained directed raid pressure by {SOURCE} against {TARGET}.",
    "A raid-pressure episode connected {SOURCE} to {TARGET}.",
    "The recorded pressure ran from {SOURCE} toward {TARGET}.",
  ]],
  ["ACTION_FORWARD_ENCROACHMENT", [
    "{SOURCE} placed qualifying forward construction toward {TARGET}.",
    "The spatial record attributes forward construction by {SOURCE} toward {TARGET}.",
    "{SOURCE} established a qualifying forward placement in the direction of {TARGET}.",
    "A forward construction episode by {SOURCE} entered the pair record.",
    "The Battle recorded forward encroachment from {SOURCE} toward {TARGET}.",
    "{SOURCE}'s building placement qualified as forward pressure toward {TARGET}.",
    "The map evidence records a forward placement by {SOURCE} against {TARGET}'s side of the map.",
    "A qualifying forward structure placement connected {SOURCE} and {TARGET}.",
    "{SOURCE} carried construction forward toward {TARGET}'s starting area.",
    "The pair's spatial history gained a forward placement by {SOURCE}.",
  ]],
  ["ACTION_ENEMY_BASE_CONTACT", [
    "{SOURCE}'s recorded commands reached qualifying proximity to {TARGET}'s starting base.",
    "The map record shows qualifying base contact by {SOURCE} near {TARGET}.",
    "{SOURCE} reached the Chronicle's base-contact threshold toward {TARGET}.",
    "Qualifying command presence from {SOURCE} appeared near {TARGET}'s starting base.",
    "The spatial evidence records {SOURCE} reaching {TARGET}'s base region.",
    "{SOURCE}'s command footprint entered qualifying proximity to {TARGET}'s starting area.",
    "A base-contact episode was recorded from {SOURCE} toward {TARGET}.",
    "The pair's spatial record includes qualifying contact near {TARGET}'s starting base.",
    "{SOURCE} registered qualifying command presence close to {TARGET}'s home anchor.",
    "The Battle records a qualifying approach by {SOURCE} toward {TARGET}'s base.",
  ]],
  ["ACTION_MATERIAL_SUPPORT", [
    "Recorded tribute passed from {SOURCE} to {TARGET}.",
    "{SOURCE} sent recorded material support to {TARGET}.",
    "The economic record contains a directed tribute from {SOURCE} to {TARGET}.",
    "Material support was recorded moving from {SOURCE} toward {TARGET}.",
    "{TARGET} received recorded tribute from {SOURCE}.",
    "The Battle includes a qualifying economic transfer from {SOURCE} to {TARGET}.",
    "A directed material-support episode linked {SOURCE} to {TARGET}.",
    "The pair's history records tribute sent by {SOURCE} to {TARGET}.",
    "Economic support passed between them, from {SOURCE} to {TARGET}.",
    "AoF recorded material assistance from {SOURCE} toward {TARGET}.",
  ]],
  ["ACTION_ALLY_REINFORCEMENT", [
    "{SOURCE} brought qualifying reinforcement toward {TARGET}.",
    "The Battle records reinforcement by {SOURCE} in support of {TARGET}.",
    "Qualifying allied reinforcement connected {SOURCE} to {TARGET}.",
    "{SOURCE}'s military activity qualified as reinforcement for {TARGET}.",
    "The evidence records {SOURCE} reinforcing {TARGET}.",
    "A reinforcement episode from {SOURCE} entered their shared history.",
    "{TARGET} received qualifying reinforcement from {SOURCE}.",
    "The pair's cooperation included recorded reinforcement by {SOURCE}.",
    "AoF recorded a reinforcement response from {SOURCE} for {TARGET}.",
    "The Battle contains a qualifying reinforcement episode between them.",
  ]],
  ["ACTION_DEFENSIVE_ASSIST", [
    "{SOURCE} provided qualifying defensive assistance for {TARGET}.",
    "The Battle records {SOURCE} responding in defence of {TARGET}.",
    "A qualifying defensive-assistance episode linked {SOURCE} to {TARGET}.",
    "{SOURCE}'s activity qualified as defensive support for {TARGET}.",
    "The evidence records a defensive response by {SOURCE} for {TARGET}.",
    "{TARGET} received qualifying defensive assistance from {SOURCE}.",
    "Their cooperation included a recorded defensive response from {SOURCE}.",
    "The pair's history gained a defensive-assistance episode.",
    "AoF recorded {SOURCE} joining a qualifying defence around {TARGET}.",
    "A defensive-support episode between them entered the record.",
  ]],
  ["ACTION_COOPERATIVE_ATTACK", [
    "{SOURCE} and {TARGET} qualified for a cooperative-attack episode against {THIRD}.",
    "The Battle records {SOURCE} and {TARGET} participating in qualifying offensive action against {THIRD}.",
    "A cooperative-attack episode connected {SOURCE} and {TARGET} against {THIRD}.",
    "Their recorded cooperation included shared offensive participation against {THIRD}.",
    "{SOURCE} and {TARGET} both contributed to a qualifying attack involving {THIRD}.",
    "The engagement evidence records cooperative offensive participation by the pair against {THIRD}.",
    "A qualifying shared attack against {THIRD} entered their pair history.",
    "Their cooperation extended to a recorded offensive episode involving {THIRD}.",
    "AoF attributed a cooperative-attack episode to {SOURCE} and {TARGET} against {THIRD}.",
    "The pair shared qualifying offensive participation against {THIRD}.",
  ]],
  ["ACTION_THIRD_PARTY_PRESSURE", [
    "{A} and {B} both applied qualifying pressure to {THIRD} during the same recorded window; no coordination is implied.",
    "Their pressure on {THIRD} overlapped in time, without the record treating that overlap as proof of coordination.",
    "The Battle records simultaneous qualifying pressure by {A} and {B} against {THIRD}.",
    "Both players pressured {THIRD} within the same episode window, though the evidence alone does not establish a joint plan.",
    "Their separate pressure against {THIRD} coincided during the Battle.",
    "A shared time window contains qualifying pressure from both {A} and {B} toward {THIRD}.",
    "The record places both players in pressure episodes against {THIRD} at the same time, without assigning intent.",
    "{THIRD} faced qualifying pressure from both {A} and {B} during an overlapping interval.",
    "The pair's actions converged in time against {THIRD}; AoF records coincidence, not conspiracy.",
    "Their separate activity against {THIRD} overlapped enough to form a third-party pressure episode.",
  ]],
  ["ABSENCE_OPPOSITION_CONTACT", [
    "A qualifying opportunity for direct opposition existed, but no qualifying pair contact was recorded in that window.",
    "The evidence covers a qualifying opposition window without recording direct contact between them.",
    "They had a qualified opportunity to meet in opposition; the recorded window contains no qualifying pair interaction.",
    "A covered opposition opportunity passed without qualifying direct contact.",
    "No qualifying pair contact appears inside the recorded opposition opportunity.",
    "The Battle supplied a qualified opposition window, yet no qualifying direct interaction was recorded between them.",
    "Within a covered opportunity for opposition, the pair remained without qualifying contact.",
    "AoF records the qualifying opportunity and the absence of qualifying pair interaction within it.",
    "The covered opposition window ended without a qualifying direct encounter between them.",
    "Their opposition was observable in that window, but qualifying contact between the pair was not recorded.",
  ]],
  ["ABSENCE_ALLIED_COOPERATION", [
    "A qualifying opportunity for cooperation existed, but no qualifying cooperative interaction was recorded in that window.",
    "The evidence covers a genuine cooperation opportunity without recording qualifying cooperation between them.",
    "They had a qualified opportunity to act together; no qualifying pair cooperation appears inside that window.",
    "A covered allied opportunity passed without qualifying cooperative interaction.",
    "No qualifying cooperation was recorded within the identified opportunity.",
    "The Battle supplied a qualifying cooperation window, but the record contains no qualifying support between them there.",
    "Within a covered opportunity to cooperate, no qualifying pair action was recorded.",
    "AoF records the opportunity and the absence of qualifying cooperation within it, without assigning motive.",
    "The qualifying allied window ended without a recorded cooperative episode between them.",
    "Their alliance had a covered opportunity for cooperation, but none qualified in that window.",
  ]],
  ["RELATIONSHIP_ESTABLISHED_RIVALRY", [
    "Their recurring contest became an established Rivalry.",
    "The relationship record now recognizes an established Rivalry between them.",
    "This encounter carried their contest into an established Rivalry.",
    "Their accumulated reciprocal contest reached the Rivalry stage.",
    "The Chronicle marks the establishment of their Rivalry here.",
    "Their repeated contest crossed into an established Rivalry.",
    "Rivalry became part of their active relationship record.",
    "This Battle established Rivalry in their shared history.",
  ]],
  ["RELATIONSHIP_ESTABLISHED_HOSTILITY", [
    "Their accumulated antagonistic record became established Hostility.",
    "The relationship record now recognizes established Hostility between them.",
    "This encounter carried their antagonistic history into established Hostility.",
    "Their qualifying reciprocal pressure reached the Hostility stage.",
    "The Chronicle marks established Hostility between them here.",
    "Hostility became part of their active relationship record.",
    "Their repeated antagonistic evidence established Hostility.",
    "This Battle established Hostility in their shared history.",
  ]],
  ["RELATIONSHIP_ESTABLISHED_BOND", [
    "Their accumulated cooperation became an established Bond.",
    "The relationship record now recognizes an established Bond between them.",
    "This encounter carried their cooperative history into an established Bond.",
    "Their qualifying reciprocal cooperation reached the Bond stage.",
    "The Chronicle marks the establishment of their Bond here.",
    "Bond became part of their active relationship record.",
    "Their repeated cooperative evidence established a Bond.",
    "This Battle established a Bond in their shared history.",
  ]],
  ["RELATIONSHIP_ADVANCED_RIVALRY", [
    "Their Rivalry reached a new recorded stage.", "The Rivalry deepened to a new historical level.", "Their contest advanced the Rivalry further.",
    "The relationship record marks a new Rivalry stage.", "Their Rivalry reached a new historical peak.", "This Battle carried the Rivalry further than before.",
    "The Chronicle records further development in their Rivalry.", "Their established contest advanced again.",
  ]],
  ["RELATIONSHIP_ADVANCED_HOSTILITY", [
    "Their Hostility reached a new recorded stage.", "The Hostility deepened to a new historical level.", "Their antagonistic record advanced further.",
    "The relationship record marks a new Hostility stage.", "Their Hostility reached a new historical peak.", "This Battle carried their Hostility further than before.",
    "The Chronicle records further development in their Hostility.", "Their established Hostility advanced again.",
  ]],
  ["RELATIONSHIP_ADVANCED_BOND", [
    "Their Bond reached a new recorded stage.", "The Bond deepened to a new historical level.", "Their cooperative record advanced further.",
    "The relationship record marks a new Bond stage.", "Their Bond reached a new historical peak.", "This Battle carried their Bond further than before.",
    "The Chronicle records further development in their Bond.", "Their established Bond advanced again.",
  ]],
  ["RELATIONSHIP_DORMANT_RIVALRY", [
    "Their Rivalry remained in the record but became Dormant.", "The active Rivalry fell Dormant without losing its history.",
    "The Chronicle preserves the Rivalry while marking it Dormant.", "Their Rivalry passed into Dormancy rather than disappearing.",
    "The contest went quiet enough for the Rivalry to become Dormant.", "Their historical Rivalry remains, though its active state became Dormant.",
    "The relationship record now marks the Rivalry as Dormant.", "Their Rivalry's history was preserved as the active contest fell quiet.",
  ]],
  ["RELATIONSHIP_DORMANT_HOSTILITY", [
    "Their Hostility remained in the record but became Dormant.", "The active Hostility fell Dormant without losing its history.",
    "The Chronicle preserves the Hostility while marking it Dormant.", "Their Hostility passed into Dormancy rather than disappearing.",
    "The antagonistic record went quiet enough for Hostility to become Dormant.", "Their historical Hostility remains, though its active state became Dormant.",
    "The relationship record now marks Hostility as Dormant.", "Their Hostility's history was preserved as active pressure fell quiet.",
  ]],
  ["RELATIONSHIP_REACTIVATED_RIVALRY", [
    "Their Dormant Rivalry became active again.", "Direct contest returned and reactivated the Rivalry.", "The quiet Rivalry returned to active record.",
    "Their Rivalry emerged from Dormancy.", "The Chronicle marks the Rivalry active once more.", "Fresh qualifying contest reactivated their Rivalry.",
    "The dormant contest resumed strongly enough to reactivate the relationship.", "Their Rivalry returned from Dormancy in this Battle.",
  ]],
  ["RELATIONSHIP_REACTIVATED_HOSTILITY", [
    "Their Dormant Hostility became active again.", "Fresh antagonistic evidence reactivated the Hostility.", "The quiet Hostility returned to active record.",
    "Their Hostility emerged from Dormancy.", "The Chronicle marks Hostility active once more.", "Fresh qualifying pressure reactivated their Hostility.",
    "The dormant antagonism resumed strongly enough to reactivate the relationship.", "Their Hostility returned from Dormancy in this Battle.",
  ]],
  ["RELATIONSHIP_WEAKENED_BOND", [
    "Their established Bond weakened in the relationship record.", "This encounter reduced the strength of their existing Bond.",
    "The Chronicle records a weakening of their Bond.", "Their previous Bond remained part of the history, but its current strength fell.",
    "The relationship record marks their Bond as weakened after this encounter.", "Their cooperative history remained, while the active Bond lost strength.",
    "This Battle placed measurable strain on the existing Bond.", "Their Bond survived in the record at reduced strength.",
  ]],
  ["CODA_ENCOUNTER_NUMBER", [
    "It was their {N} recorded meeting.", "This became encounter {N} in their shared Chronicle.", "The entry was the {N} meeting recorded between them.",
    "Their shared record now stood at {N} Battles.", "The Chronicle counted this as their {N} encounter.", "This was meeting {N} in their recorded history.",
    "Their common ledger reached {N} recorded Battles.", "The pair's Chronicle now contained {N} meetings.",
  ]],
  ["CODA_FIRST_ALLIANCE", [
    "It was the first mutual alliance recorded between them.", "No earlier Battle in their shared history contained a mutual alliance.",
    "Their Chronicle records its first mutual alliance here.", "This was their first recorded two-way alliance.",
    "The alliance was new to their shared league history.", "For the first time in the Chronicle, their diplomacy became mutually allied.",
  ]],
  ["CODA_FIRST_COOPERATION", [
    "It was their first qualifying cooperative interaction on record.", "No earlier shared Battle had recorded qualifying cooperation between them.",
    "Their Chronicle records its first qualifying cooperation here.", "This Battle supplied the first qualifying cooperative evidence between them.",
    "The cooperation was new to their recorded pair history.", "For the first time, their shared record contained qualifying cooperative action.",
  ]],
  ["CODA_FIRST_PRESSURE", [
    "It was the first qualifying directed pressure recorded between them.", "No earlier shared Battle had recorded qualifying pressure between them.",
    "Their Chronicle records its first qualifying pressure here.", "This Battle supplied the first qualifying pressure evidence in their pair history.",
    "The pressure was new to their recorded history.", "For the first time, their shared record contained qualifying directed pressure.",
  ]],
];

export const CHRONICLE_PHRASES: ChroniclePhrase[] = [
  ...Object.entries(TITLE_LIBRARY).flatMap(([key, templates]) => phrases(`TITLE_${key}` as ChroniclePhraseGroup, templates)),
  ...BODY_LIBRARY.flatMap(([group, templates]) => phrases(group, templates)),
];

export const CHRONICLE_PHRASES_BY_GROUP: ReadonlyMap<ChroniclePhraseGroup, readonly ChroniclePhrase[]> = (() => {
  const map = new Map<ChroniclePhraseGroup, ChroniclePhrase[]>();
  for (const phrase of CHRONICLE_PHRASES) {
    const list = map.get(phrase.group) ?? [];
    list.push(phrase);
    map.set(phrase.group, list);
  }
  return map;
})();

export const CHRONICLE_PROHIBITED_UNQUALIFIED_WORDS = [
  "betrayed", "betrayal", "saved", "rescued", "slaughtered", "humiliated", "refused", "abandoned", "avenged", "conspired",
] as const;
