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
export interface Bookmark {
  id: string;
  sermonId: string;
  sermon: Sermon;
  createdAt: string;
}
export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  sermonId: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Group {
  id: string;
  name: string;
  description: string | null;
  leaderId: string;
  leader?: { id: string; name: string };
  memberCount?: number;
  isMember?: boolean;
}
export interface GroupMember {
  userId: string;
  role: string;
  user: { id: string; name: string };
}
export interface Post {
  id: string;
  groupId: string;
  authorId: string;
  author?: { id: string; name: string };
  content: string;
  sermonId: string | null;
  parentPostId: string | null;
  isFlagged: boolean;
  flagReason: string | null;
  replies?: Post[];
  createdAt: string;
}
export interface Analytics {
  users: { total: number; active: number; inactive: number };
  sermons: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  studyPlans: { total: number; dailyLessons: number; completedLessons: number };
  engagement: {
    uniqueViews: number;
    uniqueListens: number;
    bookmarks: number;
    journalEntries: number;
    groups: number;
    discussionPosts: number;
  };
}
