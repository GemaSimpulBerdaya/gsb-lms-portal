import AdminGuard from "@/components/admin/AdminGuard";
import AdminShell from "./AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
