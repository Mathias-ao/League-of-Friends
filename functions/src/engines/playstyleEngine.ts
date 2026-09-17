export const PLAYSTYLE_ENGINE_VERSION = "AOF_PLAYSTYLE_ENGINE_V1";

export interface NormalizedPlaystyleMetric {
  metricId: string;
  value: number;
  samples: number;
  sourceVersion: string;
}

export interface PlaystyleComponentRule {
  metricId: string;
  weight: number;
  direction: "LEFT" | "RIGHT";
  minimumSamples?: number;
}

export interface PlaystyleSliderRule {
  sliderId: string;
  leftLabel: string;
  rightLabel: string;
  minimumAvailableComponents: number;
  requireAllComponents: boolean;
  components: PlaystyleComponentRule[];
}

export interface PlaystyleRuleSet {
  ruleVersion: string;
  sliders: PlaystyleSliderRule[];
}

export interface PlaystyleComponentResult {
  metricId: string;
  normalizedValue: number;
  directedValue: number;
  samples: number;
  weight: number;
  contribution: number;
  sourceVersion: string;
}

export interface PlaystyleSliderResult {
  sliderId: string;
  leftLabel: string;
  rightLabel: string;
  status: "READY" | "INSUFFICIENT_DATA";
  value: number | null;
  availableComponents: number;
  requiredComponents: number;
  components: PlaystyleComponentResult[];
  missingMetricIds: string[];
}

export interface PlaystyleProfile {
  engineVersion: typeof PLAYSTYLE_ENGINE_VERSION;
  ruleVersion: string | null;
  playerId: string;
  scope: "CAREER" | "RECENT";
  status: "UNCONFIGURED" | "READY" | "PARTIAL" | "INSUFFICIENT_DATA";
  sliders: PlaystyleSliderResult[];
}

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validateMetric(metric: NormalizedPlaystyleMetric): void {
  if (!metric.metricId) throw new Error("Playstyle metricId is required.");
  if (!Number.isFinite(metric.value) || metric.value < 0 || metric.value > 100) {
    throw new Error(`Playstyle metric ${metric.metricId} must be normalized from 0 to 100.`);
  }
  if (!Number.isInteger(metric.samples) || metric.samples < 0) {
    throw new Error(`Playstyle metric ${metric.metricId} samples must be a non-negative integer.`);
  }
  if (!metric.sourceVersion) throw new Error(`Playstyle metric ${metric.metricId} sourceVersion is required.`);
}

export function validatePlaystyleRuleSet(ruleSet: PlaystyleRuleSet): PlaystyleRuleSet {
  if (!ruleSet.ruleVersion) throw new Error("Playstyle ruleVersion is required.");
  const sliderIds = new Set<string>();

  for (const slider of ruleSet.sliders) {
    if (!slider.sliderId || !slider.leftLabel || !slider.rightLabel) {
      throw new Error("Every playstyle slider requires an id and both endpoint labels.");
    }
    if (sliderIds.has(slider.sliderId)) throw new Error(`Duplicate playstyle sliderId: ${slider.sliderId}.`);
    sliderIds.add(slider.sliderId);
    if (!Number.isInteger(slider.minimumAvailableComponents) || slider.minimumAvailableComponents < 1) {
      throw new Error(`Slider ${slider.sliderId} minimumAvailableComponents must be at least 1.`);
    }
    if (slider.components.length < 1) throw new Error(`Slider ${slider.sliderId} needs at least one component.`);
    if (slider.minimumAvailableComponents > slider.components.length) {
      throw new Error(`Slider ${slider.sliderId} minimumAvailableComponents exceeds its component count.`);
    }

    const metricIds = new Set<string>();
    for (const component of slider.components) {
      if (!component.metricId) throw new Error(`Slider ${slider.sliderId} contains a component without metricId.`);
      if (metricIds.has(component.metricId)) {
        throw new Error(`Slider ${slider.sliderId} uses metric ${component.metricId} more than once.`);
      }
      metricIds.add(component.metricId);
      if (!Number.isFinite(component.weight) || component.weight <= 0) {
        throw new Error(`Slider ${slider.sliderId} component weights must be positive finite numbers.`);
      }
      if (component.minimumSamples != null && (!Number.isInteger(component.minimumSamples) || component.minimumSamples < 1)) {
        throw new Error(`Slider ${slider.sliderId} minimumSamples must be a positive integer when provided.`);
      }
    }
  }

  return {
    ruleVersion: ruleSet.ruleVersion,
    sliders: ruleSet.sliders.map((slider) => ({
      ...slider,
      components: slider.components.map((component) => ({ ...component })),
    })),
  };
}

