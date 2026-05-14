/**
 * Layout khusus route /print/*
 *
 * Tidak membungkus sidebar admin/volunteer. Isinya langsung halaman raport
 * yang printable. Background global override di sini supaya preview dan
 * print konsisten.
 */

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
