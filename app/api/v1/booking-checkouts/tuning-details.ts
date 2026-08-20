export const ENGINE_STATES = ["stock", "modified"] as const;
export const TRANSMISSION_TYPES = ["automatic", "manual"] as const;
export const TRANSMISSION_SETUPS = [
  "stock",
  "converter",
  "trans_cooler",
  "converter_and_cooler",
  "upgraded_clutch",
  "built_transmission",
  "other",
] as const;
export const DIFFERENTIAL_TYPES = ["stock", "truetrac", "wavetrac", "other"] as const;
export const COMPONENT_STATES = ["stock", "upgraded", "unknown"] as const;
export const FUEL_TYPES = [
  "98_ron",
  "e85",
  "flex_fuel",
  "race_fuel",
  "other",
] as const;
export const INTAKE_TYPES = ["stock", "upgraded"] as const;
export const PREVIOUS_TUNE_STATES = ["no", "yes", "unknown"] as const;
export const EXHAUST_TYPES = ["stock", "cat_back", "full_system", "custom"] as const;
export const EXHAUST_SIZES = [
  "stock",
  "2_5_inch",
  "3_inch",
  "3_5_inch",
  "4_inch",
  "other",
] as const;
export const YES_NO_UNKNOWN = ["no", "yes", "unknown"] as const;

export interface TuningDetails {
  engineState: (typeof ENGINE_STATES)[number];
  engineModifications: string;
  transmissionType: (typeof TRANSMISSION_TYPES)[number];
  transmissionSetup: (typeof TRANSMISSION_SETUPS)[number];
  transmissionDetails: string;
  differentialType: (typeof DIFFERENTIAL_TYPES)[number];
  differentialGearRatio: string;
  differentialDetails: string;
  fuelPumpType: (typeof COMPONENT_STATES)[number];
  fuelPumpDetails: string;
  injectorType: (typeof COMPONENT_STATES)[number];
  injectorDetails: string;
  fuelType: (typeof FUEL_TYPES)[number];
  fuelTypeDetails: string;
  intakeType: (typeof INTAKE_TYPES)[number];
  intakeDetails: string;
  previouslyTuned: (typeof PREVIOUS_TUNE_STATES)[number];
  previousTuner: string;
  exhaustType: (typeof EXHAUST_TYPES)[number];
  exhaustSize: (typeof EXHAUST_SIZES)[number];
  varexControlled: (typeof YES_NO_UNKNOWN)[number];
  exhaustDetails: string;
  camshaftType: (typeof COMPONENT_STATES)[number];
  camshaftDetails: string;
}

export type PartialTuningDetails = Partial<TuningDetails>;

const DETAIL_LIMITS = {
  engineModifications: 2_000,
  transmissionDetails: 1_000,
  differentialGearRatio: 40,
  differentialDetails: 1_000,
  fuelPumpDetails: 500,
  injectorDetails: 500,
  fuelTypeDetails: 300,
  intakeDetails: 1_000,
  previousTuner: 200,
  exhaustDetails: 2_000,
  camshaftDetails: 2_000,
} as const;

type TuningDetailsKey = keyof TuningDetails;
export type TuningDetailsFieldName =
  | "tuningDetails"
  | `tuningDetails.${TuningDetailsKey}`;
export type TuningDetailsErrors = Partial<Record<TuningDetailsFieldName, string>>;

const TUNING_DETAIL_KEYS = new Set<TuningDetailsKey>([
  "engineState",
  "engineModifications",
  "transmissionType",
  "transmissionSetup",
  "transmissionDetails",
  "differentialType",
  "differentialGearRatio",
  "differentialDetails",
  "fuelPumpType",
  "fuelPumpDetails",
  "injectorType",
  "injectorDetails",
  "fuelType",
  "fuelTypeDetails",
  "intakeType",
  "intakeDetails",
  "previouslyTuned",
  "previousTuner",
  "exhaustType",
  "exhaustSize",
  "varexControlled",
  "exhaustDetails",
  "camshaftType",
  "camshaftDetails",
]);

function fieldName(field: TuningDetailsKey): TuningDetailsFieldName {
  return `tuningDetails.${field}`;
}

