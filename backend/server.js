import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  'https://ummah-connect-psi.vercel.app'
].filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
const memoryCache = new Map();
const onlineUsers = new Map();
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  standardHeaders: true,
  legacyHeaders: false
});

if (redis) {
  redis.connect().catch((error) => console.error('Redis unavailable, using memory fallback', error.message));
  redis.on('error', (error) => console.error('Redis error', error.message));
}

const fallbackMasjids = [
  {
    id: 'fallback-milton-islamic-centre',
    name: 'Milton Islamic Centre',
    type: 'Masjid',
    city: 'Milton',
    address: '8069 Esquesing Line, Milton, ON L9T 9C8',
    latitude: 43.5403,
    longitude: -79.8427,
    website: 'https://miltonislamiccentre.com/',
    verified: true
  },
  {
    id: 'fallback-hicc',
    name: 'HICC Masjid',
    type: 'Masjid',
    city: 'Oakville',
    address: '4269 Regional Road 25, Oakville, ON L6M 4E9',
    latitude: 43.4818,
    longitude: -79.8141,
    website: 'https://miltonmasjid.com/',
    verified: true
  },
  {
    id: 'fallback-imam-bukhari-centre',
    name: 'Imam Bukhari Centre',
    type: 'Masjid',
    city: 'Milton',
    address: '50 Steeles Avenue East, Unit 7 and 8, Milton, ON L9T 4W9',
    latitude: 43.5239,
    longitude: -79.8891,
    website: 'http://ahlehadithcanada.org/toronto/',
    verified: true
  }
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

io.use((socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!rawToken) return next(new Error('Unauthorized'));
    socket.user = jwt.verify(rawToken, process.env.JWT_SECRET || 'dev_secret');
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
  socket.join(userRoom(userId));
  emitPresence();
  emitUnread(userId).catch(console.error);

  socket.on('thread:join', ({ otherUserId }) => {
    if (otherUserId) socket.join(threadRoom(userId, otherUserId));
  });

  socket.on('thread:leave', ({ otherUserId }) => {
    if (otherUserId) socket.leave(threadRoom(userId, otherUserId));
  });

  socket.on('typing:start', ({ receiverId }) => {
    if (!receiverId) return;
    io.to(threadRoom(userId, receiverId)).except(socket.id).emit('typing:update', { userId, isTyping: true });
  });

  socket.on('typing:stop', ({ receiverId }) => {
    if (!receiverId) return;
    io.to(threadRoom(userId, receiverId)).except(socket.id).emit('typing:update', { userId, isTyping: false });
  });

  socket.on('disconnect', () => {
    const count = (onlineUsers.get(userId) || 1) - 1;
    if (count <= 0) onlineUsers.delete(userId);
    else onlineUsers.set(userId, count);
    emitPresence();
  });
});

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    bio: user.bio,
    city: user.city,
    location: user.location,
    education: user.education,
    experience: user.experience,
    skills: user.skills || [],
    interests: user.interests || [],
    languages: user.languages || [],
    hobbies: user.hobbies || [],
    availability: user.availability,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt
  };
}

function publicOrganization(org, viewerId) {
  if (!org) return null;
  const followers = org.followers || [];
  const events = (org.events || []).map((event) => ({
    ...event,
    registrations: (event.registrations || []).map((registration) => ({
      ...registration,
      user: publicUser(registration.user)
    }))
  }));
  const opportunities = (org.opportunities || []).map((opportunity) => ({
    ...opportunity,
    applications: (opportunity.applications || []).map((application) => ({
      ...application,
      applicant: publicUser(application.applicant)
    }))
  }));
  const { followers: _followers, events: _events, opportunities: _opportunities, ...safeOrg } = org;
  return {
    ...safeOrg,
    events,
    opportunities,
    followers: followers.map((follow) => ({ ...follow, user: publicUser(follow.user) })),
    followerCount: followers.length,
    isFollowing: viewerId ? followers.some((follow) => follow.userId === viewerId) : false,
    notifyPrayers: viewerId ? Boolean(followers.find((follow) => follow.userId === viewerId)?.notifyPrayers) : false
  };
}

