const BASE_ADMIN_PASS = 'amelia2024';

export function checkAdminPassword(pw) {
  const stored = localStorage.getItem('a_pass_admin');
  return pw === (stored || BASE_ADMIN_PASS);
}
