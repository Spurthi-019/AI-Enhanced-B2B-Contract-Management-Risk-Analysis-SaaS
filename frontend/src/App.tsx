import { useState, useEffect } from 'react';
import './App.css';

interface Comment {
  id: string;
  authorEmail: string;
  content: string;
  vendorFacing: boolean;
  createdAt: string;
}

interface RiskClause {
  title: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  clauseText: string;
  mitigation: string;
}

interface ContractAnalysis {
  summary: {
    summaryText: string;
    overallRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  riskClauses: RiskClause[];
}

interface ContractVersion {
  versionNumber: number;
  fullText: string;
  analysis: ContractAnalysis | null;
  comments: Comment[];
  updatedAt: string;
}

interface Contract {
  id: string;
  tenantId: string;
  title: string;
  currentVersion: number;
  versionHistory: ContractVersion[];
  originalFilename: string;
  storedFilePath: string;
  createdAt: string;
}

interface AuditActivity {
  id: string;
  description: string;
  timestamp: string;
}

const BACKEND_URL = 'http://localhost:8081';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [email, setEmail] = useState('test@contractiq.com');
  const [password, setPassword] = useState('devpassword');
  
  // Dashboard & Navigation states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'upload' | 'settings'>('dashboard');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activities, setActivities] = useState<AuditActivity[]>([
    { id: '1', description: 'System database initializer completed.', timestamp: 'Just now' }
  ]);
  
  // Pagination & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Form states
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  
  // Comment states
  const [commentContent, setCommentContent] = useState('');
  const [isVendorFacing, setIsVendorFacing] = useState(false);
  
  // Share states
  const [shareEmail, setShareEmail] = useState('');
  const [generatedMagicLink, setGeneratedMagicLink] = useState('');
  
  // Toast notifications
  const [toast, setToast] = useState<string | null>(null);
  
  // Vendor portal states
  const [vendorPortalToken, setVendorPortalToken] = useState<string | null>(null);
  const [vendorPortalData, setVendorPortalData] = useState<any | null>(null);

  // Path routing states
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    setCurrentPath(to);
  };

  const contractIdFromPath = currentPath.startsWith('/contracts/') 
    ? currentPath.substring('/contracts/'.length)
    : null;

  useEffect(() => {
    if (contractIdFromPath && contracts.length > 0) {
      const match = contracts.find(c => c.id === contractIdFromPath);
      if (match) {
        setSelectedContract(match);
      }
    } else if (!contractIdFromPath) {
      setSelectedContract(null);
    }
  }, [contractIdFromPath, contracts]);

  useEffect(() => {
    if (selectedContract) {
      setSelectedVersion(selectedContract.currentVersion);
    }
  }, [selectedContract]);

  useEffect(() => {
    if (currentPath.startsWith('/vendor/review')) {
      const params = new URLSearchParams(window.location.search);
      const portalToken = params.get('token');
      if (portalToken) {
        setVendorPortalToken(portalToken);
        loadVendorPortalData(portalToken);
      }
    } else {
      setVendorPortalToken(null);
    }
  }, [currentPath]);

  useEffect(() => {
    if (token) {
      loadContracts(token);
    }
  }, [token]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const addActivity = (desc: string) => {
    const newAct = {
      id: Math.random().toString(),
      description: desc,
      timestamp: new Date().toLocaleTimeString()
    };
    setActivities(prev => [newAct, ...prev]);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        showToast('Successfully authenticated with developer credentials!');
        addActivity('Administrator authenticated successfully.');
        navigate('/dashboard');
      } else {
        showToast('Authentication failed. Check your password.');
      }
    } catch (err) {
      showToast('Backend offline. Please start the Spring Boot app.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setContracts([]);
    setSelectedContract(null);
    showToast('Logged out of ContractIQ session.');
    addActivity('User logged out of active workspace.');
    navigate('/');
  };

  const loadContracts = async (authToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const list = await res.json();
        setContracts(list);
        if (list.length > 0 && !selectedContract) {
          setSelectedContract(list[0]);
        }
      }
    } catch (err) {
      console.error("Error loading contracts:", err);
    }
  };

  // Upload main contract
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle) {
      showToast('Please specify a title and select a PDF file');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const doc = await res.json();
        setContracts(prev => [doc, ...prev]);
        setSelectedContract(doc);
        setUploadTitle('');
        setUploadFile(null);
        showToast('Contract uploaded and vector indexed successfully!');
        addActivity(`Uploaded new contract: "${doc.title}".`);
        
        // Auto trigger analysis
        triggerAnalysis(doc.id, doc.title);
        setActiveTab('contracts');
      } else {
        const errText = await res.text();
        showToast(`Upload failed: ${errText}`);
      }
    } catch (err) {
      showToast('Network error during file upload');
    }
  };

  // Trigger RAG risk analysis
  const triggerAnalysis = async (contractId: string, title: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${contractId}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Legal risk analysis report generated successfully!');
        addActivity(`Generated legal risk report for "${title}".`);
        // Reload contract state
        loadContracts(token!);
      }
    } catch (err) {
      showToast('Error during RAG risk evaluation');
    }
  };

  // Trigger RAG risk analysis for Contract Analysis Studio with spinner states
  const triggerStudioAnalysis = async (contractId: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${contractId}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Legal risk analysis report generated successfully!');
        addActivity(`Generated legal risk report for contract ID: ${contractId}.`);
        
        // Reload contracts list to pull new analysis
        const loadRes = await fetch(`${BACKEND_URL}/api/v1/contracts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (loadRes.ok) {
          const list = await loadRes.json();
          setContracts(list);
          const updated = list.find((c: any) => c.id === contractId);
          if (updated) {
            setSelectedContract(updated);
          }
        }
      } else {
        showToast('Error during RAG risk evaluation');
      }
    } catch (err) {
      showToast('Error during RAG risk evaluation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Upload revised version
  const handleVersionUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile || !selectedContract) return;

    const formData = new FormData();
    formData.append('file', newVersionFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/versions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const updatedDoc = await res.json();
        setSelectedContract(updatedDoc);
        setContracts(prev => prev.map(c => c.id === updatedDoc.id ? updatedDoc : c));
        setNewVersionFile(null);
        showToast(`Successfully uploaded revised version ${updatedDoc.currentVersion}!`);
        addActivity(`Uploaded version ${updatedDoc.currentVersion} for "${updatedDoc.title}".`);
      } else {
        const errText = await res.text();
        showToast(`Version upload failed: ${errText}`);
      }
    } catch (err) {
      showToast('Network error uploading new version');
    }
  };

  // Post comments
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent || !selectedContract) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/comments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: commentContent, isVendorFacing, version: selectedVersion })
      });
      if (res.ok) {
        const comment = await res.json();
        const updated = { ...selectedContract };
        const activeVer = updated.versionHistory.find(v => v.versionNumber === selectedVersion);
        if (activeVer) {
          if (!activeVer.comments) activeVer.comments = [];
          activeVer.comments.push(comment);
        }
        setSelectedContract(updated);
        setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
        setCommentContent('');
        showToast('Comment posted successfully!');
        addActivity(`Added note on "${selectedContract.title}" v${selectedVersion}.`);
      }
    } catch (err) {
      showToast('Failed to post comment');
    }
  };

  // Delete contract
  const handleDeleteContract = async (contractId: string) => {
    if (!window.confirm('Are you sure you want to delete this contract? This will permanently remove all versions, collaboration notes, and AI vector embeddings.')) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${contractId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Contract deleted successfully!');
        addActivity('Contract removed from workspace.');
        setContracts(prev => prev.filter(c => c.id !== contractId));
        if (selectedContract?.id === contractId) {
          setSelectedContract(null);
        }
      } else {
        showToast('Failed to delete contract. Access denied.');
      }
    } catch (err) {
      showToast('Network error deleting contract');
    }
  };

  // Share contract via email magic portal link
  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail || !selectedContract) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/share?email=${shareEmail}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Portal access shared successfully with: ${shareEmail}`);
        addActivity(`Shared access link with: ${shareEmail}.`);
        setGeneratedMagicLink(data.magicLink);
        setShareEmail('');
      }
    } catch (err) {
      showToast('Failed to generate magic link sharing invitation');
    }
  };

  // Vendor Portal Standalone loading
  const loadVendorPortalData = async (portalToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/vendor/portal/access?token=${portalToken}`, {
        method: 'GET'
      });
      if (res.ok) {
        const data = await res.json();
        setVendorPortalData(data);
      } else {
        showToast('Invalid or expired review portal token');
      }
    } catch (err) {
      showToast('Error connecting to vendor portal access gateway');
    }
  };

  // Filtered and paginated contract list derived logic
  const filteredContracts = contracts.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredContracts.length / pageSize);

  // Derived SaaS Metrics
  const totalContractsCount = contracts.length;
  const highRiskContractsCount = contracts.filter(c => {
    const lastVer = c.versionHistory[c.versionHistory.length - 1];
    return lastVer?.analysis?.summary.overallRiskLevel === 'HIGH';
  }).length;
  const pendingReviewsCount = contracts.filter(c => {
    const lastVer = c.versionHistory[c.versionHistory.length - 1];
    return !lastVer?.analysis;
  }).length;

  // Render Vendor Magic Link portal standalone mode
  if (vendorPortalToken) {
    return (
      <div className="dashboard-container" style={{ padding: 40, background: '#0b0f19', minHeight: '100vh' }}>
        {toast && <div className="toast-msg">{toast}</div>}
        
        {/* Simplified Header: NO navigation dropdowns or internal menus */}
        <div className="glass-card" style={{ borderLeft: '6px solid #a78bfa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
          <div>
            <h1 className="main-title" style={{ fontSize: 24, margin: 0 }}>🔐 Vendor Secure Review Workspace</h1>
            <p className="sub-title" style={{ margin: 0, marginTop: 5 }}>ContractIQ secure collaboration gateway</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Sign In
          </button>
        </div>

        {vendorPortalData ? (
          <div className="studio-container">
            {/* Left Panel: Contract Metadata and PDF preview */}
            <div className="studio-left-panel">
              <div className="glass-card">
                <div className="studio-meta-header">
                  <div>
                    <h2 className="studio-contract-title">{vendorPortalData.title}</h2>
                    <div className="studio-meta-sub">
                      <span>Shared File: <strong style={{ color: '#38bdf8' }}>{vendorPortalData.originalFilename}</strong></span>
                      <span className="dot">•</span>
                      <span>Version {vendorPortalData.currentVersion} Review</span>
                    </div>
                  </div>
                </div>

                {/* PDF document viewer preview from secure portal endpoint */}
                <div className="pdf-viewer-container" style={{ marginTop: 20 }}>
                  <iframe 
                    src={`${BACKEND_URL}/api/v1/vendor/portal/access/download?token=${vendorPortalToken}`}
                    className="pdf-viewer-iframe"
                    title="Vendor PDF Preview"
                  />
                </div>
              </div>
            </div>

            {/* Right Panel: AI summary, clauses, and ONLY vendor comments thread */}
            <div className="studio-right-panel">
              {vendorPortalData.analysis ? (
                <div className="glass-card">
                  <h2 className="section-title">AI Legal Risk Summary</h2>
                  
                  {/* Overall Risk Score Gauge (0-100 color-coded) */}
                  {(() => {
                    const riskLevel = vendorPortalData.analysis.summary.overallRiskLevel || 'LOW';
                    const riskScore = riskLevel === 'HIGH' ? 85 : riskLevel === 'MEDIUM' ? 50 : 15;
                    const riskColor = riskLevel === 'HIGH' ? '#f87171' : riskLevel === 'MEDIUM' ? '#fbbf24' : '#34d399';
                    return (
                      <div className="risk-gauge-container">
                        <div className="risk-gauge-visual">
                          <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                            <circle 
                              cx="60" 
                              cy="60" 
                              r="50" 
                              fill="none" 
                              stroke={riskColor} 
                              strokeWidth="10" 
                              strokeDasharray="314.16" 
                              strokeDashoffset={314.16 - (314.16 * riskScore) / 100}
                              strokeLinecap="round"
                              transform="rotate(-90 60 60)"
                              style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                            />
                            <text x="60" y="65" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">
                              {riskScore}
                            </text>
                          </svg>
                          <div className="risk-gauge-label">
                            <span className="risk-gauge-title">Risk Index</span>
                            <span style={{ color: riskColor, fontWeight: 'bold', fontSize: 13 }}>{riskLevel} RISK</span>
                          </div>
                        </div>
                        
                        <div className="risk-gauge-summary">
                          <h3 className="input-label" style={{ fontSize: 13, marginBottom: 6 }}>Executive Summary</h3>
                          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                            {vendorPortalData.analysis.summary.summaryText}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expandable High-Risk Clauses Accordion */}
                  <div style={{ marginTop: 25 }}>
                    <h3 className="input-label" style={{ fontSize: 14, marginBottom: 12 }}>Shared Clauses & Mitigations</h3>
                    <div className="accordion-list">
                      {vendorPortalData.analysis.riskClauses && vendorPortalData.analysis.riskClauses.map((rc: any, idx: number) => (
                        <details key={idx} className="accordion-item">
                          <summary className="accordion-header">
                            <span className="accordion-title">{rc.title}</span>
                            <span className={`badge badge-${rc.riskLevel.toLowerCase()}`} style={{ marginLeft: 'auto', marginRight: 10 }}>{rc.riskLevel}</span>
                          </summary>
                          <div className="accordion-content">
                            <p className="clause-text">"{rc.clauseText}"</p>
                            <div className="clause-mitigation">
                              💡 <strong>Mitigation:</strong> {rc.mitigation}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-card" style={{ padding: 30, textAlign: 'center' }}>
                  <p style={{ color: '#64748b' }}>AI Legal Analysis is not yet completed for this version.</p>
                </div>
              )}

              {/* Vendor-Facing Comments Thread (ONLY public comments are returned here!) */}
              <div className="glass-card">
                <h2 className="section-title">Collaboration Notes (v{vendorPortalData.currentVersion})</h2>
                <div className="comments-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {vendorPortalData.comments && vendorPortalData.comments.length > 0 ? (
                    vendorPortalData.comments.map((c: any) => (
                      <div 
                        className="comment-bubble public-comment" 
                        key={c.id}
                        style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="comment-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="comment-author" style={{ fontWeight: '600', fontSize: 12, color: '#e2e8f0' }}>
                            {c.authorEmail.split('@')[0]}
                          </span>
                          <span className="comment-date" style={{ fontSize: 10, color: '#64748b' }}>
                            {new Date(c.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="comment-body" style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {c.content}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                      No shared comments recorded on this version.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
            <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }}></span>
            <p style={{ marginTop: 15, color: '#94a3b8' }}>Establishing secure connection to transmission gateway...</p>
          </div>
        )}
      </div>
    );
  }

  // Render Login Panel
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0b0f19' }}>
        {toast && <div className="toast-msg">{toast}</div>}
        <div className="glass-card" style={{ width: '450px' }}>
          <h1 className="main-title" style={{ textAlign: 'center' }}>🔑 ContractIQ Portal</h1>
          <p className="sub-title" style={{ textAlign: 'center', marginBottom: '30px' }}>
            AI-Enhanced B2B Contract Management & Risk Analysis SaaS
          </p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn" style={{ width: '100%', marginTop: '15px' }}>
              Authenticate Space
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeVersionObj = selectedContract?.versionHistory.find(
    v => v.versionNumber === selectedVersion
  );

  return (
    <div className="app-layout">
      {toast && <div className="toast-msg">{toast}</div>}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 15, marginBottom: 20 }}>
              <h2 className="section-title" style={{ margin: 0 }}>✉️ Share with Vendor</h2>
              <button 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
                onClick={() => { setShowShareModal(false); setGeneratedMagicLink(''); }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Generate a cryptographically secure magic portal link to share version reviews with external vendor contacts. The contact will receive an email and can view public comments and AI risk summaries without requiring user account credentials.
            </p>

            <form onSubmit={handleShare}>
              <div className="input-group" style={{ marginBottom: 15 }}>
                <label className="input-label">Vendor Contact Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="contact@vendorcompany.com" 
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <button type="submit" className="btn" style={{ width: '100%' }}>
                Send Magic Link & Grant Access
              </button>
            </form>

            {generatedMagicLink && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>Secure Collaboration Magic Link:</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={generatedMagicLink} 
                    readOnly 
                    style={{ flexGrow: 1, fontSize: 12, background: 'rgba(0,0,0,0.2)', color: '#818cf8' }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedMagicLink);
                      showToast('Magic Link copied to clipboard!');
                    }}
                  >
                    Copy
                  </button>
                </div>
                <small style={{ display: 'block', marginTop: 8, color: '#64748b', fontSize: 11 }}>
                  💡 Copy and open this link in an incognito window to verify the unauthenticated review workspace.
                </small>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-brand">ContractIQ</h1>
          <div className="sidebar-tenant-badge">
            Tenant: {contracts[0]?.tenantId || 'Active Workspace'}
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${currentPath === '/' || currentPath === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-item ${currentPath.startsWith('/contracts') ? 'active' : ''}`}
              onClick={() => navigate('/contracts')}
            >
              📁 Contracts Collection
            </button>
            <button 
              className={`nav-item ${currentPath === '/upload' ? 'active' : ''}`}
              onClick={() => navigate('/upload')}
            >
              📤 Upload Center
            </button>
            <button 
              className={`nav-item ${currentPath === '/settings' ? 'active' : ''}`}
              onClick={() => navigate('/settings')}
            >
              ⚙️ Settings
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <span className="user-email">test@contractiq.com</span>
            <span className="user-role">SaaS Administrator</span>
          </div>
          <button className="btn btn-danger" style={{ width: '100%', padding: '10px' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="main-content">
        
        {/* Tab 1: Dashboard Analytics */}
        {/* Tab 1: Dashboard Analytics */}
        {(currentPath === '/' || currentPath === '/dashboard') && (
          <div>
            <h1 className="main-title">Workspace Analytics</h1>
            <p className="sub-title">Corporate contract management, compliance thresholds, and legal audit indexes.</p>

            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Total Contracts</span>
                <span className="metric-value">{totalContractsCount}</span>
                <span className="metric-trend">✓ Uploaded successfully</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">High-Risk Contracts</span>
                <span className="metric-value">{highRiskContractsCount}</span>
                <span className="metric-trend negative">{highRiskContractsCount > 0 ? `${highRiskContractsCount} flagged item(s)` : 'None detected'}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Pending Reviews</span>
                <span className="metric-value">{pendingReviewsCount}</span>
                <span className="metric-trend">{pendingReviewsCount > 0 ? 'Requires AI RAG run' : 'Completed'}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Shared Portals</span>
                <span className="metric-value">{generatedMagicLink ? 1 : 0}</span>
                <span className="metric-trend">✓ Vendor links active</span>
              </div>
            </div>

            <div className="glass-card">
              <h2 className="section-title">Audit Trail & Recent Activity</h2>
              <div className="activity-list">
                {activities.map(act => (
                  <div className="activity-item" key={act.id}>
                    <span className="activity-desc">{act.description}</span>
                    <span className="activity-time">{act.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Contracts Collection (Search & Paginated list & Studio view) */}
        {(currentPath === '/contracts' || currentPath.startsWith('/contracts/')) && (
          <div>
            <h1 className="main-title">Contracts Registry</h1>
            <p className="sub-title">Search, inspect, and evaluate B2B agreements within active tenant context.</p>

            {/* Split Screen if contract is selected for inspection */}
            {selectedContract && currentPath.startsWith('/contracts/') ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <button className="btn btn-secondary" onClick={() => navigate('/contracts')}>
                    ← Back to collection table
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
                  >
                    💬 {showCommentsSidebar ? 'Hide Sidebar' : 'Show Comments & Notes'}
                  </button>
                </div>
                
                <div className="studio-container" style={{ display: 'grid', gridTemplateColumns: showCommentsSidebar ? '1fr 0.9fr 350px' : '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
                  {/* Left Panel: PDF and metadata */}
                  <div className="studio-left-panel">
                    <div className="glass-card">
                      <div className="studio-meta-header">
                        <div>
                          <h2 className="studio-contract-title">{selectedContract.title}</h2>
                          <div className="studio-meta-sub">
                            <span>Uploaded: {new Date(selectedContract.createdAt).toLocaleDateString()}</span>
                            <span className="dot">•</span>
                            <span>Tenant: <code style={{ color: '#a78bfa' }}>{selectedContract.tenantId.substring(0, 8)}...</code></span>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={() => setShowShareModal(true)}
                            >
                              ✉️ Share with Vendor
                            </button>
                          </div>
                        </div>
                        
                        {/* Version selector dropdown */}
                        <div className="version-selector-group">
                          <label className="input-label" style={{ marginBottom: 4 }}>Active Review Version</label>
                          <select 
                            className="input-field" 
                            style={{ padding: '8px 12px', fontSize: 13, background: 'rgba(30, 41, 59, 0.7)' }}
                            value={selectedVersion}
                            onChange={(e) => setSelectedVersion(Number(e.target.value))}
                          >
                            {selectedContract.versionHistory.map(v => (
                              <option key={v.versionNumber} value={v.versionNumber}>
                                Version {v.versionNumber}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* PDF document viewer preview */}
                      <div className="pdf-viewer-container" style={{ marginTop: 20 }}>
                        <iframe 
                          src={`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/download?token=${token}`}
                          className="pdf-viewer-iframe"
                          title="PDF Preview"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: AI Executive Summary & Risk Analysis */}
                  <div className="studio-right-panel">
                    {/* Render analysis if present */}
                    {activeVersionObj?.analysis ? (
                      <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <h2 className="section-title" style={{ margin: 0 }}>AI Risk Analysis</h2>
                          
                          {/* Analyze Contract Button inside studio */}
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '8px 16px', fontSize: '13px' }} 
                            onClick={() => triggerStudioAnalysis(selectedContract.id)}
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? (
                              <>
                                <span className="spinner"></span> Analyzing...
                              </>
                            ) : (
                              '🔄 Re-Run AI Analysis'
                            )}
                          </button>
                        </div>

                        {/* Overall Risk Score Gauge (0-100 color-coded) */}
                        {(() => {
                          const riskLevel = activeVersionObj.analysis.summary.overallRiskLevel || 'LOW';
                          const riskScore = riskLevel === 'HIGH' ? 85 : riskLevel === 'MEDIUM' ? 50 : 15;
                          const riskColor = riskLevel === 'HIGH' ? '#f87171' : riskLevel === 'MEDIUM' ? '#fbbf24' : '#34d399';
                          return (
                            <div className="risk-gauge-container">
                              <div className="risk-gauge-visual">
                                <svg width="120" height="120" viewBox="0 0 120 120">
                                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                  <circle 
                                    cx="60" 
                                    cy="60" 
                                    r="50" 
                                    fill="none" 
                                    stroke={riskColor} 
                                    strokeWidth="10" 
                                    strokeDasharray="314.16" 
                                    strokeDashoffset={314.16 - (314.16 * riskScore) / 100}
                                    strokeLinecap="round"
                                    transform="rotate(-90 60 60)"
                                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                                  />
                                  <text x="60" y="65" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">
                                    {riskScore}
                                  </text>
                                </svg>
                                <div className="risk-gauge-label">
                                  <span className="risk-gauge-title">Risk Index</span>
                                  <span style={{ color: riskColor, fontWeight: 'bold', fontSize: 13 }}>{riskLevel} RISK</span>
                                </div>
                              </div>
                              
                              <div className="risk-gauge-summary">
                                <h3 className="input-label" style={{ fontSize: 13, marginBottom: 6 }}>Executive Summary</h3>
                                <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                                  {activeVersionObj.analysis.summary.summaryText}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Expandable High-Risk Clauses Accordion */}
                        <div style={{ marginTop: 25 }}>
                          <h3 className="input-label" style={{ fontSize: 14, marginBottom: 12 }}>Identified Clauses & suggested mitigations</h3>
                          <div className="accordion-list">
                            {activeVersionObj.analysis.riskClauses.map((rc, idx) => (
                              <details key={idx} className="accordion-item">
                                <summary className="accordion-header">
                                  <span className="accordion-title">{rc.title}</span>
                                  <span className={`badge badge-${rc.riskLevel.toLowerCase()}`} style={{ marginLeft: 'auto', marginRight: 10 }}>{rc.riskLevel}</span>
                                </summary>
                                <div className="accordion-content">
                                  <p className="clause-text">"{rc.clauseText}"</p>
                                  <div className="clause-mitigation">
                                    💡 <strong>Mitigation:</strong> {rc.mitigation}
                                  </div>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: 20 }}>📊</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: 10 }}>AI Legal Report Pending</h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                          No AI evaluation has been executed for this contract version yet.
                        </p>
                        
                        <button 
                          className="btn" 
                          style={{ padding: '12px 24px' }}
                          onClick={() => triggerStudioAnalysis(selectedContract.id)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <>
                              <span className="spinner"></span> Generating AI Review...
                            </>
                          ) : (
                            'Analyze Contract'
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comments Sidebar Drawer */}
                  {showCommentsSidebar && (
                    <div className="studio-comments-sidebar glass-card">
                      <div className="sidebar-comments-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, marginBottom: 15 }}>
                        <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>
                          Version {selectedVersion} Notes
                        </h2>
                        <button 
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}
                          onClick={() => setShowCommentsSidebar(false)}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Comments List */}
                      <div className="sidebar-comments-list" style={{ overflowY: 'auto', maxHeight: '420px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 5 }}>
                        {activeVersionObj?.comments && activeVersionObj.comments.length > 0 ? (
                          activeVersionObj.comments.map(c => (
                            <div 
                              className={`comment-bubble ${c.vendorFacing ? 'public-comment' : 'private-comment'}`} 
                              key={c.id}
                              style={{ padding: 12, borderRadius: 8, background: c.vendorFacing ? 'rgba(255,255,255,0.02)' : 'rgba(245, 158, 11, 0.03)', border: c.vendorFacing ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(245, 158, 11, 0.12)' }}
                            >
                              <div className="comment-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span className="comment-author" style={{ fontWeight: '600', fontSize: 12, color: '#e2e8f0' }}>
                                  {c.authorEmail.split('@')[0]}
                                </span>
                                <span className="comment-date" style={{ fontSize: 10, color: '#64748b' }}>
                                  {new Date(c.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="comment-body" style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                {c.content}
                              </div>
                              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start' }}>
                                {c.vendorFacing ? (
                                  <span className="badge badge-vendor" style={{ fontSize: 10, padding: '2px 6px' }}>
                                    🌍 Vendor Facing
                                  </span>
                                ) : (
                                  <span className="badge badge-private" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    🔒 Private Note
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: '#64748b', textAlign: 'center', padding: '30px 0', fontSize: 13 }}>
                            No comments recorded on version {selectedVersion}.
                          </p>
                        )}
                      </div>

                      {/* Post Comment Form */}
                      <form onSubmit={handlePostComment} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 15 }}>
                        <textarea 
                          className="input-field" 
                          placeholder={`Add a note to version ${selectedVersion}...`}
                          value={commentContent}
                          onChange={(e) => setCommentContent(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', height: 80, padding: 10, fontSize: 13, marginBottom: 12, resize: 'none' }}
                          required
                        />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={isVendorFacing} 
                              onChange={(e) => setIsVendorFacing(e.target.checked)} 
                            />
                            Share with Vendor Portal (Public)
                          </label>
                          <button type="submit" className="btn btn-secondary" style={{ width: '100%', padding: '10px' }}>
                            Post Comment
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card">
                {/* Search Bar & Table */}
                <div className="table-controls">
                  <input 
                    type="text" 
                    className="search-field"
                    placeholder="Search contract name or files..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                  <button className="btn" onClick={() => navigate('/upload')}>
                    + Upload Contract
                  </button>
                </div>

                {filteredContracts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                    <p>No contracts match your search parameters.</p>
                  </div>
                ) : (
                  <>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Contract Title</th>
                          <th>Version</th>
                          <th>Uploaded File</th>
                          <th>Risk Assessment</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedContracts.map(doc => {
                          const lastVer = doc.versionHistory[doc.versionHistory.length - 1];
                          const riskLevel = lastVer?.analysis?.summary.overallRiskLevel || 'PENDING';
                          return (
                            <tr key={doc.id}>
                              <td style={{ fontWeight: '600' }}>{doc.title}</td>
                              <td><span className="badge badge-medium">v{doc.currentVersion}</span></td>
                              <td style={{ color: '#94a3b8', fontSize: 13 }}>📄 {doc.originalFilename}</td>
                              <td>
                                <span className={`badge badge-${riskLevel.toLowerCase()}`}>
                                  {riskLevel}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => navigate(`/contracts/${doc.id}`)}>
                                    Inspect Details
                                  </button>
                                  <button className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleDeleteContract(doc.id)}>
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination control details */}
                    <div className="pagination-wrapper">
                      <span className="pagination-info">
                        Showing page {currentPage} of {totalPages || 1} ({filteredContracts.length} items total)
                      </span>
                      <div className="pagination-buttons">
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px' }}
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          Prev
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px' }}
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Upload Center */}
        {currentPath === '/upload' && (
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 className="main-title">Upload Center</h1>
            <p className="sub-title">Submit a PDF agreement to register metadata and generate vector embeddings.</p>

            <form onSubmit={handleUpload}>
              <div className="input-group">
                <label className="input-label">Contract Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Mutual Services Agreement"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Choose PDF Document</label>
                <input 
                  type="file" 
                  className="input-file" 
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  required
                />
              </div>
              <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }}>
                Start Vector Indexing
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: System Settings */}
        {currentPath === '/settings' && (
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 className="main-title">Tenant Settings</h1>
            <p className="sub-title">System keys, environment configs, and legal AI model options.</p>
            
            <div className="input-group">
              <span className="input-label">SaaS Tenant Model</span>
              <div style={{ color: '#a5b4fc', fontWeight: 'bold' }}>Default Multi-Tenant Isolated Space</div>
            </div>
            <div className="input-group">
              <span className="input-label">AI Inference Engine</span>
              <div>Ollama ChatModel (local node)</div>
            </div>
            <div className="input-group">
              <span className="input-label">Vector Database</span>
              <div>PostgreSQL 18 (Native Host Service)</div>
            </div>
            <div className="input-group">
              <span className="input-label">Audit Log Level</span>
              <div style={{ color: '#34d399' }}>Active / Verbose logging</div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
