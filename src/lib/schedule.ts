/**
 * Helper untuk Schedule: generate tanggal pertemuan & compute activeWeek.
 *
 * activeWeek tidak lagi di-set manual oleh volunteer — di-derive dari
 * kbmDates + tanggal hari ini. "Pekan aktif" = pertemuan terakhir yang
 * tanggal-nya <= hari ini. Kalau semua belum lewat → pekan 1.
 */

export interface KbmDateInput {
  week: number;
  date: Date | string;
  topic?: string;
  materialLink?: string;
  documentationLink?: string;
}

/**
 * Hitung pekan aktif dari list kbmDates.
 * Aturan:
 *  - Kalau kbmDates kosong → 1 (default minimal)
 *  - Kalau semua tanggal masih di masa depan → pekan 1
 *  - Kalau ada yang sudah lewat → pekan dari pertemuan terakhir yang sudah lewat
 *  - Kalau hari ini == tanggal pertemuan → pekan itu (dianggap aktif hari H)
 */
export function computeActiveWeek(
  kbmDates: KbmDateInput[],
  now: Date = new Date()
): number {
  if (!kbmDates || kbmDates.length === 0) return 1;

  // Normalize tanggal (jam 00:00 lokal supaya perbandingan stabil)
  const today = new Date(now);
  today.setHours(23, 59, 59, 999); // anggap end-of-day biar pertemuan hari ini = aktif

  const sorted = [...kbmDates]
    .map((k) => ({ ...k, date: new Date(k.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Cari pertemuan terakhir yang <= today
  let active = sorted[0].week;
  for (const k of sorted) {
    if (k.date.getTime() <= today.getTime()) {
      active = k.week;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Generate list tanggal KBM dari config:
 *  - startDate: tanggal pertemuan pertama (Date atau ISO string)
 *  - count: jumlah pertemuan
 *  - intervalDays: jarak antar pertemuan dalam hari (default 7 = mingguan)
 *  - skipDates: array tanggal yang dilompati (libur). Tanggal ini gak
 *    masuk ke kbmDates, tapi tetep ngerusak interval — pertemuan
 *    berikutnya geser ke interval setelah skip.
 *
 * Topic di-kosongin (volunteer isi belakangan kalau perlu).
 */
export function generateKbmDates(opts: {
  startDate: Date | string;
  count: number;
  intervalDays?: number;
  skipDates?: (Date | string)[];
}): KbmDateInput[] {
  const { startDate, count, intervalDays = 7, skipDates = [] } = opts;

  if (count < 1 || count > 50) {
    throw new Error("count harus 1-50");
  }

  const skipSet = new Set(
    skipDates.map((d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    })
  );

  const result: KbmDateInput[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  let week = 1;
  // Safety guard supaya tidak infinite loop kalau skip kelewatan banyak
  let safety = count + skipSet.size + 5;

  while (result.length < count && safety-- > 0) {
    const ts = cursor.getTime();
    if (!skipSet.has(ts)) {
      result.push({
        week,
        date: new Date(cursor),
        topic: "",
      });
      week += 1;
    }
    cursor.setDate(cursor.getDate() + intervalDays);
  }

  if (result.length < count) {
    throw new Error("Tidak bisa generate cukup tanggal — cek skipDates atau interval");
  }

  return result;
}
