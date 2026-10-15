export function loginDestination(role) {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/';
}
