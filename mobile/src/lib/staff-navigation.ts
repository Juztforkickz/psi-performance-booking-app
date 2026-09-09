export type StaffTab = 'dashboard' | 'bookings' | 'customers' | 'records' | 'menu';

export const STAFF_SECTIONS = {
  dashboard: { title: 'Workshop dashboard', description: 'Your workshop at a glance.', tab: 'dashboard' },
  alerts: { title: 'Alerts', description: 'Workshop enquiries and customer-account updates.', tab: 'dashboard' },
  bookings: { title: 'Bookings', description: 'Review requests and complete workshop visits.', tab: 'bookings' },
  customers: { title: 'Customers', description: 'Find customer contact details and vehicles.', tab: 'customers' },
  records: { title: 'Workshop records', description: 'Publish reports and manage private vehicle files.', tab: 'records' },
  menu: { title: 'Workspace menu', description: 'Events, connections, history and workshop settings.', tab: 'menu' },
  events: { title: 'PSI Events', description: 'Prepare event dates and customer announcements.', tab: 'menu' },
  connections: { title: 'Connections', description: 'Review workshop integrations and delivery queues.', tab: 'menu' },
  history: { title: 'Activity history', description: 'Review protected workshop activity.', tab: 'menu' },
  settings: { title: 'Workspace settings', description: 'Manage account and authenticator security.', tab: 'menu' },
  invitations: { title: 'Customer invitations', description: 'Approve customer access and review invitations.', tab: 'customers' },
  deletion: { title: 'Account deletion requests', description: 'Review customer requests for account removal.', tab: 'customers' },
  access: { title: 'Customer access', description: 'Review customer access to the PSI app.', tab: 'customers' },
  imports: { title: 'Record imports', description: 'Review the available workshop record import tools.', tab: 'records' },
} as const satisfies Record<string, { title: string; description: string; tab: StaffTab }>;

export type StaffSection = keyof typeof STAFF_SECTIONS;

export function resolveStaffSection(value: string | string[] | undefined): StaffSection {
  const section = Array.isArray(value) ? value[0] : value;
  return typeof section === 'string' && Object.hasOwn(STAFF_SECTIONS, section)
    ? section as StaffSection
    : 'dashboard';
}

export function staffTabForSection(section: StaffSection): StaffTab {
  return STAFF_SECTIONS[section].tab;
}
