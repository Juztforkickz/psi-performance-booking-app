export type PlanBuildOption = {
  value: string;
  label: string;
};

export type PlanAreaId =
  | 'engine'
  | 'suspension'
  | 'exhaust'
  | 'intake'
  | 'repairs'
  | 'interior'
  | 'programming'
  | 'other';

export type PlanArea = {
  id: PlanAreaId;
  label: string;
  detail: string;
  options: readonly PlanBuildOption[];
};

const adviceOptions = [
  { value: 'psi-advice', label: 'Not sure — I would like PSI advice' },
  { value: 'other', label: 'Other / not listed' },
] as const;

export const PLAN_BUILD_AREAS: readonly PlanArea[] = [
  {
    id: 'engine',
    label: 'Engine',
    detail: 'Health, supporting systems and staged upgrades.',
    options: [
      { value: 'health', label: 'Health check or diagnosis' },
      { value: 'na-upgrade', label: 'Naturally aspirated upgrade' },
      { value: 'cam-valvetrain', label: 'Camshaft or valvetrain' },
      { value: 'forced-induction', label: 'Turbo or supercharger' },
      { value: 'fuel-ignition', label: 'Fuel or ignition support' },
      { value: 'cooling', label: 'Cooling, oiling or reliability' },
      { value: 'rebuild', label: 'Engine build or rebuild' },
      ...adviceOptions,
    ],
  },
  {
    id: 'suspension',
    label: 'Suspension',
    detail: 'Ride height, control and handling direction.',
    options: [
      { value: 'street-handling', label: 'Street handling package' },
      { value: 'springs-dampers', label: 'Springs or dampers' },
      { value: 'coilovers', label: 'Coilovers or ride height' },
      { value: 'bushes-mounts', label: 'Bushes or mounts' },
      { value: 'sway-geometry', label: 'Sway bars or geometry' },
      { value: 'track-setup', label: 'Track setup' },
      ...adviceOptions,
    ],
  },
  {
    id: 'exhaust',
    label: 'Exhaust',
    detail: 'Flow, sound, fitment and repair concerns.',
    options: [
      { value: 'cat-back', label: 'Cat-back system' },
      { value: 'headers', label: 'Headers or extractors' },
      { value: 'downpipes', label: 'Downpipes' },
      { value: 'high-flow-cats', label: 'High-flow catalytic converters' },
      { value: 'custom-system', label: 'Full or custom system' },
      { value: 'valved', label: 'Valved or Varex system' },
      { value: 'repair', label: 'Repair, noise or fitment concern' },
      ...adviceOptions,
    ],
  },
  {
    id: 'intake',
    label: 'Intake',
    detail: 'Airflow, charge cooling and supporting hardware.',
    options: [
      { value: 'filter', label: 'Filter or panel upgrade' },
      { value: 'cold-air', label: 'Cold-air or OTR intake' },
      { value: 'manifold', label: 'Intake manifold or throttle body' },
      { value: 'intercooler', label: 'Intercooler or charge piping' },
      { value: 'forced-inlet', label: 'Forced-induction inlet' },
      ...adviceOptions,
    ],
  },
  {
    id: 'repairs',
    label: 'Repairs',
    detail: 'Fault finding, inspection and mechanical repairs.',
    options: [
      { value: 'scan', label: 'Scan or diagnostics' },
      { value: 'engine-mechanical', label: 'Engine mechanical concern' },
      { value: 'cooling', label: 'Cooling or overheating concern' },
      { value: 'driveline', label: 'Driveline, clutch or transmission' },
      { value: 'brakes', label: 'Brakes' },
      { value: 'steering', label: 'Steering or suspension repair' },
      { value: 'electrical', label: 'Electrical fault or warning light' },
      { value: 'inspection', label: 'General inspection' },
      ...adviceOptions,
    ],
  },
  {
    id: 'interior',
    label: 'Interior',
    detail: 'Driver controls, displays, seating and fitment.',
    options: [
      { value: 'gauges', label: 'Gauges or displays' },
      { value: 'controls', label: 'Switches or controls' },
      { value: 'seats', label: 'Seats or mounting' },
      { value: 'trim', label: 'Trim or fitment' },
      { value: 'heat-noise', label: 'Heat or noise management' },
      { value: 'motorsport', label: 'Motorsport interior discussion' },
      ...adviceOptions,
    ],
  },
  {
    id: 'programming',
    label: 'Programming',
    detail: 'Calibration, diagnostics and supported configuration.',
    options: [
      { value: 'engine-ecu', label: 'Engine ECU calibration' },
      { value: 'transmission', label: 'Transmission or TCU calibration' },
      { value: 'diagnostics-coding', label: 'Diagnostics or supported coding' },
      { value: 'flex-fuel', label: 'Flex-fuel or fuel setup' },
      { value: 'features', label: 'Supported feature configuration' },
      { value: 'post-modification', label: 'Post-modification calibration' },
      ...adviceOptions,
    ],
  },
  {
    id: 'other',
    label: 'Other',
    detail: 'A complete build, unusual concern or idea not listed.',
    options: [
      { value: 'complete-build', label: 'Complete staged build' },
      { value: 'parts-matching', label: 'Parts matching or advice' },
      { value: 'health-inspection', label: 'Vehicle health or inspection' },
      { value: 'track-prep', label: 'Track or motorsport preparation' },
      { value: 'other', label: 'Idea not listed' },
      { value: 'psi-advice', label: 'Not sure — I would like PSI advice' },
    ],
  },
] as const;

