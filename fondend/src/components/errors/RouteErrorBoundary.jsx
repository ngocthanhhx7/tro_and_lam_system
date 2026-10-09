import { Component } from 'react';
import HttpErrorPage from '../../pages/HttpErrorPage.jsx';

export default class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const status = Number(this.state.error.status);
    const pageStatus = [400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 500, 502, 503, 504].includes(status)
      ? status
      : 500;
    return <HttpErrorPage status={pageStatus} />;
  }
}
