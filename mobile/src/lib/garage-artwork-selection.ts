export function shouldPersistGarageArtwork(authEnabled: boolean, authStatus: string) {
  return authEnabled && authStatus === 'signed_in';
}
