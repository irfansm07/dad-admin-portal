const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Load environment variables from current directory or parent directory
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

// Ensure website public directory exists
if (!fs.existsSync(WEBSITE_PUBLIC_DIR)) {
  fs.mkdirSync(WEBSITE_PUBLIC_DIR, { recursive: true });
}

// Serve uploaded images statically so the admin portal (and site) can access them via backend port
app.use(express.static(WEBSITE_PUBLIC_DIR));

// Ensure database files exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(PHOTOS_FILE)) {
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify([], null, 2));
}

// Initialize Supabase if credentials exist
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceKey) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase Database Connected successfully!');
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
  }
} else {
  console.log('Supabase credentials missing. Falling back to local JSON database.');
}

// Multer storage configuration - uploads go directly to the website's public folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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
app.get('/api/applications', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('applied_at', { ascending: false });
      if (error) throw error;
      
      // Convert database snake_case back to frontend camelCase
      const camelCaseData = data.map(app => ({
        id: app.id,
        fullName: app.full_name,
        age: app.age,
        gender: app.gender,
        mobile: app.mobile,
        whatsapp: app.whatsapp,
        email: app.email,
        village: app.village,
        mandal: app.mandal,
        address: app.address,
        roleId: app.role_id,
        roleName: app.role_name,
        roleIcon: app.role_icon,
        status: app.status,
        appliedAt: app.applied_at,
        tempId: app.temp_id,
        yearsExp: app.years_exp,
        politicalBg: app.political_bg,
        available247: app.available_247,
        aadharFront: app.aadhar_front,
        aadharBack: app.aadhar_back
      }));
      
      return res.json(camelCaseData);
    } catch (err) {
      console.error('Supabase fetch applications error:', err);
      // Fallback to local
    }
  }
  
  const apps = readJson(DB_FILE);
  res.json(apps);
});

// Submit a new application (from main website)
app.post('/api/applications', async (req, res) => {
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
    aadharFront: null, 
    aadharBack: null
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('applications').insert({
        id: newApp.id,
        full_name: newApp.fullName,
        age: newApp.age,
        gender: newApp.gender,
        mobile: newApp.mobile,
        whatsapp: newApp.whatsapp,
        email: newApp.email,
        village: newApp.village,
        mandal: newApp.mandal,
        address: newApp.address,
        role_id: newApp.roleId,
        role_name: newApp.roleName,
        role_icon: newApp.roleIcon,
        status: newApp.status,
        applied_at: newApp.appliedAt,
        temp_id: newApp.tempId,
        years_exp: newApp.yearsExp,
        political_bg: newApp.politicalBg,
        available_247: newApp.available247,
        aadhar_front: newApp.aadharFront,
        aadhar_back: newApp.aadharBack
      });
      if (error) throw error;
      return res.status(201).json({ success: true, application: newApp });
    } catch (err) {
      console.error('Supabase insert application error:', err);
      // Fallback to local
    }
  }

  const apps = readJson(DB_FILE);
  apps.push(newApp);
  writeJson(DB_FILE, apps);
  res.status(201).json({ success: true, application: newApp });
});

// Update application status (from admin portal)
app.patch('/api/applications/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved | rejected | pending | appointed | fired
  
  if (!['approved', 'rejected', 'pending', 'appointed', 'fired'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .update({ status: status })
        .eq('id', id)
        .select();
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Application not found in Supabase' });
      }
      
      const appVal = data[0];
      const camelCaseApp = {
        id: appVal.id,
        fullName: appVal.full_name,
        age: appVal.age,
        gender: appVal.gender,
        mobile: appVal.mobile,
        whatsapp: appVal.whatsapp,
        email: appVal.email,
        village: appVal.village,
        mandal: appVal.mandal,
        address: appVal.address,
        roleId: appVal.role_id,
        roleName: appVal.role_name,
        roleIcon: appVal.role_icon,
        status: appVal.status,
        appliedAt: appVal.applied_at,
        tempId: appVal.temp_id,
        yearsExp: appVal.years_exp,
        politicalBg: appVal.political_bg,
        available247: appVal.available_247,
        aadharFront: appVal.aadhar_front,
        aadharBack: appVal.aadhar_back
      };
      
      return res.json({ success: true, application: camelCaseApp });
    } catch (err) {
      console.error('Supabase update application status error:', err);
      // Fallback to local
    }
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
app.get('/api/photos', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      
      const camelCaseData = data.map(ph => ({
        id: ph.id,
        src: ph.src,
        captionTe: ph.caption_te,
        captionEn: ph.caption_en,
        tagTe: ph.tag_te,
        tagEn: ph.tag_en
      }));
      
      // If table is empty, generate 11 default empty slots
      if (camelCaseData.length === 0) {
        const defaultSlots = Array.from({ length: 11 }, (_, i) => ({
          id: i + 1, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: ''
        }));
        return res.json(defaultSlots);
      }
      
      // Ensure all 11 slots are represented in the response
      const fullSlots = Array.from({ length: 11 }, (_, i) => {
        const slotId = i + 1;
        return camelCaseData.find(p => p.id === slotId) || {
          id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: ''
        };
      });
      
      return res.json(fullSlots);
    } catch (err) {
      console.error('Supabase fetch photos error:', err);
      // Fallback to local
    }
  }
  
  const photos = readJson(PHOTOS_FILE);
  // Ensure all 11 slots are present locally too
  const fullLocalSlots = Array.from({ length: 11 }, (_, i) => {
    const slotId = i + 1;
    return photos.find(p => p.id === slotId) || {
      id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: ''
    };
  });
  res.json(fullLocalSlots);
});

