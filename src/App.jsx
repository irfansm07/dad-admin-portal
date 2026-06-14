import React, { useState, useEffect } from 'react';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://${window.location.hostname}:5000/api`
  : 'https://dad-admin-portal.onrender.com/api';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [apiConnected, setApiConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | applications | photos
  
  // Data states
  const [applications, setApplications] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // App detail sheet states
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Photo slot editor sheet states
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editForm, setEditForm] = useState({ captionTe:'', captionEn:'', tagTe:'', tagEn:'' });
  const [uploadFile, setUploadFile] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Check backend connection & fetch data
  const fetchData = async () => {
    try {
      const [resApps, resPhotos] = await Promise.all([
        fetch(`${API_BASE}/applications`),
        fetch(`${API_BASE}/photos`)
      ]);
      if (resApps.ok && resPhotos.ok) {
        const apps = await resApps.json();
        const pts = await resPhotos.json();
        setApplications(apps);
        setPhotos(pts);
        setApiConnected(true);
      }
    } catch (err) {
      console.error('API disconnected:', err);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Poll API connection every 5 seconds to show real-time indicator
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Passcode Login
  const handlePasscodePress = (num) => {
    setLoginError(false);
    if (passcode.length < 4) {
      const newPass = passcode + num;
      setPasscode(newPass);
      if (newPass === '7777') {
        // Authenticated!
        setTimeout(() => setAuthenticated(true), 200);
      } else if (newPass.length === 4) {
        // Wrong passcode
        setTimeout(() => {
          setLoginError(true);
          setPasscode('');
        }, 300);
      }
    }
  };

  // Handle application review action
  const handleStatusChange = async (appId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // Update local state
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        if (selectedApp?.id === appId) {
          setSelectedApp(prev => ({ ...prev, status: newStatus }));
        }
        alert(`Application marked as ${newStatus}`);
      }
    } catch (err) {
      alert('Failed to update status. Check backend connection.');
    }
  };

  // Open photo editor sheet
  const openPhotoEditor = (slot) => {
    setSelectedSlot(slot);
    setEditForm({
      captionTe: slot.captionTe || '',
      captionEn: slot.captionEn || '',
      tagTe: slot.tagTe || '',
      tagEn: slot.tagEn || ''
    });
    setUploadFile(null);
  };

  // Save photo slot
  const handleSavePhotoSlot = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSavingSlot(true);

    const formData = new FormData();
    formData.append('slotId', selectedSlot.id);
    formData.append('captionTe', editForm.captionTe);
    formData.append('captionEn', editForm.captionEn);
    formData.append('tagTe', editForm.tagTe);
    formData.append('tagEn', editForm.tagEn);
    if (uploadFile) {
      formData.append('image', uploadFile);
    }

    try {
      const res = await fetch(`${API_BASE}/photos`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        await fetchData(); // Refresh photos list
        setSelectedSlot(null);
        alert('Photo slot updated successfully!');
      }
    } catch (err) {
      alert('Failed to save photo slot. Check backend connection.');
    } finally {
      setSavingSlot(false);
    }
  };

  // Clear/Delete photo slot
  const handleClearPhotoSlot = async (slotId) => {
    if (!confirm('Are you sure you want to clear this photo slot? This will remove the image from the website.')) return;
    try {
      const res = await fetch(`${API_BASE}/photos/${slotId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchData(); // Refresh photos list
        setSelectedSlot(null);
        alert('Slot cleared successfully.');
      }
    } catch (err) {
      alert('Failed to clear slot.');
    }
  };

  // Filter applications
  const filteredApps = applications.filter(a => {
    const matchesSearch = a.fullName.toLowerCase().includes(search.toLowerCase()) ||
                          a.village.toLowerCase().includes(search.toLowerCase()) ||
                          a.roleName.toLowerCase().includes(search.toLowerCase());
    const status = a.status === 'approved' ? 'appointed' : a.status;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalApps = applications.length;
  const pendingApps = applications.filter(a => a.status === 'pending').length;
  const approvedApps = applications.filter(a => a.status === 'appointed' || a.status === 'approved').length;
  const firedApps = applications.filter(a => a.status === 'fired').length;
  const activePhotosCount = photos.filter(p => p.src).length;

  if (!authenticated) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050D1A', padding:20 }}>
        <div style={{ width:'100%', maxWidth:340, textAlign:'center', animation:'scaleIn 0.4s ease' }}>
          <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#C9A84C,#E4C97A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'#0A1628', margin:'0 auto 20px', boxShadow:'0 0 20px rgba(201,168,76,0.3)' }}>⚜</div>
          <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:26, color:'#C9A84C', fontWeight:900, marginBottom:8 }}>S.M. SAIDA</h2>
          <p style={{ fontFamily:'Inter', fontSize:12, color:'rgba(232,224,208,0.5)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:36 }}>Campaign Admin Portal</p>
          
          {/* Code Dots Indicator */}
          <div style={{ display:'flex', justifyContent:'center', gap:18, marginBottom:44 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width:16, height:16, borderRadius:'50%',
                border:'2px solid #C9A84C',
                background: passcode.length > i ? '#C9A84C' : 'transparent',
                boxShadow: passcode.length > i ? '0 0 10px #C9A84C' : 'none',
                transition:'all 0.15s ease',
                transform: loginError ? 'translateX(5px)' : 'none',
                animation: loginError ? 'wiggle 0.1s ease 3' : 'none'
              }} />
            ))}
          </div>

          {/* Keypad */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handlePasscodePress(num.toString())} style={{
                width:72, height:72, borderRadius:'50%', border:'1px solid rgba(201,168,76,0.3)',
                background:'rgba(255,255,255,0.02)', color:'#E8E0D0', fontFamily:'Inter', fontSize:24, fontWeight:600,
                cursor:'pointer', transition:'all 0.15s', outline:'none', margin:'0 auto'
              }} onTouchStart={e=>e.target.style.background='rgba(201,168,76,0.2)'} onTouchEnd={e=>e.target.style.background='rgba(255,255,255,0.02)'}
                 onMouseEnter={e=>e.target.style.background='rgba(201,168,76,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.02)'}>
                {num}
              </button>
            ))}
            <div />
            <button onClick={() => handlePasscodePress('0')} style={{
              width:72, height:72, borderRadius:'50%', border:'1px solid rgba(201,168,76,0.3)',
              background:'rgba(255,255,255,0.02)', color:'#E8E0D0', fontFamily:'Inter', fontSize:24, fontWeight:600,
              cursor:'pointer', transition:'all 0.15s', outline:'none', margin:'0 auto'
            }} onTouchStart={e=>e.target.style.background='rgba(201,168,76,0.2)'} onTouchEnd={e=>e.target.style.background='rgba(255,255,255,0.02)'}
               onMouseEnter={e=>e.target.style.background='rgba(201,168,76,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.02)'}>
              0
            </button>
            <button onClick={() => setPasscode(p => p.slice(0,-1))} style={{
              width:72, height:72, borderRadius:'50%', border:'none',
              background:'transparent', color:'rgba(232,224,208,0.5)', fontFamily:'Inter', fontSize:16, fontWeight:600,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', outline:'none', margin:'0 auto'
            }}>
              ⌫
            </button>
          </div>

          {loginError && <p style={{ fontFamily:'Inter', fontSize:14, color:'#E45B5B', margin:0 }}>Incorrect Passcode. Try again.</p>}
          <p style={{ fontFamily:'Inter', fontSize:11, color:'rgba(232,224,208,0.35)', marginTop:24 }}>Tip: Enter passcode 7777 to sign in</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#050D1A', display:'flex', flexDirection:'column' }}>
      
      {/* ── HEADER ── */}
      <header style={{
        height:68, background:'#0A1628', borderBottom:'1px solid rgba(201,168,76,0.25)',
        padding:'0 5%', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:99
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, color:'#C9A84C' }}>⚜</span>
          <span style={{ fontFamily:'Playfair Display,serif', fontSize:18, fontWeight:900, color:'#C9A84C', letterSpacing:'0.04em' }}>SAIDA ADMIN</span>
        </div>
        
        {/* Connection status badge */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:apiConnected?'rgba(46,125,50,0.1)':'rgba(198,40,40,0.1)', border:apiConnected?'1px solid rgba(46,125,50,0.3)':'1px solid rgba(198,40,40,0.3)', borderRadius:20, padding:'6px 12px' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:apiConnected?'#2E7D32':'#C62828', display:'inline-block' }} />
          <span style={{ fontFamily:'Inter', fontSize:10, fontWeight:700, color:apiConnected?'#2E7D32':'#C62828', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {apiConnected ? 'Server Connected' : 'Server Offline'}
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main style={{ flex:1, padding:'24px 5% 90px', maxWidth:1200, margin:'0 auto', width:'100%' }}>
        
        {/* Loading overlay if fetching */}
        {loading && (
          <div style={{ textAlign:'center', padding:'48px 0', fontFamily:'Inter', color:'rgba(232,224,208,0.5)' }}>
            Loading dashboard data...
          </div>
        )}

        {!loading && (
          <>
            {/* ── TAB 1: DASHBOARD ── */}
            {activeTab === 'dashboard' && (
              <div style={{ animation:'scaleIn 0.3s ease' }}>
                <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:26, color:'#fff', marginBottom:20 }}>Dashboard Overview</h2>
                
                {/* Stats Cards */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:16, marginBottom:32 }}>
                  {[
                    { title:'Total Applications', val:totalApps, bg:'rgba(255,255,255,0.02)', icon:'📥', color:'#E8E0D0' },
                    { title:'Pending Review', val:pendingApps, bg:'rgba(201,168,76,0.05)', icon:'⏳', color:'#C9A84C', border:'1px solid rgba(201,168,76,0.3)' },
                    { title:'Appointed Members', val:approvedApps, bg:'rgba(46,125,50,0.06)', icon:'✅', color:'#2E7D32', border:'1px solid rgba(46,125,50,0.3)' },
                    { title:'Fired Members', val:firedApps, bg:'rgba(198,40,40,0.06)', icon:'❌', color:'#E57373', border:'1px solid rgba(198,40,40,0.3)' },
                    { title:'Photos Active', val:`${activePhotosCount} / 11`, bg:'rgba(255,255,255,0.02)', icon:'🖼️', color:'#E8E0D0' }
                  ].map((s,i) => (
                    <div key={i} style={{ 
                      background:s.bg, border:s.border || '1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:20,
                      display:'flex', justifyContent:'space-between', alignItems:'center'
                    }}>
                      <div>
                        <div style={{ fontFamily:'Inter', fontSize:11, color:'rgba(232,224,208,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{s.title}</div>
                        <div style={{ fontFamily:'Playfair Display,serif', fontSize:28, fontWeight:900, color:s.color }}>{s.val}</div>
                      </div>
                      <div style={{ fontSize:32 }}>{s.icon}</div>
                    </div>
                  ))}
                </div>

                {/* Quick actions & welcome */}
                <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.15)', borderRadius:18, padding:24, marginBottom:32 }}>
                  <h3 style={{ fontFamily:'Playfair Display,serif', fontSize:18, color:'#C9A84C', marginBottom:10 }}>Welcome to S.M. Saida's Admin Panel</h3>
                  <p style={{ fontFamily:'Inter', fontSize:13, color:'rgba(232,224,208,0.6)', lineHeight:1.6, margin:0 }}>
                    Use the bottom bar to switch views. You can review nominee details, approve village representatives, and edit the main homepage carousel slide configurations instantly.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB 2: APPLICATIONS ── */}
            {activeTab === 'applications' && (
              <div style={{ animation:'scaleIn 0.3s ease' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:20 }}>
                  <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:26, color:'#fff', margin:0 }}>Nomination Applications</h2>
                  
                  {/* Status Pills */}
                  <div style={{ display:'flex', gap:6, background:'rgba(255,255,255,0.03)', padding:4, borderRadius:30, border:'1px solid rgba(255,255,255,0.08)' }}>
                    {['all', 'pending', 'appointed', 'rejected', 'fired'].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} style={{
                        background:statusFilter === st ? '#C9A84C' : 'transparent',
                        color:statusFilter === st ? '#0A1628' : 'rgba(232,224,208,0.6)',
                        border:'none', borderRadius:30, padding:'6px 14px', fontFamily:'Inter', fontSize:11, fontWeight:700,
                        cursor:'pointer', textTransform:'uppercase', transition:'all 0.2s'
                      }}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search box */}
                <div style={{ marginBottom:20 }}>
                  <input type="text" placeholder="Search by name, village, mandal, or role..." value={search} onChange={e=>setSearch(e.target.value)} style={{
                    width:'100%', padding:'14px 16px', borderRadius:10, border:'1px solid rgba(201,168,76,0.2)',
                    background:'rgba(255,255,255,0.04)', color:'#fff', outline:'none', fontFamily:'Inter', fontSize:14
                  }} />
                </div>

                {/* Applications Listing */}
                {filteredApps.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 0', fontFamily:'Inter', color:'rgba(232,224,208,0.4)' }}>
                    No applications match the search/filter criteria.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {filteredApps.map(app => (
                      <div key={app.id} onClick={() => setSelectedApp(app)} style={{
                        background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.1)', borderRadius:16, padding:18,
                        cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.2s',
                        boxShadow:'0 4px 12px rgba(0,0,0,0.1)'
                      }} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(201,168,76,0.3)'} onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(201,168,76,0.1)'}>
                        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                          {/* Role Icon */}
                          <div style={{ width:46, height:46, borderRadius:'50%', background:'rgba(201,168,76,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                            {app.roleIcon}
                          </div>
                          <div>
                            <div style={{ fontFamily:'Playfair Display,serif', fontSize:16, fontWeight:700, color:'#fff' }}>{app.fullName}</div>
                            <div style={{ fontFamily:'Inter', fontSize:12, color:'rgba(232,224,208,0.5)', marginTop:3 }}>
                              Role: <strong style={{ color:'#C9A84C' }}>{app.roleName}</strong> • Village: <strong>{app.village}</strong>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status Label */}
                        <div style={{
                          background: (app.status==='appointed' || app.status==='approved') ? 'rgba(46,125,50,0.15)' : 
                                      app.status==='rejected' ? 'rgba(198,40,40,0.15)' : 
                                      app.status==='fired' ? 'rgba(230,81,0,0.15)' : 'rgba(201,168,76,0.15)',
                          border: (app.status==='appointed' || app.status==='approved') ? '1px solid #2E7D32' : 
                                  app.status==='rejected' ? '1px solid #C62828' : 
                                  app.status==='fired' ? '1px solid #E65100' : '1px solid #C9A84C',
                          color: (app.status==='appointed' || app.status==='approved') ? '#81C784' : 
                                 app.status==='rejected' ? '#E57373' : 
                                 app.status==='fired' ? '#FFB74D' : '#FFD54F',
                          borderRadius:20, padding:'4px 12px', fontFamily:'Inter', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'
                        }}>
                          {app.status === 'approved' ? 'appointed' : app.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: PHOTOS MANAGER ── */}
            {activeTab === 'photos' && (
              <div style={{ animation:'scaleIn 0.3s ease' }}>
                <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:26, color:'#fff', marginBottom:10 }}>Website Photo Manager</h2>
                <p style={{ fontFamily:'Inter', fontSize:13, color:'rgba(232,224,208,0.5)', marginBottom:24 }}>
                  Configure the 11 photo slots displayed in the website's main carousel. Tap a slot to change its photo, captions, or tags.
                </p>

                {/* Slots Grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
                  {Array.from({ length: 11 }, (_, i) => {
                    const slotId = i + 1;
                    const slot = photos.find(p => p.id === slotId) || { id: slotId, src: '', captionTe: '', captionEn: '', tagTe: '', tagEn: '' };
                    return (
                      <div key={slotId} style={{
                        background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.15)', borderRadius:18,
                        overflow:'hidden', display:'flex', flexDirection:'column', height:260, justifyContent:'space-between'
                      }}>
                        {/* Image Preview Block */}
                        <div style={{ height:140, background:'#020810', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                          {slot.src ? (
                            <img src={slot.src.startsWith('http') ? slot.src : `http://${window.location.hostname}:5000${slot.src}`} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => {
                              // Fallback if Vite dev server host varies
                              e.target.src = slot.src;
                            }} />
                          ) : (
                            <div style={{ textAlign:'center', color:'rgba(232,224,208,0.3)' }}>
                              <span style={{ fontSize:32, display:'block', marginBottom:6 }}>🖼️</span>
                              <span style={{ fontFamily:'Inter', fontSize:12 }}>Empty Slot {slotId}</span>
                            </div>
                          )}
                          <div style={{ position:'absolute', top:10, left:10, background:'rgba(10,22,40,0.85)', color:'#C9A84C', border:'1px solid #C9A84C', borderRadius:4, padding:'2px 8px', fontFamily:'Inter', fontSize:11, fontWeight:700 }}>
                            Slot {slotId}
                          </div>
                        </div>

                        {/* Text details */}
                        <div style={{ padding:14, flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                          <div>
                            <div style={{ fontFamily:'Inter', fontSize:11, color:'#C9A84C', fontWeight:700 }}>
                              {slot.tagEn || 'No Tag'}
                            </div>
                            <div style={{ fontFamily:'Playfair Display,serif', fontSize:13, color:'#fff', fontWeight:600, marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {slot.captionEn || 'No Caption (English)'}
                            </div>
                          </div>
                          
                          {/* Manage Button */}
                          <div style={{ display:'flex', gap:8, marginTop:8 }}>
                            <button onClick={() => openPhotoEditor(slot)} style={{
                              flex:1, padding:'6px 0', borderRadius:6, border:'none',
                              background:'linear-gradient(135deg,#C9A84C,#E4C97A)', color:'#0A1628',
                              fontFamily:'Inter', fontSize:11, fontWeight:800, cursor:'pointer'
                            }}>
                              Edit Slot
                            </button>
                            {slot.src && (
                              <button onClick={() => handleClearPhotoSlot(slotId)} style={{
                                width:30, height:26, borderRadius:6, border:'1px solid rgba(198,40,40,0.4)',
                                background:'rgba(198,40,40,0.1)', color:'#E57373', cursor:'pointer', fontSize:12
                              }}>
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── BOTTOM NAV BAR (MOBILE FOCUSSED) ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, height:68, background:'#0A1628',
        borderTop:'1px solid rgba(201,168,76,0.25)', display:'flex', justifyContent:'space-around', alignItems:'center', zIndex:99
      }}>
        {[
          { id:'dashboard', label:'Dashboard', icon:'📊' },
          { id:'applications', label:'Applications', icon:'📥' },
          { id:'photos', label:'Photos Manager', icon:'🖼️' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background:'none', border:'none', color:activeTab === tab.id ? '#C9A84C' : 'rgba(232,224,208,0.5)',
            fontFamily:'Inter', fontSize:10, fontWeight:activeTab === tab.id ? 800 : 500,
            display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer', outline:'none'
          }}>
            <span style={{ fontSize:20 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── SLIDE-UP DRAWER SHEET: APPLICATION REVIEW ── */}
      {selectedApp && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:999,
          display:'flex', alignItems:'flex-end', justifyContent:'center'
        }} onClick={() => setSelectedApp(null)}>
          <div style={{
            width:'100%', maxWidth:540, background:'#0A1628', borderTop:'3px solid #C9A84C',
            borderRadius:'20px 20px 0 0', padding:28, animation:'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            maxHeight:'90vh', overflowY:'auto', boxSizing:'border-box', boxShadow:'0 -10px 40px rgba(0,0,0,0.5)'
          }} onClick={e=>e.stopPropagation()}>
            {/* Grab handle */}
            <div style={{ width:40, height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, margin:'0 auto 20px', cursor:'pointer' }} onClick={() => setSelectedApp(null)} />
            
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'1px solid rgba(201,168,76,0.15)', paddingBottom:14, marginBottom:20 }}>
              <div>
                <span style={{ fontFamily:'Inter', fontSize:10, color:'#C9A84C', letterSpacing:'0.1em', fontWeight:700 }}>
                  APPLIED ROLE: {selectedApp.roleName.toUpperCase()}
                </span>
                <h3 style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:900, color:'#fff', marginTop:4 }}>{selectedApp.fullName}</h3>
              </div>
              <button onClick={() => setSelectedApp(null)} style={{ background:'none', border:'none', color:'#C9A84C', fontSize:24, cursor:'pointer' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'Inter', fontSize:14 }}>
              {/* Detailed specs */}
              {[
                { l:'Age / Gender', v:`${selectedApp.age} years / ${selectedApp.gender}` },
                { l:'Mobile', v:selectedApp.mobile },
                { l:'WhatsApp', v:selectedApp.whatsapp },
                { l:'Email', v:selectedApp.email || '—' },
                { l:'Location', v:`Village: ${selectedApp.village}, Mandal: ${selectedApp.mandal}` },
                { l:'Residential Address', v:selectedApp.address }
              ].map(({l,v}) => (
                <div key={l} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:8 }}>
                  <span style={{ fontSize:10, color:'rgba(232,224,208,0.4)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</span>
                  <div style={{ color:'#E8E0D0', marginTop:3, fontWeight:500 }}>{v}</div>
                </div>
              ))}

              {/* Advisor Info */}
              {selectedApp.roleId === 'advisor' && (
                <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:12, padding:14 }}>
                  <span style={{ fontSize:10, color:'#C9A84C', fontWeight:700, textTransform:'uppercase' }}>Advisor Details</span>
                  <div style={{ fontSize:13, marginTop:6 }}><strong>Years of Experience:</strong> {selectedApp.yearsExp}</div>
                  <div style={{ fontSize:13, marginTop:6, lineHeight:1.5, color:'rgba(232,224,208,0.8)' }}>
                    <strong>Political Background:</strong><br />{selectedApp.politicalBg}
                  </div>
                </div>
              )}

              {/* 24/7 Availability checkbox */}
              {selectedApp.roleId === 'personal_manager' && (
                <div style={{ color:'#81C784', fontSize:13, fontWeight:600 }}>
                  ✓ Nominee confirmed 24/7 availability whenever called.
                </div>
              )}

              {/* Documents preview */}
              {selectedApp.aadharFront && (
                <div style={{ marginTop:10 }}>
                  <span style={{ fontSize:10, color:'rgba(232,224,208,0.4)', textTransform:'uppercase', letterSpacing:'0.04em' }}>ID Verification Docs</span>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8 }}>
                    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:12, textAlign:'center' }}>
                      <span style={{ fontSize:22, display:'block', marginBottom:4 }}>📄</span>
                      <span style={{ fontSize:11, color:'rgba(232,224,208,0.7)' }}>Aadhaar Front</span>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:12, textAlign:'center' }}>
                      <span style={{ fontSize:22, display:'block', marginBottom:4 }}>📄</span>
                      <span style={{ fontSize:11, color:'rgba(232,224,208,0.7)' }}>Aadhaar Back</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:14, marginTop:36 }}>
              {(selectedApp.status === 'appointed' || selectedApp.status === 'approved') ? (
                <>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'fired')} style={{
                    flex:1, padding:14, borderRadius:50, border:'1px solid rgba(198,40,40,0.5)',
                    background:'rgba(198,40,40,0.1)', color:'#E57373',
                    fontFamily:'Inter', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.2s'
                  }}>
                    Fire Member ❌
                  </button>
                  <button disabled style={{
                    flex:1, padding:14, borderRadius:50, border:'none',
                    background:'#2E7D32', color:'#fff',
                    fontFamily:'Inter', fontSize:14, fontWeight:800, transition:'all 0.2s'
                  }}>
                    Appointed ✓
                  </button>
                </>
              ) : selectedApp.status === 'fired' ? (
                <>
                  <button disabled style={{
                    flex:1, padding:14, borderRadius:50, border:'1px solid rgba(198,40,40,0.5)',
                    background:'#C62828', color:'#fff',
                    fontFamily:'Inter', fontSize:14, fontWeight:700
                  }}>
                    Fired ✓
                  </button>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'appointed')} style={{
                    flex:1, padding:14, borderRadius:50, border:'none',
                    background:'linear-gradient(135deg,#C9A84C,#E4C97A)', color:'#0A1628',
                    fontFamily:'Inter', fontSize:14, fontWeight:800, cursor:'pointer', transition:'all 0.2s',
                    boxShadow:'0 4px 14px rgba(0,0,0,0.2)'
                  }}>
                    Re-Appoint Member
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'rejected')} style={{
                    flex:1, padding:14, borderRadius:50, border:'1px solid rgba(198,40,40,0.5)',
                    background:selectedApp.status==='rejected'?'#C62828':'rgba(198,40,40,0.1)',
                    color:selectedApp.status==='rejected'?'#fff':'#E57373',
                    fontFamily:'Inter', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.2s'
                  }}>
                    {selectedApp.status === 'rejected' ? 'Rejected ✓' : 'Reject Nomination'}
                  </button>
                  <button onClick={() => handleStatusChange(selectedApp.id, 'appointed')} style={{
                    flex:1, padding:14, borderRadius:50, border:'none',
                    background:'linear-gradient(135deg,#C9A84C,#E4C97A)', color:'#0A1628',
                    fontFamily:'Inter', fontSize:14, fontWeight:800, cursor:'pointer', transition:'all 0.2s',
                    boxShadow:'0 4px 14px rgba(0,0,0,0.2)'
                  }}>
                    Appoint Member
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE-UP DRAWER SHEET: PHOTO SLOT EDITOR ── */}
      {selectedSlot && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:999,
          display:'flex', alignItems:'flex-end', justifyContent:'center'
        }} onClick={() => setSelectedSlot(null)}>
          <form onSubmit={handleSavePhotoSlot} style={{
            width:'100%', maxWidth:540, background:'#0A1628', borderTop:'3px solid #C9A84C',
            borderRadius:'20px 20px 0 0', padding:28, animation:'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            maxHeight:'90vh', overflowY:'auto', boxSizing:'border-box', boxShadow:'0 -10px 40px rgba(0,0,0,0.5)'
          }} onClick={e=>e.stopPropagation()}>
            {/* Grab handle */}
            <div style={{ width:40, height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, margin:'0 auto 20px', cursor:'pointer' }} onClick={() => setSelectedSlot(null)} />
            
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'1px solid rgba(201,168,76,0.15)', paddingBottom:14, marginBottom:20 }}>
              <div>
                <span style={{ fontFamily:'Inter', fontSize:10, color:'#C9A84C', letterSpacing:'0.1em', fontWeight:700 }}>
                  SLOT EDITOR
                </span>
                <h3 style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:900, color:'#fff', marginTop:4 }}>Edit Photo Slot {selectedSlot.id}</h3>
              </div>
              <button type="button" onClick={() => setSelectedSlot(null)} style={{ background:'none', border:'none', color:'#C9A84C', fontSize:24, cursor:'pointer' }}>×</button>
            </div>

            {/* Inputs */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              
              {/* File Upload input */}
              <div>
                <label style={lblS}>Upload New Photo</label>
                <div style={{ background:'rgba(255,255,255,0.02)', border:'1.5px dashed rgba(201,168,76,0.3)', borderRadius:10, padding:20, textAlign:'center', cursor:'pointer', position:'relative' }}>
                  <input type="file" accept="image/*" onChange={e=>setUploadFile(e.target.files[0])} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} />
                  <span style={{ fontSize:26, display:'block', marginBottom:4 }}>📤</span>
                  <span style={{ fontFamily:'Inter', fontSize:13, color:'#C9A84C', fontWeight:600 }}>
                    {uploadFile ? uploadFile.name : 'Select image file (JPG, PNG)'}
                  </span>
                  <span style={{ display:'block', fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4 }}>Will replace current slot photo if uploaded</span>
                </div>
              </div>

              {/* Tag inputs */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={lblS}>English Tag (Short)</label>
                  <input type="text" placeholder="e.g. Rally" value={editForm.tagEn} onChange={e=>setEditForm(p=>({...p,tagEn:e.target.value}))} style={{
                    width:'100%', padding:'12px', borderRadius:8, border:'1px solid rgba(201,168,76,0.2)', background:'rgba(255,255,255,0.03)', color:'#fff', outline:'none'
                  }} />
                </div>
                <div>
                  <label style={lblS}>Telugu Tag (Short)</label>
                  <input type="text" placeholder="e.g. ర్యాలీ" value={editForm.tagTe} onChange={e=>setEditForm(p=>({...p,tagTe:e.target.value}))} style={{
                    width:'100%', padding:'12px', borderRadius:8, border:'1px solid rgba(201,168,76,0.2)', background:'rgba(255,255,255,0.03)', color:'#fff', outline:'none'
                  }} />
                </div>
              </div>

              {/* Caption English */}
              <div>
                <label style={lblS}>English Caption</label>
                <input type="text" placeholder="Describe this photo..." value={editForm.captionEn} onChange={e=>setEditForm(p=>({...p,captionEn:e.target.value}))} style={{
                  width:'100%', padding:'12px', borderRadius:8, border:'1px solid rgba(201,168,76,0.2)', background:'rgba(255,255,255,0.03)', color:'#fff', outline:'none'
                }} required />
              </div>

              {/* Caption Telugu */}
              <div>
                <label style={lblS}>Telugu Caption</label>
                <input type="text" placeholder="ఫోటో వివరణ..." value={editForm.captionTe} onChange={e=>setEditForm(p=>({...p,captionTe:e.target.value}))} style={{
                  width:'100%', padding:'12px', borderRadius:8, border:'1px solid rgba(201,168,76,0.2)', background:'rgba(255,255,255,0.03)', color:'#fff', outline:'none'
                }} required />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:14, marginTop:32 }}>
              <button type="button" onClick={() => setSelectedSlot(null)} style={{
                flex:1, padding:14, borderRadius:50, border:'1px solid rgba(255,255,255,0.15)',
                background:'transparent', color:'#E8E0D0', fontFamily:'Inter', fontSize:14, fontWeight:600, cursor:'pointer'
              }}>
                Cancel
              </button>
              <button type="submit" disabled={savingSlot} style={{
                flex:1, padding:14, borderRadius:50, border:'none',
                background:'linear-gradient(135deg,#C9A84C,#E4C97A)', color:'#0A1628',
                fontFamily:'Inter', fontSize:14, fontWeight:800, cursor:'pointer',
                boxShadow:'0 4px 14px rgba(0,0,0,0.2)'
              }}>
                {savingSlot ? 'Saving Changes...' : 'Save Slot Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

const lblS = { fontFamily:'Inter', fontSize:12, fontWeight:600, color:'rgba(232,224,208,0.7)', marginBottom:6, display:'block' };
