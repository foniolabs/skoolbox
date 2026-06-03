import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'teacher' | 'student';
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isLoggedIn, user } = useAuthStore();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to correct dashboard
    if (user?.role === 'student') {
      return <Navigate to="/student" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