export const INTENDED_USE_OPTIONS = [
  { value: 'daily', label: 'Daily or street use' },
  { value: 'weekend', label: 'Weekend or spirited driving' },
  { value: 'drag', label: 'Drag use' },
  { value: 'circuit', label: 'Circuit or sprint use' },
  { value: 'show', label: 'Show or car meets' },
  { value: 'mixed', label: 'Mixed use' },
  { value: 'other', label: 'Other / not sure' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'reliability', label: 'Reliability and vehicle health' },
  { value: 'drivability', label: 'Drivability and response' },
  { value: 'power', label: 'Power and torque' },
  { value: 'handling', label: 'Handling' },
  { value: 'sound', label: 'Sound' },
  { value: 'comfort', label: 'Comfort or appearance' },
  { value: 'repair', label: 'Diagnosis or repair' },
  { value: 'balanced', label: 'Balanced staged build' },
  { value: 'psi-advice', label: 'I would like PSI guidance' },
] as const;

export const PLANNING_STAGE_OPTIONS = [
  { value: 'exploring', label: 'Exploring options' },
  { value: 'parts-owned', label: 'Parts already fitted or owned' },
  { value: 'inspection', label: 'Ready for a PSI inspection' },
  { value: 'staged', label: 'Planning stages over time' },
  { value: 'repair-first', label: 'Repair or baseline first' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;

export const TIMING_OPTIONS = [
  { value: 'soon', label: 'As soon as practical' },
  { value: 'one-three', label: 'Within 1–3 months' },
  { value: 'three-six', label: 'Within 3–6 months' },
  { value: 'flexible', label: 'Later or flexible' },
  { value: 'research', label: 'Research only' },
] as const;

export const BUDGET_OPTIONS = [
  { value: 'guidance', label: 'I need PSI guidance' },
  { value: 'essentials', label: 'Essentials first' },
  { value: 'staged', label: 'Stage the work over time' },
  { value: 'defined', label: 'I have a budget range to discuss' },
  { value: 'full-scope', label: 'Ready to discuss the full scope' },
  { value: 'prefer-not', label: 'Prefer not to say yet' },
] as const;

export type PlanBuildDraft = {
  selectedAreas: PlanAreaId[];
  areaSelections: Partial<Record<PlanAreaId, string>>;
  areaNotes: Partial<Record<PlanAreaId, string>>;
  intendedUse: string;
  priority: string;
  planningStage: string;
  timing: string;
  budget: string;
  budgetDetails: string;
  goalNotes: string;
  currentSetup: string;
};

export function createEmptyPlanBuildDraft(): PlanBuildDraft {
  return {
    selectedAreas: [],
    areaSelections: {},
    areaNotes: {},
    intendedUse: '',
    priority: '',
    planningStage: '',
    timing: '',
    budget: '',
    budgetDetails: '',
    goalNotes: '',
    currentSetup: '',
  };
}

function optionLabel(options: readonly PlanBuildOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? 'Not chosen';
}

function clean(value: string) {
  return value.replace(/\r\n?/gu, '\n').trim();
}

export function getPlanBuildDraftIssue(draft: PlanBuildDraft) {
  if (!draft.selectedAreas.length) return 'Choose at least one build area.';

  for (const areaId of draft.selectedAreas) {
    const area = PLAN_BUILD_AREAS.find((item) => item.id === areaId);
    if (!area) return 'Choose a valid build area.';

    const selection = draft.areaSelections[areaId] ?? '';
    if (!selection || !area.options.some((option) => option.value === selection)) {
      return `Choose what you would like to discuss for ${area.label}.`;
    }
    if (selection === 'other' && !clean(draft.areaNotes[areaId] ?? '')) {
      return `Add the other details for ${area.label}.`;
    }
  }

  return null;
}

export function formatPlanBuildBrief(draft: PlanBuildDraft, vehicleLabel: string) {
  const areaLines = draft.selectedAreas.map((areaId) => {
    const area = PLAN_BUILD_AREAS.find((item) => item.id === areaId);
    if (!area) return null;
    const selectionValue = draft.areaSelections[areaId] ?? '';
    const selection = optionLabel(area.options, selectionValue);
    const note = selectionValue === 'other' ? clean(draft.areaNotes[areaId] ?? '') : '';
    return `• ${area.label}: ${selection}${note ? ` — ${note}` : ''}`;
  }).filter((line): line is string => Boolean(line));

  const planningLines = [
    draft.intendedUse ? `Intended use: ${optionLabel(INTENDED_USE_OPTIONS, draft.intendedUse)}` : null,
    draft.priority ? `Main priority: ${optionLabel(PRIORITY_OPTIONS, draft.priority)}` : null,
    draft.planningStage ? `Planning stage: ${optionLabel(PLANNING_STAGE_OPTIONS, draft.planningStage)}` : null,
    draft.timing ? `Timing: ${optionLabel(TIMING_OPTIONS, draft.timing)}` : null,
    draft.budget ? `Budget direction: ${optionLabel(BUDGET_OPTIONS, draft.budget)}` : null,
    draft.budget === 'defined' && clean(draft.budgetDetails) ? `Budget note: ${clean(draft.budgetDetails)}` : null,
    clean(draft.goalNotes) ? `Goal or concern: ${clean(draft.goalNotes)}` : null,
    clean(draft.currentSetup) ? `Current setup or parts: ${clean(draft.currentSetup)}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    'PSI PLAN & BUILD BRIEF',
    `Vehicle: ${vehicleLabel}`,
    '',
    'Areas to discuss:',
    ...(areaLines.length ? areaLines : ['• No build area chosen yet']),
    ...(planningLines.length ? ['', ...planningLines] : []),
    '',
    'Please review this brief with me. I understand PSI must separately confirm suitability, scope, pricing, availability and timing.',
  ].join('\n');
}

function replaceUnpairedSurrogates(value: string) {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      } else {
        result += '\uFFFD';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      result += '\uFFFD';
    } else {
      result += value[index];
    }
  }

  return result;
}

const CONTACT_TRUNCATION_SUFFIX = '\n\n[Brief shortened for this message]';

export function limitPlanBriefForContact(value: string, maximum: number) {
  const safeValue = replaceUnpairedSurrogates(value);
  const codePoints = Array.from(safeValue);
  if (codePoints.length <= maximum) return safeValue;

  const suffix = Array.from(CONTACT_TRUNCATION_SUFFIX);
  if (maximum <= suffix.length) return suffix.slice(0, maximum).join('');

  return `${codePoints.slice(0, maximum - suffix.length).join('').trimEnd()}${CONTACT_TRUNCATION_SUFFIX}`;
}

export function buildPlanEmailUrl(brief: string) {
  const subject = 'PSI Plan & Build brief';
  const body = limitPlanBriefForContact(brief, 4800);
  return `mailto:info@psiperformance.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildPlanSmsUrl(brief: string, platform: 'android' | 'ios' | 'web') {
  const body = limitPlanBriefForContact(brief, 1400);
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:+61433431781${separator}body=${encodeURIComponent(body)}`;
}

export function resolvePlanSmsPlatform(platform: string, userAgent = ''): 'android' | 'ios' | 'web' {
  if (platform === 'ios' || platform === 'android') return platform;
  if (/iPad|iPhone|iPod|Macintosh.*Mobile/iu.test(userAgent)) return 'ios';
  return 'web';
}

export const PLAN_SMS_RECIPIENT_URL = 'sms:+61433431781';
