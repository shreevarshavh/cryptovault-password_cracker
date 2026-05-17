import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import './App.css';

const API = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// ─── Utility ────────────────────────────────────────────────────────────────
const formatNum = (n) => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toString();
};

const strengthConfig = {
  'Very Weak': { color: '#ff2d55', width: '15%', label: 'CRITICAL' },
  Weak:        { color: '#ff6b35', width: '30%', label: 'WEAK' },
  Moderate:    { color: '#ffd60a', width: '55%', label: 'MODERATE' },
  Strong:      { color: '#30d158', width: '75%', label: 'STRONG' },
  'Very Strong': { color: '#0a84ff', width: '100%', label: 'FORTRESS' },
};

// ─── Matrix Rain (Canvas) ────────────────────────────────────────────────────
function MatrixRain({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    const fontSize = 13;
    let cols = Math.floor(canvas.width / fontSize);
    let drops = Array(cols).fill(1);
    
    const draw = () => {
      ctx.fillStyle = active ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.font = `${fontSize}px 'Courier New', monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const brightness = Math.random();
        if (active) {
          ctx.fillStyle = brightness > 0.95
            ? `rgba(255,45,85,${0.8 + brightness * 0.2})`
            : `rgba(0,255,100,${0.1 + brightness * 0.5})`;
        } else {
          ctx.fillStyle = `rgba(0,200,80,${0.05 + brightness * 0.15})`;
        }
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    
    const speed = active ? 40 : 80;
    animRef.current = setInterval(draw, speed);
    return () => {
      clearInterval(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);
  
  return <canvas ref={canvasRef} className="matrix-canvas" />;
}

// ─── Glitch Text ─────────────────────────────────────────────────────────────
function GlitchText({ text, className = '' }) {
  return (
    <span className={`glitch-text ${className}`} data-text={text}>
      {text}
    </span>
  );
}

// ─── Terminal Log ─────────────────────────────────────────────────────────────
function TerminalLog({ logs }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  
  return (
    <div className="terminal-log">
      <div className="terminal-header">
        <div className="terminal-dots">
          <span style={{ background: '#ff5f57' }} />
          <span style={{ background: '#febc2e' }} />
          <span style={{ background: '#28c840' }} />
        </div>
        <span className="terminal-title">SYSTEM OUTPUT</span>
      </div>
      <div className="terminal-body">
        {logs.map((log, i) => (
          <div key={i} className={`log-line log-${log.type}`}>
            <span className="log-time">[{log.time}]</span>
            <span className="log-prefix">{log.prefix}</span>
            <span className="log-msg">{log.msg}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="log-line log-info">
            <span className="log-msg blink-cursor">Awaiting target password...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState({
    lowercase: true, uppercase: false, digits: false, symbols: false
  });
  const [mode, setMode] = useState('recursive');
  const [cracking, setCracking] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [complexityData, setComplexityData] = useState([]);
  const [tab, setTab] = useState('crack');
  const [analyzeInput, setAnalyzeInput] = useState('');
  const [charsetInfo, setCharsetInfo] = useState(null);

  const socketRef = useRef(null);
  const attemptsRef = useRef(0);
  const chartBufferRef = useRef([]);
  const chartTimerRef = useRef(null);

  // Init socket
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    
    socket.on('connect', () => addLog('info', '[SYS]', 'Socket connected to backend'));
    socket.on('disconnect', () => addLog('warn', '[SYS]', 'Socket disconnected'));
    
    socket.on('progress', (data) => {
      setCurrentAttempt(data.current_attempt || '');
      setAttempts(data.attempts);
      attemptsRef.current = data.attempts;
      setElapsed(data.elapsed);
      
      chartBufferRef.current.push({ attempts: data.attempts, time: data.elapsed });
      
      if (data.found) {
        setResult({ found: true, password: data.password });
        addLog('success', '[FOUND]', `PASSWORD CRACKED → "${data.password}"`);
      }
    });
    
    socket.on('complete', (data) => {
      setCracking(false);
      setResult(data);
      if (data.found) {
        addLog('success', '[COMPLETE]', `Cracked in ${data.attempts} attempts (${data.elapsed}s)`);
      } else {
        addLog('warn', '[STOPPED]', `Session ended. Attempts: ${data.attempts}`);
      }
      // Flush chart buffer
      flushChartBuffer();
    });
    
    return () => socket.disconnect();
  }, []);

  // Flush chart data every 500ms during cracking
  useEffect(() => {
    if (cracking) {
      chartTimerRef.current = setInterval(flushChartBuffer, 500);
    } else {
      clearInterval(chartTimerRef.current);
    }
    return () => clearInterval(chartTimerRef.current);
  }, [cracking]);

  const flushChartBuffer = () => {
    if (chartBufferRef.current.length > 0) {
      const last = chartBufferRef.current[chartBufferRef.current.length - 1];
      setChartData(prev => {
        const next = [...prev, { t: prev.length, attempts: last.attempts, time: last.time }];
        return next.slice(-50); // keep last 50 points
      });
      chartBufferRef.current = [];
    }
  };

  const addLog = useCallback((type, prefix, msg) => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs(prev => [...prev.slice(-100), { type, prefix, msg, time }]);
  }, []);

  const startCrack = async () => {
    if (!password) { addLog('error', '[ERR]', 'No target password provided'); return; }
    if (password.length > 6) { addLog('error', '[ERR]', 'Max 6 chars for demo (prevents infinite runtime)'); return; }
    
    setLogs([]);
    setResult(null);
    setChartData([]);
    setAttempts(0);
    setElapsed(0);
    setCurrentAttempt('');
    chartBufferRef.current = [];
    
    const sid = `session_${Date.now()}`;
    setSessionId(sid);
    
    addLog('info', '[INIT]', `Target set. Mode: ${mode.toUpperCase()}`);
    addLog('info', '[INIT]', `Charset: ${buildCharsetLabel()}`);
    addLog('info', '[PROC]', 'Initiating backtracking algorithm...');
    
    try {
      const res = await axios.post(`${API}/crack/start`, {
        password,
        options,
        session_id: sid,
        mode
      });
      setCharsetInfo(res.data);
      setStats(res.data);
      setCracking(true);
      addLog('info', '[SYS]', `Charset size: ${res.data.charset_size} | Max combinations: ${formatNum(res.data.max_combinations)}`);
    } catch (err) {
      addLog('error', '[ERR]', err.response?.data?.error || 'Failed to start cracking');
    }
  };

  const stopCrack = async () => {
    if (!sessionId) return;
    addLog('warn', '[STOP]', 'Halt signal sent by user');
    try {
      await axios.post(`${API}/crack/stop`, { session_id: sessionId });
    } catch {}
    setCracking(false);
  };

  const analyzePassword = async () => {
    if (!analyzeInput) return;
    try {
      const res = await axios.post(`${API}/analyze`, { password: analyzeInput });
      setAnalysis(res.data);
      
      // Fetch complexity chart data
      const cRes = await axios.post(`${API}/complexity`, {
        charset_size: res.data.charset_size,
        length: Math.min(res.data.length, 8)
      });
      setComplexityData(cRes.data.combinations_by_length.map(d => ({
        length: `${d.length}c`,
        combinations: Math.log10(d.combinations + 1)
      })));
    } catch (err) {
      console.error(err);
    }
  };

  const buildCharsetLabel = () => {
    const parts = [];
    if (options.lowercase) parts.push('a-z');
    if (options.uppercase) parts.push('A-Z');
    if (options.digits) parts.push('0-9');
    if (options.symbols) parts.push('!@#...');
    return parts.join(' + ') || 'none';
  };

  const progress = stats && stats.max_combinations > 0
    ? Math.min((attempts / stats.max_combinations) * 100, 100)
    : 0;

  return (
    <div className="app">
      <MatrixRain active={cracking} />
      
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-icon">🔐</div>
          <div>
            <GlitchText text="CRYPTOVAULT" className="logo-title" />
            <div className="logo-sub">Password Cracking Simulation System</div>
          </div>
        </div>
        <nav className="header-nav">
          {['crack', 'analyze', 'about'].map(t => (
            <button
              key={t}
              className={`nav-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="header-status">
          <div className={`status-dot ${cracking ? 'active' : ''}`} />
          <span>{cracking ? 'CRACKING...' : 'STANDBY'}</span>
        </div>
      </header>

      <main className="app-main">
        {/* ══════════ CRACK TAB ══════════ */}
        {tab === 'crack' && (
          <div className="crack-layout">
            {/* Left panel */}
            <div className="panel panel-left">
              <div className="panel-title">
                <span className="panel-icon">⚡</span>
                TARGET CONFIGURATION
              </div>

              <div className="form-group">
                <label className="form-label">TARGET PASSWORD</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="cyber-input"
                    placeholder="Enter password to simulate..."
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={cracking}
                    maxLength={6}
                  />
                  <div className="input-counter">{password.length}/6</div>
                </div>
                <div className="input-hint">Max 6 characters for real-time simulation</div>
              </div>

              <div className="form-group">
                <label className="form-label">CHARACTER SET</label>
                <div className="charset-grid">
                  {[
                    { key: 'lowercase', label: 'a–z', desc: 'Lowercase (26)' },
                    { key: 'uppercase', label: 'A–Z', desc: 'Uppercase (26)' },
                    { key: 'digits', label: '0–9', desc: 'Digits (10)' },
                    { key: 'symbols', label: '!@#', desc: 'Symbols (32)' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className={`charset-card ${options[key] ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))}
                        disabled={cracking}
                      />
                      <div className="charset-label">{label}</div>
                      <div className="charset-desc">{desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">ALGORITHM MODE</label>
                <div className="mode-toggle">
                  {[
                    { val: 'recursive', label: 'RECURSIVE', icon: '🔁' },
                    { val: 'iterative', label: 'ITERATIVE', icon: '📚' },
                  ].map(m => (
                    <button
                      key={m.val}
                      className={`mode-btn ${mode === m.val ? 'active' : ''}`}
                      onClick={() => setMode(m.val)}
                      disabled={cracking}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
                <div className="input-hint">
                  {mode === 'recursive'
                    ? 'Recursive DFS — builds string depth-first and backtracks'
                    : 'Iterative Stack — explicit stack simulates backtracking'}
                </div>
              </div>

              <div className="action-row">
                {!cracking ? (
                  <button className="crack-btn" onClick={startCrack}>
                    <span className="btn-icon">⚡</span>
                    INITIATE CRACK
                  </button>
                ) : (
                  <button className="stop-btn" onClick={stopCrack}>
                    <span className="btn-icon">■</span>
                    ABORT MISSION
                  </button>
                )}
              </div>

              {/* Live stats */}
              {(cracking || result) && (
                <div className="live-stats">
                  <StatCard label="ATTEMPTS" value={formatNum(attempts)} accent="#0a84ff" />
                  <StatCard label="ELAPSED" value={`${elapsed.toFixed(2)}s`} accent="#ff6b35" />
                  <StatCard label="PROGRESS" value={`${progress.toFixed(2)}%`} accent="#30d158" />
                </div>
              )}

              {/* Progress bar */}
              {cracking && (
                <div className="progress-section">
                  <div className="progress-header">
                    <span>BACKTRACKING DEPTH</span>
                    <span>{progress.toFixed(3)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                    <div className="progress-glow" style={{ left: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Current attempt */}
              {cracking && (
                <div className="current-attempt">
                  <div className="attempt-label">CURRENT CANDIDATE</div>
                  <div className="attempt-value">
                    {currentAttempt || '...'}
                    <span className="cursor-blink">_</span>
                  </div>
                </div>
              )}

              {/* Result banner */}
              {result && (
                <div className={`result-banner ${result.found ? 'success' : 'fail'}`}>
                  {result.found ? (
                    <>
                      <div className="result-icon">🎯</div>
                      <div>
                        <div className="result-title">PASSWORD CRACKED</div>
                        <div className="result-password">"{result.password}"</div>
                        <div className="result-sub">{attempts.toLocaleString()} attempts in {elapsed.toFixed(3)}s</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="result-icon">⛔</div>
                      <div>
                        <div className="result-title">SESSION TERMINATED</div>
                        <div className="result-sub">Cracking halted by user</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="panel panel-right">
              <div className="panel-title">
                <span className="panel-icon">📊</span>
                LIVE ANALYTICS
              </div>

              <div className="chart-section">
                <div className="chart-label">Attempts Over Time</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0a84ff" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#0a84ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="t" stroke="#555" tick={{ fontSize: 10, fill: '#666' }} />
                    <YAxis stroke="#555" tick={{ fontSize: 10, fill: '#666' }}
                      tickFormatter={v => formatNum(v)} />
                    <Tooltip
                      contentStyle={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4 }}
                      labelStyle={{ color: '#888' }}
                      itemStyle={{ color: '#0a84ff' }}
                      formatter={v => [formatNum(v), 'Attempts']}
                    />
                    <Area type="monotone" dataKey="attempts" stroke="#0a84ff"
                      strokeWidth={2} fill="url(#aGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Terminal */}
              <TerminalLog logs={logs} />

              {/* Complexity info */}
              {stats && (
                <div className="complexity-card">
                  <div className="complexity-title">SEARCH SPACE</div>
                  <div className="complexity-grid">
                    <div className="c-item">
                      <div className="c-label">Charset Size</div>
                      <div className="c-val">{stats.charset_size}</div>
                    </div>
                    <div className="c-item">
                      <div className="c-label">Max Combinations</div>
                      <div className="c-val">{formatNum(stats.max_combinations)}</div>
                    </div>
                    <div className="c-item">
                      <div className="c-label">Algorithm</div>
                      <div className="c-val">{mode === 'recursive' ? 'Recursive DFS' : 'Stack BT'}</div>
                    </div>
                    <div className="c-item">
                      <div className="c-label">Time Complexity</div>
                      <div className="c-val">O(n^m)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ANALYZE TAB ══════════ */}
        {tab === 'analyze' && (
          <div className="analyze-layout">
            <div className="panel" style={{ maxWidth: 700, margin: '0 auto' }}>
              <div className="panel-title"><span className="panel-icon">🔍</span>PASSWORD ANALYZER</div>

              <div className="form-group">
                <label className="form-label">PASSWORD TO ANALYZE</label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="Enter any password to analyze..."
                    value={analyzeInput}
                    onChange={e => setAnalyzeInput(e.target.value)}
                  />
                </div>
              </div>

              <button className="crack-btn" onClick={analyzePassword} style={{ marginBottom: 32 }}>
                <span className="btn-icon">🔍</span>
                ANALYZE STRENGTH
              </button>

              {analysis && (
                <div className="analysis-result">
                  <div className="strength-display">
                    <div className="strength-label-row">
                      <span>STRENGTH</span>
                      <span style={{ color: strengthConfig[analysis.strength]?.color }}>
                        {strengthConfig[analysis.strength]?.label || analysis.strength}
                      </span>
                    </div>
                    <div className="strength-bar-track">
                      <div
                        className="strength-bar-fill"
                        style={{
                          width: strengthConfig[analysis.strength]?.width || '0%',
                          background: strengthConfig[analysis.strength]?.color || '#666',
                          boxShadow: `0 0 12px ${strengthConfig[analysis.strength]?.color}`
                        }}
                      />
                    </div>
                  </div>

                  <div className="analysis-grid">
                    <StatCard label="LENGTH" value={analysis.length} accent="#0a84ff" />
                    <StatCard label="CHARSET SIZE" value={analysis.charset_size} accent="#ff6b35" />
                    <StatCard label="COMBINATIONS" value={formatNum(analysis.total_combinations)} accent="#bf5af2" />
                    <StatCard label="CRACK TIME*" value={analysis.estimated_crack_time} sub="*at 1B/sec" accent="#ff2d55" />
                  </div>

                  <div className="feature-grid">
                    {[
                      { label: 'Lowercase (a–z)', val: analysis.has_lowercase },
                      { label: 'Uppercase (A–Z)', val: analysis.has_uppercase },
                      { label: 'Digits (0–9)', val: analysis.has_digits },
                      { label: 'Symbols (!@#)', val: analysis.has_symbols },
                    ].map(f => (
                      <div key={f.label} className={`feature-badge ${f.val ? 'yes' : 'no'}`}>
                        <span>{f.val ? '✓' : '✗'}</span>
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>

                  {complexityData.length > 0 && (
                    <div className="chart-section">
                      <div className="chart-label">Search Space Growth (log₁₀ scale) by Password Length</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={complexityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="length" stroke="#555" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis stroke="#555" tick={{ fill: '#888', fontSize: 11 }}
                            label={{ value: 'log₁₀(combinations)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ background: '#0d0d0d', border: '1px solid #333' }}
                            itemStyle={{ color: '#bf5af2' }}
                            formatter={v => [`10^${v.toFixed(1)}`, 'Combinations']}
                          />
                          <Bar dataKey="combinations" radius={[4, 4, 0, 0]}>
                            {complexityData.map((_, i) => (
                              <Cell key={i}
                                fill={i < complexityData.length - 1 ? '#bf5af2' : '#ff2d55'}
                                opacity={0.7 + (i / complexityData.length) * 0.3}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ABOUT TAB ══════════ */}
        {tab === 'about' && (
          <div className="about-layout">
            <div className="about-hero">
              <GlitchText text="BACKTRACKING" className="about-hero-title" />
              <div className="about-hero-sub">The Algorithm Behind the Simulation</div>
            </div>

            <div className="about-grid">
              <div className="about-card">
                <div className="about-card-icon">🌲</div>
                <div className="about-card-title">HOW BACKTRACKING WORKS</div>
                <div className="about-card-body">
                  Backtracking is a depth-first search algorithm that builds candidate
                  solutions incrementally. For password cracking, it appends one character
                  at a time to a partial string and checks if it can lead to the target.
                  When a partial string exceeds the target length without matching,
                  the algorithm <em>backtracks</em> to the previous state and tries the next character.
                </div>
              </div>

              <div className="about-card">
                <div className="about-card-icon">📐</div>
                <div className="about-card-title">TIME COMPLEXITY</div>
                <div className="about-card-body">
                  The worst-case complexity is <strong>O(|charset|^length)</strong>.
                  For a 4-character password with 26 lowercase letters: 26⁴ = 456,976 combinations.
                  Adding uppercase, digits, and symbols (94 chars): 94⁴ = 78,074,896.
                  This exponential growth is why long, complex passwords are critical.
                </div>
              </div>

              <div className="about-card">
                <div className="about-card-icon">🔐</div>
                <div className="about-card-title">SECURITY IMPLICATIONS</div>
                <div className="about-card-body">
                  Modern GPUs can attempt billions of hashes per second. An 8-character
                  lowercase password can be cracked in minutes. Adding uppercase, digits,
                  and symbols increases crack time to years. Password length matters most—
                  each additional character multiplies the search space by the charset size.
                </div>
              </div>

              <div className="about-card">
                <div className="about-card-icon">🛡️</div>
                <div className="about-card-title">DEFENSE STRATEGIES</div>
                <div className="about-card-body">
                  Use passwords of 16+ characters with all character types. Use a password
                  manager to generate and store unique passwords. Enable 2FA. Systems should
                  implement rate limiting, account lockouts, and use slow hashing algorithms
                  like bcrypt, Argon2, or scrypt to resist brute-force attacks.
                </div>
              </div>
            </div>

            <div className="pseudocode-block">
              <div className="panel-title"><span className="panel-icon">💻</span>ALGORITHM PSEUDOCODE</div>
              <pre className="pseudocode">{`function BACKTRACK(current, target, charset):
  // Base case: match found
  if current == target:
    return current
  
  // Pruning: exceeded max length → backtrack
  if len(current) >= len(target):
    return NULL
  
  // Explore each character in charset
  for each char in charset:
    candidate = current + char
    
    result = BACKTRACK(candidate, target, charset)
    
    if result != NULL:
      return result   // propagate solution up
    
    // Otherwise: backtrack (implicit via recursion)
  
  return NULL  // no solution in this branch

// Entry point
BACKTRACK("", targetPassword, charset)`}</pre>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>🎓 Educational Simulation Only — CryptoVault v1.0</span>
        <span>Built with React + Flask + Socket.IO | Backtracking Algorithm</span>
        <span>Not for malicious use</span>
      </footer>
    </div>
  );
}
