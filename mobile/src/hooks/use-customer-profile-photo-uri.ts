import { useEffect, useState } from 'react';

import { useCustomerAccount } from '@/lib/customer-account-context';
import { createCustomerProfilePhotoSignedUrl } from '@/lib/customer-profile-photo';

type ProfilePhotoState = {
  objectPath: string;
  uri: string;
  userId: string;
};

export function useCustomerProfilePhotoUri() {
  const { account } = useCustomerAccount();
  const profile = account?.profile;
  const objectPath = profile?.profile_photo_object_path ?? null;
  const [photoState, setPhotoState] = useState<ProfilePhotoState | null>(null);

  useEffect(() => {
    let active = true;
    if (!profile?.profile_photo_object_path) {
      return () => { active = false; };
    }

    void createCustomerProfilePhotoSignedUrl(profile)
      .then((uri) => {
        if (active && uri) {
          setPhotoState({ objectPath: profile.profile_photo_object_path!, uri, userId: profile.user_id });
        }
      })
      .catch(() => {
        if (active) setPhotoState(null);
      });

    return () => { active = false; };
  }, [objectPath, profile]);

  return profile
    && photoState?.userId === profile.user_id
    && photoState.objectPath === objectPath
    ? photoState.uri
    : null;
}
