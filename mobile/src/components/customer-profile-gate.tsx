import { type Href, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { customerAccessState, customerReturnPath } from '@/lib/customer-access';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export function CustomerProfileGate({ children, feature, returnTo, requireVehicle = false, profileRequired = true, inline = false }: {
  children: ReactNode;
  feature: string;
  returnTo: string;
  requireVehicle?: boolean;
  profileRequired?: boolean;
  inline?: boolean;
}) {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { account, status, refreshAccount } = useCustomerAccount();
  const { horizontalPadding } = useResponsiveLayout();
  const state = customerAccessState({ authEnabled: CUSTOMER_AUTH.enabled, authStatus: auth.status,
    accountStatus: status, hasAccount: Boolean(account), profile: account?.profile,
    vehicleCount: account?.vehicles.length ?? 0, profileRequired, requireVehicle });
  if (state === 'ready') return children;
  const destination = customerReturnPath(returnTo) ?? '/garage';
  const review = REVIEW_ENVIRONMENT.enabled;
  const loading = state === 'loading';
  const setup = state === 'profile' || state === 'vehicle';
  const title = loading ? 'Opening your account' : state === 'error' ? 'Account could not be loaded'
    : state === 'restricted' ? 'Contact PSI about your account' : state === 'unavailable' ? 'Account access unavailable'
      : setup ? state === 'vehicle' ? 'Add your vehicle first' : 'Complete your profile first'
        : review ? 'Sign in to the reviewer demonstration' : 'Create your profile first';
  const copy = loading ? 'Please wait while your secure account loads.'
    : state === 'error' ? 'Your saved information has not changed. Try loading your account again.'
      : state === 'restricted' ? 'Your account needs workshop assistance before you can make changes.'
        : state === 'unavailable' ? 'You can browse PSI or try the demonstration. Real account changes are unavailable in this build.'
          : setup ? `Save your ${state === 'vehicle' ? 'vehicle' : 'name, mobile number and vehicle'} to continue with ${feature}.`
            : review ? 'Use the dedicated app reviewer email and password to explore the isolated sample account.'
              : `Verify your email and save your profile before ${feature}. Already have an account? Sign in with the same email.`;
  const content = <View style={styles.card}>
    {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.copy}>{copy}</Text>
    {destination.startsWith('/booking') && !loading ? <Text style={styles.copy}>Any existing booking draft stays on this device. Nothing has been submitted.</Text> : null}
    {state === 'sign_in' ? <PrimaryButton label={review ? 'Reviewer sign in' : 'Create account or sign in'} onPress={() => router.push({ pathname: '/account', params: { returnTo: destination } })} /> : null}
    {setup ? <PrimaryButton label={state === 'vehicle' ? 'Add my vehicle' : 'Complete my profile'} onPress={() => router.push({ pathname: '/account/sign-up', params: { returnTo: destination } })} /> : null}
    {state === 'error' ? <PrimaryButton label="Try again" onPress={refreshAccount} /> : null}
    {state === 'restricted' ? <PrimaryButton label="Contact PSI" onPress={() => router.push('/support')} /> : null}
    {!loading && !review ? <PrimaryButton label="Try demonstration" variant="outline" onPress={() => router.push('/demonstration' as Href)} /> : null}
    {!loading && !inline ? <PrimaryButton label="Back to browsing" variant="outline" onPress={() => router.replace('/')} /> : null}
  </View>;
  return inline ? content : <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}>{content}</ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  card: { ...mobileFrame, width: '100%', padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.panel },
  title: { color: colors.white, fontSize: 28, lineHeight: 34, fontWeight: '900', flexShrink: 1 },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, flexShrink: 1 },
});
