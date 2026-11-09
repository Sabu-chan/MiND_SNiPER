import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { getBrowserStorage } from './app/storage';
import { routes } from './routes';

const router = createBrowserRouter(routes);
const storage = getBrowserStorage();

export function App() {
  return (
    <AppProviders storage={storage}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
