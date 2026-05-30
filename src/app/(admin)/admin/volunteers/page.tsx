"use client";

import { useEffect, useState, useCallback } from "react";
import VolunteerTable, { Volunteer } from "@/components/admin/VolunteerTable/VolunteerTable";
import VolunteerModal from "@/components/admin/VolunteerModal/VolunteerModal";
import styles from "./volunteers.module.css";
import { useDialog } from "@/components/ui/DialogProvider";

export default function AdminVolunteersPage() {
  const { showAlert, showConfirm } = useDialog();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [search, setSearch] = useState("");

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
    const isConfirmed = await showConfirm("Hapus akun tim ini?", "Hapus Tim");
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVolunteers(volunteers.filter((v) => v._id !== id));
      } else {
        const data = await res.json();
        await showAlert(data.error || "Gagal menghapus relawan", "error");
      }
    } catch {
      await showAlert("Terjadi kesalahan saat menghapus", "error");
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
          Akun login bersifat per tim. Satu akun mewakili satu tim, dengan beberapa anggota yang memiliki peran berbeda (Fasilitator, Pengajar, Dokumentasi). Data individu lintas tim dikelola di {" "}
          <a
            href="/admin/volunteer-registry"
            style={{
              color: "#F58220",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Daftar Relawan
          </a>.
        </p>
      </div>

      <div style={{ marginBottom: "20px", display: "flex" }}>
        <input
          type="text"
          placeholder="Cari nama tim atau region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            width: "300px",
            fontSize: "14px",
            outline: "none"
          }}
        />
      </div>

      <VolunteerTable
        volunteers={volunteers.filter(v => 
          (v.name?.toLowerCase() || "").includes(search.toLowerCase()) || 
          (v.region?.toLowerCase() || "").includes(search.toLowerCase()) ||
          (v.teamName?.toLowerCase() || "").includes(search.toLowerCase())
        )}
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
