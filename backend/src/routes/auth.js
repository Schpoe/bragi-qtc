const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // No SMTP configured — log to console (dev/self-hosted fallback)
  return null;
}

async function sendResetEmail(to, resetUrl) {
  const transport = createTransport();
  if (transport) {
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@bragi-qtc',
      to,
      subject: 'Reset your Bragi QTC password',
      text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`,
    });
  } else {
    console.log(`[password-reset] Reset link for ${to}: ${resetUrl}`);
  }
}

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, managed_team_ids: user.managed_team_ids },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const { password_hash, ...userOut } = user;
  res.json({ token, user: userOut });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password_hash, ...userOut } = user;
  res.json(userOut);
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

router.put('/me/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'current_password and new_password required' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }
  const password_hash = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { password_hash } });
  res.json({ ok: true });
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  // Always respond 200 to avoid leaking whether the email exists
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } });
    await prisma.passwordResetToken.create({ data: { user_id: user.id, token_hash, expires_at } });

    const appUrl = process.env.APP_URL || 'http://localhost:3003';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendResetEmail(user.email, resetUrl);
  }

  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({ where: { token_hash } });

  if (!record || record.expires_at < new Date()) {
    await prisma.passwordResetToken.deleteMany({ where: { token_hash } });
    return res.status(400).json({ message: 'Reset link is invalid or has expired' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: record.user_id }, data: { password_hash } });
  await prisma.passwordResetToken.delete({ where: { token_hash } });

  res.json({ ok: true });
});

module.exports = router;
