import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client (direct connection – no separate backend needed)
// Admin portal uses service role key (safe here — app is PIN-protected & admin-only)
const SUPABASE_URL  = 'https://hpqhmyjwqjfmwgnlvedg.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcWhteWp3cWpmbXdnbmx2ZWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQyNjI0NCwiZXhwIjoyMDk3MDAyMjQ0fQ.2bM_KWSTO-LKICdqScjw3nf0QSyG8U82VFeLPyUlbeM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utility styles
const lblS = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(232,224,208,0.7)',
  marginBottom: 6,
  display: 'block'
};

const inputS = {
  width: '100%',
  padding: '12px',
  borderRadius: 8,
  border: '1px solid rgba(201,168,76,0.2)',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  boxSizing: 'border-box'
};

// ── Status badge helper
function StatusBadge({ status }) {
  const normalized = status === 'approved' ? 'appointed' : status;
  const cfg = {
    appointed: { bg: 'rgba(46,125,50,0.15)', border: '#2E7D32', color: '#81C784' },
    rejected:  { bg: 'rgba(198,40,40,0.15)',  border: '#C62828', color: '#E57373' },
    fired:     { bg: 'rgba(230,81,0,0.15)',   border: '#E65100', color: '#FFB74D' },
    pending:   { bg: 'rgba(201,168,76,0.15)', border: '#C9A84C', color: '#FFD54F' },
  }[normalized] || { bg: 'rgba(201,168,76,0.15)', border: '#C9A84C', color: '#FFD54F' };

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      borderRadius: 20, padding: '4px 12px',
      fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap'
    }}>
      {normalized}
    </div>
  );
}

// Stored passcode key
const PASSCODE_KEY = 'admin_passcode';
const getStoredPasscode = () => localStorage.getItem(PASSCODE_KEY) || '7777';

