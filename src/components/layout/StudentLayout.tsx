import { Outlet } from 'react-router-dom';
import StudentNavBar from './StudentNavBar';

export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-bg-app">
      <StudentNavBar />
      <main className="mx-auto max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
}
