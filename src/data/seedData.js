export const seedOrganizations = [
  {
    id: 'imam-bukhari-centre',
    name: 'Imam Bukhari Centre',
    organization: 'Ahle-Hadith Society of Canada',
    type: 'Masjid',
    city: 'Milton',
    address: 'Unit 7 & 8, 50 Steeles Avenue East, Milton, ON L9T 4W9',
    website: 'http://ahlehadithcanada.org/toronto/',
    email: 'toronto@ahlehadithcanada.org',
    phone: '+1-647-549-7909',
    claimed: false,
    verified: false,
    tags: ['Prayer', 'Programs', 'Education', 'Lectures'],
    facilities: ['Prayer hall', 'Jummah', 'Classes', 'Community programs'],
    description: 'A community centre focused on Islamic education, prayer services, programs, and access to qualified scholars.'
  },
  {
    id: 'hicc',
    name: 'HICC Masjid',
    organization: 'Muslim Association of Milton',
    type: 'Masjid',
    city: 'Milton / Oakville',
    address: '4269 Regional Road 25, Oakville, ON L6M 4E9',
    website: 'https://miltonmasjid.com/',
    email: 'info@miltonmasjid.com',
    claimed: false,
    verified: false,
    tags: ['Prayer', 'Quran Classes', 'Hifz', 'Food Bank', 'Youth'],
    facilities: ['Parking', 'Quran classes', 'Hifz', 'Food bank', 'Youth programs'],
    description: 'Serving Milton, Oakville, Burlington, and surrounding communities through prayers, Quran classes, Hifz, food bank, and community programs.'
  },
  {
    id: 'tmu-msa',
    name: 'TMU MSA',
    organization: 'Toronto Metropolitan University',
    type: 'MSA',
    city: 'Toronto',
    address: 'Downtown Toronto',
    website: '#',
    email: 'msa@example.com',
    claimed: false,
    verified: false,
    tags: ['MSA', 'Students', 'Halaqah', 'Volunteers'],
    facilities: ['Student events', 'Speaker invites', 'Volunteer teams'],
    description: 'Student-led Muslim community for events, halaqahs, networking, and campus support.'
  }
];

export const seedPeople = [
  { id: '1', name: 'Sh. Omar Rahman', accountType: 'IMAM', role: 'Imam / Khateeb', city: 'GTA', areas: ['Seerah', 'Identity', 'Family'], available: 'Available weekends' },
  { id: '2', name: 'Ust. Mariam Ali', accountType: 'STUDENT_OF_KNOWLEDGE', role: 'Qur’an teacher', city: 'Mississauga', areas: ['Tafsir', 'Sisters programs', 'MSA talks'], available: 'Open to MSA invites' },
  { id: '3', name: 'Br. Yusuf Khan', accountType: 'BUSINESS', role: 'Startup founder', city: 'Toronto', areas: ['Career', 'Business', 'Mentorship'], available: 'Coffee chats' },
  { id: '4', name: 'Aisha Ahmed', accountType: 'USER', role: 'Volunteer coordinator', city: 'Milton', areas: ['Youth', 'Volunteering', 'Events'], available: 'Open to help' }
];

export const seedEvents = [
  { id: 'local-1', type: 'Lecture', title: 'Friday Night Reminder', host: 'Imam Bukhari Centre', time: 'Friday • 8:30 PM', place: '50 Steeles Ave E, Milton', distance: 'Nearby', tags: ['Lecture', 'Family', 'Community'], going: 42, saved: false },
  { id: 'local-2', type: 'Youth', title: 'Youth Halaqah', host: 'HICC Masjid', time: 'Saturday • 7:00 PM', place: '4269 Regional Road 25, Oakville', distance: '15 min away', tags: ['Youth', 'Halaqah', 'MSA'], going: 28, saved: true },
  { id: 'local-3', type: 'MSA', title: 'Campus Iftar Planning', host: 'TMU MSA', time: 'Tuesday • 6:00 PM', place: 'Downtown Toronto', distance: 'Campus', tags: ['MSA', 'Volunteers', 'Students'], going: 16, saved: false }
];

export const prayers = [['Fajr','4:12'], ['Dhuhr','1:18'], ['Asr','5:24'], ['Maghrib','9:01'], ['Isha','10:32']];
