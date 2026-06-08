export type Report = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  scheduleId?: string;
  region?: string;
  level?: string;
  createdAt: string;
};

export type KbmDate = {
  week: number;
  date: string;
  topic?: string;
};

export type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: KbmDate[];
};

export type Toast = { type: "success" | "error"; message: string } | null;
