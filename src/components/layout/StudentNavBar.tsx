import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, BookOpen, ClipboardCheck, TrendingUp, Home } from 'lucide-react';
import logo from '../../assets/logo.svg';
import { useAuthStore } from '../../stores/useAuthStore';

const tabs = [
  { label: 'Home', to: '/student', icon: Home },
  { label: 'My Subjects', to: '/student/subjects', icon: BookOpen },
  { label: 'Quizzes', to: '/student/quizzes', icon: ClipboardCheck },
  { label: 'My Progress', to: '/student/progress', icon: TrendingUp },
];

export default function StudentNavBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src={logo} alt="SkoolBox" className="h-8 w-auto" />
          <span className="text-lg font-bold text-text-primary">SkoolBox</span>
        </div>

        {/* Center navigation tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              end={to === '/student'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'text-text-primary bg-bg-secondary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors">
            <Bell className="h-5 w-5" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-bg-secondary transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent/80 to-accent text-white">
                <User className="h-4 w-4" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-text-primary">
                {user?.full_name?.split(' ')[0] || 'Student'}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-white py-1 shadow-lg">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">{user?.full_name}</p>
                  <p className="text-xs text-text-muted">Student</p>
                </div>
                <button className="flex w-full items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors">
                  Profile
                </button>
                <div className="border-t border-border">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-bg-secondary transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {tabs.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/student'}
            className={({ isActive }) =>
              `flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive ? 'text-text-primary bg-bg-secondary' : 'text-text-secondary'
              }`
            }
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
