export interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "leader" | "admin";
  isActive: boolean;
  createdAt: string;
}
export interface Sermon {
  id: string;
  title: string;
  preacher: string;
  passage: string;
  sermonDate: string;
  summary: string | null;
  content: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  tags: string[];
  status: string;
}
export interface Lesson {
  id: string;
  studyPlanId: string;
  day: number;
  title: string;
  passage: string | null;
  content: string;
}
export interface Plan {
  id: string;
  sermonId: string | null;
  title: string;
  description: string | null;
  dailyLessons?: Lesson[];
  sermon?: Pick<Sermon, "id" | "title" | "preacher" | "passage">;
}
export interface Progress {
  studyPlanId: string;
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  dailyLessons: {
    dailyLessonId: string;
    day: number;
    completed: boolean;
    completedAt: string | null;
  }[];
}
export interface Envelope<T> {
  status: string;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}
