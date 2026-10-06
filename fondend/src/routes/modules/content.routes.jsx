import { lazy } from 'react';

const ContentAdminPage = lazy(() => import('../../pages/admin/content/ContentAdminPage.jsx'));
const NfcAdminPage = lazy(() => import('../../pages/admin/content/NfcAdminPage.jsx'));
const NfcStoryPage = lazy(() => import('../../pages/stories/NfcStoryPage.jsx'));
const PublishedPage = lazy(() => import('../../pages/stories/PublishedPage.jsx'));
const StoryPage = lazy(() => import('../../pages/stories/StoryPage.jsx'));

export const publicContentRouteFragments = Object.freeze([
  { path: 'cau-chuyen/:slug', element: <StoryPage /> },
  { path: 'nfc/:publicId', element: <NfcStoryPage /> },
  { path: 'trang/:slug', element: <PublishedPage /> },
]);

export const adminContentRouteFragments = Object.freeze([
  { path: 'admin/content', requiredCapability: 'content.manage', element: <ContentAdminPage /> },
  { path: 'admin/nfc', requiredCapability: 'content.manage', element: <NfcAdminPage /> },
]);

export const contentRouteFragments = Object.freeze([...publicContentRouteFragments, ...adminContentRouteFragments]);
