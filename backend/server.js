import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  'https://ummah-connect-psi.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: [
    "http://localhost:5173",
    process.env.FRONTEND_URL
  ],
  credentials: true
}));
app.use(express.json());

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, accountType: user.accountType, city: user.city, bio: user.bio };
}
function createToken(user) {
  return jwt.sign({ id: user.id, accountType: user.accountType }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
}
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret'); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function canPostEvent(req, res, next) {
  if (!['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Only masjid, MSA, or admin accounts can post events right now' });
  next();
}

app.get('/', (_, res) => res.json({ message: 'Ummah Connect API running' }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, accountType, city, bio } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    const allowed = ['USER','MASJID','MSA','IMAM','STUDENT_OF_KNOWLEDGE','BUSINESS','ADMIN'];
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), passwordHash, accountType: allowed.includes(accountType) ? accountType : 'USER', city, bio } });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (err) { console.error(err); res.status(400).json({ error: err.code === 'P2002' ? 'Email already exists' : err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() || '' } });
  if (!user) return res.status(401).json({ error: 'Invalid login' });
  const valid = await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid login' });
  res.json({ token: createToken(user), user: publicUser(user) });
});

app.get('/api/users', auth, async (_, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, accountType: true, city: true, bio: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  res.json(users);
});

app.get('/api/organizations', async (_, res) => {
  const organizations = await prisma.organization.findMany({ include: { events: true }, orderBy: { createdAt: 'desc' } });
  res.json(organizations);
});
app.post('/api/organizations', auth, async (req, res) => {
  const { name, type, city, address, website, email, phone, description, facilities } = req.body;
  const org = await prisma.organization.create({ data: { name, type, city, address, website, email, phone, description, facilities, ownerId: req.user.id, claimed: true, verified: req.user.accountType === 'ADMIN' } });
  res.json(org);
});

app.get('/api/events', async (_, res) => {
  const events = await prisma.event.findMany({ include: { organization: true, createdBy: { select: { id: true, name: true, accountType: true } }, registrations: true }, orderBy: { startTime: 'asc' } });
  res.json(events);
});
app.post('/api/events', auth, canPostEvent, async (req, res) => {
  const { title, description, location, startTime, endTime, organizationId } = req.body;
  if (!title || !startTime) return res.status(400).json({ error: 'Title and start time are required' });
  const event = await prisma.event.create({ data: { title, description, location, startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : null, organizationId, createdById: req.user.id } });
  res.json(event);
});
app.post('/api/events/:eventId/register', auth, async (req, res) => {
  try {
    const registration = await prisma.eventRegistration.create({ data: { userId: req.user.id, eventId: req.params.eventId } });
    res.json(registration);
  } catch (err) { res.status(400).json({ error: 'Already registered or event not found' }); }
});
app.delete('/api/events/:eventId/register', auth, async (req, res) => {
  await prisma.eventRegistration.deleteMany({ where: { userId: req.user.id, eventId: req.params.eventId } });
  res.json({ message: 'Registration removed' });
});

app.post('/api/messages', auth, async (req, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content) return res.status(400).json({ error: 'Receiver and content are required' });
  const message = await prisma.message.create({ data: { senderId: req.user.id, receiverId, content } });
  res.json(message);
});
app.get('/api/messages/:userId', auth, async (req, res) => {
  const otherUserId = req.params.userId;
  const messages = await prisma.message.findMany({ where: { OR: [{ senderId: req.user.id, receiverId: otherUserId }, { senderId: otherUserId, receiverId: req.user.id }] }, orderBy: { createdAt: 'asc' } });
  res.json(messages);
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
