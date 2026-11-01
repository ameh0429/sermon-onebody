import { Avatar } from "./Avatar";
import { useEffect } from "react";
import {
  BookOpen,
  Bookmark,
  Users,
  LayoutDashboard,
  ChevronRight,
  CircleUserRound,
  Leaf,
  LogOut,
  Sprout,
} from "lucide-react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./auth";
import { Brand } from "./ui";
import { PwaStatus } from "./pwa";
import { AccountPage, ProfilePage } from "./pages/Account";
import { SermonDetail, SermonLibrary } from "./pages/Sermons";
import { GrowthLibrary, StudyPlanPage } from "./pages/Growth";
import { BookmarksPage, JournalPage, JournalEditor } from "./pages/Personal";
import { GroupsPage, GroupDetail, GroupEditor } from "./pages/Fellowship";
import {
  DashboardLayout,
  AnalyticsPage,
  ManageSermons,
  SermonEditor,
  ManagePlans,
  PlanEditor,
  UsersPage,
} from "./pages/Dashboard";
function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  const links = [
    {
      to: "/sermons",
      label: "Sermon library",
      mobile: "Sermons",
      icon: BookOpen,
    },
    { to: "/growth", label: "Weekly growth", mobile: "Growth", icon: Sprout },
    {
      to: "/personal",
      label: "Personal space",
      mobile: "Personal",
      icon: Bookmark,
    },
    { to: "/groups", label: "Fellowship", mobile: "Groups", icon: Users },
    {
      to: "/profile",
      label: "My profile",
      mobile: "Profile",
      icon: CircleUserRound,
    },
    ...(user.role !== "member"
      ? [
          {
            to: "/dashboard",
            label: "Dashboard",
            mobile: "Dashboard",
            icon: LayoutDashboard,
          },
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/sermons" aria-label="OneBody home">
          <Brand />
        </Link>
        <div className="mt-14">
          <p className="nav-label">YOUR DAILY WALK</p>
          <nav aria-label="Main navigation" className="mt-4 space-y-2">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
                key={to}
                to={to}
              >
                <Icon size={20} strokeWidth={1.7} />
                {label}
                <ChevronRight className="nav-chevron" size={15} />
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar-note">
          <Leaf size={25} strokeWidth={1.4} />
          <p className="font-serif text-xl leading-snug mt-4">
            Rooted in the Word.
            <br />
            Growing together.
          </p>
          <p className="mt-3 text-xs text-muted leading-relaxed">
            A little time with God.
            <br />A little growth, every day.
          </p>
        </div>
        <div className="sidebar-user">
          <Link to="/profile" className="flex min-w-0 items-center gap-3">
            <Avatar user={user} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {user.name}
              </span>
              <span className="block text-xs text-muted capitalize">
                {user.role === "leader" ? "Pastor" : user.role}
              </span>
            </span>
          </Link>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="icon-button"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="mobile-header">
          <Link to="/sermons" aria-label="OneBody home">
            <Brand />
          </Link>
          <Link to="/profile" aria-label="My profile">
            <Avatar user={user} />
          </Link>
        </header>
        <header className="desktop-header">
          <span>A place to listen, reflect, and grow.</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            GROW AT YOUR OWN PACE
          </span>
        </header>
        <PwaStatus />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          Love: Hearts, Eyes, Hands, Feet.
        </footer>
      </div>
      <nav
        className="bottom-nav"
        style={{
          gridTemplateColumns: `repeat(${Math.min(links.length, 5)}, minmax(0, 1fr))`,
        }}
        aria-label="Mobile navigation"
      >
        {links
          .filter((l) => user.role === "member" || l.to !== "/profile")
          .map(({ to, mobile, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={21} strokeWidth={1.7} />
              <span>{mobile}</span>
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AccountPage />} />
      <Route path="/register" element={<AccountPage register />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/sermons" replace />} />
        <Route path="sermons" element={<SermonLibrary />} />
        <Route path="sermons/:sermonId" element={<SermonDetail />} />
        <Route path="growth" element={<GrowthLibrary />} />
        <Route path="growth/:planId" element={<StudyPlanPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="personal" element={<BookmarksPage />} />
        <Route path="personal/journal" element={<JournalPage />} />
        <Route path="personal/journal/new" element={<JournalEditor />} />
        <Route path="personal/journal/:entryId" element={<JournalEditor />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/new" element={<GroupEditor />} />
        <Route path="groups/:groupId" element={<GroupDetail />} />
        <Route path="groups/:groupId/edit" element={<GroupEditor />} />
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<AnalyticsPage />} />
          <Route path="sermons" element={<ManageSermons />} />
          <Route path="sermons/new" element={<SermonEditor />} />
          <Route path="sermons/:sermonId/edit" element={<SermonEditor />} />
          <Route path="plans" element={<ManagePlans />} />
          <Route path="plans/new" element={<PlanEditor />} />
          <Route path="plans/:planId/edit" element={<PlanEditor />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="state-box">
              <h1 className="page-title">A little off the path.</h1>
              <p>This page doesn’t exist.</p>
              <Link to="/sermons" className="btn-primary">
                Back to the library
              </Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
