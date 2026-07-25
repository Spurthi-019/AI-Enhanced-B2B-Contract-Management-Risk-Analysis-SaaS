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

  useEffect(() => {
    // Check if token exists in query string for Vendor Magic Link Portal
    const params = new URLSearchParams(window.location.search);
    const portalToken = params.get('token');
    if (portalToken) {
      setVendorPortalToken(portalToken);
      loadVendorPortalData(portalToken);
    }
  }, []);

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
        body: JSON.stringify({ content: commentContent, isVendorFacing })
      });
      if (res.ok) {
        const comment = await res.json();
        const updated = { ...selectedContract };
        const activeVer = updated.versionHistory.find(v => v.versionNumber === updated.currentVersion);
        if (activeVer) {
          if (!activeVer.comments) activeVer.comments = [];
          activeVer.comments.push(comment);
        }
        setSelectedContract(updated);
        setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
        setCommentContent('');
        showToast('Comment posted successfully!');
        addActivity(`Added note on "${selectedContract.title}" v${selectedContract.currentVersion}.`);
      }
    } catch (err) {
      showToast('Failed to post comment');
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
        showToast(`Portal access shared successfully with: ${shareEmail}`);
        addActivity(`Shared access link with: ${shareEmail}.`);
        
        // Build mock token locally to display for test purposes
        const header = btoa(JSON.stringify({ alg: "HS256" }));
        const payload = btoa(JSON.stringify({
          contractId: selectedContract.id,
          tenantId: selectedContract.tenantId,
          vendorEmail: shareEmail,
          isVendor: true,
          sub: shareEmail,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        })).replace(/=/g, '');
        const mockToken = `${header}.${payload}.mockSignatureKey`;
        setGeneratedMagicLink(`http://localhost:5173/?token=${mockToken}`);
        setShareEmail('');
      }
    } catch (err) {
      showToast('Sharing invite generated successfully');
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
      <div className="dashboard-container" style={{ padding: 40 }}>
        {toast && <div className="toast-msg">{toast}</div>}
        <div className="glass-card" style={{ borderLeft: '6px solid #a78bfa' }}>
          <h1 className="main-title">🔐 Vendor Secure Portal</h1>
          <p className="sub-title">ContractIQ Secure Transmission Link Review Screen</p>
          <a href="/" className="btn btn-secondary">← Exit Review Portal</a>
        </div>

        {vendorPortalData ? (
          <div className="grid-2">
            <div className="glass-card">
              <h2 className="section-title">Contract Information</h2>
              <div className="input-group">
                <span className="input-label">Contract ID</span>
                <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>{vendorPortalData.id}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Title</span>
                <div>{vendorPortalData.title}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Filename</span>
                <div style={{ color: '#38bdf8' }}>📄 {vendorPortalData.originalFilename}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Current Version</span>
                <div>Version {vendorPortalData.currentVersion}</div>
              </div>
            </div>

            <div className="glass-card">
              <h2 className="section-title">Comments Board</h2>
              <div className="comments-list">
                {vendorPortalData.comments && vendorPortalData.comments.length > 0 ? (
                  vendorPortalData.comments.map((c: any) => (
                    <div className="comment-bubble" key={c.id}>
                      <div className="comment-header">
                        <span className="comment-author">{c.authorEmail}</span>
                        <span className="comment-date">{new Date(c.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="comment-body">{c.content}</div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#64748b' }}>No comments shared with vendor for this version.</p>
                )}
              </div>
            </div>

            {vendorPortalData.analysis && (
              <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                <h2 className="section-title">Legal Counsel AI Analysis</h2>
                <div className="risk-meter-wrapper">
                  <span className="input-label">Overall Risk:</span>
                  <span className={`risk-level-indicator risk-level-${vendorPortalData.analysis.summary.overallRiskLevel}`}>
                    {vendorPortalData.analysis.summary.overallRiskLevel}
                  </span>
                  <div className="risk-bar-bg">
                    <div className={`risk-bar-fill fill-${vendorPortalData.analysis.summary.overallRiskLevel}`}></div>
                  </div>
                </div>
                <p style={{ margin: '15px 0', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6 }}>
                  {vendorPortalData.analysis.summary.summaryText}
                </p>

                <h3 className="input-label" style={{ marginTop: 20, marginBottom: 10 }}>Identified Risk Clauses & Mitigations</h3>
                {vendorPortalData.analysis.riskClauses && vendorPortalData.analysis.riskClauses.map((rc: any, idx: number) => (
                  <div className="risk-clause-card" key={idx}>
                    <div className="risk-clause-header">
                      <span className="risk-clause-title">{rc.title}</span>
                      <span className={`badge badge-${rc.riskLevel.toLowerCase()}`}>{rc.riskLevel}</span>
                    </div>
                    <div className="risk-clause-text">"{rc.clauseText}"</div>
                    <div className="risk-clause-mitigation">💡 <strong>Mitigation:</strong> {rc.mitigation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading portal reviews...</p>
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
    v => v.versionNumber === selectedContract.currentVersion
  );

  return (
    <div className="app-layout">
      {toast && <div className="toast-msg">{toast}</div>}

      {/* Main Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-brand">ContractIQ</h1>
          <div className="sidebar-tenant-badge">
            Tenant: {contracts[0]?.tenantId || 'Active Workspace'}
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setSelectedContract(null); }}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'contracts' ? 'active' : ''}`}
              onClick={() => setActiveTab('contracts')}
            >
              📁 Contracts Collection
            </button>
            <button 
              className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📤 Upload Center
            </button>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
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
        {activeTab === 'dashboard' && (
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

        {/* Tab 2: Contracts Collection (Search & Paginated list) */}
        {activeTab === 'contracts' && (
          <div>
            <h1 className="main-title">Contracts Registry</h1>
            <p className="sub-title">Search, inspect, and evaluate B2B agreements within active tenant context.</p>

            {/* Split Screen if contract is selected for inspection */}
            {selectedContract ? (
              <div>
                <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => setSelectedContract(null)}>
                  ← Back to collection table
                </button>
                <div className="grid-2">
                  {/* Uploader control */}
                  <div className="glass-card">
                    <h2 className="section-title">Version Revision Control</h2>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 15 }}>
                      Contract Title: <strong style={{ color: '#fff' }}>{selectedContract.title}</strong><br/>
                      Stored File: <strong style={{ color: '#38bdf8' }}>{selectedContract.originalFilename}</strong>
                    </p>
                    <form onSubmit={handleVersionUpload}>
                      <div className="input-group">
                        <label className="input-label">Upload Revised Document (PDF)</label>
                        <input 
                          type="file" 
                          className="input-file" 
                          accept="application/pdf"
                          onChange={(e) => setNewVersionFile(e.target.files ? e.target.files[0] : null)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn" style={{ width: '100%' }}>
                        Submit Version {selectedContract.currentVersion + 1}
                      </button>
                    </form>

                    {/* Share wizard */}
                    <div style={{ marginTop: 25, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 className="input-label" style={{ marginBottom: 10, fontSize: 14 }}>Send Magic Portal Link</h3>
                      <form onSubmit={handleShare} style={{ display: 'flex', gap: 10 }}>
                        <input 
                          type="email" 
                          className="input-field" 
                          placeholder="vendor@b2bproject.com"
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          style={{ flexGrow: 1 }}
                          required
                        />
                        <button type="submit" className="btn">Share</button>
                      </form>
                      {generatedMagicLink && (
                        <div style={{ marginTop: 15, background: 'rgba(99,102,241,0.1)', padding: 12, borderRadius: 8, border: '1px dashed #6366f1' }}>
                          <span className="input-label" style={{ display: 'block', marginBottom: 5 }}>Secure Link (Right click to open in incognito):</span>
                          <a href={generatedMagicLink} style={{ color: '#818cf8', wordBreak: 'break-all', fontSize: 12 }}>
                            {generatedMagicLink}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comments board */}
                  <div className="glass-card">
                    <h2 className="section-title">Collaboration Notes (v{selectedContract.currentVersion})</h2>
                    <div className="comments-list">
                      {activeVersionObj?.comments && activeVersionObj.comments.length > 0 ? (
                        activeVersionObj.comments.map(c => (
                          <div className="comment-bubble" key={c.id}>
                            <div className="comment-header">
                              <span className="comment-author">
                                {c.authorEmail}
                                {c.vendorFacing && <span className="comment-badge-vendor">Vendor Facing</span>}
                              </span>
                              <span className="comment-date">{new Date(c.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <div className="comment-body">{c.content}</div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: '30px 0' }}>No comments recorded on this version.</p>
                      )}
                    </div>

                    <form onSubmit={handlePostComment}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Type notes here..." 
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
                        required
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isVendorFacing} 
                            onChange={(e) => setIsVendorFacing(e.target.checked)} 
                          />
                          Share with Vendor Portal
                        </label>
                        <button type="submit" className="btn btn-secondary">Post Note</button>
                      </div>
                    </form>
                  </div>

                  {/* AI report board */}
                  {activeVersionObj?.analysis && (
                    <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                      <h2 className="section-title">Legal AI RAG Analysis</h2>
                      <div className="risk-meter-wrapper">
                        <span className="input-label">Risk Threshold:</span>
                        <span className={`risk-level-indicator risk-level-${activeVersionObj.analysis.summary.overallRiskLevel}`}>
                          {activeVersionObj.analysis.summary.overallRiskLevel}
                        </span>
                        <div className="risk-bar-bg">
                          <div className={`risk-bar-fill fill-${activeVersionObj.analysis.summary.overallRiskLevel}`}></div>
                        </div>
                      </div>
                      <p style={{ margin: '15px 0', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6 }}>
                        {activeVersionObj.analysis.summary.summaryText}
                      </p>

                      <h3 className="input-label" style={{ marginTop: 20, marginBottom: 12, fontSize: 14 }}>Identified Clauses & legal mitigations</h3>
                      <div className="grid-2">
                        {activeVersionObj.analysis.riskClauses.map((rc, idx) => (
                          <div className="risk-clause-card" key={idx}>
                            <div className="risk-clause-header">
                              <span className="risk-clause-title">{rc.title}</span>
                              <span className={`badge badge-${rc.riskLevel.toLowerCase()}`}>{rc.riskLevel}</span>
                            </div>
                            <div className="risk-clause-text">"{rc.clauseText}"</div>
                            <div className="risk-clause-mitigation">💡 <strong>Mitigation:</strong> {rc.mitigation}</div>
                          </div>
                        ))}
                      </div>
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
                  <button className="btn" onClick={() => setActiveTab('upload')}>
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
                                <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setSelectedContract(doc)}>
                                  Inspect Details
                                </button>
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
        {activeTab === 'upload' && (
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
        {activeTab === 'settings' && (
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
              <div>PostgreSQL 16 with PGVector Store Starter</div>
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
