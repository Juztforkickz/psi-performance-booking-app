export type PreviewVehicle = {
  id: string;
  isPrimary: boolean;
  lastVisit: string | null;
  latestPsiOdometerKm?: number | null;
  make: string;
  model: string;
  nextDue: string | null;
  nextPsiCheckInOdometerKm?: number | null;
  odometerKm: number | null;
  registration: string;
  vinLastFour: string | null;
  year: number;
};

export type DynoMeasurement = {
  unit: 'kW_at_hubs' | 'Nm_at_hubs';
  value: number;
};

/**
 * Dyno figures are workshop records. Customers may view them, but only PSI can
 * create or replace a verified result after a real hub-dyno session.
 */
export type PsiVerifiedDynoResult = {
  ambientTemperatureC: number;
  customerAccess: 'read_only';
  fuel: string;
  id: string;
  managedBy: 'psi';
  peakPower: DynoMeasurement & { unit: 'kW_at_hubs' };
  peakTorque: DynoMeasurement & { unit: 'Nm_at_hubs' };
  recordedAt: string;
  runType: 'hub_dyno';
  status: 'psi_verified';
  summary: string;
  vehicleId: string;
};

export type BuildPlanStage = {
  id: string;
  note: string;
  status: 'completed' | 'current' | 'planned';
  title: string;
};

export type VehicleBuildPlan = {
  id: string;
  objective: string;
  stages: readonly BuildPlanStage[];
  status: 'planning_with_psi';
  title: string;
  updatedAt: string;
  vehicleId: string;
};

export type PreviewBooking = {
  depositStatus: 'not_requested' | 'verified';
  id: string;
  reference: string;
  scheduledFor: string | null;
  service: 'Dyno Tuning' | 'Service & Report';
  status: 'awaiting_psi_review' | 'completed' | 'confirmed';
  vehicleId: string;
};

export type PreviewAlert = {
  id: string;
  message: string;
  read: boolean;
  title: string;
  type: 'booking' | 'reminder' | 'vehicle';
};

export type CustomerPreview = {
  alerts: readonly PreviewAlert[];
  bookings: readonly PreviewBooking[];
  buildPlans: readonly VehicleBuildPlan[];
  dynoResults: readonly PsiVerifiedDynoResult[];
  mode: 'synthetic_preview';
  notice: string;
  profile: {
    email: string;
    firstName: string;
    mobile: string;
  };
  selectedVehicleId: string;
  vehicles: readonly PreviewVehicle[];
};

export const CUSTOMER_PREVIEW = {
  mode: 'synthetic_preview',
  notice: 'Example account only. No real customer, vehicle, booking or dyno data is loaded or saved.',
  profile: {
    firstName: 'Jordan',
    email: 'jordan@example.com',
    mobile: '0000 000 000',
  },
  selectedVehicleId: 'vehicle-vf-ss',
  vehicles: [
    {
      id: 'vehicle-vf-ss',
      isPrimary: true,
      year: 2017,
      make: 'Holden',
      model: 'Commodore VF SS',
      registration: 'DEMO-01',
      vinLastFour: '0001',
      odometerKm: 84210,
      lastVisit: '2026-05-14',
      nextDue: '2026-11-14',
    },
    {
      id: 'vehicle-mustang-gt',
      isPrimary: false,
      year: 2015,
      make: 'Ford',
      model: 'Mustang GT',
      registration: 'DEMO-02',
      vinLastFour: '0002',
      odometerKm: 61780,
      lastVisit: '2025-11-07',
      nextDue: null,
    },
  ],
  dynoResults: [
    {
      id: 'dyno-vf-2026-05-14',
      vehicleId: 'vehicle-vf-ss',
      recordedAt: '2026-05-14',
      runType: 'hub_dyno',
      status: 'psi_verified',
      managedBy: 'psi',
      customerAccess: 'read_only',
      fuel: '98 RON',
      ambientTemperatureC: 21,
      peakPower: { value: 318, unit: 'kW_at_hubs' },
      peakTorque: { value: 612, unit: 'Nm_at_hubs' },
      summary: 'Synthetic example of the latest PSI-verified hub-dyno result. PSI updates this record after a completed dyno session.',
    },
  ],
  buildPlans: [
    {
      id: 'build-plan-vf-street',
      vehicleId: 'vehicle-vf-ss',
      title: 'Responsive street package',
      objective: 'Protect reliability first, then develop a responsive street setup with PSI in measured stages.',
      status: 'planning_with_psi',
      updatedAt: '2026-08-18',
      stages: [
        {
          id: 'build-stage-health',
          title: 'Health check & baseline',
          note: 'Workshop inspection and baseline hub-dyno record reviewed with PSI.',
          status: 'completed',
        },
        {
          id: 'build-stage-support',
          title: 'Supporting systems',
          note: 'Confirm cooling, fuel delivery and driveline suitability before parts are selected.',
          status: 'current',
        },
        {
          id: 'build-stage-calibration',
          title: 'Parts, fitment & calibration',
          note: 'Final scope remains subject to PSI inspection, advice and customer approval.',
          status: 'planned',
        },
      ],
    },
  ],
  bookings: [
    {
      id: 'booking-example-002',
      reference: 'PSI-EXAMPLE-002',
      vehicleId: 'vehicle-vf-ss',
      service: 'Dyno Tuning',
      scheduledFor: '2026-09-16T09:00:00+10:00',
      status: 'confirmed',
      depositStatus: 'verified',
    },
    {
      id: 'booking-example-001',
      reference: 'PSI-EXAMPLE-001',
      vehicleId: 'vehicle-vf-ss',
      service: 'Service & Report',
      scheduledFor: '2026-02-18T08:30:00+11:00',
      status: 'completed',
      depositStatus: 'verified',
    },
    {
      id: 'booking-example-003',
      reference: 'PSI-EXAMPLE-003',
      vehicleId: 'vehicle-mustang-gt',
      service: 'Service & Report',
      scheduledFor: null,
      status: 'awaiting_psi_review',
      depositStatus: 'not_requested',
    },
  ],
  alerts: [
    {
      id: 'alert-next-visit',
      type: 'booking',
      title: 'Next visit confirmed',
      message: 'Dyno Tuning · Wed 16 Sep 2026 at 9:00 am. This is synthetic preview information.',
      read: false,
    },
    {
      id: 'alert-build-plan',
      type: 'vehicle',
      title: 'Build plan updated',
      message: 'Supporting systems are the current planning stage for the VF SS example vehicle.',
      read: false,
    },
    {
      id: 'alert-service-reminder',
      type: 'reminder',
      title: 'Service check-in',
      message: 'The example VF SS is due for its next service check-in in November 2026.',
      read: true,
    },
  ],
} as const satisfies CustomerPreview;

export function getPreviewVehicle(vehicleId: string) {
  return CUSTOMER_PREVIEW.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

export function getLatestVerifiedDynoResult(vehicleId: string) {
  return CUSTOMER_PREVIEW.dynoResults
    .filter((result) => result.vehicleId === vehicleId && result.status === 'psi_verified')
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
}
