import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CUSTOMER_PREVIEW, type PreviewVehicle } from '@/lib/customer-preview';
import {
  type LocalVehiclePhoto,
  releaseLocalVehiclePhoto,
} from '@/lib/local-vehicle-photo';

export type TemporaryVehiclePhoto = LocalVehiclePhoto;

export type VehicleMaintenancePreview = {
  customerLastServiceDate: string | null;
  customerNextCheckInDate: string | null;
  odometerKm: number | null;
  updatedLocally: boolean;
};

export type EphemeralAccountPreview = {
  profile: {
    email: string;
    firstName: string;
    lastName: string;
    mobile: string;
  };
  vehicle: PreviewVehicle;
};

type StageAccountInput = {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  photo: TemporaryVehiclePhoto | null;
  registration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
};

type CustomerPreviewContextValue = {
  clearPendingBookingVehicle: () => void;
  ephemeralAccount: EphemeralAccountPreview | null;
  pendingBookingVehicle: PreviewVehicle | null;
  prepareBookingVehicle: (vehicleId: string) => void;
  prepareBookingVehicleRecord: (vehicle: PreviewVehicle) => void;
  selectedVehicleId: string;
  selectVehicle: (vehicleId: string) => void;
  setVehiclePhoto: (vehicleId: string, photo: TemporaryVehiclePhoto | null) => void;
  stageAccountPreview: (input: StageAccountInput) => void;
  updateVehicleMaintenancePreview: (
    vehicleId: string,
    maintenance: Omit<VehicleMaintenancePreview, 'updatedLocally'>,
  ) => void;
  vehicleMaintenance: Readonly<Record<string, VehicleMaintenancePreview>>;
  vehiclePhotos: Readonly<Record<string, TemporaryVehiclePhoto | null>>;
  vehicles: readonly PreviewVehicle[];
};

const CustomerPreviewContext = createContext<CustomerPreviewContextValue | null>(null);
const EPHEMERAL_VEHICLE_ID = 'vehicle-local-account-preview';

export function CustomerPreviewProvider({ children }: PropsWithChildren) {
  const [ephemeralAccount, setEphemeralAccount] = useState<EphemeralAccountPreview | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(CUSTOMER_PREVIEW.selectedVehicleId);
  const [pendingBookingVehicle, setPendingBookingVehicle] = useState<PreviewVehicle | null>(null);
  const [vehicleMaintenance, setVehicleMaintenance] = useState<Record<string, VehicleMaintenancePreview>>({});
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, TemporaryVehiclePhoto | null>>({});
  const vehiclePhotosRef = useRef(vehiclePhotos);

  const vehicles = useMemo<readonly PreviewVehicle[]>(
    () => ephemeralAccount
      ? [
        ephemeralAccount.vehicle,
        ...CUSTOMER_PREVIEW.vehicles.map((vehicle) => ({ ...vehicle, isPrimary: false })),
      ]
      : CUSTOMER_PREVIEW.vehicles,
    [ephemeralAccount],
  );

  useEffect(() => {
    vehiclePhotosRef.current = vehiclePhotos;
  }, [vehiclePhotos]);

  useEffect(() => () => {
    Object.values(vehiclePhotosRef.current).forEach(releaseLocalVehiclePhoto);
  }, []);

  const setVehiclePhoto = useCallback((vehicleId: string, photo: TemporaryVehiclePhoto | null) => {
    setVehiclePhotos((current) => {
      const previous = current[vehicleId];
      if (previous?.uri !== photo?.uri) releaseLocalVehiclePhoto(previous);
      const next = { ...current, [vehicleId]: photo };
      vehiclePhotosRef.current = next;
      return next;
    });
  }, []);

  const updateVehicleMaintenancePreview = useCallback((
    vehicleId: string,
    maintenance: Omit<VehicleMaintenancePreview, 'updatedLocally'>,
  ) => {
    setVehicleMaintenance((current) => ({
      ...current,
      [vehicleId]: { ...maintenance, updatedLocally: true },
    }));
  }, []);

  const stageAccountPreview = useCallback((input: StageAccountInput) => {
    const vehicle: PreviewVehicle = {
      id: EPHEMERAL_VEHICLE_ID,
      isPrimary: true,
      year: input.vehicleYear,
      make: input.vehicleMake.trim(),
      model: input.vehicleModel.trim(),
      registration: input.registration.trim().toUpperCase(),
      vinLastFour: null,
      odometerKm: null,
      lastVisit: null,
      nextDue: null,
    };

    setEphemeralAccount({
      profile: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        mobile: input.mobile.trim(),
      },
      vehicle,
    });
    setVehiclePhotos((current) => {
      const previous = current[EPHEMERAL_VEHICLE_ID];
      if (previous?.uri !== input.photo?.uri) releaseLocalVehiclePhoto(previous);
      const next = { ...current, [EPHEMERAL_VEHICLE_ID]: input.photo };
      vehiclePhotosRef.current = next;
      return next;
    });
    setVehicleMaintenance((current) => ({
      ...current,
      [EPHEMERAL_VEHICLE_ID]: {
        customerLastServiceDate: null,
        customerNextCheckInDate: null,
        odometerKm: null,
        updatedLocally: false,
      },
    }));
    setSelectedVehicleId(EPHEMERAL_VEHICLE_ID);
  }, []);

  const selectVehicle = useCallback((vehicleId: string) => {
    if (vehicles.some((vehicle) => vehicle.id === vehicleId)) setSelectedVehicleId(vehicleId);
  }, [vehicles]);

  const prepareBookingVehicle = useCallback((vehicleId: string) => {
    const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) return;
    setSelectedVehicleId(vehicle.id);
    setPendingBookingVehicle(vehicle);
  }, [vehicles]);

  const prepareBookingVehicleRecord = useCallback((vehicle: PreviewVehicle) => {
    setPendingBookingVehicle(vehicle);
  }, []);

  const clearPendingBookingVehicle = useCallback(() => {
    setPendingBookingVehicle(null);
  }, []);

  const value = useMemo<CustomerPreviewContextValue>(() => ({
    clearPendingBookingVehicle,
    ephemeralAccount,
    pendingBookingVehicle,
    prepareBookingVehicle,
    prepareBookingVehicleRecord,
    selectedVehicleId,
    selectVehicle,
    setVehiclePhoto,
    stageAccountPreview,
    updateVehicleMaintenancePreview,
    vehicleMaintenance,
    vehiclePhotos,
    vehicles,
  }), [
    clearPendingBookingVehicle,
    ephemeralAccount,
    pendingBookingVehicle,
    prepareBookingVehicle,
    prepareBookingVehicleRecord,
    selectVehicle,
    selectedVehicleId,
    setVehiclePhoto,
    stageAccountPreview,
    updateVehicleMaintenancePreview,
    vehicleMaintenance,
    vehiclePhotos,
    vehicles,
  ]);

  return <CustomerPreviewContext.Provider value={value}>{children}</CustomerPreviewContext.Provider>;
}

export function useCustomerPreview() {
  const value = useContext(CustomerPreviewContext);
  if (!value) throw new Error('useCustomerPreview must be used inside CustomerPreviewProvider');
  return value;
}