// Update or upload a photo to a slot (from admin portal)
app.post('/api/photos', upload.single('image'), async (req, res) => {
  const slotId = Number(req.body.slotId); // ID 1 to 11
  const captionTe = req.body.captionTe || '';
  const captionEn = req.body.captionEn || '';
  const tagTe = req.body.tagTe || '';
  const tagEn = req.body.tagEn || '';

  if (!slotId) {
    return res.status(400).json({ error: 'Missing slotId' });
  }

  let imageUrl = '';
  
  if (req.file) {
    if (supabase) {
      // Upload file directly to Supabase Storage bucket 'photos'
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = `${slotId}_${Date.now()}${path.extname(req.file.originalname)}`;
        
        const { data, error } = await supabase.storage
          .from('photos')
          .upload(fileName, fileBuffer, {
            contentType: req.file.mimetype,
            upsert: true
          });
          
        if (error) throw error;
        
        // Get public url
        const { data: publicUrlData } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);
          
        imageUrl = publicUrlData.publicUrl;
        
        // Delete temporary local file
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.warn('Error deleting temp upload file:', unlinkErr);
        }
      } catch (uploadErr) {
        console.error('Supabase Storage upload error, using local fallback:', uploadErr);
        imageUrl = `/${req.file.filename}`;
      }
    } else {
      imageUrl = `/${req.file.filename}`;
    }
  }

  if (supabase) {
    try {
      const dbPayload = {
        caption_te: captionTe,
        caption_en: captionEn,
        tag_te: tagTe,
        tag_en: tagEn
      };
      
      if (imageUrl) {
        dbPayload.src = imageUrl;
      }
      
      const { data, error } = await supabase
        .from('photos')
        .upsert({ id: slotId, ...dbPayload })
        .select();
        
      if (error) throw error;
      
      const phVal = data[0];
      const camelCasePhoto = {
        id: phVal.id,
        src: phVal.src,
        captionTe: phVal.caption_te,
        captionEn: phVal.caption_en,
        tagTe: phVal.tag_te,
        tagEn: phVal.tag_en
      };
      
      return res.json({ success: true, photo: camelCasePhoto });
    } catch (err) {
      console.error('Supabase upsert photo error:', err);
      // Fallback to local
    }
  }

  const photos = readJson(PHOTOS_FILE);
  let slotIndex = photos.findIndex(p => p.id === slotId);

  if (slotIndex === -1) {
    photos.push({ id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: '' });
    slotIndex = photos.length - 1;
  }

  photos[slotIndex].captionTe = captionTe;
  photos[slotIndex].captionEn = captionEn;
  photos[slotIndex].tagTe = tagTe;
  photos[slotIndex].tagEn = tagEn;

  if (imageUrl) {
    photos[slotIndex].src = imageUrl;
  }

  writeJson(PHOTOS_FILE, photos);
  res.json({ success: true, photo: photos[slotIndex] });
});

// Delete a photo slot configuration
app.delete('/api/photos/:id', async (req, res) => {
  const slotId = Number(req.params.id);

  if (supabase) {
    try {
      const { data: slotData, error: getError } = await supabase
        .from('photos')
        .select('*')
        .eq('id', slotId);
        
      if (!getError && slotData && slotData.length > 0) {
        const phVal = slotData[0];
        const srcUrl = phVal.src;
        // If it's a Supabase storage URL, delete it from storage
        if (srcUrl && srcUrl.includes('/storage/v1/object/public/photos/')) {
          const fileName = srcUrl.split('/storage/v1/object/public/photos/')[1];
          if (fileName) {
            await supabase.storage.from('photos').remove([fileName]);
          }
        }
      }
      
      const { error } = await supabase
        .from('photos')
        .upsert({
          id: slotId,
          src: '',
          caption_te: '',
          caption_en: '',
          tag_te: '',
          tag_en: ''
        });
        
      if (error) throw error;
      return res.json({ success: true, message: 'Slot cleared successfully' });
    } catch (err) {
      console.error('Supabase clear slot error:', err);
      // Fallback to local
    }
  }

  const photos = readJson(PHOTOS_FILE);
  const slotIndex = photos.findIndex(p => p.id === slotId);

  if (slotIndex === -1) {
    return res.status(404).json({ error: 'Photo slot not found' });
  }

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
  console.log(`Serving uploads directly from: ${WEBSITE_PUBLIC_DIR}`);
});
