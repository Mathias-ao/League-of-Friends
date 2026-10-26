/**
 * Explicit, TUNABLE private E2E pilot calibration for the existing #139 allocator.
 *
 * NOT a live policy, entitlement source, source-method approval or proof of
 * execution. This file never authenticates a Game or promotes a #158 LIMITED
 * candidate into a QUALIFIED Claim. A server-owned, independently tested bridge
 * must do that first. Do not import this into production callable routes.
 *
 * The owner elected to test workable first-pass rules rather than hold all
 * development for final numerical tuning. Every value below is provisional.
 */
export const SOCIAL_E2E_PILOT_VERSION = 'AOF_SOCIAL_E2E_PILOT_CALIBRATION_1';
export const SOCIAL_E2E_PILOT_STATUS = 'PRIVATE_SIMULATION_ONLY';
export const SOCIAL_E2E_PILOT_BANDS = Object.freeze({
  ORDINARY: 1,
  SUBSTANTIAL: 2,
});

// Names are the nine explicitly supported ordinary inference families in #141.
// A rule cannot qualify its own conduct: original-source method/coverage and
// track-specific context must separately admit the corresponding Claim.
export const SOCIAL_E2E_PILOT_RULES = Object.freeze({
  E2E_PAIR_CONTEST: ['RELATIONSHIP', 'RIVALRY', 'STRENGTHEN'],
  E2E_DARING_OFFENSE: ['REPUTATION', 'GALLANTRY', 'STRENGTHEN'],
  E2E_PREEXISTING_VULNERABILITY_PRESSURE: ['REPUTATION', 'CRUELTY', 'STRENGTHEN'],
  E2E_DIRECTED_HELP: ['RELATIONSHIP', 'BOND', 'STRENGTHEN'],
  E2E_NOTEWORTHY_DIRECTED_PROTECTION: ['REPUTATION', 'CHIVALRY', 'STRENGTHEN'],
  E2E_DISTINCT_RUPTURE_ANTAGONISM: ['RELATIONSHIP', 'HOSTILITY', 'STRENGTHEN'],
  E2E_RECONCILIATORY_HELP: ['RELATIONSHIP', 'HOSTILITY', 'WEAKEN'],
  E2E_SERIOUS_BOND_ANTAGONISM: ['RELATIONSHIP', 'BOND', 'WEAKEN'],
  E2E_QUALIFIED_DEESCALATION: ['RELATIONSHIP', 'RIVALRY', 'WEAKEN'],
});

/** A fresh pure configuration object for a controlled E2E simulation.
 * Status PROPOSED + approvalRef null ensures #139 never publishes receipts,
 * regardless of caller-supplied trustedApprovals.
 */
export function createSocialE2EPilotCalibration() {
  const stages={REPUTATION:{},RELATIONSHIP:{}};
  const budgets={reputationBattle:{},relationshipEvent:{}};
  // Stage requirements are per boundary, not cumulative score points.
  // Four stages offer two attainable one-sided levels and two advanced levels.
  for(const track of ['GALLANTRY','CRUELTY','CHIVALRY']) {
    stages.REPUTATION[track]={up:[2,3,5,8],down:[2,3,5,8]};
    budgets.reputationBattle[track]={STRENGTHEN:2,WEAKEN:1};
  }
  for(const track of ['RIVALRY','HOSTILITY','BOND']) {
    stages.RELATIONSHIP[track]={
      up:[2,3,5,8],down:[2,3,5,8],
      // The existing #139 allocator independently verifies original
      // source-owned conduct from BOTH directions for stage 3+.
      reciprocity:{3:2,4:3}
    };
    budgets.relationshipEvent[track]={STRENGTHEN:2,WEAKEN:1};
  }
  const rules={};
  for(const [ruleId,[system,track,effect]] of Object.entries(SOCIAL_E2E_PILOT_RULES)){
    rules[ruleId]={system,track,effect,bands:{...SOCIAL_E2E_PILOT_BANDS}};
  }
  return {
    version:SOCIAL_E2E_PILOT_VERSION,
    policy:{
      policyVersion:'AOF_SOC_GRADE_OWNER_REVIEW_CATALOGUE_V0_1',
      configurationVersion:SOCIAL_E2E_PILOT_VERSION,
      status:'PROPOSED',
      approvalRef:null
    },
    stages,budgets,rules,
    // This numerical reservation does not qualify Treachery: all seven
    // strict source gates and the victim's judgment remain mandatory.
    treachery:{consumptionUnits:2,maximumStage:4}
  };
}
