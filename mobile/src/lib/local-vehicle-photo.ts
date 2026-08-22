/** Only the fields needed to render a temporary, device-local vehicle photo. */
export type LocalVehiclePhoto = {
  height: number;
  uri: string;
  width: number;
};

/** Release Expo's web object URL when its owning preview state discards it. */
export function releaseLocalVehiclePhoto(photo: LocalVehiclePhoto | null | undefined) {
  if (!photo?.uri.startsWith('blob:')) return;
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;

  try {
    URL.revokeObjectURL(photo.uri);
  } catch {
    // Already-released browser URLs need no further work.
  }
}
