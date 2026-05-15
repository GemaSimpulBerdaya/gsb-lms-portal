"use client";

import { useEffect, useState } from "react";
import VolunteerTable, { Volunteer } from "@/components/admin/VolunteerTable/VolunteerTable";
import VolunteerModal from "@/components/admin/VolunteerModal/VolunteerModal";
import styles from "./volunteers.module.css";

export default function AdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchVolunteers = async () => {
    try {
      const res = await fetch("/api/admin/volunteers");
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data.volunteers || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data relawan", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVolunteers(volunteers.filter(v => v._id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menghapus relawan");
      }
    } catch {
      alert("Terjadi kesalahan saat menghapus");
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data relawan...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Database Relawan</h1>
        <p className={styles.subtitle}>Kelola semua relawan GSB yang terdaftar di sistem.</p>
      </div>

      <VolunteerTable 
        volunteers={volunteers} 
        onDelete={handleDelete}
        onAdd={() => setIsModalOpen(true)}
      />

      <VolunteerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchVolunteers}
      />
    </div>
  );
}
