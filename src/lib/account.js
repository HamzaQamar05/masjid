export const coreInterestLabels = ['Home', 'Prayer', 'Messages', 'Masjids', 'Network', 'Profile'];
export const optionalInterestLabels = ['Events', 'Library', 'Volunteer', 'Jobs', 'Business'];

export const interestByNavKey = {
  home: 'Home',
  prayer: 'Prayer',
  messages: 'Messages',
  organizations: 'Masjids',
  network: 'Network',
  profile: 'Profile',
  events: 'Events',
  library: 'Library',
  volunteers: 'Volunteer',
  jobs: 'Jobs',
  businesses: 'Business'
};

export function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

export function canManageOrgs(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

export function isOrganizationAccount(user) {
  return ['MASJID', 'MSA'].includes(user?.accountType);
}

export function isImamAccount(user) {
  return ['IMAM', 'STUDENT_OF_KNOWLEDGE'].includes(user?.accountType);
}

export function isUserAccount(user) {
  return user?.accountType === 'USER';
}

export function userPreferenceLabels(user) {
  const saved = Array.isArray(user?.interests) ? user.interests : [];
  const known = saved.filter((item) => [...coreInterestLabels, ...optionalInterestLabels].includes(item));
  return new Set([...coreInterestLabels, ...(known.length ? known : optionalInterestLabels)]);
}

export function hasPreference(user, navKey) {
  const label = interestByNavKey[navKey];
  return !label || userPreferenceLabels(user).has(label);
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (!Number.isFinite(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

export function canUseJobs(user) {
  return calculateAge(user?.dateOfBirth) >= 18;
}

export function displayRoleLabel(accountType = 'USER') {
  const labels = {
    USER: 'Community member',
    MASJID: 'Masjid organization',
    MSA: 'Student organization',
    IMAM: 'Imam / scholar',
    STUDENT_OF_KNOWLEDGE: 'Student of knowledge',
    BUSINESS: 'Business',
    ADMIN: 'Platform admin'
  };
  return labels[accountType] || accountType;
}