function hasUnsupportedControlCharacters(value: string, allowNewlines: boolean) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      allowNewlines &&
      (codePoint === 9 || codePoint === 10 || codePoint === 13)
    ) {
      return false;
    }
    return codePoint < 32 || (codePoint >= 127 && codePoint <= 159);
  });
}

function readDetailText(
  body: Record<string, unknown>,
  field: keyof typeof DETAIL_LIMITS,
  errors: TuningDetailsErrors,
  options: { required?: boolean; allowNewlines?: boolean } = {},
) {
  const errorField = fieldName(field);
  const rawValue = body[field];
  if (rawValue === undefined || rawValue === null) {
    if (options.required) errors[errorField] = "This field is required.";
    return "";
  }
  if (typeof rawValue !== "string") {
    errors[errorField] = "Must be text.";
    return "";
  }

  const value = rawValue.trim();
  if (options.required && value.length === 0) {
    errors[errorField] = "This field is required.";
  } else if (value.length > DETAIL_LIMITS[field]) {
    errors[errorField] = `Must be ${DETAIL_LIMITS[field]} characters or fewer.`;
  } else if (
    hasUnsupportedControlCharacters(value, options.allowNewlines === true)
  ) {
    errors[errorField] = "Contains unsupported control characters.";
  }
  return value;
}

function readEnum<const T extends readonly string[]>(
  body: Record<string, unknown>,
  field: TuningDetailsKey,
  allowed: T,
  errors: TuningDetailsErrors,
): T[number] | "" {
  const errorField = fieldName(field);
  const rawValue = body[field];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    errors[errorField] = "Choose an option.";
    return "";
  }

  const value = rawValue.trim();
  if (
    value.length > 40 ||
    hasUnsupportedControlCharacters(value, false) ||
    !(allowed as readonly string[]).includes(value)
  ) {
    errors[errorField] = "Choose a valid option.";
    return "";
  }
  return value as T[number];
}

function requireConditionalDetail(
  value: string,
  field: keyof typeof DETAIL_LIMITS,
  errors: TuningDetailsErrors,
  message: string,
) {
  if (value.length === 0 && !errors[fieldName(field)]) {
    errors[fieldName(field)] = message;
  }
}

