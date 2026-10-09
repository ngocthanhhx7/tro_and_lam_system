import HttpErrorPage from './HttpErrorPage.jsx';

export default function NotFoundPage() {
  return <HttpErrorPage status={404} embedded />;
}
