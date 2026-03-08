import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Radio,
  Activity,
  MessageSquare,
  History,
  ShieldCheck,
  Globe,
  Lock,
  Unlock,
  Key,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [roomName, setRoomName] = useState('testroom');
  const {
    status,
    isConnected,
    isMuted,
    inCall,
    logs,
    connectSignaling,
    startCall,
    endCall,
    toggleMute,
    localStream,
    participants,
    liveAiInsight
  } = useWebRTC(roomName);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!inCall || !localStream || !canvasRef.current) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(localStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');

    let animationId;
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = '#0a0a0c';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      let average = sum / bufferLength;

      const gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#10b981');
      gradient.addColorStop(1, '#34d399');

      canvasCtx.fillStyle = average > 20 ? gradient : '#444';
      canvasCtx.fillRect(0, 0, (average / 128) * canvas.width, canvas.height);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      audioCtx.close();
    };
  }, [inCall, localStream]);

  const [activeTab, setActiveTab] = useState('phone');
  const [developerInfo, setDeveloperInfo] = useState({ api_key: 'Loading...', project_name: '', error: null });
  const [showKey, setShowKey] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);

  const [history, setHistory] = useState([]);
  const [expandedCall, setExpandedCall] = useState(null);

  const fetchHistory = useCallback(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/calls/history/`)
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/project/apikey/`)
      .then(res => {
        if (!res.ok) throw new Error('Backend unreachable');
        return res.json();
      })
      .then(data => setDeveloperInfo({ ...data, error: null }))
      .catch(err => {
        console.error(err);
        setDeveloperInfo(prev => ({ ...prev, error: 'Connection to backend failed. Please ensure the server is running.', api_key: 'Unavailable' }));
      });

    fetchHistory();
    // Poll for history updates every 10 seconds (useful after call ends)
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passphrase === 'admin123') {
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setPassphrase('');
    } else {
      alert('Invalid Admin Passphrase');
    }
  };

  return (
    <div className="dashboard-container" onClick={() => showSidebar && setShowSidebar(false)}>
      {/* Mobile Nav Header */}
      <div className="mobile-nav">
        <h2 style={{ fontSize: '20px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Globe size={20} /> Vocalis
        </h2>
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          {showSidebar ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Stats & Status */}
      <aside className={`glass-card sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="desktop-logo">
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={24} /> Vocalis
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>VoIP-as-a-Service MVP</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="btn-tab"
            onClick={() => setActiveTab('phone')}
            style={{
              background: activeTab === 'phone' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
              color: activeTab === 'phone' ? 'var(--accent-gold)' : 'white',
              border: 'none', padding: '12px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}
          >
            <Phone size={18} /> Phone Dashboard
          </button>
          <button
            className="btn-tab"
            onClick={() => setActiveTab('history')}
            style={{
              background: activeTab === 'history' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
              color: activeTab === 'history' ? 'var(--accent-gold)' : 'white',
              border: 'none', padding: '12px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}
          >
            <History size={18} /> Call History
          </button>

          {isLoggedIn && (
            <button
              className="btn-tab"
              onClick={() => setActiveTab('developer')}
              style={{
                background: activeTab === 'developer' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                color: activeTab === 'developer' ? 'var(--accent-gold)' : 'white',
                border: 'none', padding: '12px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}
            >
              <ShieldCheck size={18} /> Settings & API
            </button>
          )}
        </nav>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

        {/* Admin Access Toggle */}
        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={() => isLoggedIn ? setIsLoggedIn(false) : setShowLoginModal(true)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: isLoggedIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: isLoggedIn ? 'var(--success)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {isLoggedIn ? <Unlock size={16} /> : <Lock size={16} />}
            {isLoggedIn ? 'Admin Mode Active' : 'Admin Login'}
          </button>
        </div>

        {/* Participants Section */}
        <div style={{ flexShrink: 0 }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} /> Active Participants ({participants.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {participants.map((p, i) => (
              <div key={i} style={{
                fontSize: '11px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--success)',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                {p}
              </div>
            ))}
            {participants.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No one joined yet</span>}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

        <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={14} /> System Logs
          </h3>
          <div style={{ flexGrow: 1, overflowY: 'auto', fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', borderLeft: '2px solid var(--accent-gold)', paddingLeft: '8px' }}>{log}</div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'phone' && (
          <>
            {/* Top Header/Controls */}
            <header className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="input-group" style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '500px' }}>
                <input
                  className="input-premium"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter Room ID"
                  disabled={isConnected}
                />
                <button
                  className="btn-primary"
                  onClick={connectSignaling}
                  disabled={isConnected}
                >
                  {isConnected ? 'Connected' : 'Join Room'}
                </button>
              </div>

              {isConnected && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <ShieldCheck size={16} color="var(--success)" />
                  <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600' }}>AES-256 E2EE ACTIVE</span>
                </div>
              )}
            </header>

            {/* Center Canvas / Dialer */}
            <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <AnimatePresence mode="wait">
                {!inCall ? (
                  <motion.div
                    key="dialer"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="glass-card dialer-card"
                    style={{ padding: '48px', textAlign: 'center' }}
                  >
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-gold-glow)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px' }}>
                      <Radio size={40} color="var(--accent-gold)" />
                    </div>
                    <h2 style={{ marginBottom: '8px' }}>Ready to Start?</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Start a P2P encrypted session in {roomName}</p>
                    <button
                      className="btn-primary pulse"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', height: '54px', fontSize: '18px' }}
                      onClick={startCall}
                      disabled={!isConnected}
                    >
                      <Phone size={20} /> Initiate Call
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="active"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="glass-card call-card"
                    style={{ padding: '48px', textAlign: 'center', border: '1px solid var(--success)' }}
                  >
                    <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 32px' }}>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid var(--success)', opacity: 0.3 }}
                      />
                      <div style={{ position: 'absolute', inset: '10px', borderRadius: '50%', background: '#10b98122', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Activity size={48} color="var(--success)" />
                      </div>
                    </div>

                    <h2 style={{ marginBottom: '8px' }}>Call in Progress</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Room: {roomName}</p>

                    <div style={{ marginBottom: '32px' }}>
                      <canvas ref={canvasRef} width="200" height="8" style={{ background: '#111', borderRadius: '4px' }} />
                      <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>Audio Activity</p>
                    </div>

                    {/* Live AI Insight HUD */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass-card"
                      style={{
                        padding: '12px 20px',
                        marginBottom: '32px',
                        background: 'rgba(212, 175, 55, 0.05)',
                        border: '1px solid rgba(212, 175, 55, 0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gold)', boxShadow: '0 0 10px var(--accent-gold)' }} />
                      <p style={{ fontSize: '13px', color: 'var(--accent-gold)', fontWeight: '500', margin: 0, textAlign: 'left' }}>
                        {liveAiInsight}
                      </p>
                    </motion.div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                      <button
                        onClick={toggleMute}
                        style={{
                          width: '64px', height: '64px', borderRadius: '50%', border: '1px solid var(--border)',
                          background: isMuted ? 'var(--danger)' : 'transparent', color: 'white',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s'
                        }}
                      >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                      </button>
                      <button
                        onClick={() => endCall(true)}
                        style={{
                          width: '64px', height: '64px', borderRadius: '50%', border: 'none',
                          background: 'var(--danger)', color: 'white',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
                          boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                        }}
                      >
                        <PhoneOff size={24} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {activeTab === 'developer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}
          >
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ color: 'var(--accent-gold)', marginBottom: '4px' }}>Project Settings</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your API keys and project configuration</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Project Name</span>
                  <p style={{ fontWeight: '600' }}>{developerInfo.project_name || 'VoIP Default'}</p>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Primary API Key</p>
                  {developerInfo.error && <span style={{ color: 'var(--danger)', fontSize: '11px' }}>{developerInfo.error}</span>}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    flexGrow: 1,
                    background: '#0a0a0c',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <code style={{
                      color: developerInfo.error ? 'var(--text-secondary)' : 'var(--success)',
                      fontSize: '15px',
                      letterSpacing: showKey ? '1px' : '4px',
                      fontFamily: 'monospace'
                    }}>
                      {showKey ? developerInfo.api_key : '••••••••••••••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ height: '52px', padding: '0 24px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(developerInfo.api_key);
                      alert('API Key copied to clipboard');
                    }}
                    disabled={!!developerInfo.error}
                  >
                    Copy Key
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-grid">
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={18} color="var(--accent-gold)" /> Signaling Endpoint
                </h3>
                <code style={{ display: 'block', background: '#000', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#888' }}>
                  {import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/signaling/
                </code>
              </div>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--success)" /> Infrastructure
                </h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>Region</p>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>Mumbai-1</p>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>Status</p>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, color: 'var(--success)' }}>Operational</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
              <h3 style={{ marginBottom: '16px' }}>SDK Implementation</h3>
              <div style={{ position: 'relative' }}>
                <pre style={{ background: '#0a0a0c', padding: '24px', borderRadius: '12px', fontSize: '14px', overflowX: 'auto', border: '1px solid var(--border)', color: '#ccc', lineHeight: '1.6' }}>
                  <span style={{ color: '#666' }}>// 1. Initialize Vocalis Client</span>{'\n'}
                  <span style={{ color: 'var(--accent-gold)' }}>const</span> voip = <span style={{ color: 'var(--accent-gold)' }}>new</span> <span style={{ color: 'var(--success)' }}>VoIPClient</span>({'{'}{'\n'}
                  {'  '}apiKey: <span style={{ color: '#10b981' }}>"{showKey ? developerInfo.api_key : 'PROD_API_KEY'}"</span>,{'\n'}
                  {'  '}onRemoteStream: (stream) ={'>'} {'{'} ... {'}'}{'\n'}
                  {'}'});{'\n'}{'\n'}
                  <span style={{ color: '#666' }}>// 2. Establish Connection</span>{'\n'}
                  <span style={{ color: 'var(--accent-gold)' }}>await</span> voip.<span style={{ color: 'var(--success)' }}>connect</span>(<span style={{ color: '#10b981' }}>"secure-room-101"</span>);{'\n'}
                  voip.<span style={{ color: 'var(--success)' }}>startCall</span>();
                </pre>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '32px', flexGrow: 1, overflowY: 'auto' }}
          >
            <h2 style={{ marginBottom: '24px', color: 'var(--accent-gold)' }}>Call History & AI Insights</h2>

            <div className="history-grid">
              {history.map((call) => (
                <div key={call.id} className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: '600' }}>Room: {call.room}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(call.start_time).toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: call.status === 'Completed' ? '#10b98122' : '#f59e0b22', color: call.status === 'Completed' ? 'var(--success)' : '#f59e0b' }}>
                        {call.status}
                      </span>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                      >
                        {expandedCall === call.id ? 'Close' : 'View AI Insights'}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedCall === call.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
                      >
                        <p style={{ color: 'var(--accent-gold)', fontSize: '14px', marginBottom: '8px', fontWeight: '600' }}>AI Summary:</p>
                        <p style={{ fontSize: '14px', marginBottom: '16px', fontStyle: 'italic' }}>"{call.summary}"</p>

                        <p style={{ color: 'var(--accent-gold)', fontSize: '14px', marginBottom: '8px', fontWeight: '600' }}>Full Transcript:</p>
                        <p style={{ fontSize: '13px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', lineHeight: '1.6', color: '#ccc' }}>
                          {call.transcript}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {history.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                  No call logs found yet. Start your first encrypted call!
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Global Footer Stats */}
        <footer className="glass-card footer-responsive" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-gold)' }}>
            <Activity size={18} />
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Global AI Workers: 2 Active</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexGrow: 1 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Latency: 42ms</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Region: Mumbai, India</span>
          </div>
          <div style={{ fontSize: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
            {history.length} Calls Logged
          </div>
        </footer>
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card"
              style={{ width: '360px', padding: '40px', textAlign: 'center' }}
            >
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-gold-glow)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px' }}>
                <Key size={30} color="var(--accent-gold)" />
              </div>
              <h2 style={{ marginBottom: '8px' }}>Admin Access</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Enter passphrase to view API keys</p>

              <form onSubmit={handleLogin}>
                <input
                  type="password"
                  className="input-premium"
                  placeholder="Passphrase"
                  autoFocus
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  style={{ marginBottom: '24px', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-tab" style={{ flex: 1 }} onClick={() => setShowLoginModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>Login</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
