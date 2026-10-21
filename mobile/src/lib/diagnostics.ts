export const DIAGNOSTICS_DESCRIPTION = 'Something not right? Tell us what’s happening so we can assess the issue and discuss the next steps.';

export const DIAGNOSTICS_HELP = [
  { value: 'diagnosis', label: 'Find the cause of a problem' },
  { value: 'known_repair', label: 'Repair a known issue' },
  { value: 'both', label: 'Diagnosis and repairs' },
  { value: 'unsure', label: 'I’m not sure' },
] as const;
export const DIAGNOSTICS_DRIVING = [
  { value: 'normal', label: 'Currently drives normally' },
  { value: 'issue', label: 'Drives, but has an issue' },
  { value: 'not_drivable', label: 'Not drivable or arriving by tow' },
  { value: 'unsure', label: 'I’m not sure' },
] as const;
export const DIAGNOSTICS_WARNINGS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'I’m not sure' },
] as const;

export type DiagnosticsDetails = {
  helpNeeded: '' | typeof DIAGNOSTICS_HELP[number]['value'];
  startedWhen: string;
  occursWhen: string;
  drivingStatus: '' | typeof DIAGNOSTICS_DRIVING[number]['value'];
  warningLights: '' | typeof DIAGNOSTICS_WARNINGS[number]['value'];
  warningDetails: string;
  odometerKm: string;
  previousDiagnosis: string;
  recentWork: string;
};
export const EMPTY_DIAGNOSTICS_DETAILS: DiagnosticsDetails = {
  helpNeeded: '', startedWhen: '', occursWhen: '', drivingStatus: '', warningLights: '',
  warningDetails: '', odometerKm: '', previousDiagnosis: '', recentWork: '',
};

export function sanitiseDiagnosticsDetails(raw: unknown): DiagnosticsDetails {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const result = Object.fromEntries(Object.keys(EMPTY_DIAGNOSTICS_DETAILS).map(key => [key,
    typeof source[key] === 'string' ? source[key].trim().slice(0, key === 'odometerKm' ? 7 : 600) : '',
  ])) as DiagnosticsDetails;
  if (!DIAGNOSTICS_HELP.some(option => option.value === result.helpNeeded)) result.helpNeeded = '';
  if (!DIAGNOSTICS_DRIVING.some(option => option.value === result.drivingStatus)) result.drivingStatus = '';
  if (!DIAGNOSTICS_WARNINGS.some(option => option.value === result.warningLights)) result.warningLights = '';
  if (result.warningLights !== 'yes') result.warningDetails = '';
  if (result.helpNeeded === 'known_repair') { result.startedWhen = ''; result.occursWhen = ''; }
  return result;
}

export function validateDiagnosticsDetails(raw: DiagnosticsDetails) {
  const errors: Partial<Record<keyof DiagnosticsDetails, string>> = {};
  if (!DIAGNOSTICS_HELP.some(option => option.value === raw.helpNeeded)) errors.helpNeeded = 'Choose what you need help with.';
  if (raw.helpNeeded !== 'known_repair') {
    if (!raw.startedWhen.trim()) errors.startedWhen = 'Tell PSI when it started, or enter Not sure.';
    if (!raw.occursWhen.trim()) errors.occursWhen = 'Tell PSI when it happens, or enter Not sure.';
  }
  if (!DIAGNOSTICS_DRIVING.some(option => option.value === raw.drivingStatus)) errors.drivingStatus = 'Choose the current driving status.';
  if (!DIAGNOSTICS_WARNINGS.some(option => option.value === raw.warningLights)) errors.warningLights = 'Tell PSI whether any warning lights or messages appear.';
  if (raw.warningLights === 'yes' && !raw.warningDetails.trim()) errors.warningDetails = 'Describe the warning light or message.';
  if (raw.odometerKm && !/^\d{1,7}$/u.test(raw.odometerKm)) errors.odometerKm = 'Enter whole kilometres, or leave blank.';
  for (const [key, value] of Object.entries(raw)) {
    if (value.length > (key === 'odometerKm' ? 7 : 600)) errors[key as keyof DiagnosticsDetails] = 'Use 600 characters or fewer.';
  }
  return errors;
}

export function diagnosticsSummary(raw: unknown): { label: string; value: string }[] {
  const details = sanitiseDiagnosticsDetails(raw);
  return [
    { label: 'Help needed', value: DIAGNOSTICS_HELP.find(option => option.value === details.helpNeeded)?.label ?? '' },
    { label: 'When it started', value: details.startedWhen },
    { label: 'When it happens', value: details.occursWhen },
    { label: 'Driving status', value: DIAGNOSTICS_DRIVING.find(option => option.value === details.drivingStatus)?.label ?? '' },
    { label: 'Warning lights or messages', value: DIAGNOSTICS_WARNINGS.find(option => option.value === details.warningLights)?.label ?? '' },
    { label: 'Warning details', value: details.warningDetails },
    { label: 'Current kilometres', value: details.odometerKm ? `${Number(details.odometerKm).toLocaleString('en-AU')} km` : '' },
    { label: 'Previous diagnosis or fault codes', value: details.previousDiagnosis },
    { label: 'Recent work or modifications', value: details.recentWork },
  ].filter(item => item.value);
}
