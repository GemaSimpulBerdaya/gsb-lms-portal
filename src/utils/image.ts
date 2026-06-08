/**
 * Helper kompresi & konversi gambar sisi-klien.
 *
 * Dipakai bareng alur upload UploadThing (foto laporan KBM, portfolio, modul).
 * Semua fungsi di sini bergantung pada API browser (Image, canvas, atob) —
 * HANYA boleh dipanggil dari komponen "use client" / event handler, jangan
 * dari Server Component atau route handler.
 */

/**
 * Kompres image data:URL via canvas — resize ke max `maxDim`px (sisi terpanjang)
 * dan re-encode jadi JPEG `quality`. Foto 5MB jadi ~150-300KB, sehingga
 * multi-foto muat di payload tanpa ketabrak body size limit.
 *
 * Input: data:image/...;base64,...  Output: data:image/jpeg;base64,...
 * Kalau gambar gagal di-load atau canvas gagal encode, dataURL asli dikembalikan
 * (graceful fallback — caller tetap dapat sesuatu yang valid).
 */
export const compressDataUrl = (
  dataUrl: string,
  maxDim = 1280,
  quality = 0.75,
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Convert dataURL string ke File object untuk upload via UploadThing.
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
};

/**
 * Tebak ekstensi file dari prefix MIME sebuah image dataURL.
 * Dipakai untuk membuat nama file yang masuk akal sebelum upload.
 */
export const extFromDataUrl = (dataUrl: string): string =>
  dataUrl.startsWith("data:image/png")
    ? "png"
    : dataUrl.startsWith("data:image/webp")
      ? "webp"
      : dataUrl.startsWith("data:image/gif")
        ? "gif"
        : "jpg";
