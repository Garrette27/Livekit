import AdministratorEntry from '@/components/admin/AdministratorEntry';

/** Dedicated platform-owner entry; server configuration remains the source of super-admin authority. */
export default function SuperAdministratorLoginPage() {
  return <AdministratorEntry administratorLevel="super_admin" />;
}
