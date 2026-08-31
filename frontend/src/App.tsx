import React, { useState, useEffect } from 'react';
import './App.css';
import { LandingPage } from './components/LandingPage';
import { ContractDetail } from './components/ContractDetail';
import { TopNavbar } from './components/TopNavbar';

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
  expirationDate?: string;
  approvalStatus?: string;
  reminderThresholdDays?: number;
}

interface AuditActivity {
  id: string;
  description: string;
  timestamp: string;
  createdAt: Date;
}

const BACKEND_URL = 'http://localhost:8081';

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const parseErrorMessage = (errText: string, fallback: string = 'Error occurred') => {
  try {
    const parsed = JSON.parse(errText);
    if (parsed && parsed.message) {
      return parsed.message;
    }
  } catch (e) {
    // not JSON
  }
  return errText || fallback;
};

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [email, setEmail] = useState('test@contractiq.com');
  const [password, setPassword] = useState('devpassword');

  useEffect(() => {
    if (token) {
      setCurrentUser(parseJwt(token));
    } else {
      setCurrentUser(null);
    }
  }, [token]);

  const roles = currentUser?.roles || [];
  const isAdmin = roles.includes('ROLE_ADMIN');
  const isReviewer = roles.includes('ROLE_LEGAL_REVIEWER');
  const isEmployee = roles.includes('ROLE_EMPLOYEE');

  const getRoleDisplayName = () => {
    if (isAdmin) return 'Workspace Admin';
    if (isReviewer) return 'Legal Reviewer';
    if (isEmployee) return 'Employee';
    return 'User';
  };

  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);

  // Tenant Settings states
  const [tenantSettings, setTenantSettings] = useState<{
    companyName: string;
    domain: string;
    aiModel: string;
    riskSensitivity: string;
    magicLinkExpiryDays: number;
    webhookUrl: string;
    subscriptionPlan: string;
  }>({
    companyName: '',
    domain: '',
    aiModel: 'llama3',
    riskSensitivity: 'MEDIUM',
    magicLinkExpiryDays: 7,
    webhookUrl: '',
    subscriptionPlan: 'FREE'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadWorkspaceUsers = async (authToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const roster = await res.json();
        setWorkspaceUsers(roster);
      }
    } catch (err) {
      console.error("Error loading workspace users:", err);
    }
  };

  const loadTenantSettings = async (authToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/settings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const settings = await res.json();
        setTenantSettings(settings);
      }
    } catch (err) {
      console.error("Error loading tenant settings:", err);
    }
  };

  useEffect(() => {
    if (token) {
      loadTenantSettings(token);
      if (isAdmin) {
        loadWorkspaceUsers(token);
      }
    }
  }, [token, isAdmin]);

  // Dashboard & Navigation states
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activities, setActivities] = useState<AuditActivity[]>([
    { id: '1', description: 'System database initializer completed.', timestamp: 'Just now', createdAt: new Date() }
  ]);
  
  // Pagination & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Form states
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Comment states
  const [commentContent, setCommentContent] = useState('');
  const [isVendorFacing, setIsVendorFacing] = useState(false);
  
  // Share states
  const [shareEmail, setShareEmail] = useState('');
  const [generatedMagicLink, setGeneratedMagicLink] = useState('');
  
  // Toast notifications
  const [toast, setToast] = useState<string | null>(null);
  
  // Vendor portal states
  const [vendorPortalToken, setVendorPortalToken] = useState<string | null>(() => {
    if (window.location.pathname.startsWith('/vendor/review')) {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    }
    return null;
  });
  const [vendorPortalData, setVendorPortalData] = useState<any | null>(null);

  // Path routing states
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [registerCompany, setRegisterCompany] = useState('');
  const [registerEmail, setRegisterEmail] = useState(localStorage.getItem('quickEmail') || '');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EMPLOYEE');

  // RAG Chat States
  const [rightPanelTab, setRightPanelTab] = useState<'risk' | 'chat'>('risk');
  const [chatMessages, setChatMessages] = useState<{[key: string]: { sender: 'user' | 'ai', text: string }[]}>({});
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

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
      timestamp: new Date().toLocaleTimeString(),
      createdAt: new Date()
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
    setCurrentUser(null);
    setContracts([]);
    setSelectedContract(null);
    setTenantSettings({ companyName: '', domain: '', aiModel: 'llama3', riskSensitivity: 'MEDIUM', magicLinkExpiryDays: 7, webhookUrl: '', subscriptionPlan: 'FREE' });
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
    setIsUploading(true);
    setUploadProgress(10);
    setUploadProgressText('📤 Transmitting document bits securely...');

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev < 40) {
          setUploadProgressText('📤 Transmitting document bits securely...');
          return prev + 10;
        } else if (prev < 75) {
          setUploadProgressText('🛡️ Scanning document for viruses & malware...');
          return prev + 8;
        } else if (prev < 95) {
          setUploadProgressText('🤖 Vectorizing RAG index chunks...');
          return prev + 3;
        }
        return prev;
      });
    }, 300);

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
        navigate('/contracts');
      } else {
        const errText = await res.text();
        showToast(`Upload failed: ${errText}`);
      }
    } catch (err) {
      showToast('Network error during file upload');
    } finally {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadProgressText('Complete!');
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadProgressText('');
      }, 500);
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
      console.error("Error triggering analysis:", err);
    }
  };

  // Update contract status
  const handleUpdateContractStatus = async (status: string) => {
    if (!selectedContract) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/status?status=${status}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
        setSelectedContract(updated);
        showToast(`Contract approval status updated to ${status}`);
        addActivity(`Updated contract "${updated.title}" approval status to ${status}.`);
      } else {
        const err = await res.text();
        showToast(`Failed to update status: ${err}`);
      }
    } catch (err) {
      showToast('Network error during status update');
    }
  };

  // Update reminder alert threshold days
  const handleUpdateReminderThreshold = async (days: number) => {
    if (!selectedContract) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contracts/${selectedContract.id}/reminders?days=${days}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
        setSelectedContract(updated);
        showToast(`Smart expiration threshold set to ${days} days`);
        addActivity(`Set reminder alert threshold for "${updated.title}" to ${days} days.`);
      } else {
        const err = await res.text();
        showToast(`Failed to update reminder threshold: ${err}`);
      }
    } catch (err) {
      showToast('Network error during reminder threshold update');
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tenantSettings)
      });
      if (res.ok) {
        const updated = await res.json();
        setTenantSettings(updated);
        showToast('Workspace settings saved successfully!');
        addActivity('Workspace settings updated.');
      } else {
        const err = await res.text();
        showToast(`Failed to save settings: ${err || 'Forbidden'}`);
      }
    } catch (err) {
      showToast('Network error saving workspace settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Send AI Chat Message (RAG System)
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedContract || isSendingChat) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsSendingChat(true);

    const contractId = selectedContract.id;
    // 1. Instantly append User's message to local chat history for this contract
    setChatMessages(prev => {
      const currentList = prev[contractId] || [];
      return {
        ...prev,
        [contractId]: [...currentList, { sender: 'user', text: userMessage }]
      };
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: userMessage, contractId })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => {
          const currentList = prev[contractId] || [];
          return {
            ...prev,
            [contractId]: [...currentList, { sender: 'ai', text: data.answer }]
          };
        });
      } else {
        showToast('AI Chat request failed. Check server status.');
        setChatMessages(prev => {
          const currentList = prev[contractId] || [];
          return {
            ...prev,
            [contractId]: [...currentList, { sender: 'ai', text: 'Error: Failed to fetch AI answer.' }]
          };
        });
      }
    } catch (err) {
      showToast('Network error during AI chat request');
      setChatMessages(prev => {
        const currentList = prev[contractId] || [];
        return {
          ...prev,
          [contractId]: [...currentList, { sender: 'ai', text: 'Network error communicating with ContractIQ AI.' }]
        };
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  // Register Company / Tenant onboarding
  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: registerCompany,
          email: registerEmail,
          password: registerPassword
        })
      });
      if (res.ok) {
        showToast('Company registered successfully! Please log in.');
        setRegisterCompany('');
        setRegisterEmail('');
        setRegisterPassword('');
        localStorage.removeItem('quickEmail');
        navigate('/login');
      } else {
        const errText = await res.text();
        showToast(`Registration failed: ${parseErrorMessage(errText, 'Invalid details')}`);
      }
    } catch (err) {
      showToast('Network error during registration');
    }
  };

  // Change Subscription Plan
  const handleSelectPlan = async (planName: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/subscription?plan=${planName}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const settings = await res.json();
        setTenantSettings(settings);
        showToast(`Subscription plan updated to ${planName} successfully!`);
        addActivity(`Subscription plan updated to ${planName}.`);
      } else {
        const errText = await res.text();
        showToast(`Failed to update plan: ${parseErrorMessage(errText)}`);
      }
    } catch (err) {
      showToast('Network error during subscription plan update');
    }
  };

  // Invite Team Member
  const handleInviteTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/invite`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });
      if (res.ok) {
        showToast(`Invitation sent successfully to ${inviteEmail}!`);
        addActivity(`Invited ${inviteEmail} as ${inviteRole}.`);
        setInviteEmail('');
        setShowInviteModal(false);
      } else {
        const errText = await res.text();
        showToast(`Failed to send invitation: ${parseErrorMessage(errText, 'Access Denied')}`);
      }
    } catch (err) {
      showToast('Network error sending invitation');
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

  const [vendorUploadFile, setVendorUploadFile] = useState<File | null>(null);
  const [isVendorUploading, setIsVendorUploading] = useState(false);

  const handleVendorPostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent || !vendorPortalToken) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/vendor/portal/comment?token=${vendorPortalToken}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: commentContent })
      });
      if (res.ok) {
        const commentsList = await res.json();
        setVendorPortalData((prev: any) => ({
          ...prev,
          comments: commentsList
        }));
        setCommentContent('');
        showToast('Comment posted successfully!');
      } else {
        showToast('Failed to submit vendor comment.');
      }
    } catch (err) {
      showToast('Failed to post comment');
    }
  };

  const handleVendorRevisionUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorUploadFile || !vendorPortalToken) {
      showToast('Please select a PDF file first.');
      return;
    }
    setIsVendorUploading(true);
    const formData = new FormData();
    formData.append('file', vendorUploadFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/vendor/portal/upload?token=${vendorPortalToken}`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const updatedResponse = await res.json();
        setVendorPortalData(updatedResponse);
        setVendorUploadFile(null);
        showToast('Revised counter-offer uploaded successfully!');
      } else {
        const txt = await res.text();
        showToast(`Upload failed: ${txt}`);
      }
    } catch (err) {
      showToast('Network error during revised upload');
    } finally {
      setIsVendorUploading(false);
    }
  };

  // Filtered and paginated contract list derived logic
  const filteredContracts = contracts.filter(c => {
    const lastVer = c.versionHistory[c.versionHistory.length - 1];
    const riskLevel = lastVer?.analysis?.summary.overallRiskLevel || 'PENDING';
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.originalFilename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === 'ALL' || riskLevel.toUpperCase() === riskFilter.toUpperCase();
    return matchesSearch && matchesRisk;
  });

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
  const expiringSoonContracts = contracts.filter(doc => {
    if (!doc.expirationDate) return false;
    try {
      const expDate = new Date(doc.expirationDate);
      if (isNaN(expDate.getTime())) return false;
      const thresholdDays = doc.reminderThresholdDays || 30;
      const msDiff = expDate.getTime() - Date.now();
      const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= thresholdDays;
    } catch {
      return false;
    }
  });

  // Render Vendor Magic Link portal standalone mode
  if (vendorPortalToken) {
    return (
      <div className="dashboard-container" style={{ padding: 40, background: '#090D16', minHeight: '100vh' }}>
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
                            <text x="60" y="65" textAnchor="middle" fill="#0F172A" fontSize="22" fontWeight="bold">
                              {riskScore}
                            </text>
                          </svg>
                          <div className="risk-gauge-label">
                            <span className="risk-gauge-title" style={{ color: '#64748B' }}>Risk Index</span>
                            <span style={{ color: riskColor, fontWeight: 'bold', fontSize: 13 }}>{riskLevel} RISK</span>
                          </div>
                        </div>
                        
                        <div className="risk-gauge-summary">
                          <h3 className="input-label" style={{ fontSize: 13, marginBottom: 6 }}>Executive Summary</h3>
                          <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
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

              {/* Vendor Comment Reply Form */}
              <div className="glass-card" style={{ marginTop: 20 }}>
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>💬 Add Note / Reply</h3>
                <form onSubmit={handleVendorPostComment}>
                  <textarea 
                    className="input-field" 
                    placeholder="Type a public message for the review team..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', height: 80, padding: 10, fontSize: 13, marginBottom: 12, resize: 'none', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    required
                  />
                  <button type="submit" className="btn" style={{ width: '100%', padding: '10px' }}>
                    Post Reply
                  </button>
                </form>
              </div>

              {/* Upload Revised Counter-Offer Version */}
              <div className="glass-card" style={{ marginTop: 20 }}>
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>📤 Submit Revised Version</h3>
                <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4, marginBottom: 15 }}>
                  Select and upload a revised PDF copy containing counter-offer terms to create a new review version.
                </p>
                <form onSubmit={handleVendorRevisionUpload}>
                  <input 
                    type="file" 
                    className="input-file" 
                    accept="application/pdf"
                    onChange={(e) => setVendorUploadFile(e.target.files ? e.target.files[0] : null)}
                    required
                    style={{ marginBottom: 12, width: '100%' }}
                  />
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%', padding: '10px' }} disabled={isVendorUploading}>
                    {isVendorUploading ? 'Uploading Revision...' : 'Submit Revised Copy'}
                  </button>
                </form>
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

  // Render Landing Page at '/'
  if (currentPath === '/') {
    return <LandingPage token={token} navigate={navigate} />;
  }

  // Render Register Page
  if (!token && currentPath === '/register') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#090D16' }}>
        {toast && <div className="toast-msg">{toast}</div>}
        <div className="glass-card" style={{ width: '450px' }}>
          <h1 className="main-title" style={{ textAlign: 'center' }}>🏢 Register Company</h1>
          <p className="sub-title" style={{ textAlign: 'center', marginBottom: '30px' }}>
            Set up a secure B2B tenant workspace and register the administrator account
          </p>

          <form onSubmit={handleRegisterCompany}>
            <div className="input-group">
              <label className="input-label">Company / Tenant Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Acme Corp"
                value={registerCompany} 
                onChange={(e) => setRegisterCompany(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Admin Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="admin@company.com"
                value={registerEmail} 
                onChange={(e) => setRegisterEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group" style={{ marginBottom: 25 }}>
              <label className="input-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={registerPassword} 
                onChange={(e) => setRegisterPassword(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="btn" style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
              Register Workspace & Admin
            </button>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <a 
                href="/login" 
                onClick={(e) => { e.preventDefault(); navigate('/login'); }} 
                style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 13 }}
              >
                Already have a company? Sign In
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Login Panel
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#090D16' }}>
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
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <a 
                href="/register" 
                onClick={(e) => { e.preventDefault(); navigate('/register'); }} 
                style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 13 }}
              >
                Register a new company workspace
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }


  return (
    <div className="app-container-with-navbar">
      <TopNavbar
        currentUser={currentUser}
        tenantName={tenantSettings.companyName || contracts[0]?.tenantId || 'Active Workspace'}
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          if (q === 'HIGH') {
            setRiskFilter('HIGH');
            setSearchQuery('');
          } else {
            setSearchQuery(q);
          }
          setCurrentPage(1);
        }}
        highRiskCount={highRiskContractsCount}
        navigate={navigate}
        handleLogout={handleLogout}
        onOpenUpload={() => setShowUploadModal(true)}
      />
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

      {/* Invite Team Modal */}
      {showInviteModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '450px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 15, marginBottom: 20 }}>
              <h2 className="section-title" style={{ margin: 0 }}>➕ Invite Team Member</h2>
              <button 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Invite an employee or legal counsel to join your active tenant workspace. They will receive an email containing a temporary password (`welcome123`) to log in immediately.
            </p>

            <form onSubmit={handleInviteTeamSubmit}>
              <div className="input-group" style={{ marginBottom: 15 }}>
                <label className="input-label">Member Email Address</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="collaborator@company.com" 
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Workspace Access Role</label>
                <select 
                  className="input-field"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)' }}
                >
                  <option value="EMPLOYEE">Employee (Read Only)</option>
                  <option value="LEGAL_REVIEWER">Legal Reviewer (Read & Edit)</option>
                  <option value="ADMIN">Tenant Administrator (Full Control)</option>
                </select>
              </div>

              <button type="submit" className="btn" style={{ width: '100%', padding: '12px' }}>
                Send Workspace Invitation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Contract Modal */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 15, marginBottom: 20 }}>
              <h2 className="section-title" style={{ margin: 0, borderLeft: 'none', paddingLeft: 0 }}>📤 Upload Contract</h2>
              <button 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadTitle(''); }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={async (e) => { e.preventDefault(); await handleUpload(e); setShowUploadModal(false); }}>
              <div className="input-group">
                <label className="input-label">Contract Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Mutual Services Agreement"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={isUploading}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Choose PDF Document</label>
                <div 
                  className="upload-zone"
                  onClick={() => !isUploading && document.getElementById('contract-modal-file-input')?.click()}
                  style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                >
                  <div className="upload-zone-icon">📤</div>
                  <h3 style={{ fontSize: '15px', color: '#0F172A', margin: '0 0 6px' }}>
                    {uploadFile ? uploadFile.name : 'Select contract PDF file'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    {uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : 'Click to browse files or drop a PDF copy here'}
                  </p>
                  <input 
                    id="contract-modal-file-input"
                    type="file" 
                    style={{ display: 'none' }}
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    disabled={isUploading}
                    required={!uploadFile}
                  />
                </div>
              </div>

              {isUploading && (
                <div className="upload-progress-container" style={{ marginBottom: '15px' }}>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <div className="progress-text">
                    <span>{uploadProgressText}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }} disabled={isUploading}>
                {isUploading ? 'Securely Uploading & Indexing...' : 'Start Vector Indexing'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-brand">ContractIQ</h1>
          <div className="sidebar-tenant-badge">
            Workspace: {tenantSettings.companyName || contracts[0]?.tenantId || 'Active Workspace'}
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${currentPath === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-item ${currentPath.startsWith('/contracts') ? 'active' : ''}`}
              onClick={() => navigate('/contracts')}
            >
              📁 {isAdmin ? 'All Contracts' : 'My Assigned Contracts'}
            </button>
            <button 
              className={`nav-item ${currentPath === '/upload' ? 'active' : ''}`}
              onClick={() => navigate('/upload')}
            >
              📤 Upload Center
            </button>
            {isAdmin && (
              <>
                <button 
                  className={`nav-item ${currentPath === '/users' ? 'active' : ''}`}
                  onClick={() => navigate('/users')}
                >
                  👥 User Management
                </button>
                <button 
                  className={`nav-item ${currentPath === '/billing' ? 'active' : ''}`}
                  onClick={() => navigate('/billing')}
                >
                  💳 Billing & subscription
                </button>
                <button 
                  className={`nav-item ${currentPath === '/audit' ? 'active' : ''}`}
                  onClick={() => navigate('/audit')}
                >
                  📜 Audit Logs
                </button>
                <button 
                  className={`nav-item ${currentPath === '/settings' ? 'active' : ''}`} 
                  onClick={() => navigate('/settings')}
                >
                  ⚙️ Workspace Settings {isAdmin ? <span className="badge" style={{ marginLeft: '4px', background: '#6366F1', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Admin Only</span> : <span className="badge" style={{ marginLeft: '4px', background: '#94A3B8', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>View Policy</span>}
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <span className="user-email">{currentUser?.email || 'user@contractiq.com'}</span>
            <span className="user-role">{getRoleDisplayName()}</span>
          </div>
          <button className="btn btn-danger" style={{ width: '100%', padding: '10px' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="main-content">
        
        {currentPath === '/dashboard' && (
          <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h1 className="main-title" style={{ margin: 0 }}>Workspace Analytics</h1>
                  <p className="sub-title" style={{ margin: 0, marginTop: 4 }}>Corporate contract management, compliance thresholds, and legal audit indexes.</p>
                </div>
                {isAdmin && (
                  <button className="btn" onClick={() => setShowInviteModal(true)}>
                    ➕ Invite Team Members
                  </button>
                )}
              </div>

              {/* Dashboard Hero Card */}
              <div className="glass-card" style={{ marginBottom: 25, background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }}></div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Welcome back!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  Gain instant visibility into contract risks, upcoming expiration dates, and vendor negotiations.
                </p>
              </div>

              {/* Expiration Alert Banner */}
              <div className="glass-card" style={{ marginBottom: 20, border: expiringSoonContracts.length > 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.15)', background: expiringSoonContracts.length > 0 ? 'rgba(245, 158, 11, 0.01)' : 'rgba(16, 185, 129, 0.01)' }}>
                <h3 className="section-title" style={{ margin: 0, fontSize: 14, borderLeft: expiringSoonContracts.length > 0 ? '4px solid #f59e0b' : '4px solid #10b981', paddingLeft: 10, color: 'var(--text-primary)' }}>
                  ⏰ Smart Expiration Monitor
                </h3>
                {expiringSoonContracts.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ color: '#b45309', fontSize: 13, margin: '0 0 10px 0' }}>
                      ⚠️ <strong>Attention:</strong> The following B2B agreements are approaching their configured expiration alert thresholds:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {expiringSoonContracts.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-canvas)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ fontWeight: '600', fontSize: 13, color: 'var(--text-primary)' }}>{doc.title}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>({doc.originalFilename})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '2px 8px', fontSize: 11 }}>
                              📅 Expiry: {doc.expirationDate}
                            </span>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => navigate(`/contracts/${doc.id}`)}>
                              Inspect
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#10b981', fontSize: 12, margin: '10px 0 0 0' }}>
                    ✓ All workspace agreements are actively within safe expiration alert thresholds.
                  </p>
                )}
              </div>

            <div className="metrics-grid">
              <div className="metric-card action-card-upload" onClick={() => setShowUploadModal(true)}>
                <span className="metric-label" style={{ color: '#0369a1', fontWeight: 'bold' }}>📤 Upload Contract</span>
                <span className="metric-value" style={{ color: '#0284c7', fontSize: '24px' }}>+ Add PDF</span>
                <span className="metric-trend" style={{ color: '#0284c7' }}>Index & parse agreements</span>
              </div>
              <div className="metric-card action-card-flags" onClick={() => { setRiskFilter('HIGH'); navigate('/contracts'); }}>
                <span className="metric-label" style={{ color: '#b45309', fontWeight: 'bold' }}>⚠️ High Risk Flags</span>
                <span className="metric-value" style={{ color: '#d97706', fontSize: '24px' }}>{highRiskContractsCount}</span>
                <span className="metric-trend" style={{ color: '#d97706' }}>{highRiskContractsCount > 0 ? 'Requires legal review' : 'Zero items flagged'}</span>
              </div>
              <div className="metric-card action-card-analytics" onClick={() => navigate('/dashboard')}>
                <span className="metric-label" style={{ color: '#047857', fontWeight: 'bold' }}>📊 Risk Analytics</span>
                <span className="metric-value" style={{ color: '#059669', fontSize: '24px' }}>{totalContractsCount}</span>
                <span className="metric-trend" style={{ color: '#059669' }}>Active B2B portfolio</span>
              </div>
              <div className="metric-card action-card-ai" onClick={() => navigate('/contracts')}>
                <span className="metric-label" style={{ color: '#6d28d9', fontWeight: 'bold' }}>🤖 Ask AI Studio</span>
                <span className="metric-value" style={{ color: '#7c3aed', fontSize: '24px' }}>Interactive RAG</span>
                <span className="metric-trend" style={{ color: '#7c3aed' }}>Chat with vector index</span>
              </div>
            </div>

            <div className="glass-card">
              <h2 className="section-title">Audit Trail & Workspace Log</h2>
              <div className="timeline-wrapper" style={{ marginTop: 24 }}>
                {activities.map(act => (
                  <div className="timeline-event" key={act.id}>
                    <div className="timeline-node"></div>
                    <div className="timeline-content-card">
                      <span className="activity-desc" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚡</span> {act.description}
                      </span>
                      <span className="activity-time">{act.timestamp}</span>
                    </div>
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
            <p className="sub-title">Search and manage your organization's contracts.</p>

            {selectedContract && currentPath.startsWith('/contracts/') ? (
              <ContractDetail
                currentUser={currentUser}
                selectedContract={selectedContract}
                selectedVersion={selectedVersion}
                setSelectedVersion={setSelectedVersion}
                showCommentsSidebar={showCommentsSidebar}
                setShowCommentsSidebar={setShowCommentsSidebar}
                rightPanelTab={rightPanelTab}
                setRightPanelTab={setRightPanelTab}
                isAnalyzing={isAnalyzing}
                triggerStudioAnalysis={triggerStudioAnalysis}
                chatMessages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                isSendingChat={isSendingChat}
                handleSendChatMessage={handleSendChatMessage}
                handlePostComment={handlePostComment}
                commentContent={commentContent}
                setCommentContent={setCommentContent}
                isVendorFacing={isVendorFacing}
                setIsVendorFacing={setIsVendorFacing}
                setShowShareModal={setShowShareModal}
                navigate={navigate}
                token={token}
                BACKEND_URL={BACKEND_URL}
                onUpdateContractStatus={handleUpdateContractStatus}
                onUpdateReminderThreshold={handleUpdateReminderThreshold}
                subscriptionPlan={tenantSettings.subscriptionPlan}
              />
            ) : contracts.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                <span className="empty-state-icon" style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>📁</span>
                <h3 className="empty-state-title" style={{ fontSize: '18px', color: '#fff', marginBottom: '8px', fontWeight: '600' }}>No contracts uploaded yet</h3>
                <p className="empty-state-description" style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                  Get started by adding your first B2B agreement. Our AI will automatically index, run legal risk evaluations, and track expiration cycles.
                </p>
                <button className="btn" style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', padding: '10px 24px', fontSize: '13px' }} onClick={() => setShowUploadModal(true)}>
                  ➕ Upload your first contract
                </button>
              </div>
            ) : (
              <div className="glass-card">
                {/* Search Bar & Labeled Controls */}
                <div className="table-controls" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flexGrow: 1 }}>
                    <label className="input-label" style={{ fontSize: '11px', color: '#94a3b8', margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>Search Registry</label>
                    <input 
                      type="text" 
                      className="search-field"
                      placeholder="Search by title or filename..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      style={{ width: '100%', margin: 0 }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
                    <label className="input-label" style={{ fontSize: '11px', color: '#94a3b8', margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>Risk Level Filter</label>
                    <select
                      className="input-field"
                      value={riskFilter}
                      onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }}
                      style={{ width: '100%', height: 'auto', padding: '10px 14px', margin: 0, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <option value="ALL">All Risk Levels</option>
                      <option value="LOW">Low Risk</option>
                      <option value="MEDIUM">Medium Risk</option>
                      <option value="HIGH">High Risk</option>
                    </select>
                  </div>

                  <button className="btn" style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }} onClick={() => setShowUploadModal(true)}>
                    + Upload Contract
                  </button>
                </div>

                {filteredContracts.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state-icon">📂</span>
                    <h3 className="empty-state-title">No Contracts Found</h3>
                    <p className="empty-state-description">No contracts match your search parameters or risk filters. Adjust your filters or upload a new contract.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto', width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Contract Title</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Version</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Uploaded File</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Expiration Date</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Risk Assessment</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px' }}>Approval Status</th>
                            <th style={{ verticalAlign: 'middle', padding: '12px 16px', minWidth: '190px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedContracts.map(doc => {
                            const lastVer = doc.versionHistory[doc.versionHistory.length - 1];
                            const riskLevel = lastVer?.analysis?.summary.overallRiskLevel || 'PENDING';
                            
                            // Expiry logic: alert color accent only if expires <= 30 days
                            const checkExpiresSoon = (expiryStr: string | undefined) => {
                              if (!expiryStr) return false;
                              try {
                                const expDate = new Date(expiryStr);
                                if (isNaN(expDate.getTime())) return false;
                                const msDiff = expDate.getTime() - Date.now();
                                const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
                                return daysDiff >= 0 && daysDiff <= 30;
                              } catch {
                                return false;
                              }
                            };
                            const isUrgent = checkExpiresSoon(doc.expirationDate);

                            const formatSimpleDate = (expiryStr: string | undefined) => {
                              if (!expiryStr) return '—';
                              const match = expiryStr.match(/(\d{4})-(\d{2})-(\d{2})/);
                              if (match) {
                                const [_, year, month, day] = match;
                                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const monthIndex = parseInt(month, 10) - 1;
                                if (monthIndex >= 0 && monthIndex < 12) {
                                  return `${months[monthIndex]} ${parseInt(day, 10)}, ${year}`;
                                }
                              }
                              try {
                                const d = new Date(expiryStr);
                                if (!isNaN(d.getTime())) {
                                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                                }
                              } catch {}
                              return expiryStr;
                            };

                            return (
                              <tr key={doc.id} style={{ height: '60px' }}>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px', fontWeight: '600', maxWidth: '240px' }}>
                                  <div 
                                    title={doc.title} 
                                    style={{ 
                                      display: '-webkit-box', 
                                      WebkitLineClamp: 2, 
                                      WebkitBoxOrient: 'vertical', 
                                      overflow: 'hidden', 
                                      textOverflow: 'ellipsis', 
                                      lineHeight: '1.4',
                                      fontSize: '13px'
                                    }}
                                  >
                                    {doc.title}
                                  </div>
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                                  <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    v{doc.currentVersion}
                                  </span>
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px', color: '#94a3b8', fontSize: 13, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.originalFilename}>
                                  📄 {doc.originalFilename}
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                                  {doc.expirationDate ? (
                                    <span style={{ 
                                      fontSize: '13px', 
                                      color: isUrgent ? '#f87171' : '#cbd5e1', 
                                      fontWeight: isUrgent ? '600' : 'normal',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      📅 {formatSimpleDate(doc.expirationDate)}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: 13 }}>—</span>
                                  )}
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                                  <span className={`badge badge-${riskLevel.toLowerCase()}`}>
                                    {riskLevel}
                                  </span>
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                                  <span className="badge" style={{ 
                                    background: doc.approvalStatus === 'APPROVED' ? '#10b981' : doc.approvalStatus === 'REJECTED' ? '#ef4444' : doc.approvalStatus === 'ARCHIVED' ? '#64748b' : '#3b82f6', 
                                    color: '#ffffff', 
                                    border: doc.approvalStatus === 'APPROVED' ? '1px solid #059669' : doc.approvalStatus === 'REJECTED' ? '1px solid #dc2626' : doc.approvalStatus === 'ARCHIVED' ? '1px solid #475569' : '1px solid #2563eb',
                                    fontWeight: '600'
                                  }}>
                                    {doc.approvalStatus || 'PENDING_APPROVAL'}
                                  </span>
                                </td>
                                <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }} 
                                      onClick={() => navigate(`/contracts/${doc.id}`)}
                                    >
                                      Inspect
                                    </button>
                                    {isAdmin && (
                                      <button 
                                        className="btn btn-danger" 
                                        style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }} 
                                        onClick={() => handleDeleteContract(doc.id)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

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
                  disabled={isUploading}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Choose PDF Document</label>
                <div 
                  className="upload-zone"
                  onClick={() => !isUploading && document.getElementById('contract-file-input')?.click()}
                  style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                >
                  <div className="upload-zone-icon">📤</div>
                  <h3 style={{ fontSize: '15px', color: '#0F172A', margin: '0 0 6px' }}>
                    {uploadFile ? uploadFile.name : 'Select contract PDF file'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    {uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : 'Click to browse files or drop a PDF copy here'}
                  </p>
                  <input 
                    id="contract-file-input"
                    type="file" 
                    style={{ display: 'none' }}
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    disabled={isUploading}
                    required={!uploadFile}
                  />
                </div>
              </div>

              {isUploading && (
                <div className="upload-progress-container" style={{ marginBottom: '15px' }}>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <div className="progress-text">
                    <span>{uploadProgressText}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }} disabled={isUploading}>
                {isUploading ? 'Securely Uploading & Indexing...' : 'Start Vector Indexing'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: System Settings */}
        {currentPath === '/settings' && (
          isAdmin ? (
            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h1 className="main-title">⚙️ Workspace Settings</h1>
              <p className="sub-title">Configure legal AI inference models, risk sensitivities, expiration defaults, and integrations.</p>
              
              <form onSubmit={handleSaveSettings}>
                <div className="input-group">
                  <label className="input-label">Company / Tenant Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={tenantSettings.companyName} 
                    onChange={(e) => setTenantSettings(prev => ({ ...prev, companyName: e.target.value }))}
                    required 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Company Domain</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. company.com"
                    value={tenantSettings.domain || ''} 
                    onChange={(e) => setTenantSettings(prev => ({ ...prev, domain: e.target.value }))}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">AI Review Model</label>
                  <select 
                    className="input-field"
                    value={tenantSettings.aiModel}
                    onChange={(e) => setTenantSettings(prev => ({ ...prev, aiModel: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)' }}
                  >
                    <option value="llama3">Llama 3 (Local Ollama Node)</option>
                    <option value="mistral">Mistral 7B (Local / Cloud)</option>
                    <option value="gpt-4o">GPT-4o (OpenAI Cloud API)</option>
                    <option value="claude-3.5">Claude 3.5 Sonnet (Anthropic API)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ marginBottom: 8 }}>Risk Sensitivity Threshold</label>
                  <div style={{ display: 'flex', gap: 20, marginTop: 5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="riskSensitivity" 
                        value="HIGH" 
                        checked={tenantSettings.riskSensitivity === 'HIGH'} 
                        onChange={() => setTenantSettings(prev => ({ ...prev, riskSensitivity: 'HIGH' }))}
                      />
                      Conservative / High Sensitivity
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="riskSensitivity" 
                        value="MEDIUM" 
                        checked={tenantSettings.riskSensitivity === 'MEDIUM'} 
                        onChange={() => setTenantSettings(prev => ({ ...prev, riskSensitivity: 'MEDIUM' }))}
                      />
                      Balanced
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="riskSensitivity" 
                        value="LOW" 
                        checked={tenantSettings.riskSensitivity === 'LOW'} 
                        onChange={() => setTenantSettings(prev => ({ ...prev, riskSensitivity: 'LOW' }))}
                      />
                      Lenient
                    </label>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Vendor Magic Link Expiration (Days)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    min="1" 
                    max="90"
                    value={tenantSettings.magicLinkExpiryDays} 
                    onChange={(e) => setTenantSettings(prev => ({ ...prev, magicLinkExpiryDays: parseInt(e.target.value) || 7 }))}
                    required 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Teams / Slack Notification Webhook URL (Optional)</label>
                  <input 
                    type="url" 
                    className="input-field" 
                    placeholder="https://hooks.slack.com/services/..."
                    value={tenantSettings.webhookUrl || ''} 
                    onChange={(e) => setTenantSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn" 
                  style={{ width: '100%', marginTop: 15 }} 
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? 'Saving Settings...' : 'Save Workspace Settings'}
                </button>
              </form>
            </div>
          ) : (
            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h1 className="main-title">⚙️ Workspace Settings (Read‑Only)</h1>
              <p className="sub-title">Company policy and environment summary.</p>
              <div className="input-group">
                <label className="input-label">Company / Tenant Name</label>
                <input type="text" className="input-field" value={tenantSettings.companyName} disabled />
              </div>
              <div className="input-group">
                <label className="input-label">Company Domain</label>
                <input type="text" className="input-field" value={tenantSettings.domain || ''} disabled />
              </div>
              <div className="input-group">
                <label className="input-label">AI Review Model</label>
                <input type="text" className="input-field" value={tenantSettings.aiModel} disabled />
              </div>
              <div className="input-group">
                <label className="input-label">Risk Sensitivity Threshold</label>
                <input type="text" className="input-field" value={tenantSettings.riskSensitivity} disabled />
              </div>
              <div className="input-group">
                <label className="input-label">Vendor Magic Link Expiration (Days)</label>
                <input type="number" className="input-field" value={tenantSettings.magicLinkExpiryDays} disabled />
              </div>
              <div className="input-group">
                <label className="input-label">Teams / Slack Notification Webhook URL (Optional)</label>
                <input type="url" className="input-field" value={tenantSettings.webhookUrl || ''} disabled />
              </div>
              <div className="notice-badge" style={{ marginTop: '10px', color: '#f43f5e' }}>🔒 Workspace settings can only be modified by a Workspace Admin.</div>
            </div>
          )
        )}

        {/* Tab 5: User Management */}
        {currentPath === '/users' && isAdmin && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h1 className="main-title" style={{ margin: 0 }}>👥 Workspace User Management</h1>
                <p className="sub-title" style={{ margin: 0, marginTop: 4 }}>Manage user roles, workspace rosters, and team collaboration invitations.</p>
              </div>
              <button className="btn" onClick={() => setShowInviteModal(true)}>
                ➕ Invite Team Member
              </button>
            </div>

            <table className="custom-table" style={{ marginTop: 20 }}>
              <thead>
                <tr>
                  <th>Email Address</th>
                  <th>Workspace Access Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workspaceUsers.map(u => {
                  const roleName = u.roles.includes('ROLE_ADMIN') ? 'Workspace Admin' : 
                                   u.roles.includes('ROLE_LEGAL_REVIEWER') ? 'Legal Reviewer' : 'Employee';
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: '600' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.roles.includes('ROLE_ADMIN') ? 'badge-high' : u.roles.includes('ROLE_LEGAL_REVIEWER') ? 'badge-medium' : 'badge-low'}`}>
                          {roleName}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                          ✓ Active Member
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 6: Billing & Subscription */}
        {currentPath === '/billing' && isAdmin && (
          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="main-title">💳 Billing & Subscription Plan</h1>
            <p className="sub-title" style={{ marginBottom: 25 }}>Configure subscription tiers, usage quotas, and payment receipts.</p>

            <div className="metrics-grid" style={{ marginBottom: 30 }}>
              <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                <span className="metric-label" style={{ color: '#2563eb' }}>Active Plan Tier</span>
                <span className="metric-value" style={{ fontSize: 24, marginTop: 5, color: 'var(--text-primary)' }}>
                  {tenantSettings.subscriptionPlan === 'FREE' ? 'Free Starter' : tenantSettings.subscriptionPlan === 'PRO' ? 'Pro Plan' : 'Enterprise Plan'}
                </span>
                <span className="metric-trend" style={{ color: '#3b82f6' }}>✓ Active status</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Monthly Charge</span>
                <span className="metric-value" style={{ fontSize: 24, marginTop: 5, color: 'var(--text-primary)' }}>
                  {tenantSettings.subscriptionPlan === 'FREE' ? '$0.00' : tenantSettings.subscriptionPlan === 'PRO' ? '$149.00' : '$499.00'}
                </span>
                <span className="metric-trend">Simulated database billing</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Workspace Roster Limits</span>
                <span className="metric-value" style={{ fontSize: 24, marginTop: 5, color: 'var(--text-primary)' }}>
                  {workspaceUsers.length} {tenantSettings.subscriptionPlan === 'FREE' ? '/ 2' : tenantSettings.subscriptionPlan === 'PRO' ? '/ 20' : ''} seats
                </span>
                <span className="metric-trend">
                  {tenantSettings.subscriptionPlan === 'FREE' ? '2 users limit' : tenantSettings.subscriptionPlan === 'PRO' ? '20 users limit' : 'Unlimited users'}
                </span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, marginBottom: 30 }}>
              <h3 className="input-label" style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>Usage Metrics Quotas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Contract Document Storage Limit</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {contracts.length} {tenantSettings.subscriptionPlan === 'FREE' ? '/ 2' : tenantSettings.subscriptionPlan === 'PRO' ? '/ 100' : ''} agreements
                    </span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.05)', height: 6, borderRadius: 3 }}>
                    <div style={{ 
                      background: '#3b82f6', 
                      width: tenantSettings.subscriptionPlan === 'FREE' ? `${Math.min(100, (contracts.length / 2) * 100)}%` : tenantSettings.subscriptionPlan === 'PRO' ? `${Math.min(100, (contracts.length / 100) * 100)}%` : '1%', 
                      height: '100%', 
                      borderRadius: 3 
                    }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RAG Index Storage Size</span>
                    <span style={{ color: 'var(--text-muted)' }}>348 MB / 10 GB (3.48%)</span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.05)', height: 6, borderRadius: 3 }}>
                    <div style={{ background: '#10b981', width: '3.48%', height: '100%', borderRadius: 3 }}></div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="input-label" style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 15 }}>Upgrade Workspace subscriptionPlan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
              {/* Free Card */}
              <div className="metric-card" style={{ 
                textAlign: 'center', 
                border: tenantSettings.subscriptionPlan === 'FREE' ? '2px solid #10b981' : '1px solid var(--border-color)',
                background: tenantSettings.subscriptionPlan === 'FREE' ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '15px'
              }}>
                <div>
                  {tenantSettings.subscriptionPlan === 'FREE' && <div className="badge badge-low" style={{ alignSelf: 'center', marginBottom: 8, fontSize: 10 }}>Active Plan</div>}
                  <span className="metric-label" style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)' }}>Starter Free</span>
                  <span className="metric-value" style={{ fontSize: 20, margin: '8px 0', display: 'block', color: 'var(--text-primary)' }}>$0 / mo</span>
                  <span className="metric-trend" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max 2 contracts, 2 users. Basic summaries. No AI Chat.</span>
                </div>
                {tenantSettings.subscriptionPlan !== 'FREE' && (
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: 12, padding: '6px 12px', fontSize: 12 }} onClick={() => handleSelectPlan('FREE')}>
                    Downgrade
                  </button>
                )}
              </div>

              {/* Pro Card */}
              <div className="metric-card" style={{ 
                textAlign: 'center', 
                border: tenantSettings.subscriptionPlan === 'PRO' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                background: tenantSettings.subscriptionPlan === 'PRO' ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '15px'
              }}>
                <div>
                  {tenantSettings.subscriptionPlan === 'PRO' && <div className="badge badge-high" style={{ alignSelf: 'center', marginBottom: 8, fontSize: 10, background: '#3b82f6', borderColor: '#2563eb' }}>Active Plan</div>}
                  <span className="metric-label" style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)' }}>Legal Pro</span>
                  <span className="metric-value" style={{ fontSize: 20, margin: '8px 0', display: 'block', color: 'var(--text-primary)' }}>$149 / mo</span>
                  <span className="metric-trend" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max 100 contracts, 20 users. Advanced AI, AI Chat enabled.</span>
                </div>
                {tenantSettings.subscriptionPlan !== 'PRO' && (
                  <button className="btn" style={{ width: '100%', marginTop: 12, padding: '6px 12px', fontSize: 12, background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }} onClick={() => handleSelectPlan('PRO')}>
                    {tenantSettings.subscriptionPlan === 'FREE' ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>

              {/* Enterprise Card */}
              <div className="metric-card" style={{ 
                textAlign: 'center', 
                border: tenantSettings.subscriptionPlan === 'ENTERPRISE' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                background: tenantSettings.subscriptionPlan === 'ENTERPRISE' ? 'rgba(139, 92, 246, 0.02)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '15px'
              }}>
                <div>
                  {tenantSettings.subscriptionPlan === 'ENTERPRISE' && <div className="badge badge-high" style={{ alignSelf: 'center', marginBottom: 8, fontSize: 10, background: '#8b5cf6', borderColor: '#7c3aed' }}>Active Plan</div>}
                  <span className="metric-label" style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)' }}>Enterprise Pro</span>
                  <span className="metric-value" style={{ fontSize: 20, margin: '8px 0', display: 'block', color: 'var(--text-primary)' }}>$499 / mo</span>
                  <span className="metric-trend" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unlimited contracts & users. Full AI suite, priority support.</span>
                </div>
                {tenantSettings.subscriptionPlan !== 'ENTERPRISE' && (
                  <button className="btn" style={{ width: '100%', marginTop: 12, padding: '6px 12px', fontSize: 12, background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' }} onClick={() => handleSelectPlan('ENTERPRISE')}>
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Audit Logs */}
        {currentPath === '/audit' && isAdmin && (
          <div className="glass-card">
            <h1 className="main-title">📜 Workspace Audit History Logs</h1>
            <p className="sub-title" style={{ marginBottom: 20 }}>Trace actions, edits, versions, and security portal share operations.</p>

            <table className="custom-table">
              <thead>
                <tr>
                  <th>Audit Log Event Description</th>
                  <th>Action Timestamp</th>
                  <th>System Status</th>
                </tr>
              </thead>
              <tbody>
                {activities
                  .filter(act => {
                    if (!act.createdAt) return true;
                    const daysDiff = (new Date().getTime() - new Date(act.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                    if (tenantSettings.subscriptionPlan === 'FREE') {
                      return daysDiff <= 7;
                    }
                    if (tenantSettings.subscriptionPlan === 'PRO') {
                      return daysDiff <= 365;
                    }
                    return true; // ENTERPRISE
                  })
                  .map(act => (
                    <tr key={act.id}>
                      <td style={{ fontWeight: '600' }}>⚡ {act.description}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{act.timestamp}</td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                          SUCCESS
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
    </div>
  );
}

export default App;
