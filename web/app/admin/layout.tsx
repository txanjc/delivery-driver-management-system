import { AdminShell } from "./_components/admin-shell";
import { AdminRouteGuard } from "./_components/admin-route-guard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminRouteGuard>
      <AdminShell>{children}</AdminShell>
    </AdminRouteGuard>
  );
}