async function canManageOrganization(user, organizationId) {
  if (user.accountType === 'ADMIN') return true;
  if (!organizationId) return false;
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  return Boolean(org && org.ownerId === user.id && ['MASJID', 'MSA', 'ADMIN'].includes(user.accountType));
}

async function ensureFallbackOrganizations() {
  for (const masjid of fallbackMasjids) {
    const existing = await prisma.organization.findFirst({ where: { name: masjid.name } });
    if (!existing) {
      await prisma.organization.create({
        data: {
          name: masjid.name,
          type: 'MASJID',
          city: masjid.city,
          address: masjid.address,
          website: masjid.website,
          latitude: masjid.latitude,
          longitude: masjid.longitude,
          description: `${masjid.name} community profile. Admins can claim and customize this page during onboarding.`,
          verified: masjid.verified,
          facilities: 'Prayer hall, community programs, events'
        }
      });
    }
  }
}

function createToken(user) {
  return jwt.sign({ id: user.id, accountType: user.accountType }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
}

function threadIdFor(a, b) {
  return [a, b].sort().join(':');
}

function userRoom(userId) {
  return `user:${userId}`;
}

function threadRoom(a, b) {
  return `thread:${threadIdFor(a, b)}`;
}

function serializeMessage(message) {
  const reactions = message.reactions || [];
  return {
    ...message,
    content: message.deletedAt ? 'This message was unsent' : message.content,
    isDeleted: Boolean(message.deletedAt),
    sender: publicUser(message.sender),
    receiver: publicUser(message.receiver),
    reactions: reactions.map((reaction) => ({
      id: reaction.id,
      emoji: reaction.emoji,
      userId: reaction.userId,
      user: publicUser(reaction.user),
      createdAt: reaction.createdAt
    }))
  };
}

async function cacheGet(key) {
  if (redis?.status === 'ready') {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  const item = memoryCache.get(key);
  if (!item || item.expiresAt < Date.now()) return null;
  return item.value;
}

async function cacheSet(key, value, seconds = 30) {
  if (redis?.status === 'ready') {
    await redis.set(key, JSON.stringify(value), 'EX', seconds);
    return;
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
}

async function cacheDel(key) {
  if (redis?.status === 'ready') {
    await redis.del(key);
    return;
  }
  memoryCache.delete(key);
}

async function unreadCount(userId) {
  const key = `unread:${userId}`;
  const cached = await cacheGet(key);
  if (cached != null) return cached;
  const count = await prisma.message.count({ where: { receiverId: userId, readAt: null, deletedAt: null } });
  await cacheSet(key, count, 20);
  return count;
}

async function invalidateUnread(userId) {
  await cacheDel(`unread:${userId}`);
}

function emitPresence() {
  io.emit('presence:update', { onlineUserIds: [...onlineUsers.keys()] });
}

async function emitUnread(userId) {
  io.to(userRoom(userId)).emit('messages:unread', { unread: await unreadCount(userId) });
}

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret');
    const currentUser = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!currentUser) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: currentUser.id, accountType: currentUser.accountType };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.accountType !== 'ADMIN') return res.status(403).json({ error: 'Admin account required' });
  next();
}

function canPostEvent(req, res, next) {
  if (!['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Only masjid, MSA, or admin accounts can post events right now' });
  next();
}

function organizationType(value) {
  return ['MASJID', 'MSA'].includes(String(value || '').toUpperCase()) ? String(value).toUpperCase() : 'MASJID';
}

function distanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withDistance(items, latitude, longitude) {
  const origin = { latitude: Number(latitude), longitude: Number(longitude) };
  return items
    .map((item) => {
      const km = item.latitude && item.longitude ? distanceKm(origin, item) : null;
      return {
        ...item,
        distanceKm: km == null ? null : Number(km.toFixed(2)),
        walkingMinutes: km == null ? null : Math.max(1, Math.round((km / 5) * 60)),
        drivingMinutes: km == null ? null : Math.max(1, Math.round((km / 35) * 60 + 3))
      };
    })
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
}

