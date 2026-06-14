const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Paths to databases
const DB_FILE = path.join(__dirname, 'db.json');
const PHOTOS_FILE = path.join(__dirname, 'photos.json');

// Path to dad website's public folder for image placement
const WEBSITE_PUBLIC_DIR = path.resolve(__dirname, '../../dad website/public');

// Ensure database files exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(PHOTOS_FILE)) {
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify([], null, 2));
}

// Multer storage configuration - uploads go directly to the website's public folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(WEBSITE_PUBLIC_DIR)) {
      fs.mkdirSync(WEBSITE_PUBLIC_DIR, { recursive: true });
    }
    cb(null, WEBSITE_PUBLIC_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique name keeping original extension
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `upload_${base}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Helper to read JSON database files
const readJson = (file) => {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
};

// Helper to write JSON database files
const writeJson = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing to ${file}:`, err);
  }
};

/* ─── APPLICATIONS API ─── */

// Get all applications
app.get('/api/applications', (req, res) => {
  const apps = readJson(DB_FILE);
  res.json(apps);
});

// Submit a new application (from main website)
app.post('/api/applications', (req, res) => {
  const apps = readJson(DB_FILE);
  const newApp = {
    id: `app_${Date.now()}`,
    fullName: req.body.fullName || '',
    age: Number(req.body.age) || 0,
    gender: req.body.gender || '',
    mobile: req.body.mobile || '',
    whatsapp: req.body.whatsapp || '',
    email: req.body.email || '',
    village: req.body.village || '',
    mandal: req.body.mandal || '',
    address: req.body.address || '',
    roleId: req.body.roleId || 'volunteer',
    roleName: req.body.roleName || 'Volunteer',
    roleIcon: req.body.roleIcon || '🤝',
    status: 'pending',
    appliedAt: new Date().toISOString(),
    tempId: req.body.tempId || '',
    yearsExp: req.body.yearsExp || '',
    politicalBg: req.body.politicalBg || '',
    available247: req.body.available247 || false,
    aadharFront: null, // Multer file details if uploaded later, or placeholder
    aadharBack: null
  };
  apps.push(newApp);
  writeJson(DB_FILE, apps);
  res.status(201).json({ success: true, application: newApp });
});

// Update application status (from admin portal)
app.patch('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved | rejected
  
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const apps = readJson(DB_FILE);
  const appIndex = apps.findIndex(a => a.id === id);
  if (appIndex === -1) {
    return res.status(404).json({ error: 'Application not found' });
  }

  apps[appIndex].status = status;
  writeJson(DB_FILE, apps);
  res.json({ success: true, application: apps[appIndex] });
});

/* ─── PHOTOS/SLOTS API ─── */

// Get all photos
app.get('/api/photos', (req, res) => {
  const photos = readJson(PHOTOS_FILE);
  res.json(photos);
});

// Update or upload a photo to a slot (from admin portal)
app.post('/api/photos', upload.single('image'), (req, res) => {
  const slotId = Number(req.body.slotId); // ID 1 to 11
  const captionTe = req.body.captionTe || '';
  const captionEn = req.body.captionEn || '';
  const tagTe = req.body.tagTe || '';
  const tagEn = req.body.tagEn || '';

  if (!slotId) {
    return res.status(400).json({ error: 'Missing slotId' });
  }

  const photos = readJson(PHOTOS_FILE);
  let slotIndex = photos.findIndex(p => p.id === slotId);

  // If slot doesn't exist, create it
  if (slotIndex === -1) {
    photos.push({ id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: '' });
    slotIndex = photos.length - 1;
  }

  // Update text metadata
  photos[slotIndex].captionTe = captionTe;
  photos[slotIndex].captionEn = captionEn;
  photos[slotIndex].tagTe = tagTe;
  photos[slotIndex].tagEn = tagEn;

  // Update image file path if a new file was uploaded
  if (req.file) {
    // Save relative public path e.g. "/upload_filename_timestamp.jpg"
    photos[slotIndex].src = `/${req.file.filename}`;
  }

  writeJson(PHOTOS_FILE, photos);
  res.json({ success: true, photo: photos[slotIndex] });
});

// Delete a photo slot configuration
app.delete('/api/photos/:id', (req, res) => {
  const slotId = Number(req.params.id);
  const photos = readJson(PHOTOS_FILE);
  const slotIndex = photos.findIndex(p => p.id === slotId);

  if (slotIndex === -1) {
    return res.status(404).json({ error: 'Photo slot not found' });
  }

  // Option: delete the image file from public folder if exists
  const fileRelativePath = photos[slotIndex].src;
  if (fileRelativePath && fileRelativePath.startsWith('/upload_')) {
    const fullFilePath = path.join(WEBSITE_PUBLIC_DIR, fileRelativePath);
    if (fs.existsSync(fullFilePath)) {
      try {
        fs.unlinkSync(fullFilePath);
      } catch (err) {
        console.error('Error deleting image file:', err);
      }
    }
  }

  // Reset the slot
  photos[slotIndex].src = '';
  photos[slotIndex].captionTe = '';
  photos[slotIndex].captionEn = '';
  photos[slotIndex].tagTe = '';
  photos[slotIndex].tagEn = '';

  writeJson(PHOTOS_FILE, photos);
  res.json({ success: true, message: 'Slot cleared successfully' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Express Backend running on http://localhost:${PORT}`);
  console.log(`Serving uploads directly into: ${WEBSITE_PUBLIC_DIR}`);
});
