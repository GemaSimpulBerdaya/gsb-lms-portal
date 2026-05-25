"use client";

import { useEffect, useState, useCallback } from "react";
import VolunteerTable, { Volunteer } from "@/components/admin/VolunteerTable/VolunteerTable";
import VolunteerModal from "@/components/admin/VolunteerModal/VolunteerModal";
import styles from "./volunteers.module.css";

export default function AdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);

  const fetchVolunteers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVolunteers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVolunteers]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVolunteers(volunteers.filter((v) => v._id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Gagal menghapus relawan");
      }
    } catch {
      alert("Terjadi kesalahan saat menghapus");
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (v: Volunteer) => {
    setEditing(v);
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data relawan...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Akun Tim Relawan</h1>
        <p className={styles.subtitle}>
          Akun login per tim. 1 akun = 1 tim, beberapa anggota berperan
          (Facilitator/Pengajar/Dokumentasi). Daftar individu lintas tim
          dikelola di{" "}
          <a
            href="/admin/volunteer-registry"
            style={{
              color: "#F58220",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Registry Relawan
          </a>
          .
        </p>
      </div>

      <VolunteerTable
        volunteers={volunteers}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onMembersChange={fetchVolunteers}
      />

      <VolunteerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchVolunteers}
        volunteerToEdit={editing}
      />
    </div>
  );
}
