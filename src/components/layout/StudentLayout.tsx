'use client';

import { Suspense, type ReactNode } from 'react';
import { BookOpen, ClipboardCheck, Home, TrendingUp } from 'lucide-react';
import Sidebar, { type SidebarGroup } from './Sidebar';
import DemoBanner from './DemoBanner';
import PageLoading from './PageLoading';

const groups: SidebarGroup[] = [
  {
    items: [
      { label: 'Home', to: '/student', icon: Home, end: true },
      { label: 'My Subjects', to: '/student/subjects', icon: BookOpen },
      { label: 'Quizzes', to: '/student/quizzes', icon: ClipboardCheck },
      { label: 'My Progress', to: '/student/progress', icon: TrendingUp },
    ],
  },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-app lg:pl-64">
      <Sidebar groups={groups} roleLabel="Student" />
      <DemoBanner />
      <main className="mx-auto max-w-[1280px]">
        <Suspense fallback={<PageLoading />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