function osmAddress(tags = {}) {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:province'] || tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean);
  return parts.join(', ');
}

app.get('/', (_, res) => res.json({ message: 'Ummah Connect API running' }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, city, bio } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        accountType: 'USER',
        city,
        bio,
        skills: normalizeList(req.body.skills),
        interests: normalizeList(req.body.interests),
        languages: normalizeList(req.body.languages),
        hobbies: normalizeList(req.body.hobbies)
      }
    });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.code === 'P2002' ? 'Email already exists' : err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() || '' } });
  if (!user) return res.status(401).json({ error: 'Invalid login' });
  const valid = await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid login' });
  res.json({ token: createToken(user), user: publicUser(user) });
});

app.get('/api/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json(publicUser(user));
});

app.put('/api/me', auth, async (req, res) => {
  const data = {
    name: req.body.name,
    bio: req.body.bio,
    city: req.body.city,
    location: req.body.location,
    education: req.body.education,
    experience: req.body.experience,
    availability: req.body.availability,
    skills: normalizeList(req.body.skills),
    interests: normalizeList(req.body.interests),
    languages: normalizeList(req.body.languages),
    hobbies: normalizeList(req.body.hobbies),
    avatarUrl: req.body.avatarUrl
  };
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user));
});

app.get('/api/users', auth, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  const connections = await prisma.connection.findMany({
    where: { OR: [{ requesterId: req.user.id }, { receiverId: req.user.id }] }
  });
  const connectionMap = new Map();
  connections.forEach((connection) => {
    const otherId = connection.requesterId === req.user.id ? connection.receiverId : connection.requesterId;
    connectionMap.set(otherId, connection.status);
  });
  res.json(users.map((user) => ({ ...publicUser(user), connectionStatus: user.id === req.user.id ? 'SELF' : connectionMap.get(user.id) || 'NONE' })));
});

app.get('/api/users/:id/social', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const [connections, follows] = await Promise.all([
    prisma.connection.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: req.params.id }, { receiverId: req.params.id }] },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.organizationFollow.findMany({
      where: { userId: req.params.id },
      include: { organization: { include: { followers: true, events: true, opportunities: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  res.json({
    user: publicUser(user),
    connections: connections.map((connection) => publicUser(connection.requesterId === req.params.id ? connection.receiver : connection.requester)),
    followingMasjids: follows.map((follow) => publicOrganization(follow.organization, req.user.id))
  });
});

app.delete('/api/users/:id', auth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Admins cannot delete their own active session account' });
  await prisma.eventRegistration.deleteMany({ where: { userId: req.params.id } });
  await prisma.organizationFollow.deleteMany({ where: { userId: req.params.id } });
  await prisma.volunteerApplication.deleteMany({ where: { applicantId: req.params.id } });
  await prisma.message.deleteMany({ where: { OR: [{ senderId: req.params.id }, { receiverId: req.params.id }] } });
  await prisma.connection.deleteMany({ where: { OR: [{ requesterId: req.params.id }, { receiverId: req.params.id }] } });
  await prisma.event.deleteMany({ where: { createdById: req.params.id } });
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

app.put('/api/users/:id/role', auth, requireAdmin, async (req, res) => {
  const allowed = ['USER', 'MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'ADMIN'];
  if (!allowed.includes(req.body.accountType)) return res.status(400).json({ error: 'Invalid account type' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { accountType: req.body.accountType } });
  res.json(publicUser(user));
});

app.post('/api/connections/:userId', auth, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot connect with yourself' });
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: req.user.id, receiverId: req.params.userId },
        { requesterId: req.params.userId, receiverId: req.user.id }
      ]
    }
  });
  if (existing) return res.json(existing);
  const connection = await prisma.connection.create({ data: { requesterId: req.user.id, receiverId: req.params.userId } });
  res.json(connection);
});

