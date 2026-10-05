import { Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import { identityRoutes } from './modules/identity.routes.jsx';

export default function AppRoutes() {
  return <Routes>
    <Route element={<MainLayout />}>
      <Route index element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    {identityRoutes.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
  </Routes>;
}
