import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { ConfigPage } from './pages/ConfigPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlayPage } from './pages/PlayPage';
import { RulesPage } from './pages/RulesPage';
import { SetupPage } from './pages/SetupPage';
import { TopPage } from './pages/TopPage';
import { ROUTE_PATHS } from './routePaths';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: ROUTE_PATHS.top, element: <TopPage /> },
      { path: ROUTE_PATHS.setup, element: <SetupPage /> },
      { path: ROUTE_PATHS.play, element: <PlayPage /> },
      { path: ROUTE_PATHS.rules, element: <RulesPage /> },
      { path: ROUTE_PATHS.config, element: <ConfigPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
