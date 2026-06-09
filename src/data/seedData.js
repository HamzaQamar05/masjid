export const prayers = [
  ['Fajr', '4:12'],
  ['Dhuhr', '1:18'],
  ['Asr', '5:24'],
  ['Maghrib', '9:01'],
  ['Isha', '10:32']
];

export const platformStats = [
  { label: 'Organizations', value: '128' },
  { label: 'Events this month', value: '46' },
  { label: 'Volunteer roles', value: '214' },
  { label: 'Donations raised', value: '$82k' }
];

export const seedOrganizations = [
  {
    id: 'imam-bukhari-centre',
    name: 'Imam Bukhari Centre',
    type: 'Masjid',
    city: 'Milton',
    address: 'Unit 7 and 8, 50 Steeles Avenue East, Milton, ON',
    website: 'http://ahlehadithcanada.org/toronto/',
    email: 'toronto@ahlehadithcanada.org',
    phone: '+1-647-549-7909',
    verified: true,
    followers: '3.8k',
    cover: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=80',
    tags: ['Prayer', 'Education', 'Lectures', 'Family'],
    facilities: ['Jummah', 'Classes', 'Community programs'],
    description: 'A community centre focused on Islamic education, prayer services, programs, and access to qualified scholars.'
  },
  {
    id: 'hicc',
    name: 'HICC Masjid',
    type: 'Masjid',
    city: 'Milton / Oakville',
    address: '4269 Regional Road 25, Oakville, ON',
    website: 'https://miltonmasjid.com/',
    email: 'info@miltonmasjid.com',
    verified: true,
    followers: '5.1k',
    cover: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80',
    tags: ['Quran Classes', 'Hifz', 'Food Bank', 'Youth'],
    facilities: ['Parking', 'Quran classes', 'Hifz', 'Food bank'],
    description: 'Serving Milton, Oakville, Burlington, and surrounding communities through prayer, Quran programs, food bank, and youth work.'
  },
  {
    id: 'tmu-msa',
    name: 'TMU MSA',
    type: 'MSA',
    city: 'Toronto',
    address: 'Downtown Toronto',
    website: '#',
    email: 'msa@example.com',
    verified: false,
    followers: '1.9k',
    cover: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    tags: ['Students', 'Halaqah', 'Volunteers', 'Mentorship'],
    facilities: ['Student events', 'Speaker invites', 'Volunteer teams'],
    description: 'Student-led Muslim community for events, halaqahs, networking, and campus support.'
  },
  {
    id: 'mercy-relief',
    name: 'Mercy Relief GTA',
    type: 'Islamic Charity',
    city: 'Greater Toronto Area',
    address: 'Mobile teams across the GTA',
    website: '#',
    email: 'volunteer@example.com',
    verified: true,
    followers: '8.4k',
    cover: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80',
    tags: ['Charity', 'Food Bank', 'Refugee Support', 'Volunteers'],
    facilities: ['Food packing', 'Distribution teams', 'Donation campaigns'],
    description: 'Volunteer-led relief programs connecting donors and volunteers with local families who need support.'
  }
];

export const seedPeople = [
  {
    id: '1',
    name: 'Sh. Omar Rahman',
    accountType: 'IMAM',
    role: 'Imam / Khateeb',
    city: 'GTA',
    areas: ['Seerah', 'Identity', 'Family'],
    available: 'Available weekends',
    headline: 'Helping youth build confident Muslim identity in public life.'
  },
  {
    id: '2',
    name: 'Ust. Mariam Ali',
    accountType: 'STUDENT_OF_KNOWLEDGE',
    role: 'Quran teacher',
    city: 'Mississauga',
    areas: ['Tafsir', 'Sisters Programs', 'MSA Talks'],
    available: 'Open to MSA invites',
    headline: 'Weekend tafsir, sisters circles, and student mentorship.'
  },
  {
    id: '3',
    name: 'Br. Yusuf Khan',
    accountType: 'BUSINESS',
    role: 'Startup founder',
    city: 'Toronto',
    areas: ['Career', 'Business', 'Mentorship'],
    available: 'Coffee chats',
    headline: 'Cloud engineering mentor for students entering tech.'
  },
  {
    id: '4',
    name: 'Aisha Ahmed',
    accountType: 'USER',
    role: 'Volunteer coordinator',
    city: 'Milton',
    areas: ['Youth', 'Volunteering', 'Events'],
    available: 'Open to help',
    headline: 'Coordinating youth nights, registration desks, and food drives.'
  }
];

