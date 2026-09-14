import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import type { CustomerProfileRow, CustomerVehicleRow, WorkshopContactRow, WorkshopVehicleRow } from '@/lib/database.types';
import { claimWorkshopContact } from '@/lib/staff-portal';

type Match = {
  customer: CustomerProfileRow;
  email: boolean;
  name: boolean;
  registrations: string[];
};

const normalizedName = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
const customerName = (customer: CustomerProfileRow) =>
  [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || customer.email;

export function StaffWorkshopCustomers({
  contacts,
  customerVehicles,
  customers,
  onRefresh,
  owner,
  workshopVehicles,
}: {
  contacts: WorkshopContactRow[];
  customerVehicles: CustomerVehicleRow[];
  customers: CustomerProfileRow[];
  onRefresh: () => void;
  owner: boolean;
  workshopVehicles: WorkshopVehicleRow[];
}) {
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');
  const activeContacts = contacts.filter(contact => contact.status === 'active');
  const candidates = useMemo(() => new Map(activeContacts.map(contact => {
    const registrations = workshopVehicles
      .filter(vehicle => vehicle.workshop_contact_id === contact.id && vehicle.status === 'active')
      .map(vehicle => vehicle.registration.toLocaleUpperCase());
    const matches: Match[] = customers.flatMap(customer => {
      const email = Boolean(contact.email && contact.email.toLocaleLowerCase() === customer.email.toLocaleLowerCase());
      const name = normalizedName(contact.display_name) === normalizedName([customer.first_name, customer.last_name].filter(Boolean).join(' '));
      const matchedRegistrations = customerVehicles
        .filter(vehicle => vehicle.customer_id === customer.user_id && !vehicle.archived_at && registrations.includes(vehicle.registration.toLocaleUpperCase()))
        .map(vehicle => vehicle.registration);
      return email || (name && matchedRegistrations.length) ? [{ customer, email, name, registrations: matchedRegistrations }] : [];
    });
    return [contact.id, matches] as const;
  })), [activeContacts, customerVehicles, customers, workshopVehicles]);

  const approve = (contact: WorkshopContactRow, match: Match) => {
    Alert.alert(
      'Transfer workshop history?',
      `Link ${contact.display_name} and their workshop-only jobs to ${customerName(match.customer)}? This requires an exact email match or an exact name plus registration match.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            setWorkingId(contact.id);
            setMessage('');
            void claimWorkshopContact(contact.id, match.customer.user_id)
              .then(() => {
                setMessage(`Transferred ${contact.display_name}'s workshop history to the selected app account.`);
                onRefresh();
              })
              .catch(() => setMessage('The transfer was not completed. Recheck the email, name and registration match.'))
              .finally(() => setWorkingId(''));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.stack}>
      <View style={styles.notice}>
        <Text style={styles.title}>Workshop-only customers</Text>
        <Text style={styles.copy}>Phone and walk-in jobs can be created without an app login. Files remain private on the workshop PC until an owner reviews and transfers a strong match.</Text>
      </View>
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      {activeContacts.map(contact => {
        const vehicles = workshopVehicles.filter(vehicle => vehicle.workshop_contact_id === contact.id && vehicle.status === 'active');
        const matches = candidates.get(contact.id) ?? [];
        return (
          <View key={contact.id} style={styles.card}>
            <Text style={styles.title}>{contact.display_name}</Text>
            <Text selectable style={styles.copy}>{contact.email || 'No email'} · {contact.mobile || 'No mobile'}</Text>
            {vehicles.map(vehicle => <Text key={vehicle.id} style={styles.vehicle}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.registration}</Text>)}
            <Text style={styles.kicker}>{matches.length ? `${matches.length} strong app match${matches.length === 1 ? '' : 'es'} — owner review required` : 'No strong app-account match yet'}</Text>
            {matches.map(match => (
              <View key={match.customer.user_id} style={styles.match}>
                <View style={styles.flex}>
                  <Text style={styles.matchTitle}>{customerName(match.customer)}</Text>
                  <Text style={styles.copy}>{match.customer.email}</Text>
                  <Text style={styles.reason}>{[
                    match.email ? 'Exact email' : null,
                    match.name ? 'Exact name' : null,
                    match.registrations.length ? `Registration ${match.registrations.join(', ')}` : null,
                  ].filter(Boolean).join(' · ')}</Text>
                </View>
                {owner ? <PrimaryButton disabled={Boolean(workingId)} loading={workingId === contact.id} label="Review & transfer" onPress={() => approve(contact, match)} /> : null}
              </View>
            ))}
          </View>
        );
      })}
      {!activeContacts.length ? <Text style={styles.empty}>No workshop-only customers are waiting for an app account.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  notice: { backgroundColor: colors.inkSoft, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  match: { backgroundColor: colors.inkSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.sm },
  flex: { flex: 1 },
  title: { color: colors.white, fontSize: 17, fontWeight: '900' },
  matchTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  vehicle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: .5, textTransform: 'uppercase' },
  reason: { color: colors.success, fontSize: 12, fontWeight: '800', marginTop: 4 },
  message: { color: colors.success, fontSize: 13, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