function evaluateSlider(
  slider: PlaystyleSliderRule,
  metrics: Map<string, NormalizedPlaystyleMetric>,
): PlaystyleSliderResult {
  const components: PlaystyleComponentResult[] = [];
  const missingMetricIds: string[] = [];

  for (const rule of slider.components) {
    const metric = metrics.get(rule.metricId);
    const minimumSamples = rule.minimumSamples ?? 1;
    if (!metric || metric.samples < minimumSamples) {
      missingMetricIds.push(rule.metricId);
      continue;
    }

    const directedValue = rule.direction === "RIGHT" ? metric.value : 100 - metric.value;
    components.push({
      metricId: metric.metricId,
      normalizedValue: rounded(metric.value),
      directedValue: rounded(directedValue),
      samples: metric.samples,
      weight: rule.weight,
      contribution: rounded(directedValue * rule.weight),
      sourceVersion: metric.sourceVersion,
    });
  }

  const enoughComponents = components.length >= slider.minimumAvailableComponents;
  const satisfiesAll = !slider.requireAllComponents || missingMetricIds.length === 0;
  const ready = enoughComponents && satisfiesAll;
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = components.reduce((sum, component) => sum + component.directedValue * component.weight, 0);

  return {
    sliderId: slider.sliderId,
    leftLabel: slider.leftLabel,
    rightLabel: slider.rightLabel,
    status: ready ? "READY" : "INSUFFICIENT_DATA",
    value: ready && totalWeight > 0 ? rounded(weighted / totalWeight) : null,
    availableComponents: components.length,
    requiredComponents: slider.requireAllComponents ? slider.components.length : slider.minimumAvailableComponents,
    components,
    missingMetricIds: missingMetricIds.sort((a, b) => a.localeCompare(b)),
  };
}

export function evaluatePlaystyleProfile(
  playerId: string,
  scope: "CAREER" | "RECENT",
  metricsInput: NormalizedPlaystyleMetric[],
  ruleSetInput: PlaystyleRuleSet | null,
): PlaystyleProfile {
  if (!ruleSetInput) {
    return {
      engineVersion: PLAYSTYLE_ENGINE_VERSION,
      ruleVersion: null,
      playerId,
      scope,
      status: "UNCONFIGURED",
      sliders: [],
    };
  }

  const ruleSet = validatePlaystyleRuleSet(ruleSetInput);
  const metrics = new Map<string, NormalizedPlaystyleMetric>();
  for (const metric of metricsInput) {
    validateMetric(metric);
    if (metrics.has(metric.metricId)) throw new Error(`Duplicate playstyle metricId: ${metric.metricId}.`);
    metrics.set(metric.metricId, { ...metric });
  }

  const sliders = ruleSet.sliders
    .map((slider) => evaluateSlider(slider, metrics))
    .sort((left, right) => left.sliderId.localeCompare(right.sliderId));
  const readyCount = sliders.filter((slider) => slider.status === "READY").length;

  return {
    engineVersion: PLAYSTYLE_ENGINE_VERSION,
    ruleVersion: ruleSet.ruleVersion,
    playerId,
    scope,
    status: readyCount === sliders.length && sliders.length > 0
      ? "READY"
      : readyCount > 0
        ? "PARTIAL"
        : "INSUFFICIENT_DATA",
    sliders,
  };
}
