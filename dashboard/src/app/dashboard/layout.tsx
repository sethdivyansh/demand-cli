import KBar from '@/components/kbar';
import Header from '@/components/layout/header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Persisting the sidebar state in the cookie.
  return (
    <KBar>
      <Header />
      {/* page main content */}
      {children}
      {/* page main content ends */}
    </KBar>
  );
}
