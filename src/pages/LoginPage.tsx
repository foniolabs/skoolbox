import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, User, Lock, GraduationCap } from 'lucide-react';
import { login } from '../lib/tauri/commands';
import { useAuthStore } from '../stores/useAuthStore';
import logo from '../assets/logo.svg';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  // Clear any stale auth when landing on login page
  useEffect(() => {
    logout();
  }, [logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(username, password);
      if (res.success) {
        authLogin(res.user);
        if (res.user.role === 'teacher') {
          navigate('/dashboard');
        } else {
          navigate('/student');
        }
      } else {
        setError(res.message);
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={logo} alt="SkoolBox" className="h-12 w-auto" />
            <span className="text-3xl font-bold text-text-primary">SkoolBox</span>
          </div>
          <p className="text-text-secondary">AI-Powered Teaching Assistant</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[20px] shadow-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <GraduationCap size={24} className="text-primary" />
            <h2 className="text-xl font-bold text-text-primary">Welcome Back</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-[12px] border border-border bg-bg-secondary/50 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-[12px] border border-border bg-bg-secondary/50 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-[12px] border border-red-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Sign Up
              </Link>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 p-3 bg-bg-secondary rounded-[12px]">
            <p className="text-xs font-medium text-text-secondary mb-1">Demo Credentials:</p>
            <div className="flex gap-4 text-xs text-text-muted">
              <div>
                <span className="font-medium">Teacher:</span> teacher / teacher123
              </div>
              <div>
                <span className="font-medium">Student:</span> amina / student123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