export default function App() {
  const [authenticated, setAuthenticated]   = useState(false);
  const [passcode, setPasscode]             = useState('');
  const [loginError, setLoginError]         = useState(false);

  const [dbConnected, setDbConnected]       = useState(false);
  const [activeTab, setActiveTab]           = useState('dashboard');

  // Data
  const [applications, setApplications]     = useState([]);
  const [photos, setPhotos]                 = useState([]);
  const [loading, setLoading]               = useState(true);

  // Application detail sheet
  const [selectedApp, setSelectedApp]       = useState(null);

  // Photo editor sheet
  const [selectedSlot, setSelectedSlot]     = useState(null);
  const [editForm, setEditForm]             = useState({ captionTe:'', captionEn:'', tagTe:'', tagEn:'' });
  const [uploadFile, setUploadFile]         = useState(null);
  const [uploadPreview, setUploadPreview]   = useState(null);
  const [savingSlot, setSavingSlot]         = useState(false);

  // Filters
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');

  // Change password
  const [pwStep, setPwStep]                 = useState('idle'); // idle | enterCurrent | enterNew | confirmNew
  const [pwCurrent, setPwCurrent]           = useState('');
  const [pwNew, setPwNew]                   = useState('');
  const [pwConfirm, setPwConfirm]           = useState('');
  const [pwError, setPwError]               = useState('');
  const [pwSuccess, setPwSuccess]           = useState(false);

  // Track broken images
  const [brokenImgs, setBrokenImgs]         = useState({});

  // ── Fetch all data from Supabase
  const fetchData = async () => {
    try {
      const [{ data: apps, error: appsErr }, { data: pts, error: ptsErr }] = await Promise.all([
        supabase.from('applications').select('*').order('applied_at', { ascending: false }),
        supabase.from('photos').select('*').order('id', { ascending: true })
      ]);

      if (appsErr) throw appsErr;
      if (ptsErr)  throw ptsErr;

      // Convert snake_case → camelCase for applications
      const camelApps = (apps || []).map(a => ({
        id: a.id,
        fullName: a.full_name,
        age: a.age,
        gender: a.gender,
        mobile: a.mobile,
        whatsapp: a.whatsapp,
        email: a.email,
        village: a.village,
        mandal: a.mandal,
        address: a.address,
        roleId: a.role_id,
        roleName: a.role_name,
        roleIcon: a.role_icon,
        status: a.status,
        appliedAt: a.applied_at,
        tempId: a.temp_id,
        yearsExp: a.years_exp,
        politicalBg: a.political_bg,
        available247: a.available_247,
        aadharFront: a.aadhar_front,
        aadharBack: a.aadhar_back
      }));

      // Normalize photos – ensure all 11 slots are present
      const photosMap = {};
      (pts || []).forEach(p => { photosMap[p.id] = p; });
      const fullSlots = Array.from({ length: 11 }, (_, i) => {
        const id = i + 1;
        const p = photosMap[id];
        return p
          ? { id, src: p.src || '', captionTe: p.caption_te || '', captionEn: p.caption_en || '', tagTe: p.tag_te || '', tagEn: p.tag_en || '' }
          : { id, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: '' };
      });

      setApplications(camelApps);
      setPhotos(fullSlots);
      setDbConnected(true);
    } catch (err) {
      console.error('Supabase fetch error:', err);
      setDbConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Passcode login
  const handlePasscodePress = (num) => {
    setLoginError(false);
    if (passcode.length < 4) {
      const newPass = passcode + num;
      setPasscode(newPass);
      if (newPass === getStoredPasscode()) {
        setTimeout(() => setAuthenticated(true), 200);
      } else if (newPass.length === 4) {
        setTimeout(() => { setLoginError(true); setPasscode(''); }, 300);
      }
    }
  };

  // ── Change Password helpers
  const resetPwFlow = () => { setPwStep('idle'); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError(''); setPwSuccess(false); };

  const handlePwDigit = (digit) => {
    setPwError('');
    if (pwStep === 'enterCurrent') {
      const next = pwCurrent + digit;
      if (next.length <= 4) {
        setPwCurrent(next);
        if (next.length === 4) {
          if (next !== getStoredPasscode()) {
            setTimeout(() => { setPwError('Incorrect current PIN. Try again.'); setPwCurrent(''); }, 300);
          } else {
            setTimeout(() => setPwStep('enterNew'), 200);
          }
        }
      }
    } else if (pwStep === 'enterNew') {
      const next = pwNew + digit;
      if (next.length <= 4) {
        setPwNew(next);
        if (next.length === 4) setTimeout(() => setPwStep('confirmNew'), 200);
      }
    } else if (pwStep === 'confirmNew') {
      const next = pwConfirm + digit;
      if (next.length <= 4) {
        setPwConfirm(next);
        if (next.length === 4) {
          if (next !== pwNew) {
            setTimeout(() => { setPwError('PINs do not match. Try again.'); setPwConfirm(''); setPwNew(''); setPwStep('enterNew'); }, 300);
          } else {
            localStorage.setItem(PASSCODE_KEY, next);
            setPwSuccess(true);
            setTimeout(() => resetPwFlow(), 2500);
          }
        }
      }
    }
  };

  const handlePwBackspace = () => {
    if (pwStep === 'enterCurrent') setPwCurrent(p => p.slice(0, -1));
    else if (pwStep === 'enterNew') setPwNew(p => p.slice(0, -1));
    else if (pwStep === 'confirmNew') setPwConfirm(p => p.slice(0, -1));
  };

  const currentPwEntry = pwStep === 'enterCurrent' ? pwCurrent : pwStep === 'enterNew' ? pwNew : pwConfirm;

  // ── Update application status
  const handleStatusChange = async (appId, newStatus) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', appId);

      if (error) throw error;
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      if (selectedApp?.id === appId) setSelectedApp(prev => ({ ...prev, status: newStatus }));
      alert(`✅ Application marked as "${newStatus}" successfully!`);
    } catch (err) {
      alert('❌ Failed to update status: ' + err.message);
    }
  };

  // ── Open photo editor
  const openPhotoEditor = (slot) => {
    setSelectedSlot(slot);
    setEditForm({
      captionTe: slot.captionTe || '',
      captionEn: slot.captionEn || '',
      tagTe: slot.tagTe || '',
      tagEn: slot.tagEn || ''
    });
    setUploadFile(null);
    setUploadPreview(null);
  };

  // Handle file selection → generate preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setUploadPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Save photo slot
  const handleSavePhotoSlot = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSavingSlot(true);

    try {
      let imageUrl = selectedSlot.src || '';

      // Upload to Supabase Storage if a new file was selected
      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop();
        const fileName = `slot_${selectedSlot.id}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('photos')
          .upload(fileName, uploadFile, { upsert: true, contentType: uploadFile.type });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('photos').upsert({
        id: selectedSlot.id,
        src: imageUrl,
        caption_te: editForm.captionTe,
        caption_en: editForm.captionEn,
        tag_te: editForm.tagTe,
        tag_en: editForm.tagEn
      });

      if (error) throw error;

      await fetchData();
      setSelectedSlot(null);
      setUploadFile(null);
      setUploadPreview(null);
      alert('✅ Photo slot updated successfully!');
    } catch (err) {
      alert('❌ Failed to save photo slot: ' + err.message);
    } finally {
      setSavingSlot(false);
    }
  };

  // ── Clear / Delete photo slot
  const handleClearPhotoSlot = async (slotId, currentSrc) => {
    if (!confirm('Are you sure you want to clear this photo slot? This will remove the image from the website.')) return;

    try {
      // If image is in Supabase storage, delete it
      if (currentSrc && currentSrc.includes('/storage/v1/object/public/photos/')) {
        const fileName = currentSrc.split('/storage/v1/object/public/photos/')[1];
        if (fileName) await supabase.storage.from('photos').remove([fileName]);
      }

      const { error } = await supabase.from('photos').upsert({
        id: slotId, src: '', caption_te: '', caption_en: '', tag_te: '', tag_en: ''
      });

      if (error) throw error;
      await fetchData();
      setSelectedSlot(null);
      alert('✅ Slot cleared successfully.');
    } catch (err) {
      alert('❌ Failed to clear slot: ' + err.message);
    }
  };

  // ── Computed values
  const filteredApps = applications.filter(a => {
    const matchesSearch =
      (a.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.village || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.roleName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.mandal || '').toLowerCase().includes(search.toLowerCase());
    const normalized = a.status === 'approved' ? 'appointed' : a.status;
    const matchesStatus = statusFilter === 'all' || normalized === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalApps        = applications.length;
  const pendingApps      = applications.filter(a => a.status === 'pending').length;
  const approvedApps     = applications.filter(a => a.status === 'appointed' || a.status === 'approved').length;
  const rejectedApps     = applications.filter(a => a.status === 'rejected').length;
  const firedApps        = applications.filter(a => a.status === 'fired').length;
  const activePhotosCount= photos.filter(p => p.src).length;

  // ──────────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #050D1A 0%, #0A1628 50%, #050D1A 100%)',
        padding: 20
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap');
          @keyframes scaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
          @keyframes slideUp { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }
          @keyframes pulse { 0%,100% { box-shadow:0 0 8px rgba(201,168,76,0.3); } 50% { box-shadow:0 0 20px rgba(201,168,76,0.6); } }
          @keyframes shake { 0%,100% { transform:translateX(0); } 25%,75% { transform:translateX(-6px); } 50% { transform:translateX(6px); } }
          * { box-sizing:border-box; }
        `}</style>
        <div style={{ width: '100%', maxWidth: 340, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #E4C97A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, color: '#0A1628', margin: '0 auto 20px',
            animation: 'pulse 2.5s ease infinite'
          }}>⚜</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#C9A84C', fontWeight: 900, margin: '0 0 6px' }}>
            S.M. SHAIDA
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(232,224,208,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 40px' }}>
            Campaign Admin Portal
          </p>

          {/* Code dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 44 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid #C9A84C',
                background: passcode.length > i ? '#C9A84C' : 'transparent',
                boxShadow: passcode.length > i ? '0 0 12px #C9A84C' : 'none',
                transition: 'all 0.15s ease',
                animation: loginError ? 'shake 0.4s ease' : 'none'
              }} />
            ))}
          </div>

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <button key={num} onClick={() => handlePasscodePress(num.toString())} style={{
                width: 72, height: 72, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)',
                background: 'rgba(255,255,255,0.03)', color: '#E8E0D0',
                fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', outline: 'none', margin: '0 auto'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >{num}</button>
            ))}
            <div />
            <button onClick={() => handlePasscodePress('0')} style={{
              width: 72, height: 72, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)',
              background: 'rgba(255,255,255,0.03)', color: '#E8E0D0',
              fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', outline: 'none', margin: '0 auto'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >0</button>
            <button onClick={() => setPasscode(p => p.slice(0,-1))} style={{
              width: 72, height: 72, borderRadius: '50%', border: 'none',
              background: 'transparent', color: 'rgba(232,224,208,0.5)',
              fontFamily: 'Inter, sans-serif', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', margin: '0 auto'
            }}>⌫</button>
          </div>

          {loginError && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#E45B5B', margin: '0 0 12px' }}>Incorrect Passcode. Try again.</p>}
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(232,224,208,0.25)', marginTop: 16 }}>
            Authorized access only
          </p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN DASHBOARD
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050D1A', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes scaleIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes slideUp { from { transform:translateY(60px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.2); border-radius:4px; }
        button:focus-visible { outline:2px solid #C9A84C; }
      `}</style>

      {/* ── HEADER */}
      <header style={{
        height: 68, background: '#0A1628',
        borderBottom: '1px solid rgba(201,168,76,0.2)',
        padding: '0 5%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 99
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: '#C9A84C' }}>⚜</span>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 900, color: '#C9A84C', letterSpacing: '0.05em' }}>
            SHAIDA ADMIN
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: dbConnected ? 'rgba(46,125,50,0.1)' : 'rgba(198,40,40,0.1)',
            border: dbConnected ? '1px solid rgba(46,125,50,0.35)' : '1px solid rgba(198,40,40,0.35)',
            borderRadius: 20, padding: '6px 14px'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dbConnected ? '#4CAF50' : '#C62828', display: 'inline-block' }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: dbConnected ? '#4CAF50' : '#C62828', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {dbConnected ? 'Supabase Connected' : 'DB Offline'}
            </span>
          </div>
          <button onClick={() => { setAuthenticated(false); setPasscode(''); }} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(232,224,208,0.5)', borderRadius: 20, padding: '6px 14px',
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>Sign Out</button>
        </div>
      </header>

      {/* ── MAIN CONTENT */}
      <main style={{ flex: 1, padding: '28px 5% 96px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', fontFamily: 'Inter, sans-serif', color: 'rgba(232,224,208,0.4)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚜</div>
            Loading dashboard data from Supabase...
          </div>
        )}

        {!loading && !dbConnected && (
          <div style={{
            background: 'rgba(198,40,40,0.08)', border: '1px solid rgba(198,40,40,0.3)',
            borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', color: '#E57373', margin: '0 0 8px' }}>Database Not Connected</h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(232,224,208,0.6)', margin: 0 }}>
              Unable to connect to Supabase. Please check that the database tables have been created.<br />
              Run the <strong>supabase-setup.sql</strong> file in your Supabase SQL Editor to set up the tables.
            </p>
            <button onClick={fetchData} style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 50,
              background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', border: 'none',
              color: '#0A1628', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 800, cursor: 'pointer'
            }}>↻ Retry Connection</button>
          </div>
        )}

        {!loading && (
          <>
            {/* ── TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div style={{ animation: 'scaleIn 0.3s ease' }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#fff', marginBottom: 24, fontWeight: 900 }}>
                  Dashboard Overview
                </h2>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
                  {[
                    { title: 'Total Applications', val: totalApps,    icon: '📥', color: '#E8E0D0', border: 'rgba(255,255,255,0.1)' },
                    { title: 'Pending Review',      val: pendingApps,  icon: '⏳', color: '#FFD54F', border: 'rgba(201,168,76,0.3)',  bg: 'rgba(201,168,76,0.05)' },
                    { title: 'Appointed Members',   val: approvedApps, icon: '✅', color: '#81C784', border: 'rgba(46,125,50,0.3)',   bg: 'rgba(46,125,50,0.06)' },
                    { title: 'Rejected',            val: rejectedApps, icon: '🚫', color: '#E57373', border: 'rgba(198,40,40,0.3)',   bg: 'rgba(198,40,40,0.06)' },
                    { title: 'Fired Members',       val: firedApps,    icon: '❌', color: '#FFB74D', border: 'rgba(230,81,0,0.3)',    bg: 'rgba(230,81,0,0.06)' },
                    { title: 'Photos Active',       val: `${activePhotosCount} / 11`, icon: '🖼️', color: '#E8E0D0', border: 'rgba(255,255,255,0.1)' },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: s.bg || 'rgba(255,255,255,0.02)',
                      border: `1px solid ${s.border}`,
                      borderRadius: 16, padding: '20px 22px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(232,224,208,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.title}</div>
                        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 900, color: s.color }}>{s.val}</div>
                      </div>
                      <div style={{ fontSize: 34 }}>{s.icon}</div>
                    </div>
                  ))}
                </div>

                {/* Welcome card */}
                <div style={{
                  background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)',
                  borderRadius: 18, padding: 28, marginBottom: 28
                }}>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#C9A84C', margin: '0 0 10px' }}>
                    Welcome to S.M. Shaida's Campaign Admin Panel
                  </h3>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(232,224,208,0.65)', lineHeight: 1.7, margin: 0 }}>
                    Use the navigation below to switch views. You can review nominee applications, appoint or fire village representatives, 
                    and manage the 11 photo slots displayed in the main website's carousel — all in real time via Supabase.
                  </p>
                </div>

                {/* Recent applications preview */}
                {applications.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#fff', margin: 0 }}>Recent Applications</h3>
                      <button onClick={() => setActiveTab('applications')} style={{
                        background: 'none', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C',
                        borderRadius: 20, padding: '6px 14px', fontFamily: 'Inter, sans-serif',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer'
                      }}>View All →</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {applications.slice(0, 5).map(app => (
                        <div key={app.id} onClick={() => { setSelectedApp(app); setActiveTab('applications'); }} style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)',
                          borderRadius: 12, padding: '14px 18px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: 'pointer', transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.1)'}
                        >
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{app.roleIcon}</div>
                            <div>
                              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>{app.fullName}</div>
                              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(232,224,208,0.4)', marginTop: 2 }}>
                                {app.roleName} • {app.village}
                              </div>
                            </div>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: APPLICATIONS */}
            {activeTab === 'applications' && (
              <div style={{ animation: 'scaleIn 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#fff', margin: 0, fontWeight: 900 }}>
                    Nomination Applications
                  </h2>
                  <div style={{
                    display: 'flex', gap: 4, flexWrap: 'wrap',
                    background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 30,
                    border: '1px solid rgba(255,255,255,0.07)'
                  }}>
                    {['all', 'pending', 'appointed', 'rejected', 'fired'].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} style={{
                        background: statusFilter === st ? '#C9A84C' : 'transparent',
                        color: statusFilter === st ? '#0A1628' : 'rgba(232,224,208,0.55)',
                        border: 'none', borderRadius: 30, padding: '6px 14px',
                        fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s'
                      }}>{st}</button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div style={{ marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="🔍  Search by name, village, mandal, or role..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...inputS, padding: '14px 16px' }}
                  />
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total', val: totalApps, color: '#E8E0D0' },
                    { label: 'Pending', val: pendingApps, color: '#FFD54F' },
                    { label: 'Appointed', val: approvedApps, color: '#81C784' },
                    { label: 'Rejected', val: rejectedApps, color: '#E57373' },
                    { label: 'Fired', val: firedApps, color: '#FFB74D' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 8, padding: '6px 14px', fontFamily: 'Inter, sans-serif'
                    }}>
                      <span style={{ fontSize: 10, color: 'rgba(232,224,208,0.4)' }}>{s.label}: </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.val}</span>
                    </div>
                  ))}
                </div>

                {/* List */}
                {filteredApps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Inter, sans-serif', color: 'rgba(232,224,208,0.35)' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    No applications match the filter criteria.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredApps.map(app => (
                      <div key={app.id} onClick={() => setSelectedApp(app)} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)',
                        borderRadius: 16, padding: '18px 20px',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.2s', gap: 12
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      >
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                            {app.roleIcon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.fullName}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(232,224,208,0.45)', marginTop: 3 }}>
                              {app.roleName} • {app.village}, {app.mandal}
                            </div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(232,224,208,0.3)', marginTop: 2 }}>
                              Applied: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : '—'}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: PHOTOS MANAGER */}
            {activeTab === 'photos' && (
              <div style={{ animation: 'scaleIn 0.3s ease' }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#fff', marginBottom: 8, fontWeight: 900 }}>
                  Website Photo Manager
                </h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(232,224,208,0.5)', marginBottom: 28 }}>
                  Manage the 11 photo slots displayed in the website's main carousel. Tap a slot to change its photo, captions, or tags.
                  All changes sync instantly to the live website via Supabase.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 20 }}>
                  {Array.from({ length: 11 }, (_, i) => {
                    const slotId = i + 1;
                    const slot = photos.find(p => p.id === slotId) || { id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: '' };
                    const isBroken = brokenImgs[slotId];
                    const hasImage = slot.src && !isBroken;
                    return (
                      <div key={slotId} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.15)',
                        borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.45)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {/* Image preview */}
                        <div style={{ height: 170, background: '#020810', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {hasImage ? (
                            <img
                              src={slot.src}
                              alt={slot.captionEn || `Slot ${slotId}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={() => setBrokenImgs(prev => ({ ...prev, [slotId]: true }))}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'rgba(232,224,208,0.25)', gap: 8 }}>
                              <span style={{ fontSize: 40 }}>🖼️</span>
                              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>Empty Slot {slotId}</span>
                            </div>
                          )}
                          {/* Slot badge */}
                          <div style={{
                            position: 'absolute', top: 10, left: 10,
                            background: 'rgba(10,22,40,0.88)', color: '#C9A84C',
                            border: '1px solid #C9A84C', borderRadius: 4, padding: '2px 9px',
                            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700
                          }}>Slot {slotId}</div>
                          {hasImage && (
                            <div style={{
                              position: 'absolute', top: 10, right: 10,
                              background: 'rgba(46,125,50,0.88)', borderRadius: 4, padding: '2px 7px',
                              fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#fff'
                            }}>● LIVE</div>
                          )}
                          {/* Caption overlay on filled slots */}
                          {hasImage && slot.captionEn && (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(transparent, rgba(5,13,26,0.92))',
                              padding: '20px 12px 10px',
                              fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#fff', fontWeight: 500
                            }}>
                              {slot.captionEn}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: hasImage ? '#C9A84C' : 'rgba(201,168,76,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {slot.tagEn || 'NO TAG SET'}
                            </div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: hasImage ? '#fff' : 'rgba(232,224,208,0.4)', fontWeight: 600, marginTop: 4 }}>
                              {slot.captionEn || 'No Caption Set'}
                            </div>
                            {slot.captionTe && (
                              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(232,224,208,0.45)', marginTop: 2 }}>
                                {slot.captionTe}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openPhotoEditor(slot)} style={{
                              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                              background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', color: '#0A1628',
                              fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 800, cursor: 'pointer'
                            }}>✏️ Edit Slot</button>
                            {hasImage && (
                              <button onClick={() => handleClearPhotoSlot(slotId, slot.src)} style={{
                                width: 36, height: 34, borderRadius: 6,
                                border: '1px solid rgba(198,40,40,0.4)',
                                background: 'rgba(198,40,40,0.1)', color: '#E57373',
                                cursor: 'pointer', fontSize: 14
                              }}>🗑</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div style={{ animation: 'scaleIn 0.3s ease', maxWidth: 480 }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#fff', marginBottom: 8, fontWeight: 900 }}>Settings</h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(232,224,208,0.5)', marginBottom: 32 }}>Manage your admin portal preferences and security.</p>

                {/* Change PIN card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 18, padding: 28, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔐</div>
                    <div>
                      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#fff' }}>Change PIN</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(232,224,208,0.45)', marginTop: 2 }}>Update your 4-digit access PIN</div>
                    </div>
                  </div>

                  {pwStep === 'idle' && !pwSuccess && (
                    <button onClick={() => { resetPwFlow(); setPwStep('enterCurrent'); }} style={{
                      width: '100%', padding: '13px 0', borderRadius: 50, border: 'none',
                      background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', color: '#0A1628',
                      fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer'
                    }}>Change PIN →</button>
                  )}

                  {pwSuccess && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#81C784', fontWeight: 700 }}>PIN Changed Successfully!</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(232,224,208,0.5)', marginTop: 8 }}>Your new PIN is active. Use it on next login.</div>
                    </div>
                  )}

                  {(pwStep === 'enterCurrent' || pwStep === 'enterNew' || pwStep === 'confirmNew') && (
                    <div>
                      <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C9A84C', fontWeight: 600, marginBottom: 4 }}>
                          {pwStep === 'enterCurrent' ? '🔒 Enter your current PIN' : pwStep === 'enterNew' ? '🆕 Enter your new PIN' : '✅ Confirm new PIN'}
                        </div>
                        {/* PIN dots */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, margin: '16px 0' }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{
                              width: 18, height: 18, borderRadius: '50%',
                              border: '2px solid #C9A84C',
                              background: currentPwEntry.length > i ? '#C9A84C' : 'transparent',
                              boxShadow: currentPwEntry.length > i ? '0 0 10px #C9A84C' : 'none',
                              transition: 'all 0.15s'
                            }} />
                          ))}
                        </div>
                        {pwError && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#E45B5B', marginTop: 8 }}>{pwError}</div>}
                      </div>

                      {/* Mini keypad */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                        {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => handlePwDigit(num.toString())} style={{
                            padding: '14px 0', borderRadius: 10, border: '1px solid rgba(201,168,76,0.25)',
                            background: 'rgba(255,255,255,0.03)', color: '#E8E0D0',
                            fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.12s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          >{num}</button>
                        ))}
                        <button onClick={() => resetPwFlow()} style={{
                          padding: '14px 0', borderRadius: 10, border: 'none',
                          background: 'transparent', color: 'rgba(232,224,208,0.4)',
                          fontFamily: 'Inter, sans-serif', fontSize: 11, cursor: 'pointer', fontWeight: 700
                        }}>CANCEL</button>
                        <button onClick={() => handlePwDigit('0')} style={{
                          padding: '14px 0', borderRadius: 10, border: '1px solid rgba(201,168,76,0.25)',
                          background: 'rgba(255,255,255,0.03)', color: '#E8E0D0',
                          fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600, cursor: 'pointer'
                        }}>0</button>
                        <button onClick={handlePwBackspace} style={{
                          padding: '14px 0', borderRadius: 10, border: 'none',
                          background: 'transparent', color: 'rgba(232,224,208,0.5)',
                          fontFamily: 'Inter, sans-serif', fontSize: 20, cursor: 'pointer'
                        }}>⌫</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info card */}
                <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(232,224,208,0.45)', lineHeight: 1.7 }}>
                    ⚠️ Your PIN is stored securely on this device. If you forget your PIN, contact the developer to reset it.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── BOTTOM NAV */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 72,
        background: '#0A1628', borderTop: '1px solid rgba(201,168,76,0.2)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 99
      }}>
        {[
          { id: 'dashboard',    label: 'Dashboard',    icon: '📊', badge: null },
          { id: 'applications', label: 'Applications', icon: '📥', badge: pendingApps > 0 ? pendingApps : null },
          { id: 'photos',       label: 'Photos',       icon: '🖼️', badge: null },
          { id: 'settings',     label: 'Settings',     icon: '⚙️', badge: null },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: 'none', border: 'none',
            color: activeTab === tab.id ? '#C9A84C' : 'rgba(232,224,208,0.4)',
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: activeTab === tab.id ? 800 : 500,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            cursor: 'pointer', outline: 'none', position: 'relative', padding: '8px 20px'
          }}>
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge && (
              <span style={{
                position: 'absolute', top: 2, right: 10,
                background: '#C9A84C', color: '#0A1628', borderRadius: '50%',
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 900
              }}>{tab.badge}</span>
            )}
            {activeTab === tab.id && (
              <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2, background: '#C9A84C', borderRadius: 2 }} />
            )}
          </button>
        ))}
      </nav>

      {/* ── DRAWER: APPLICATION DETAIL */}
      {selectedApp && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)', zIndex: 999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => setSelectedApp(null)}>
          <div style={{
            width: '100%', maxWidth: 560, background: '#0A1628',
            borderTop: '3px solid #C9A84C', borderRadius: '22px 22px 0 0',
            padding: '28px 28px 36px', animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
            maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box',
            boxShadow: '0 -16px 60px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>

            {/* Handle */}
            <div style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '0 auto 22px', cursor: 'pointer' }} onClick={() => setSelectedApp(null)} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(201,168,76,0.15)', paddingBottom: 16, marginBottom: 22 }}>
              <div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#C9A84C', letterSpacing: '0.12em', fontWeight: 700 }}>
                  {selectedApp.roleIcon} {selectedApp.roleName?.toUpperCase()}
                </span>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 900, color: '#fff', margin: '6px 0 0' }}>{selectedApp.fullName}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <button onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', color: '#C9A84C', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
                <StatusBadge status={selectedApp.status} />
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>

              {/* ── Application ID Highlight Box ── */}
              {(selectedApp.tempId || selectedApp.id) && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.06))',
                  border: '1.5px solid rgba(201,168,76,0.45)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 4
                }}>
                  <div>
                    <span style={{ fontSize: 9, color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>🪪 Application ID</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: '#FFD97D', letterSpacing: '0.06em' }}>
                      {selectedApp.tempId || `APP-${String(selectedApp.id).padStart(6, '0')}`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const idVal = selectedApp.tempId || `APP-${String(selectedApp.id).padStart(6, '0')}`;
                      navigator.clipboard.writeText(idVal).then(() => alert(`✅ Application ID copied: ${idVal}`));
                    }}
                    title="Copy Application ID"
                    style={{
                      background: 'rgba(201,168,76,0.15)',
                      border: '1px solid rgba(201,168,76,0.4)',
                      borderRadius: 8,
                      color: '#C9A84C',
                      fontSize: 13,
                      fontWeight: 700,
                      padding: '7px 14px',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.28)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(201,168,76,0.15)'}
                  >📋 Copy ID</button>
                </div>
              )}

              {[
                { l: 'Age / Gender',         v: `${selectedApp.age} years / ${selectedApp.gender}` },
                { l: 'Mobile Number',         v: selectedApp.mobile },
                { l: 'WhatsApp Number',       v: selectedApp.whatsapp || '—' },
                { l: 'Email Address',         v: selectedApp.email || '—' },
                { l: 'Village / Mandal',      v: `${selectedApp.village}, ${selectedApp.mandal}` },
                { l: 'Residential Address',   v: selectedApp.address },
                { l: 'Applied On',            v: selectedApp.appliedAt ? new Date(selectedApp.appliedAt).toLocaleString('en-IN') : '—' },
              ].map(({ l, v }) => (
                <div key={l} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 10, color: 'rgba(232,224,208,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span>
                  <div style={{ color: '#E8E0D0', marginTop: 4, fontWeight: 500, lineHeight: 1.5 }}>{v}</div>
                </div>
              ))}

              {/* Advisor extra info */}
              {selectedApp.roleId === 'advisor' && (selectedApp.yearsExp || selectedApp.politicalBg) && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: 10, color: '#C9A84C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Advisor Details</span>
                  {selectedApp.yearsExp && <div style={{ fontSize: 13, marginTop: 8 }}><strong>Years of Experience:</strong> {selectedApp.yearsExp}</div>}
                  {selectedApp.politicalBg && (
                    <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6, color: 'rgba(232,224,208,0.8)' }}>
                      <strong>Political Background:</strong><br />{selectedApp.politicalBg}
                    </div>
                  )}
                </div>
              )}

              {/* 24/7 availability */}
              {selectedApp.available247 && (
                <div style={{ color: '#81C784', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✓</span> Nominee confirmed 24/7 availability when called.
                </div>
              )}

              {/* Aadhaar Documents Section */}
              {(selectedApp.aadharFront || selectedApp.aadharBack) && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 10, color: '#C9A84C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 12 }}>
                    Uploaded Documents (Aadhaar Card)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {selectedApp.aadharFront && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(232,224,208,0.55)' }}>Front Side</span>
                        <a href={selectedApp.aadharFront} target="_blank" rel="noopener noreferrer" style={{ borderRadius: 10, border: '1.5px solid rgba(201,168,76,0.25)', overflow: 'hidden', display: 'block', height: 110, background: '#020810', position: 'relative' }}>
                          <img src={selectedApp.aadharFront} alt="Aadhaar Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.4)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0}
                          >🔍 View Full</div>
                        </a>
                      </div>
                    )}
                    {selectedApp.aadharBack && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(232,224,208,0.55)' }}>Back Side</span>
                        <a href={selectedApp.aadharBack} target="_blank" rel="noopener noreferrer" style={{ borderRadius: 10, border: '1.5px solid rgba(201,168,76,0.25)', overflow: 'hidden', display: 'block', height: 110, background: '#020810', position: 'relative' }}>
                          <img src={selectedApp.aadharBack} alt="Aadhaar Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.4)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0}
                          >🔍 View Full</div>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
              {(selectedApp.status === 'appointed' || selectedApp.status === 'approved') ? (
                <>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'fired')} style={{
                    flex: 1, padding: 14, borderRadius: 50, border: '1px solid rgba(198,40,40,0.5)',
                    background: 'rgba(198,40,40,0.1)', color: '#E57373',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                  }}>Fire Member ❌</button>
                  <button disabled style={{
                    flex: 1, padding: 14, borderRadius: 50, border: 'none',
                    background: '#2E7D32', color: '#fff',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 800,
                    opacity: 0.8, cursor: 'not-allowed'
                  }}>Appointed ✓</button>
                </>
              ) : selectedApp.status === 'fired' ? (
                <>
                  <button disabled style={{
                    flex: 1, padding: 14, borderRadius: 50, border: '1px solid rgba(198,40,40,0.5)',
                    background: '#C62828', color: '#fff',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'not-allowed'
                  }}>Fired ✓</button>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'appointed')} style={{
                    flex: 1, padding: 14, borderRadius: 50, border: 'none',
                    background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', color: '#0A1628',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer'
                  }}>Re-Appoint Member</button>
                </>
              ) : selectedApp.status === 'rejected' ? (
                <>
                  <button disabled style={{
                    flex: 1, padding: 14, borderRadius: 50, border: '1px solid rgba(198,40,40,0.5)',
                    background: '#C62828', color: '#fff',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'not-allowed'
                  }}>Rejected ✓</button>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'appointed')} style={{
                    flex: 1, padding: 14, borderRadius: 50, border: 'none',
                    background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', color: '#0A1628',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer'
                  }}>Appoint Member ✓</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'rejected')} style={{
                    flex: 1, padding: 14, borderRadius: 50, border: '1px solid rgba(198,40,40,0.5)',
                    background: 'rgba(198,40,40,0.1)', color: '#E57373',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                  }}>Reject Nomination</button>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'appointed')} style={{
                    flex: 1, padding: 14, borderRadius: 50, border: 'none',
                    background: 'linear-gradient(135deg,#C9A84C,#E4C97A)', color: '#0A1628',
                    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.25)'
                  }}>Appoint Member ✅</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: PHOTO SLOT EDITOR */}
      {selectedSlot && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)', zIndex: 999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => setSelectedSlot(null)}>
          <form onSubmit={handleSavePhotoSlot} style={{
            width: '100%', maxWidth: 560, background: '#0A1628',
            borderTop: '3px solid #C9A84C', borderRadius: '22px 22px 0 0',
            padding: '28px 28px 36px', animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
            maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box',
            boxShadow: '0 -16px 60px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>

            {/* Handle */}
            <div style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '0 auto 22px', cursor: 'pointer' }} onClick={() => setSelectedSlot(null)} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(201,168,76,0.15)', paddingBottom: 16, marginBottom: 22 }}>
              <div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#C9A84C', letterSpacing: '0.12em', fontWeight: 700 }}>PHOTO SLOT EDITOR</span>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#fff', margin: '6px 0 0' }}>Edit Slot {selectedSlot.id}</h3>
              </div>
              <button type="button" onClick={() => setSelectedSlot(null)} style={{ background: 'none', border: 'none', color: '#C9A84C', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Current image preview */}
            {(selectedSlot.src || uploadPreview) && (
              <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', height: 140, background: '#020810' }}>
                <img
                  src={uploadPreview || selectedSlot.src}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* File upload */}
              <div>
                <label style={lblS}>Upload New Photo (JPG, PNG, WEBP)</label>
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(201,168,76,0.35)',
                  borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', position: 'relative'
                }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>📤</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#C9A84C', fontWeight: 600 }}>
                    {uploadFile ? `✅ ${uploadFile.name}` : 'Click to select image'}
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    Will be uploaded to Supabase Storage & linked to this slot
                  </span>
                </div>
              </div>

              {/* Tags row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lblS}>English Tag (Short)</label>
                  <input type="text" placeholder="e.g. Rally" value={editForm.tagEn}
                    onChange={e => setEditForm(p => ({ ...p, tagEn: e.target.value }))} style={inputS} />
                </div>
                <div>
                  <label style={lblS}>Telugu Tag (Short)</label>
                  <input type="text" placeholder="e.g. ర్యాలీ" value={editForm.tagTe}
                    onChange={e => setEditForm(p => ({ ...p, tagTe: e.target.value }))} style={inputS} />
                </div>
              </div>

              {/* Captions */}
              <div>
                <label style={lblS}>English Caption</label>
                <input type="text" placeholder="Describe this photo in English..." value={editForm.captionEn}
                  onChange={e => setEditForm(p => ({ ...p, captionEn: e.target.value }))} style={inputS} required />
              </div>
              <div>
                <label style={lblS}>Telugu Caption</label>
                <input type="text" placeholder="ఫోటో వివరణ తెలుగులో..." value={editForm.captionTe}
                  onChange={e => setEditForm(p => ({ ...p, captionTe: e.target.value }))} style={inputS} required />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 14, marginTop: 28 }}>
              <button type="button" onClick={() => setSelectedSlot(null)} style={{
                flex: 1, padding: 14, borderRadius: 50, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: '#E8E0D0',
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}>Cancel</button>
              <button type="submit" disabled={savingSlot} style={{
                flex: 2, padding: 14, borderRadius: 50, border: 'none',
                background: savingSlot ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg,#C9A84C,#E4C97A)',
                color: '#0A1628', fontFamily: 'Inter, sans-serif', fontSize: 14,
                fontWeight: 800, cursor: savingSlot ? 'wait' : 'pointer',
                boxShadow: '0 4px 18px rgba(0,0,0,0.25)'
              }}>
                {savingSlot ? '⏳ Uploading to Supabase...' : '💾 Save & Publish to Website'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
