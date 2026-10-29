import { StudyPlan } from './StudyPlan.js';
import { DailyLesson } from './DailyLesson.js';
import { LessonProgress } from './LessonProgress.js';
import { User } from './User.js';
import { Sermon } from './Sermon.js';
import { JournalEntry } from './JournalEntry.js';
import { Bookmark } from './Bookmark.js';
import { FellowshipGroup } from './FellowshipGroup.js';
import { GroupMember } from './GroupMember.js';
import { DiscussionPost } from './DiscussionPost.js';

// --- Journal -------------------------------------------------------------
User.hasMany(JournalEntry, { foreignKey: 'userId', as: 'journalEntries', onDelete: 'CASCADE' });
JournalEntry.belongsTo(User, { foreignKey: 'userId', as: 'author' });
Sermon.hasMany(JournalEntry, { foreignKey: 'sermonId', as: 'journalEntries', onDelete: 'SET NULL' });
JournalEntry.belongsTo(Sermon, { foreignKey: 'sermonId', as: 'sermon' });
FellowshipGroup.hasMany(JournalEntry, { foreignKey: 'sharedWithGroupId', as: 'sharedEntries', onDelete: 'SET NULL' });
JournalEntry.belongsTo(FellowshipGroup, { foreignKey: 'sharedWithGroupId', as: 'sharedWithGroup' });

// --- Bookmarks -----------------------------------------------------------
User.hasMany(Bookmark, { foreignKey: 'userId', as: 'bookmarks', onDelete: 'CASCADE' });
Bookmark.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Sermon.hasMany(Bookmark, { foreignKey: 'sermonId', as: 'bookmarks', onDelete: 'CASCADE' });
Bookmark.belongsTo(Sermon, { foreignKey: 'sermonId', as: 'sermon' });

// --- Fellowship ----------------------------------------------------------
User.hasMany(FellowshipGroup, { foreignKey: 'leaderId', as: 'ledGroups', onDelete: 'CASCADE' });
FellowshipGroup.belongsTo(User, { foreignKey: 'leaderId', as: 'leader' });

FellowshipGroup.hasMany(GroupMember, { foreignKey: 'groupId', as: 'memberships', onDelete: 'CASCADE' });
GroupMember.belongsTo(FellowshipGroup, { foreignKey: 'groupId', as: 'group' });
User.hasMany(GroupMember, { foreignKey: 'userId', as: 'memberships', onDelete: 'CASCADE' });
GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- Discussions ---------------------------------------------------------
FellowshipGroup.hasMany(DiscussionPost, { foreignKey: 'groupId', as: 'posts', onDelete: 'CASCADE' });
DiscussionPost.belongsTo(FellowshipGroup, { foreignKey: 'groupId', as: 'group' });
Sermon.hasMany(DiscussionPost, { foreignKey: 'sermonId', as: 'posts', onDelete: 'SET NULL' });
DiscussionPost.belongsTo(Sermon, { foreignKey: 'sermonId', as: 'sermon' });
User.hasMany(DiscussionPost, { foreignKey: 'authorId', as: 'posts', onDelete: 'CASCADE' });
DiscussionPost.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
// Threading: replies point at a top-level post via parent_post_id.
DiscussionPost.hasMany(DiscussionPost, { foreignKey: 'parentPostId', as: 'replies', onDelete: 'CASCADE' });
DiscussionPost.belongsTo(DiscussionPost, { foreignKey: 'parentPostId', as: 'parent' });

export { User, Sermon, JournalEntry, Bookmark, FellowshipGroup, GroupMember, DiscussionPost };

// Weekly growth plans survive sermon deletion; lessons and progress follow their parents.
Sermon.hasMany(StudyPlan, { foreignKey: 'sermonId', as: 'studyPlans', onDelete: 'SET NULL' });
StudyPlan.belongsTo(Sermon, { foreignKey: 'sermonId', as: 'sermon' });
StudyPlan.hasMany(DailyLesson, { foreignKey: 'studyPlanId', as: 'dailyLessons', onDelete: 'CASCADE' });
DailyLesson.belongsTo(StudyPlan, { foreignKey: 'studyPlanId', as: 'studyPlan' });
DailyLesson.hasMany(LessonProgress, { foreignKey: 'dailyLessonId', as: 'progress', onDelete: 'CASCADE' });
LessonProgress.belongsTo(DailyLesson, { foreignKey: 'dailyLessonId', as: 'dailyLesson' });
User.hasMany(LessonProgress, { foreignKey: 'userId', as: 'lessonProgress', onDelete: 'CASCADE' });
LessonProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });
export { StudyPlan, DailyLesson, LessonProgress };

import { SermonEngagement } from './SermonEngagement.js';
User.hasMany(SermonEngagement, { foreignKey: 'userId', as: 'sermonEngagements', onDelete: 'CASCADE' });
SermonEngagement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Sermon.hasMany(SermonEngagement, { foreignKey: 'sermonId', as: 'engagements', onDelete: 'CASCADE' });
SermonEngagement.belongsTo(Sermon, { foreignKey: 'sermonId', as: 'sermon' });
export { SermonEngagement };