export const seedEvents = [
  {
    id: 'local-1',
    type: 'Lecture',
    title: 'Friday Night Reminder',
    host: 'Imam Bukhari Centre',
    time: 'Friday, 8:30 PM',
    place: '50 Steeles Ave E, Milton',
    distance: 'Nearby',
    tags: ['Lecture', 'Family', 'Community'],
    going: 142,
    saved: false,
    description: 'A weekly reminder for families with short reflections, Quran recitation, and refreshments.'
  },
  {
    id: 'local-2',
    type: 'Youth',
    title: 'Youth Halaqah and Basketball',
    host: 'HICC Masjid',
    time: 'Saturday, 7:00 PM',
    place: '4269 Regional Road 25, Oakville',
    distance: '15 min away',
    tags: ['Youth', 'Halaqah', 'Sports'],
    going: 86,
    saved: true,
    description: 'A structured youth night with halaqah, food, and gym time for high school and university students.'
  },
  {
    id: 'local-3',
    type: 'MSA',
    title: 'Campus Iftar Planning',
    host: 'TMU MSA',
    time: 'Tuesday, 6:00 PM',
    place: 'Downtown Toronto',
    distance: 'Campus',
    tags: ['MSA', 'Volunteers', 'Students'],
    going: 34,
    saved: false,
    description: 'Planning session for Ramadan iftar logistics, sponsor outreach, and volunteer teams.'
  },
  {
    id: 'local-4',
    type: 'Fundraiser',
    title: 'Winter Relief Packing Night',
    host: 'Mercy Relief GTA',
    time: 'Sunday, 2:00 PM',
    place: 'Mississauga Warehouse',
    distance: '24 min away',
    tags: ['Charity', 'Family', 'Volunteers'],
    going: 210,
    saved: false,
    description: 'Pack food and hygiene kits for families across the GTA. Student hours can be verified.'
  }
];

export const feedPosts = [
  {
    id: 'post-1',
    org: 'HICC Masjid',
    role: 'Masjid',
    time: '18m',
    type: 'Announcement',
    title: 'Volunteer teams needed for the food bank this weekend',
    body: 'We need help with intake, packing, delivery routing, and setup. Students can receive verified volunteer hours.',
    tags: ['Volunteer', 'Food Bank', 'Students'],
    reactions: 92,
    comments: 14
  },
  {
    id: 'post-2',
    org: 'Sh. Omar Rahman',
    role: 'Imam / Speaker',
    time: '1h',
    type: 'Lecture',
    title: 'New khutbah uploaded: building trust inside the community',
    body: 'Audio and notes are available now. Masjid admins can pin this lecture to their organization page.',
    tags: ['Lecture', 'Khutbah', 'Audio'],
    reactions: 184,
    comments: 26
  },
  {
    id: 'post-3',
    org: 'TMU MSA',
    role: 'MSA',
    time: '3h',
    type: 'Event',
    title: 'Career night: Muslim professionals in cybersecurity',
    body: 'Students can meet mentors, ask questions, and find internship leads. Registration opens tonight.',
    tags: ['MSA', 'Career', 'Mentorship'],
    reactions: 231,
    comments: 37
  }
];

export const volunteerRoles = [
  { title: 'Food bank intake lead', org: 'HICC Masjid', hours: '4 hrs', applicants: 18, skill: 'Operations' },
  { title: 'Youth night setup crew', org: 'Imam Bukhari Centre', hours: '3 hrs', applicants: 11, skill: 'Events' },
  { title: 'Social media editor', org: 'TMU MSA', hours: 'Remote', applicants: 7, skill: 'Design' },
  { title: 'Donation desk support', org: 'Mercy Relief GTA', hours: '2 hrs', applicants: 23, skill: 'Fundraising' }
];

export const lectures = [
  { title: 'Tafsir of Surah Al-Kahf', speaker: 'Ust. Mariam Ali', format: 'Audio + notes', category: 'Tafsir' },
  { title: 'The Seerah for High School Students', speaker: 'Sh. Omar Rahman', format: 'Video', category: 'Seerah' },
  { title: 'Muslim Identity at Work', speaker: 'Br. Yusuf Khan', format: 'Article', category: 'Career' }
];

export const businesses = [
  { name: 'Crescent Dental', category: 'Dentist', city: 'Milton', rating: '4.9' },
  { name: 'Halal Homes Realty', category: 'Realtor', city: 'GTA', rating: '4.8' },
  { name: 'Noor Tutors', category: 'Tutoring', city: 'Online', rating: '5.0' }
];

export const dashboardMetrics = [
  { label: 'Event registrations', value: '1,248', change: '+18%' },
  { label: 'Volunteer hours', value: '642', change: '+31%' },
  { label: 'Campaign donations', value: '$24.6k', change: '+12%' },
  { label: 'Follower growth', value: '3.2k', change: '+9%' }
];