export function validateTuningDetails(value: unknown):
  | { details: TuningDetails; errors: null }
  | { details: null; errors: TuningDetailsErrors } {
  const errors: TuningDetailsErrors = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      details: null,
      errors: { tuningDetails: "Complete the dyno tuning questionnaire." },
    };
  }

  const body = value as Record<string, unknown>;
  const unsupportedFields = Object.keys(body).filter(
    (key) => !TUNING_DETAIL_KEYS.has(key as TuningDetailsKey),
  );
  if (unsupportedFields.length > 0) {
    errors.tuningDetails = "Contains unsupported questionnaire fields.";
  }

  const engineState = readEnum(body, "engineState", ENGINE_STATES, errors);
  const engineModifications = readDetailText(
    body,
    "engineModifications",
    errors,
    { allowNewlines: true },
  );
  const transmissionType = readEnum(
    body,
    "transmissionType",
    TRANSMISSION_TYPES,
    errors,
  );
  const transmissionSetup = readEnum(
    body,
    "transmissionSetup",
    TRANSMISSION_SETUPS,
    errors,
  );
  const transmissionDetails = readDetailText(
    body,
    "transmissionDetails",
    errors,
    { allowNewlines: true },
  );
  const differentialType = readEnum(
    body,
    "differentialType",
    DIFFERENTIAL_TYPES,
    errors,
  );
  const differentialGearRatio = readDetailText(
    body,
    "differentialGearRatio",
    errors,
    { required: true },
  );
  const differentialDetails = readDetailText(
    body,
    "differentialDetails",
    errors,
    { allowNewlines: true },
  );
  const fuelPumpType = readEnum(body, "fuelPumpType", COMPONENT_STATES, errors);
  const fuelPumpDetails = readDetailText(body, "fuelPumpDetails", errors, {
    allowNewlines: true,
  });
  const injectorType = readEnum(body, "injectorType", COMPONENT_STATES, errors);
  const injectorDetails = readDetailText(body, "injectorDetails", errors, {
    allowNewlines: true,
  });
  const fuelType = readEnum(body, "fuelType", FUEL_TYPES, errors);
  const fuelTypeDetails = readDetailText(body, "fuelTypeDetails", errors, {
    allowNewlines: true,
  });
  const intakeType = readEnum(body, "intakeType", INTAKE_TYPES, errors);
  const intakeDetails = readDetailText(body, "intakeDetails", errors, {
    allowNewlines: true,
  });
  const previouslyTuned = readEnum(
    body,
    "previouslyTuned",
    PREVIOUS_TUNE_STATES,
    errors,
  );
  const previousTuner = readDetailText(body, "previousTuner", errors);
  const exhaustType = readEnum(body, "exhaustType", EXHAUST_TYPES, errors);
  const exhaustSize = readEnum(body, "exhaustSize", EXHAUST_SIZES, errors);
  const varexControlled = readEnum(
    body,
    "varexControlled",
    YES_NO_UNKNOWN,
    errors,
  );
  const exhaustDetails = readDetailText(body, "exhaustDetails", errors, {
    allowNewlines: true,
  });
  const camshaftType = readEnum(body, "camshaftType", COMPONENT_STATES, errors);
  const camshaftDetails = readDetailText(body, "camshaftDetails", errors, {
    allowNewlines: true,
  });

  if (engineState === "modified") {
    requireConditionalDetail(
      engineModifications,
      "engineModifications",
      errors,
      "List the engine modifications.",
    );
  }
  if (transmissionSetup && transmissionSetup !== "stock") {
    requireConditionalDetail(
      transmissionDetails,
      "transmissionDetails",
      errors,
      "Describe the transmission upgrade.",
    );
  }
  if (
    transmissionType === "manual" &&
    ["converter", "trans_cooler", "converter_and_cooler"].includes(
      transmissionSetup,
    )
  ) {
    errors["tuningDetails.transmissionSetup"] =
      "Converter and transmission-cooler options apply to automatic transmissions.";
  }
  if (
    transmissionType === "automatic" &&
    transmissionSetup === "upgraded_clutch"
  ) {
    errors["tuningDetails.transmissionSetup"] =
      "An upgraded clutch applies to a manual transmission.";
  }
  if (differentialType === "other") {
    requireConditionalDetail(
      differentialDetails,
      "differentialDetails",
      errors,
      "Describe the differential setup.",
    );
  }
  if (fuelPumpType === "upgraded") {
    requireConditionalDetail(
      fuelPumpDetails,
      "fuelPumpDetails",
      errors,
      "Enter the upgraded fuel pump.",
    );
  }
  if (injectorType === "upgraded") {
    requireConditionalDetail(
      injectorDetails,
      "injectorDetails",
      errors,
      "Enter the upgraded injectors.",
    );
  }
  if (fuelType === "other") {
    requireConditionalDetail(
      fuelTypeDetails,
      "fuelTypeDetails",
      errors,
      "Enter the fuel type.",
    );
  }
  if (intakeType === "upgraded") {
    requireConditionalDetail(
      intakeDetails,
      "intakeDetails",
      errors,
      "Describe the upgraded intake.",
    );
  }
  if (previouslyTuned === "yes") {
    requireConditionalDetail(
      previousTuner,
      "previousTuner",
      errors,
      "Enter who previously tuned the vehicle.",
    );
  }
  if (exhaustType && exhaustType !== "stock") {
    requireConditionalDetail(
      exhaustDetails,
      "exhaustDetails",
      errors,
      "Describe the exhaust modifications.",
    );
  }
  if (camshaftType === "upgraded") {
    requireConditionalDetail(
      camshaftDetails,
      "camshaftDetails",
      errors,
      "Enter the camshaft code or specifications.",
    );
  }

  if (Object.keys(errors).length > 0) return { details: null, errors };

  return {
    details: {
      engineState: engineState as TuningDetails["engineState"],
      engineModifications,
      transmissionType: transmissionType as TuningDetails["transmissionType"],
      transmissionSetup: transmissionSetup as TuningDetails["transmissionSetup"],
      transmissionDetails,
      differentialType: differentialType as TuningDetails["differentialType"],
      differentialGearRatio,
      differentialDetails,
      fuelPumpType: fuelPumpType as TuningDetails["fuelPumpType"],
      fuelPumpDetails,
      injectorType: injectorType as TuningDetails["injectorType"],
      injectorDetails,
      fuelType: fuelType as TuningDetails["fuelType"],
      fuelTypeDetails,
      intakeType: intakeType as TuningDetails["intakeType"],
      intakeDetails,
      previouslyTuned: previouslyTuned as TuningDetails["previouslyTuned"],
      previousTuner,
      exhaustType: exhaustType as TuningDetails["exhaustType"],
      exhaustSize: exhaustSize as TuningDetails["exhaustSize"],
      varexControlled: varexControlled as TuningDetails["varexControlled"],
      exhaustDetails,
      camshaftType: camshaftType as TuningDetails["camshaftType"],
      camshaftDetails,
    },
    errors: null,
  };
}

