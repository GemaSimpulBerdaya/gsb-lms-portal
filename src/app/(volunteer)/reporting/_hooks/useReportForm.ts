import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { dateToIso } from "@/utils/formatters";
import { compressDataUrl, dataUrlToFile, extFromDataUrl } from "@/utils/image";
import { uploadFiles } from "@/lib/uploadthing";
import type { Report, Schedule, Toast } from "../_lib/reportingTypes";

type UseReportFormParams = {
  isReadOnly: boolean;
  selectedSemester: string;
  schedules: Schedule[];
  queryScheduleId: string | null;
  queryDate: string | null;
  setReports: Dispatch<SetStateAction<Report[]>>;
  setTotal: Dispatch<SetStateAction<number>>;
  setToast: Dispatch<SetStateAction<Toast>>;
};

const showToast = (setToast: Dispatch<SetStateAction<Toast>>, toast: NonNullable<Toast>) => {
  setToast(toast);
  setTimeout(() => setToast(null), 3500);
};

async function resolvePhotoUrl(dataUrl: string): Promise<string> {
  const ext = extFromDataUrl(dataUrl);
  const filename = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const file = dataUrlToFile(dataUrl, filename);
  const result = await uploadFiles("reportPhoto", { files: [file] });
  const first = result?.[0];
  if (!first || !first.ufsUrl) throw new Error("upload failed");
  return first.ufsUrl;
}

export function useReportForm({
  isReadOnly,
  selectedSemester,
  schedules,
  queryScheduleId,
  queryDate,
  setReports,
  setTotal,
  setToast,
}: UseReportFormParams) {
  const [photoOptionOpen, setPhotoOptionOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formScheduleId, setFormScheduleId] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoOpenedFromQueryRef = useRef(false);

  useEffect(() => {
    if (autoOpenedFromQueryRef.current) return;
    if (!queryScheduleId && !queryDate) return;
    if (schedules.length === 0) return;

    autoOpenedFromQueryRef.current = true;
    Promise.resolve().then(() => {
      setEditingId(null);
      setFormDate(queryDate || "");
      setFormTitle("");
      setFormDesc("");
      setFormLocation("");
      setFormScheduleId(queryScheduleId || "");
      setFormPhotos([]);
      setFormOpen(true);
    });
  }, [queryScheduleId, queryDate, schedules]);

  const openAdd = () => {
    setEditingId(null);
    setFormDate("");
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormScheduleId("");
    setFormPhotos([]);
    setFormOpen(true);
  };

  const openEdit = (report: Report) => {
    setEditingId(report._id);
    setFormDate(report.date ? dateToIso(report.date) : "");
    setFormTitle(report.title);
    setFormDesc(report.description);
    setFormLocation(report.location || "");
    setFormScheduleId(report.scheduleId || "");
    const initial = Array.isArray(report.photoUrls) && report.photoUrls.length > 0
      ? report.photoUrls
      : report.photoUrl ? [report.photoUrl] : [];
    setFormPhotos(initial);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        showToast(setToast, { type: "error", message: `${file.name} terlalu besar (maks 10MB)` });
        return;
      }
      accepted.push(file);
    });

    if (accepted.length === 0) {
      event.target.value = "";
      return;
    }

    Promise.all(
      accepted.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const raw = ev.target?.result as string;
                const compressed = await compressDataUrl(raw);
                resolve(compressed);
              } catch {
                resolve("");
              }
            };
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((results) => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        setFormPhotos((prev) => [...prev, ...valid]);
      }
    });

    event.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;
    const missingFields = [
      !formDate && "Tanggal",
      !formTitle.trim() && "Judul",
      !formDesc.trim() && "Deskripsi",
    ].filter(Boolean);
    if (missingFields.length > 0) {
      showToast(setToast, { type: "error", message: `${missingFields.join(", ")} wajib diisi.` });
      return;
    }

    setSubmitting(true);
    try {
      const resolvedPhotos: string[] = [];
      for (const photo of formPhotos) {
        if (photo.startsWith("data:")) {
          const url = await resolvePhotoUrl(photo);
          resolvedPhotos.push(url);
        } else if (photo) {
          resolvedPhotos.push(photo);
        }
      }

      let region: string | undefined;
      let fase: string | undefined;
      if (formScheduleId) {
        const schedule = schedules.find((item) => item._id === formScheduleId);
        if (schedule) {
          region = schedule.region;
          fase = schedule.fase;
        }
      }

      const isEdit = editingId !== null;
      const res = await fetch("/api/reports", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                id: editingId,
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                fase,
                semester: selectedSemester,
              }
            : {
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                fase,
                semester: selectedSemester,
              },
        ),
      });
      const data = (await res.json()) as { error?: string; report: Report };
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");

      if (isEdit) {
        setReports((prev) => prev.map((report) => report._id === editingId ? data.report : report));
        showToast(setToast, { type: "success", message: "Laporan berhasil diperbarui." });
      } else {
        setReports((prev) => [data.report, ...prev]);
        setTotal((total) => total + 1);
        showToast(setToast, { type: "success", message: "Laporan berhasil dikirim." });
      }
      closeForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan.";
      showToast(setToast, { type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newId = event.target.value;
    setFormScheduleId(newId);
    if (newId) {
      const schedule = schedules.find((item) => item._id === newId);
      if (schedule) {
        setFormLocation(`${schedule.region} - ${schedule.fase}`);
      }
    } else {
      setFormLocation("");
    }
  };

  const handleCameraCapture = async (dataUrl: string) => {
    const compressed = await compressDataUrl(dataUrl);
    setFormPhotos((prev) => [...prev, compressed]);
    setCameraOpen(false);
  };

  const openCameraFromSource = () => {
    setPhotoOptionOpen(false);
    setCameraOpen(true);
  };

  const openGalleryFromSource = () => {
    setPhotoOptionOpen(false);
    fileInputRef.current?.click();
  };

  return {
    photoOptionOpen,
    setPhotoOptionOpen,
    formOpen,
    editingId,
    submitting,
    formDate,
    setFormDate,
    formTitle,
    setFormTitle,
    formDesc,
    setFormDesc,
    formLocation,
    setFormLocation,
    formScheduleId,
    formPhotos,
    cameraOpen,
    setCameraOpen,
    fileInputRef,
    openAdd,
    openEdit,
    closeForm,
    handleFileChange,
    removePhoto,
    handleSubmit,
    handleScheduleChange,
    handleCameraCapture,
    openCameraFromSource,
    openGalleryFromSource,
  };
}
