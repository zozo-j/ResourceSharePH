const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'assets', 'records', 'users.json');
const TMP_FILE = DATA_FILE + '.tmp';

const app = express();
app.use(bodyParser.json());

function sanitizeInput(body) {
  return {
    ID: String(Date.now()),
    Username: String(body.username || '').trim(),
    FullName: String(body.fullName || '').trim(),
    Role: body.role || 'user',
    Barangay: String(body.barangay || '').trim(),
    Phone: String(body.phone || '').trim(),
    DateRegistered: new Date().toLocaleDateString()
  };
}

// POST /api/users - accept registration and append sanitized user to JSON file
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, fullName, role, barangay, phone } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ error: 'username, password and fullName required' });

    // Read existing users
    let users = [];
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      users = JSON.parse(raw);
      if (!Array.isArray(users)) users = [];
    } catch (err) {
      users = [];
    }

    if (users.find(u => u.Username === username)) {
      return res.status(409).json({ error: 'username exists' });
    }

    const user = sanitizeInput({ username, fullName, role, barangay, phone });

    // Optionally store a server-side hash (SHA-256) - not plaintext
    if (password) {
      user.PasswordHash = crypto.createHash('sha256').update(String(password)).digest('hex');
    }

    users.push(user);

    // ensure folder exists and write atomically
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(TMP_FILE, JSON.stringify(users, null, 2), 'utf8');
    await fs.rename(TMP_FILE, DATA_FILE);

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Error in /api/users:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// GET /api/users - return users.json if present
app.get('/api/users', async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    res.json([]);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`User API listening on ${port}`));
