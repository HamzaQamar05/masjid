export const ORGANIZATION_OPERATOR_ROLE_KEYWORDS = [
  'admin',
  'manager',
  'coordinator',
  'imam',
  'khateeb',
  'staff',
  'director',
  'lead',
  'owner'
];

export function canOperateOrganizationRole(roleLabel = '') {
  return ORGANIZATION_OPERATOR_ROLE_KEYWORDS.some((keyword) => String(roleLabel || '').toLowerCase().includes(keyword));
}

export function organizationManagerRoleFilters() {
  return ORGANIZATION_OPERATOR_ROLE_KEYWORDS.map((keyword) => ({ roleLabel: { contains: keyword, mode: 'insensitive' } }));
}