app.put('/api/connections/:connectionId', auth, async (req, res) => {
  const connection = await prisma.connection.findUnique({ where: { id: req.params.connectionId } });
  if (!connection || connection.receiverId !== req.user.id) return res.status(404).json({ error: 'Connection request not found' });
  const updated = await prisma.connection.update({ where: { id: connection.id }, data: { status: req.body.status === 'DECLINED' ? 'DECLINED' : 'ACCEPTED' } });
  res.json(updated);
});

app.get('/api/connections', auth, async (req, res) => {
  const connections = await prisma.connection.findMany({
    where: { OR: [{ requesterId: req.user.id }, { receiverId: req.user.id }] },
    include: { requester: true, receiver: true },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(connections.map((connection) => ({
    ...connection,
    requester: publicUser(connection.requester),
    receiver: publicUser(connection.receiver)
  })));
});

app.get('/api/me/organizations', auth, async (req, res) => {
  const where = req.user.accountType === 'ADMIN' ? {} : { ownerId: req.user.id };
  const organizations = await prisma.organization.findMany({
    where,
    include: {
      followers: { include: { user: true } },
      events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
      opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(organizations.map((org) => publicOrganization(org, req.user.id)));
});

app.get('/api/me/notification-masjids', auth, async (req, res) => {
  const follows = await prisma.organizationFollow.findMany({
    where: { userId: req.user.id, notifyPrayers: true },
    include: { organization: { include: { followers: true, events: true, opportunities: true } } }
  });
  res.json(follows.map((follow) => publicOrganization(follow.organization, req.user.id)));
});

app.get('/api/organizations', async (req, res) => {
  await ensureFallbackOrganizations();
  const header = req.headers.authorization;
  let viewerId = null;
  if (header) {
    try {
      viewerId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
    } catch {
      viewerId = null;
    }
  }
  const organizations = await prisma.organization.findMany({
    include: {
      events: { orderBy: { startTime: 'asc' } },
      opportunities: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      followers: true
    },
    orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }]
  });
  res.json(organizations.map((org) => publicOrganization(org, viewerId)));
});

app.post('/api/organizations', auth, async (req, res) => {
  if (!['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Admin must upgrade your account before you can create an organization' });
  const { name, type, city, address, website, email, phone, description, facilities, latitude, longitude, imageUrl, heroImageUrl, donationUrl, instagramUrl, facebookUrl, prayerTimes, iqamahTimes } = req.body;
  const org = await prisma.organization.create({
    data: {
      name,
      type: organizationType(type),
      city,
      address,
      website,
      email,
      phone,
      description,
      facilities: Array.isArray(facilities) ? facilities.join(', ') : facilities,
      latitude: latitude == null ? null : Number(latitude),
      longitude: longitude == null ? null : Number(longitude),
      imageUrl,
      heroImageUrl,
      donationUrl,
      instagramUrl,
      facebookUrl,
      prayerTimes,
      iqamahTimes,
      ownerId: req.user.id,
      claimed: true,
      verified: req.user.accountType === 'ADMIN'
    }
  });
  res.json(org);
});

app.get('/api/organizations/:id', async (req, res) => {
  const header = req.headers.authorization;
  let viewerId = null;
  if (header) {
    try {
      viewerId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
    } catch {
      viewerId = null;
    }
  }
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
      opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } },
      followers: { include: { user: true } }
    }
  });
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json(publicOrganization(org, viewerId));
});

app.put('/api/organizations/:id', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can update it' });
  const allowed = ['name', 'type', 'city', 'address', 'website', 'email', 'phone', 'description', 'facilities', 'imageUrl', 'heroImageUrl', 'donationUrl', 'instagramUrl', 'facebookUrl', 'prayerTimes', 'iqamahTimes'];
  const data = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) data[key] = key === 'facilities' && Array.isArray(req.body[key]) ? req.body[key].join(', ') : req.body[key];
  });
  if (data.type !== undefined) data.type = organizationType(data.type);
  if (req.body.latitude !== undefined) data.latitude = req.body.latitude === '' ? null : Number(req.body.latitude);
  if (req.body.longitude !== undefined) data.longitude = req.body.longitude === '' ? null : Number(req.body.longitude);
  const org = await prisma.organization.update({ where: { id: req.params.id }, data });
  res.json(org);
});