/**
 * PSI-inspection requests may contain only what the customer knows. Supplied
 * values still use the same allow-lists, text limits and control-character
 * protections as the complete questionnaire.
 */
export function validatePartialTuningDetails(value: unknown):
  | { details: PartialTuningDetails | null; errors: null }
  | { details: null; errors: TuningDetailsErrors } {
  if (value === undefined || value === null) {
    return { details: null, errors: null };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      details: null,
      errors: { tuningDetails: "Enter the setup details you know, or leave them blank for PSI to inspect." },
    };
  }

  const body = value as Record<string, unknown>;
  const errors: TuningDetailsErrors = {};
  const details: Record<string, unknown> = {};
  const unsupportedFields = Object.keys(body).filter(
    (key) => !TUNING_DETAIL_KEYS.has(key as TuningDetailsKey),
  );
  if (unsupportedFields.length > 0) {
    errors.tuningDetails = "Contains unsupported questionnaire fields.";
  }

  const enumFields = {
    engineState: ENGINE_STATES,
    transmissionType: TRANSMISSION_TYPES,
    transmissionSetup: TRANSMISSION_SETUPS,
    differentialType: DIFFERENTIAL_TYPES,
    fuelPumpType: COMPONENT_STATES,
    injectorType: COMPONENT_STATES,
    fuelType: FUEL_TYPES,
    intakeType: INTAKE_TYPES,
    previouslyTuned: PREVIOUS_TUNE_STATES,
    exhaustType: EXHAUST_TYPES,
    exhaustSize: EXHAUST_SIZES,
    varexControlled: YES_NO_UNKNOWN,
    camshaftType: COMPONENT_STATES,
  } as const;
  for (const [field, allowed] of Object.entries(enumFields)) {
    if (!Object.hasOwn(body, field)) continue;
    const raw = body[field];
    if (
      typeof raw !== "string" ||
      raw.trim().length === 0 ||
      raw.length > 40 ||
      hasUnsupportedControlCharacters(raw, false) ||
      !(allowed as readonly string[]).includes(raw.trim())
    ) {
      errors[fieldName(field as TuningDetailsKey)] = "Choose a valid option.";
    } else {
      details[field] = raw.trim();
    }
  }

  for (const field of Object.keys(DETAIL_LIMITS) as (keyof typeof DETAIL_LIMITS)[]) {
    if (!Object.hasOwn(body, field)) continue;
    const parsed = readDetailText(body, field, errors, { allowNewlines: true });
    if (!errors[fieldName(field)]) details[field] = parsed;
  }

  if (
    details.transmissionType === "manual" &&
    ["converter", "trans_cooler", "converter_and_cooler"].includes(
      String(details.transmissionSetup ?? ""),
    )
  ) {
    errors["tuningDetails.transmissionSetup"] =
      "Converter and transmission-cooler options apply to automatic transmissions.";
  }
  if (
    details.transmissionType === "automatic" &&
    details.transmissionSetup === "upgraded_clutch"
  ) {
    errors["tuningDetails.transmissionSetup"] =
      "An upgraded clutch applies to a manual transmission.";
  }

  if (Object.keys(errors).length > 0) return { details: null, errors };
  return {
    details: Object.keys(details).length > 0 ? (details as PartialTuningDetails) : null,
    errors: null,
  };
}
