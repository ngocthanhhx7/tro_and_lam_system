import ContentAdminPage from '../../pages/admin/content/ContentAdminPage.jsx';
import NfcAdminPage from '../../pages/admin/content/NfcAdminPage.jsx';
import NfcStoryPage from '../../pages/stories/NfcStoryPage.jsx';
import PublishedPage from '../../pages/stories/PublishedPage.jsx';
import StoryPage from '../../pages/stories/StoryPage.jsx';

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