app.post('/api/organizations/:id/follow', auth, async (req, res) => {
  const notifyPrayers = Boolean(req.body.notifyPrayers);
  if (notifyPrayers) {
    const activeNotificationFollows = await prisma.organizationFollow.count({ where: { userId: req.user.id, notifyPrayers: true, organizationId: { not: req.params.id } } });
    if (activeNotificationFollows >= 2) return res.status(400).json({ error: 'You can enable prayer notifications for up to 2 masjids' });
  }
  const follow = await prisma.organizationFollow.upsert({
    where: { organizationId_userId: { organizationId: req.params.id, userId: req.user.id } },
    create: { organizationId: req.params.id, userId: req.user.id, notifyPrayers },
    update: { notifyPrayers }
  });
  res.json(follow);
});

app.delete('/api/organizations/:id/follow', auth, async (req, res) => {
  await prisma.organizationFollow.deleteMany({ where: { organizationId: req.params.id, userId: req.user.id } });
  res.json({ message: 'Unfollowed' });
});

app.get('/api/events', async (_, res) => {
  const events = await prisma.event.findMany({
    include: { organization: true, createdBy: { select: { id: true, name: true, accountType: true } }, registrations: { include: { user: true } } },
    orderBy: { startTime: 'asc' }
  });
  res.json(events.map((event) => ({ ...event, registrations: event.registrations.map((registration) => ({ ...registration, user: publicUser(registration.user) })) })));
});

app.post('/api/events', auth, canPostEvent, async (req, res) => {
  const { title, description, location, startTime, endTime, organizationId, capacity, requiresApproval } = req.body;
  if (!title || !startTime) return res.status(400).json({ error: 'Title and start time are required' });
  if (organizationId && !(await canManageOrganization(req.user, organizationId))) return res.status(403).json({ error: 'You can only post under an organization you manage' });
  const event = await prisma.event.create({
    data: {
      title,
      description,
      location,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      capacity: capacity ? Number(capacity) : null,
      requiresApproval: Boolean(requiresApproval),
      organizationId,
      createdById: req.user.id
    }
  });
  res.json(event);
});

app.delete('/api/events/:eventId', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can delete this event' });
  await prisma.eventRegistration.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });
  res.json({ message: 'Event deleted' });
});

app.post('/api/events/:eventId/register', auth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId }, include: { registrations: true } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.capacity && event.registrations.filter((registration) => registration.status !== 'DENIED').length >= event.capacity) return res.status(400).json({ error: 'Event is full' });
    const registration = await prisma.eventRegistration.create({ data: { userId: req.user.id, eventId: req.params.eventId, status: event.requiresApproval ? 'PENDING' : 'APPROVED' } });
    res.json(registration);
  } catch {
    res.status(400).json({ error: 'Already registered or event not found' });
  }
});

app.put('/api/events/:eventId/registrations/:registrationId', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can update attendance' });
  const status = ['APPROVED', 'DENIED', 'ATTENDED'].includes(req.body.status) ? req.body.status : 'APPROVED';
  const registration = await prisma.eventRegistration.update({ where: { id: req.params.registrationId }, data: { status } });
  res.json(registration);
});

app.delete('/api/events/:eventId/register', auth, async (req, res) => {
  await prisma.eventRegistration.deleteMany({ where: { userId: req.user.id, eventId: req.params.eventId } });
  res.json({ message: 'Registration removed' });
});

