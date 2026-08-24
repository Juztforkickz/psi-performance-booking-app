export type PlanBuilderOption = { value: string; label: string };

export type PlanAreaId =
  | "engine"
  | "suspension"
  | "exhaust"
  | "intake"
  | "repairs"
  | "interior"
  | "programming"
  | "other";

export type PlanArea = {
  id: PlanAreaId;
  label: string;
  detail: string;
  options: readonly PlanBuilderOption[];
};

const adviceOptions = [
  { value: "psi-advice", label: "Not sure — I would like PSI advice" },
  { value: "other", label: "Other / not listed" },
] as const;

export const PLAN_BUILD_AREAS: readonly PlanArea[] = [
  {
    id: "engine", label: "Engine", detail: "Health, supporting systems and staged upgrades.",
    options: [
      { value: "health", label: "Health check or diagnosis" },
      { value: "na-upgrade", label: "Naturally aspirated upgrade" },
      { value: "cam-valvetrain", label: "Camshaft or valvetrain" },
      { value: "forced-induction", label: "Turbo or supercharger" },
      { value: "fuel-ignition", label: "Fuel or ignition support" },
      { value: "cooling", label: "Cooling, oiling or reliability" },
      { value: "rebuild", label: "Engine build or rebuild" },
      ...adviceOptions,
    ],
  },
  {
    id: "suspension", label: "Suspension", detail: "Ride height, control and handling direction.",
    options: [
      { value: "street-handling", label: "Street handling package" },
      { value: "springs-dampers", label: "Springs or dampers" },
      { value: "coilovers", label: "Coilovers or ride height" },
      { value: "bushes-mounts", label: "Bushes or mounts" },
      { value: "sway-geometry", label: "Sway bars or geometry" },
      { value: "track-setup", label: "Track setup" },
      ...adviceOptions,
    ],
  },
  {
    id: "exhaust", label: "Exhaust", detail: "Flow, sound, fitment and repair concerns.",
    options: [
      { value: "cat-back", label: "Cat-back system" },
      { value: "headers", label: "Headers or extractors" },
      { value: "downpipes", label: "Downpipes" },
      { value: "high-flow-cats", label: "High-flow catalytic converters" },
      { value: "custom-system", label: "Full or custom system" },
      { value: "valved", label: "Valved or Varex system" },
      { value: "repair", label: "Repair, noise or fitment concern" },
      ...adviceOptions,
    ],
  },
  {
    id: "intake", label: "Intake", detail: "Airflow, charge cooling and supporting hardware.",
    options: [
      { value: "filter", label: "Filter or panel upgrade" },
      { value: "cold-air", label: "Cold-air or OTR intake" },
      { value: "manifold", label: "Intake manifold or throttle body" },
      { value: "intercooler", label: "Intercooler or charge piping" },
      { value: "forced-inlet", label: "Forced-induction inlet" },
      ...adviceOptions,
    ],
  },
  {
    id: "repairs", label: "Repairs", detail: "Fault finding, inspection and mechanical repairs.",
    options: [
      { value: "scan", label: "Scan or diagnostics" },
      { value: "engine-mechanical", label: "Engine mechanical concern" },
      { value: "cooling", label: "Cooling or overheating concern" },
      { value: "driveline", label: "Driveline, clutch or transmission" },
      { value: "brakes", label: "Brakes" },
      { value: "steering", label: "Steering or suspension repair" },
      { value: "electrical", label: "Electrical fault or warning light" },
      { value: "inspection", label: "General inspection" },
      ...adviceOptions,
    ],
  },
  {
    id: "interior", label: "Interior", detail: "Driver controls, displays, seating and fitment.",
    options: [
      { value: "gauges", label: "Gauges or displays" },
      { value: "controls", label: "Switches or controls" },
      { value: "seats", label: "Seats or mounting" },
      { value: "trim", label: "Trim or fitment" },
      { value: "heat-noise", label: "Heat or noise management" },
      { value: "motorsport", label: "Motorsport interior discussion" },
      ...adviceOptions,
    ],
  },
  {
    id: "programming", label: "Programming", detail: "Calibration, diagnostics and supported configuration.",
    options: [
      { value: "engine-ecu", label: "Engine ECU calibration" },
      { value: "transmission", label: "Transmission or TCU calibration" },
      { value: "diagnostics-coding", label: "Diagnostics or supported coding" },
      { value: "flex-fuel", label: "Flex-fuel or fuel setup" },
      { value: "features", label: "Supported feature configuration" },
      { value: "post-modification", label: "Post-modification calibration" },
      ...adviceOptions,
    ],
  },
  {
    id: "other", label: "Other", detail: "A complete build, unusual concern or idea not listed.",
    options: [
      { value: "complete-build", label: "Complete staged build" },
      { value: "parts-matching", label: "Parts matching or advice" },
      { value: "health-inspection", label: "Vehicle health or inspection" },
      { value: "track-prep", label: "Track or motorsport preparation" },
      { value: "other", label: "Idea not listed" },
      { value: "psi-advice", label: "Not sure — I would like PSI advice" },
    ],
  },
] as const;

export const INTENDED_USE_OPTIONS = [
  { value: "daily", label: "Daily or street use" }, { value: "weekend", label: "Weekend or spirited driving" },
  { value: "drag", label: "Drag use" }, { value: "circuit", label: "Circuit or sprint use" },
  { value: "show", label: "Show or car meets" }, { value: "mixed", label: "Mixed use" },
  { value: "other", label: "Other / not sure" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "reliability", label: "Reliability and vehicle health" }, { value: "drivability", label: "Drivability and response" },
  { value: "power", label: "Power and torque" }, { value: "handling", label: "Handling" },
  { value: "sound", label: "Sound" }, { value: "comfort", label: "Comfort or appearance" },
  { value: "repair", label: "Diagnosis or repair" }, { value: "balanced", label: "Balanced staged build" },
  { value: "psi-advice", label: "I would like PSI guidance" },
] as const;

export const PLANNING_STAGE_OPTIONS = [
  { value: "exploring", label: "Exploring options" }, { value: "parts-owned", label: "Parts already fitted or owned" },
  { value: "inspection", label: "Ready for a PSI inspection" }, { value: "staged", label: "Planning stages over time" },
  { value: "repair-first", label: "Repair or baseline first" }, { value: "not-sure", label: "Not sure yet" },
] as const;

export const TIMING_OPTIONS = [
  { value: "soon", label: "As soon as practical" }, { value: "one-three", label: "Within 1–3 months" },
  { value: "three-six", label: "Within 3–6 months" }, { value: "flexible", label: "Later or flexible" },
  { value: "research", label: "Research only" },
] as const;

export const BUDGET_OPTIONS = [
  { value: "guidance", label: "I need PSI guidance" }, { value: "essentials", label: "Essentials first" },
  { value: "staged", label: "Stage the work over time" }, { value: "defined", label: "I have a budget range to discuss" },
  { value: "full-scope", label: "Ready to discuss the full scope" }, { value: "prefer-not", label: "Prefer not to say yet" },
] as const;
