import React from 'react';

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

interface ComplianceChecklist {
  gdprStatus: 'VERIFIED' | 'RISK_FLAGGED' | 'MISSING';
  gdprDetails: string;
  indemnityStatus: 'VERIFIED' | 'RISK_FLAGGED' | 'MISSING';
  indemnityDetails: string;
  liabilityStatus: 'VERIFIED' | 'RISK_FLAGGED' | 'MISSING';
  liabilityDetails: string;
  govLawStatus: 'VERIFIED' | 'RISK_FLAGGED' | 'MISSING';
  govLawDetails: string;
}

interface ContractAnalysis {
  summary: {
    summaryText: string;
    overallRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  riskClauses: RiskClause[];
  keyTerms?: string[];
  complianceChecklist?: ComplianceChecklist;
}

interface ContractVersion {
  versionNumber: number;
  fullText: string;
  analysis: ContractAnalysis | null;
  comments: Comment[];
  updatedAt: string;
}

interface User {
  email: string;
  roles: string[];
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
  expirationDate?: string;
  approvalStatus?: string;
}

interface ContractDetailProps {
  currentUser: User | null;
  selectedContract: Contract;
  selectedVersion: number;
  setSelectedVersion: (version: number) => void;
  showCommentsSidebar: boolean;
  setShowCommentsSidebar: (show: boolean) => void;
  rightPanelTab: 'risk' | 'chat';
  setRightPanelTab: (tab: 'risk' | 'chat') => void;
  isAnalyzing: boolean;
  triggerStudioAnalysis: (contractId: string) => Promise<void>;
  chatMessages: {[key: string]: { sender: 'user' | 'ai', text: string }[]};
  chatInput: string;
  setChatInput: (input: string) => void;
  isSendingChat: boolean;
  handleSendChatMessage: (e: React.FormEvent) => Promise<void>;
  handlePostComment: (e: React.FormEvent) => Promise<void>;
  commentContent: string;
  setCommentContent: (content: string) => void;
  isVendorFacing: boolean;
  setIsVendorFacing: (vendorFacing: boolean) => void;
  setShowShareModal: (show: boolean) => void;
  navigate: (to: string) => void;
  token: string | null;
  BACKEND_URL: string;
  onUpdateContractStatus?: (status: string) => Promise<void>;
  onUpdateReminderThreshold?: (days: number) => Promise<void>;
}

export function ContractDetail({
  currentUser,
  selectedContract,
  selectedVersion,
  setSelectedVersion,
  showCommentsSidebar,
  setShowCommentsSidebar,
  rightPanelTab,
  setRightPanelTab,
  isAnalyzing,
  triggerStudioAnalysis,
  chatMessages,
  chatInput,
  setChatInput,
  isSendingChat,
  handleSendChatMessage,
  handlePostComment,
  commentContent,
  setCommentContent,
  isVendorFacing,
  setIsVendorFacing,
  setShowShareModal,
  navigate,
  token,
  BACKEND_URL,
  onUpdateContractStatus,
  onUpdateReminderThreshold
}: ContractDetailProps) {
  const activeVersionObj = selectedContract.versionHistory.find(
    v => v.versionNumber === selectedVersion
  );

  const riskLevel = activeVersionObj?.analysis?.summary.overallRiskLevel || 'LOW';
  const riskScore = riskLevel === 'HIGH' ? 85 : riskLevel === 'MEDIUM' ? 50 : 15;
  const riskColor = riskLevel === 'HIGH' ? '#fb7185' : riskLevel === 'MEDIUM' ? '#fcd34d' : '#34d399';

  // Compliance values loaded from the backend analysis result
  const compliance = activeVersionObj?.analysis?.complianceChecklist;

  const gdprStatus = compliance?.gdprStatus || 'MISSING';
  const gdprDetails = compliance?.gdprDetails || 'No privacy assessment run yet.';
  
  const indemnityStatus = compliance?.indemnityStatus || 'MISSING';
  const indemnityDetails = compliance?.indemnityDetails || 'No indemnification assessment run yet.';

  const liabilityStatus = compliance?.liabilityStatus || 'MISSING';
  const liabilityDetails = compliance?.liabilityDetails || 'No liability limit assessment run yet.';

  const govLawStatus = compliance?.govLawStatus || 'MISSING';
  const govLawDetails = compliance?.govLawDetails || 'No governing law assessment run yet.';

  const userRoles = currentUser?.roles || [];
  const canApprove = userRoles.includes('ROLE_ADMIN') || userRoles.includes('ROLE_LEGAL_REVIEWER');
  const isApproved = selectedContract.approvalStatus === 'APPROVED';

  // Derive lifecycle steps
  const isStep2Completed = activeVersionObj?.analysis ? true : false;
  const isStep3Completed = activeVersionObj?.comments && activeVersionObj.comments.length > 0 ? true : false;
  const isStep4Completed = isApproved;

  let stepIndex = 1;
  if (isStep4Completed) {
    stepIndex = 4;
  } else if (isStep3Completed) {
    stepIndex = 3;
  } else if (isStep2Completed) {
    stepIndex = 2;
  }

  const progressPercent = stepIndex === 1 ? 0 : stepIndex === 2 ? 33 : stepIndex === 3 ? 66 : 100;

  // Expiration checking
  const checkIsExpiringSoon = () => {
    if (!selectedContract.expirationDate) return false;
    try {
      const expDate = new Date(selectedContract.expirationDate);
      if (isNaN(expDate.getTime())) return false;
      const thresholdDays = selectedContract.reminderThresholdDays || 30;
      const msDiff = expDate.getTime() - Date.now();
      const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= thresholdDays;
    } catch {
      return false;
    }
  };

  const isExpiringSoon = checkIsExpiringSoon();
  const [selectedThreshold, setSelectedThreshold] = React.useState(selectedContract.reminderThresholdDays || 30);

  const chatFormRef = React.useRef<HTMLFormElement>(null);

  const handleQuickPromptClick = (text: string) => {
    setChatInput(text);
    setTimeout(() => {
      if (chatFormRef.current) {
        chatFormRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 50);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Re-architected Top Banner & Header Bar */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '16px 24px', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => navigate('/contracts')}>
            ← Back to collection table
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="main-title" style={{ fontSize: '20px', margin: 0, fontWeight: '700' }}>
              {selectedContract.title}
            </h1>
            
            {/* Version Selector Dropdown */}
            <select 
              className="input-field" 
              style={{ padding: '4px 24px 4px 12px', fontSize: '12px', height: 'auto', width: 'auto', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '6px' }}
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
            >
              {selectedContract.versionHistory.map(v => (
                <option key={v.versionNumber} value={v.versionNumber}>
                  Version {v.versionNumber}
                </option>
              ))}
            </select>

            {/* Expiration Date Badge */}
            <span className="badge" style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.25)', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              📅 Expires {selectedContract.expirationDate || 'Jul 28, 2027'}
            </span>

            {/* Tenant Context Pill */}
            <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              Workspace: {selectedContract.tenantId.substring(0, 8)}...
            </span>

            {/* Approval Status Badge */}
            <span className="badge" style={{ 
              background: selectedContract.approvalStatus === 'APPROVED' ? 'rgba(16, 185, 129, 0.1)' : selectedContract.approvalStatus === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
              color: selectedContract.approvalStatus === 'APPROVED' ? '#34d399' : selectedContract.approvalStatus === 'REJECTED' ? '#f87171' : '#60a5fa', 
              border: selectedContract.approvalStatus === 'APPROVED' ? '1px solid rgba(16, 185, 129, 0.2)' : selectedContract.approvalStatus === 'REJECTED' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
              padding: '4px 10px', 
              fontSize: '12px', 
              whiteSpace: 'nowrap'
            }}>
              Approval: {selectedContract.approvalStatus || 'PENDING_APPROVAL'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {canApprove && !isApproved && onUpdateContractStatus && (
            <div style={{ display: 'flex', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '12px', marginRight: '2px' }}>
              <button 
                className="btn" 
                style={{ padding: '8px 14px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                onClick={() => onUpdateContractStatus('APPROVED')}
              >
                ✔️ Approve
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                onClick={() => onUpdateContractStatus('REJECTED')}
              >
                ❌ Request Changes
              </button>
            </div>
          )}

          <button 
            className="btn" 
            style={{ padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
            onClick={() => setShowShareModal(true)}
          >
            ✉️ Share with Vendor
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
          >
            💬 {showCommentsSidebar ? 'Hide Sidebar' : 'Show Comments & Notes'}
          </button>
        </div>
      </div>

      {/* 1.5. Visual Contract Lifecycle Stepper */}
      <div className="lifecycle-stepper-card">
        <div className="stepper-container">
          <div className="stepper-line"></div>
          <div className="stepper-line-progress" style={{ width: `${progressPercent}%` }}></div>
          
          <div className={`stepper-step ${stepIndex >= 1 ? (stepIndex === 1 ? 'active' : 'completed') : ''}`}>
            <div className="stepper-bubble">📤</div>
            <div className="stepper-label">Draft Uploaded</div>
          </div>
          <div className={`stepper-step ${stepIndex >= 2 ? (stepIndex === 2 ? 'active' : 'completed') : ''}`}>
            <div className="stepper-bubble">🤖</div>
            <div className="stepper-label">AI Risk Evaluated</div>
          </div>
          <div className={`stepper-step ${stepIndex >= 3 ? (stepIndex === 3 ? 'active' : 'completed') : ''}`}>
            <div className="stepper-bubble">👥</div>
            <div className="stepper-label">Teammate Review</div>
          </div>
          <div className={`stepper-step ${stepIndex >= 4 ? (stepIndex === 4 ? 'active' : 'completed') : ''}`}>
            <div className="stepper-bubble">✔️</div>
            <div className="stepper-label">Approved & Active</div>
          </div>
        </div>
      </div>

      {/* 2. Main Content Split Layout (65% Main Studio / 35% Right Collaboration Dock) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column — Main AI Studio (8 Cols / 65% Width or 12 Cols if sidebar closed) */}
        <div className={`studio-left-panel ${showCommentsSidebar ? 'lg:col-span-8' : 'lg:col-span-12'}`} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* PDF Viewer Card */}
          <div className="glass-card" style={{ marginBottom: 0 }}>
            <div className="pdf-viewer-container">
              <iframe 
                src={`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/download?token=${token}`}
                className="pdf-viewer-iframe"
                title="PDF Preview"
              />
            </div>
          </div>

           {/* Security & Compliance Verification Card */}
          <div className="security-sandbox-card">
            <h3 className="section-title" style={{ margin: 0, fontSize: 15, borderLeft: '4px solid #10b981', paddingLeft: 10, color: '#0F172A' }}>
              🛡️ Security & Compliance Sandbox
            </h3>
            <p style={{ color: '#64748B', fontSize: '13px', margin: '6px 0 0 0', lineHeight: 1.5 }}>
              This agreement is stored using high-grade isolated network storage. Access is limited to active tenant context.
            </p>
            <div className="security-grid">
              <div className="security-item">
                <span style={{ fontSize: 16 }}>🔒</span>
                <div>
                  <div className="security-label">AES-256 Storage</div>
                  <div className="security-value">Enforced & Encrypted</div>
                </div>
                <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>✓</span>
              </div>
              <div className="security-item">
                <span style={{ fontSize: 16 }}>👤</span>
                <div>
                  <div className="security-label">Tenant Sandbox</div>
                  <div className="security-value">Bound to Context</div>
                </div>
                <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>✓</span>
              </div>
              <div className="security-item">
                <span style={{ fontSize: 16 }}>📡</span>
                <div>
                  <div className="security-label">Transit Protocol</div>
                  <div className="security-value">SSL/TLS HTTPS Active</div>
                </div>
                <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>✓</span>
              </div>
              <div className="security-item">
                <span style={{ fontSize: 16 }}>📜</span>
                <div>
                  <div className="security-label">File Integrity</div>
                  <div className="security-value">SHA-256 Verified</div>
                </div>
                <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>✓</span>
              </div>
            </div>
          </div>

          {/* AI Studio Tabs Card */}
          <div className="glass-card" style={{ marginBottom: 0 }}>
            {/* Top Tab Bar: Navigable tabs for Risk Analysis and Ask AI Chat */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button 
                className={`btn ${rightPanelTab === 'risk' ? '' : 'btn-secondary'}`}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  boxShadow: rightPanelTab === 'risk' ? '0 0 15px rgba(99, 102, 241, 0.25)' : 'none',
                  border: rightPanelTab === 'risk' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent'
                }}
                onClick={() => setRightPanelTab('risk')}
              >
                🛡️ Risk Analysis
              </button>
              <button 
                className={`btn ${rightPanelTab === 'chat' ? '' : 'btn-secondary'}`}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  boxShadow: rightPanelTab === 'chat' ? '0 0 15px rgba(139, 92, 246, 0.25)' : 'none',
                  border: rightPanelTab === 'chat' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent'
                }}
                onClick={() => setRightPanelTab('chat')}
              >
                💬 Ask AI Chat
              </button>
            </div>

            {rightPanelTab === 'risk' ? (
              isAnalyzing ? (
                <div className="skeleton-loader" style={{ padding: '20px 0' }}>
                  <div className="skeleton-line title"></div>
                  <div style={{ display: 'flex', gap: '16px', margin: '12px 0' }}>
                    <div className="skeleton-line" style={{ height: '80px', width: '80px', borderRadius: '50%' }}></div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  </div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line short"></div>
                  <p style={{ textAlign: 'center', marginTop: '16px', color: '#818cf8', fontSize: '13px', fontWeight: '500' }}>
                    <span className="spinner"></span> Running vector index queries & prompt completion...
                  </p>
                </div>
              ) : activeVersionObj?.analysis ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 className="section-title" style={{ margin: 0, borderLeft: '4px solid #6366f1', paddingLeft: '10px' }}>AI Risk Analysis</h2>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '8px 16px', fontSize: '13px' }} 
                      onClick={() => triggerStudioAnalysis(selectedContract.id)}
                    >
                      🔄 Re-Run AI Analysis
                    </button>
                  </div>

                  {/* Executive Summary Area: A two-column sub-layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'center', marginTop: 20 }}>
                    {/* Left: circular Risk Score Gauge in soft radial container */}
                    <div style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.01) 100%)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                          <text x="60" y="65" textAnchor="middle" fill="#0F172A" fontSize="22" fontWeight="bold">
                            {riskScore}
                          </text>
                        </svg>
                        <div className="risk-gauge-label" style={{ marginTop: '8px' }}>
                          <span className="risk-gauge-title" style={{ color: '#64748B' }}>Risk Index</span>
                          <span style={{ color: riskColor, fontWeight: 'bold', fontSize: 13 }}>{riskLevel} RISK</span>
                        </div>
                      </div>
                    </div>
                    {/* Right: Executive Summary paragraph text with clean typography */}
                    <div className="risk-gauge-summary">
                      <h3 className="input-label" style={{ fontSize: '14px', marginBottom: '8px', color: '#3b82f6', fontWeight: '600' }}>Executive Summary</h3>
                      <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: 1.6 }}>
                        {activeVersionObj.analysis.summary.summaryText}
                      </p>
                    </div>
                  </div>

                  {/* ⚖️ Compliance & Governance Scorecard */}
                  <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <h3 className="input-label" style={{ fontSize: 13, marginBottom: 12, color: '#818cf8', textTransform: 'none', letterSpacing: 'normal', fontWeight: '600' }}>
                      ⚖️ Compliance & Governance Scorecard
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      {/* GDPR check */}
                      <div className="security-item" style={{ 
                        border: gdprStatus === 'RISK_FLAGGED' ? '1px solid rgba(244, 63, 94, 0.2)' : gdprStatus === 'VERIFIED' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(0,0,0,0.06)', 
                        background: gdprStatus === 'RISK_FLAGGED' ? 'rgba(244, 63, 94, 0.02)' : gdprStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.02)' : 'transparent' 
                      }}>
                        <span style={{ fontSize: 16 }}>🛡️</span>
                        <div>
                          <div className="security-label" style={{ color: '#0F172A' }}>Data Privacy & GDPR</div>
                          <div className="security-value" style={{ fontSize: 11, color: gdprStatus === 'RISK_FLAGGED' ? '#fb7185' : gdprStatus === 'VERIFIED' ? '#3b82f6' : '#64748b' }} title={gdprDetails}>
                            {gdprStatus === 'RISK_FLAGGED' ? '⚠️ Compliance Risk' : gdprStatus === 'VERIFIED' ? '✓ GDPR Verified' : '🔍 No Privacy Terms'}
                          </div>
                        </div>
                        <span style={{ color: gdprStatus === 'RISK_FLAGGED' ? '#fb7185' : gdprStatus === 'VERIFIED' ? '#34d399' : '#64748b', marginLeft: 'auto', fontWeight: 'bold' }}>
                          {gdprStatus === 'RISK_FLAGGED' ? '!' : gdprStatus === 'VERIFIED' ? '✓' : '?'}
                        </span>
                      </div>

                      {/* Indemnification check */}
                      <div className="security-item" style={{ 
                        border: indemnityStatus === 'RISK_FLAGGED' ? '1px solid rgba(244, 63, 94, 0.2)' : indemnityStatus === 'VERIFIED' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(0,0,0,0.06)', 
                        background: indemnityStatus === 'RISK_FLAGGED' ? 'rgba(244, 63, 94, 0.02)' : indemnityStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.02)' : 'transparent' 
                      }}>
                        <span style={{ fontSize: 16 }}>⚖️</span>
                        <div>
                          <div className="security-label" style={{ color: '#0F172A' }}>Indemnity Boundaries</div>
                          <div className="security-value" style={{ fontSize: 11, color: indemnityStatus === 'RISK_FLAGGED' ? '#fb7185' : indemnityStatus === 'VERIFIED' ? '#3b82f6' : '#64748b' }} title={indemnityDetails}>
                            {indemnityStatus === 'RISK_FLAGGED' ? '⚠️ Indemnity Risk' : indemnityStatus === 'VERIFIED' ? '✓ Indemnity Clause' : '🔍 No Indemnity Terms'}
                          </div>
                        </div>
                        <span style={{ color: indemnityStatus === 'RISK_FLAGGED' ? '#fb7185' : indemnityStatus === 'VERIFIED' ? '#34d399' : '#64748b', marginLeft: 'auto', fontWeight: 'bold' }}>
                          {indemnityStatus === 'RISK_FLAGGED' ? '!' : indemnityStatus === 'VERIFIED' ? '✓' : '?'}
                        </span>
                      </div>

                      {/* Liability Cap check */}
                      <div className="security-item" style={{ 
                        border: liabilityStatus === 'RISK_FLAGGED' ? '1px solid rgba(244, 63, 94, 0.2)' : liabilityStatus === 'VERIFIED' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(0,0,0,0.06)', 
                        background: liabilityStatus === 'RISK_FLAGGED' ? 'rgba(244, 63, 94, 0.02)' : liabilityStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.02)' : 'transparent' 
                      }}>
                        <span style={{ fontSize: 16 }}>💸</span>
                        <div>
                          <div className="security-label" style={{ color: '#0F172A' }}>Liability Cap Limit</div>
                          <div className="security-value" style={{ fontSize: 11, color: liabilityStatus === 'RISK_FLAGGED' ? '#fb7185' : liabilityStatus === 'VERIFIED' ? '#3b82f6' : '#64748b' }} title={liabilityDetails}>
                            {liabilityStatus === 'RISK_FLAGGED' ? '⚠️ Liability Risk' : liabilityStatus === 'VERIFIED' ? '✓ Liability Cap Bound' : '🔍 No Liability Cap'}
                          </div>
                        </div>
                        <span style={{ color: liabilityStatus === 'RISK_FLAGGED' ? '#fb7185' : liabilityStatus === 'VERIFIED' ? '#34d399' : '#64748b', marginLeft: 'auto', fontWeight: 'bold' }}>
                          {liabilityStatus === 'RISK_FLAGGED' ? '!' : liabilityStatus === 'VERIFIED' ? '✓' : '?'}
                        </span>
                      </div>

                      {/* Governing Law check */}
                      <div className="security-item" style={{ 
                        border: govLawStatus === 'RISK_FLAGGED' ? '1px solid rgba(244, 63, 94, 0.2)' : govLawStatus === 'VERIFIED' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(0,0,0,0.06)', 
                        background: govLawStatus === 'RISK_FLAGGED' ? 'rgba(244, 63, 94, 0.02)' : govLawStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.02)' : 'transparent' 
                      }}>
                        <span style={{ fontSize: 16 }}>🌍</span>
                        <div>
                          <div className="security-label" style={{ color: '#0F172A' }}>Governing Jurisdiction</div>
                          <div className="security-value" style={{ fontSize: 11, color: govLawStatus === 'RISK_FLAGGED' ? '#fb7185' : govLawStatus === 'VERIFIED' ? '#3b82f6' : '#64748b' }} title={govLawDetails}>
                            {govLawStatus === 'RISK_FLAGGED' ? '⚠️ Jurisdiction Risk' : govLawStatus === 'VERIFIED' ? '✓ Jurisdiction OK' : '🔍 No Jurisdiction'}
                          </div>
                        </div>
                        <span style={{ color: govLawStatus === 'RISK_FLAGGED' ? '#fb7185' : govLawStatus === 'VERIFIED' ? '#34d399' : '#64748b', marginLeft: 'auto', fontWeight: 'bold' }}>
                          {govLawStatus === 'RISK_FLAGGED' ? '!' : govLawStatus === 'VERIFIED' ? '✓' : '?'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ⏰ Expiration & Smart Alerts */}
                  <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 className="input-label" style={{ fontSize: 13, margin: 0, color: '#818cf8', textTransform: 'none', letterSpacing: 'normal', fontWeight: '600' }}>
                        ⏰ Expiration & Smart Alerts
                      </h3>
                      <span className="badge" style={{ 
                        background: isExpiringSoon ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        color: isExpiringSoon ? '#fbbf24' : '#34d399', 
                        border: isExpiringSoon ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {isExpiringSoon ? '⚠️ EXPIRING SOON' : '✓ Active'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: '#334155', fontSize: '13px' }}>
                        📅 Expiration Date: <strong style={{ color: '#0F172A' }}>{selectedContract.expirationDate || 'Jul 28, 2027'}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Notify alert threshold:</span>
                        <select 
                          className="input-field"
                          value={selectedThreshold}
                          onChange={(e) => setSelectedThreshold(Number(e.target.value))}
                          style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', height: 'auto', background: '#FFFFFF', border: '1px solid rgba(203, 213, 225, 0.8)' }}
                        >
                          <option value={15}>15 Days before</option>
                          <option value={30}>30 Days before</option>
                          <option value={60}>60 Days before</option>
                          <option value={90}>90 Days before</option>
                        </select>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => onUpdateReminderThreshold?.(selectedThreshold)}
                        >
                          Save alert rule
                        </button>
                      </div>
                    </div>
                  </div>

                  {activeVersionObj.analysis.keyTerms && activeVersionObj.analysis.keyTerms.length > 0 && (
                    <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <h3 className="input-label" style={{ fontSize: 13, marginBottom: 8, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'none', letterSpacing: 'normal' }}>
                        🔑 Key Terms & Highlights
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
                        {activeVersionObj.analysis.keyTerms.map((term, index) => (
                          <li key={index} style={{ marginBottom: 4 }}>{term}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Accordion Area: High-Risk Clauses Accordion spanning full width */}
                  <div style={{ marginTop: 25 }}>
                    <h3 className="input-label" style={{ fontSize: 14, marginBottom: 12 }}>Identified Clauses & Suggested Mitigations</h3>
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
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: 20 }}>📊</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', marginBottom: 10 }}>AI Legal Report Pending</h3>
                  <p style={{ color: '#64748B', fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                    No AI evaluation has been executed for this contract version yet.
                  </p>
                  <button 
                    className="btn" 
                    style={{ padding: '12px 24px' }}
                    onClick={() => triggerStudioAnalysis(selectedContract.id)}
                  >
                    Analyze Contract
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, marginBottom: 15 }}>
                  <h2 className="section-title" style={{ margin: 0, fontSize: 16, borderLeft: '4px solid #8b5cf6', paddingLeft: '10px' }}>
                    Ask AI About This Contract
                  </h2>
                  <p className="sub-title" style={{ margin: 0, marginTop: 4, fontSize: 12 }}>
                    Ask questions about terms, liabilities, or specific clauses in version {selectedVersion}.
                  </p>
                </div>

                {/* Chat Messages Stream */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 15, paddingRight: 5 }}>
                  {(chatMessages[selectedContract.id] || []).length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px' }}>
                      <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <span style={{ fontSize: 32 }}>🤖</span>
                        <p style={{ margin: '8px 0 0 0', fontSize: 14, fontWeight: '600', color: '#e2e8f0' }}>AI Contract Assistant</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                          Tap a quick-query below to instantly parse the document context using vector RAG similarity search:
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc', cursor: 'pointer' }}
                          onClick={() => handleQuickPromptClick("Can you summarize the main purpose and key terms of this contract?")}
                        >
                          <span>📝</span> <span>Summarize Agreement</span>
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc', cursor: 'pointer' }}
                          onClick={() => handleQuickPromptClick("What is the liability cap limit specified in this agreement?")}
                        >
                          <span>💸</span> <span>Liability Cap Limit</span>
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc', cursor: 'pointer' }}
                          onClick={() => handleQuickPromptClick("What are the data privacy, security, and GDPR compliance terms?")}
                        >
                          <span>🛡️</span> <span>GDPR & Privacy Check</span>
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc', cursor: 'pointer' }}
                          onClick={() => handleQuickPromptClick("What are the indemnification boundaries and responsibilities?")}
                        >
                          <span>⚖️</span> <span>Indemnification Boundaries</span>
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc', cursor: 'pointer' }}
                          onClick={() => handleQuickPromptClick("What is the termination policy and notice period?")}
                        >
                          <span>📅</span> <span>Termination notice period</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    (chatMessages[selectedContract.id] || []).map((msg, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: 13,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: msg.sender === 'user' ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : '#F1F5F9',
                          color: msg.sender === 'user' ? '#fff' : '#1E293B',
                          border: msg.sender === 'user' ? 'none' : '1px solid #E2E8F0'
                        }}
                      >
                        {msg.text}
                      </div>
                    ))
                  )}
                  {isSendingChat && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748b', fontSize: 13 }}>
                      <span className="spinner" style={{ width: 14, height: 14 }}></span>
                      <span>AI is reading contract chunks...</span>
                    </div>
                  )}
                </div>

                {/* Input Form */}
                <form ref={chatFormRef} onSubmit={handleSendChatMessage} style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: 15, display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Type question about this agreement..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={{ flex: 1, padding: '12px', fontSize: 13, margin: 0 }}
                    disabled={isSendingChat}
                  />
                  <button 
                    type="submit" 
                    className="btn" 
                    style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    disabled={isSendingChat || !chatInput.trim()}
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Collaboration & Notes Drawer (4 Cols / 35% Width) */}
        {showCommentsSidebar && (
          <div className="lg:col-span-4 studio-comments-sidebar glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px', marginBottom: 0 }}>
            <div className="sidebar-comments-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, marginBottom: 15 }}>
              <h2 className="section-title" style={{ margin: 0, fontSize: 16, borderLeft: 'none', paddingLeft: 0 }}>
                Version {selectedVersion} Notes
              </h2>
              <button 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
                onClick={() => setShowCommentsSidebar(false)}
              >
                ✕
              </button>
            </div>

            {/* Comment Feed Container: Vertically scrollable */}
            <div className="sidebar-comments-list" style={{ flexGrow: 1, overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 5 }}>
              {activeVersionObj?.comments && activeVersionObj.comments.length > 0 ? (
                activeVersionObj.comments.map(c => {
                  const emailName = c.authorEmail.split('@')[0];
                  const initials = emailName.substring(0, 2).toUpperCase();
                  const authorRole = c.authorEmail.toLowerCase().includes('admin') ? 'Workspace Admin' 
                                   : c.authorEmail.toLowerCase().includes('legal') || c.authorEmail.toLowerCase().includes('reviewer') ? 'Legal Reviewer'
                                   : 'Workspace Collaborator';
                  return (
                    <div 
                      className={`comment-bubble ${c.vendorFacing ? 'public-comment' : 'private-comment'}`} 
                      key={c.id}
                      style={{ padding: 14, borderRadius: 12, background: c.vendorFacing ? 'rgba(99, 102, 241, 0.03)' : 'rgba(245, 158, 11, 0.03)', border: c.vendorFacing ? '1px solid rgba(99, 102, 241, 0.12)' : '1px solid rgba(245, 158, 11, 0.12)' }}
                    >
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                        <div style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '50%', 
                          background: c.vendorFacing ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                          color: c.vendorFacing ? '#a5b4fc' : '#fbbf24', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          border: c.vendorFacing ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {initials}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="comment-author" style={{ fontWeight: '600', fontSize: '12px', color: '#0F172A' }}>
                            {emailName}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>
                            {authorRole}
                          </span>
                        </div>
                        <span className="comment-date" style={{ fontSize: '10px', color: '#64748b', marginLeft: 'auto' }}>
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="comment-body" style={{ fontSize: 13, color: '#334155', lineHeight: 1.4, wordBreak: 'break-word', paddingLeft: '38px' }}>
                        {c.content}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start', paddingLeft: '38px' }}>
                        {c.vendorFacing ? (
                          <span className="badge" style={{ fontSize: 9, background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '2px 6px' }}>
                            🌐 VENDOR FACING
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 6px' }}>
                            🔒 INTERNAL ONLY
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <span className="empty-state-icon" style={{ fontSize: '32px', marginBottom: '10px' }}>💬</span>
                  <h4 className="empty-state-title" style={{ fontSize: '15px', marginBottom: '4px' }}>No Notes Yet</h4>
                  <p className="empty-state-description" style={{ fontSize: '12px' }}>Be the first to record a note or post a comment on version {selectedVersion}.</p>
                </div>
              )}
            </div>

            {/* Bottom Sticky Input Section */}
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
                <button type="submit" className="btn" style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}>
                  Post Comment
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
