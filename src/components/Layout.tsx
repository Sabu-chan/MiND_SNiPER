import { Outlet } from 'react-router';

export function Layout() {
  return (
    <main className="layout">
      <Outlet />
    </main>
  );
}