app.get('/api/opportunities', auth, async (req, res) => {
  const where = { isActive: true };
  if (req.query.type) where.type = String(req.query.type).toUpperCase();
  if (req.query.organizationId) where.organizationId = String(req.query.organizationId);
  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { organization: true, applications: { where: { applicantId: req.user.id } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(opportunities);
});

app.post('/api/organizations/:id/opportunities', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can create opportunities' });
  const type = ['JOB', 'VOLUNTEER', 'OPPORTUNITY'].includes(String(req.body.type || '').toUpperCase()) ? String(req.body.type).toUpperCase() : 'OPPORTUNITY';
  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId: req.params.id,
      title: req.body.title,
      description: req.body.description,
      type,
      location: req.body.location,
      skills: normalizeList(req.body.skills),
      hours: req.body.hours == null || req.body.hours === '' ? null : Number(req.body.hours)
    }
  });
  res.json(opportunity);
});

app.post('/api/opportunities/:id/apply', auth, async (req, res) => {
  const application = await prisma.volunteerApplication.upsert({
    where: { opportunityId_applicantId: { opportunityId: req.params.id, applicantId: req.user.id } },
    create: { opportunityId: req.params.id, applicantId: req.user.id },
    update: {}
  });
  res.json(application);
});

app.put('/api/opportunities/:id/applications/:applicationId', auth, async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
  if (!(await canManageOrganization(req.user, opportunity.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can manage applications' });
  const status = ['PENDING', 'APPROVED', 'DENIED', 'COMPLETED'].includes(req.body.status) ? req.body.status : 'APPROVED';
  const application = await prisma.volunteerApplication.update({
    where: { id: req.params.applicationId },
    data: {
      status,
      approvedHours: req.body.approvedHours == null ? undefined : Number(req.body.approvedHours),
      checkedInAt: req.body.checkedInAt === true ? new Date() : undefined,
      checkedOutAt: req.body.checkedOutAt === true ? new Date() : undefined,
      approvedById: req.user.id
    }
  });
  res.json(application);
});

app.get('/api/messages/threads', auth, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
    include: { sender: true, receiver: true },
    orderBy: { createdAt: 'desc' }
  });
  const threads = new Map();
  messages.forEach((message) => {
    const other = message.senderId === req.user.id ? message.receiver : message.sender;
    if (!threads.has(other.id)) {
      threads.set(other.id, {
        user: publicUser(other),
        lastMessage: message.deletedAt ? 'This message was unsent' : message.content,
        lastMessageAt: message.createdAt,
        unread: message.receiverId === req.user.id && !message.readAt ? 1 : 0
      });
    } else if (message.receiverId === req.user.id && !message.readAt) {
      const thread = threads.get(other.id);
      thread.unread += 1;
    }
  });
  res.json({ threads: [...threads.values()], unreadTotal: await unreadCount(req.user.id), onlineUserIds: [...onlineUsers.keys()] });
});

app.get('/api/messages/:userId', auth, async (req, res) => {
  const otherUserId = req.params.userId;
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 50);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const filters = [{ OR: [{ senderId: req.user.id, receiverId: otherUserId }, { senderId: otherUserId, receiverId: req.user.id }] }];
  if (before && Number.isFinite(before.getTime())) filters.push({ createdAt: { lt: before } });
  await prisma.message.updateMany({ where: { senderId: otherUserId, receiverId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  await invalidateUnread(req.user.id);
  const messages = await prisma.message.findMany({
    where: { AND: filters },
    include: { sender: true, receiver: true, reactions: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1
  });
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit).reverse();
  const nextCursor = hasMore ? page[0]?.createdAt : null;
  await emitUnread(req.user.id);
  res.json({ messages: page.map(serializeMessage), nextCursor, hasMore });
});

app.post('/api/messages', auth, messageLimiter, async (req, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content?.trim()) return res.status(400).json({ error: 'Receiver and content are required' });
  if (receiverId === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
  const message = await prisma.message.create({
    data: { senderId: req.user.id, receiverId, content: content.trim() },
    include: { sender: true, receiver: true, reactions: { include: { user: true } } }
  });
  await invalidateUnread(receiverId);
  const serialized = serializeMessage(message);
  io.to(threadRoom(req.user.id, receiverId)).emit('message:new', serialized);
  io.to(userRoom(receiverId)).emit('message:new', serialized);
  await emitUnread(receiverId);
  res.json(serialized);
});

app.delete('/api/messages/:messageId', auth, async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.messageId },
    include: { sender: true, receiver: true, reactions: { include: { user: true } } }
  });
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.senderId !== req.user.id && req.user.accountType !== 'ADMIN') return res.status(403).json({ error: 'Only the sender or an admin can unsend this message' });
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { deletedAt: new Date(), content: '' },
    include: { sender: true, receiver: true, reactions: { include: { user: true } } }
  });
  const serialized = serializeMessage(updated);
  io.to(threadRoom(updated.senderId, updated.receiverId)).emit('message:update', serialized);
  io.to(userRoom(updated.senderId)).emit('message:update', serialized);
  io.to(userRoom(updated.receiverId)).emit('message:update', serialized);
  res.json(serialized);
});

