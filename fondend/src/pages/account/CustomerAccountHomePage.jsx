import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import CustomerAccountLayout from '../../components/account/CustomerAccountLayout.jsx';
import CustomerAccountOverviewPage from './CustomerAccountOverviewPage.jsx';

export default function CustomerAccountHomePage() {
  const { user } = useAuth();
  if (user?.role !== 'customer') return <Navigate to="/tai-khoan/ho-so" replace />;
  return <CustomerAccountLayout><CustomerAccountOverviewPage /></CustomerAccountLayout>;
}