app.post('/api/messages/:messageId/reactions', auth, async (req, res) => {
  const emoji = String(req.body.emoji || '').trim().slice(0, 8);
  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });
  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!message || ![message.senderId, message.receiverId].includes(req.user.id)) return res.status(404).json({ error: 'Message not found' });
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: message.id, userId: req.user.id, emoji } }
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId: message.id, userId: req.user.id, emoji } });
  }
  const updated = await prisma.message.findUnique({
    where: { id: message.id },
    include: { sender: true, receiver: true, reactions: { include: { user: true }, orderBy: { createdAt: 'asc' } } }
  });
  const serialized = serializeMessage(updated);
  io.to(threadRoom(updated.senderId, updated.receiverId)).emit('message:update', serialized);
  io.to(userRoom(updated.senderId)).emit('message:update', serialized);
  io.to(userRoom(updated.receiverId)).emit('message:update', serialized);
  res.json(serialized);
});

app.get('/api/location/masjids', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  const radius = Math.min(Number(req.query.radius || 25000), 50000);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: 'lat and lng query parameters are required' });

  try {
    await ensureFallbackOrganizations();
    const sqlMasjids = await prisma.organization.findMany({
      where: { type: { in: ['MASJID', 'MSA'] }, latitude: { not: null }, longitude: { not: null } },
      include: { followers: true, events: true, opportunities: { where: { isActive: true } } }
    });
    if (sqlMasjids.length) return res.json(withDistance(sqlMasjids.map((org) => publicOrganization(org, null)), latitude, longitude));

    const query = `
      [out:json][timeout:12];
      (
        node["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
        way["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
        relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
      );
      out center tags 25;
    `;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query })
    });
    if (!response.ok) throw new Error('Overpass failed');
    const data = await response.json();
    const masjids = (data.elements || []).map((item) => {
      const tags = item.tags || {};
      return {
        id: `osm-${item.type}-${item.id}`,
        name: tags.name || tags['name:en'] || 'Unnamed masjid',
        type: 'Masjid',
        city: tags['addr:city'] || tags.city || '',
        address: osmAddress(tags) || tags['addr:full'] || tags.description || '',
        latitude: item.lat || item.center?.lat,
        longitude: item.lon || item.center?.lon,
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        verified: false,
        source: 'OpenStreetMap'
      };
    }).filter((item) => item.latitude && item.longitude && item.name !== 'Unnamed masjid');
    const finalMasjids = masjids.length ? masjids : fallbackMasjids;
    res.json(withDistance(finalMasjids, latitude, longitude));
  } catch (err) {
    console.error(err);
    res.json(withDistance(fallbackMasjids, latitude, longitude));
  }
});

app.get('/api/prayer-times', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: 'lat and lng query parameters are required' });
  const method = req.query.method || 2;
  const date = req.query.date || Math.floor(Date.now() / 1000);
  try {
    const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Prayer time API failed');
    const data = await response.json();
    res.json(data.data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not fetch prayer times right now' });
  }
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`API running on http://localhost:${port}`));
