import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';

interface User {
  email: string;
  roles: string[];
}

interface TopNavbarProps {
  currentUser: User | null;
  tenantName: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  highRiskCount: number;
  navigate: (to: string) => void;
  handleLogout: () => void;
  onOpenUpload: () => void;
}

export function TopNavbar({
  currentUser,
  tenantName,
  searchQuery,
  setSearchQuery,
  highRiskCount,
  navigate,
  handleLogout,
  onOpenUpload
}: TopNavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const userEmail = currentUser?.email || 'user@contractiq.com';
  const displayEmail = userEmail.split('@')[0];
  const userInitials = displayEmail.substring(0, 2).toUpperCase();
  const isAdmin = currentUser?.roles.includes('ROLE_ADMIN') || false;
  const displayRole = isAdmin ? 'ADMIN' : currentUser?.roles.includes('ROLE_LEGAL_REVIEWER') ? 'LEGAL REVIEWER' : 'EMPLOYEE';

  return (
    <header className="top-navbar">
      {/* Far Left Logo */}
      <div className="navbar-brand-section" onClick={() => navigate('/dashboard')}>
        <span style={{ fontSize: 24 }}>🧠</span>
        <span className="navbar-brand-text">ContractIQ</span>
      </div>

      {/* Center Search Bar */}
      <div className="navbar-search-container">
        <span className="navbar-search-icon">🔍</span>
        <input
          type="text"
          className="navbar-search-input"
          placeholder="Search contracts by name, vendor, or keyword..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (window.location.pathname !== '/contracts') {
              navigate('/contracts');
            }
          }}
        />
      </div>

      {/* Right Side Actions & Profiles */}
      <div className="navbar-actions-section">
        {/* Quick Upload CTA */}
        <button 
          className="btn" 
          style={{ padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
          onClick={onOpenUpload}
        >
          ➕ Upload
        </button>

        {/* Notification Bell */}
        <button 
          className="navbar-icon-btn" 
          onClick={() => {
            setSearchQuery('HIGH');
            navigate('/contracts');
          }}
          title={`${highRiskCount} High-Risk Alert(s)`}
        >
          🔔
          {highRiskCount > 0 && (
            <span className="navbar-badge">{highRiskCount}</span>
          )}
        </button>

        {/* Workspace Pill */}
        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '6px 12px', fontSize: '12px', fontWeight: '500' }}>
          🏢 {tenantName || 'Workspace'}
        </span>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary" 
          style={{ 
            padding: '8px 12px', 
            fontSize: '13px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            transition: 'all 0.3s ease',
            height: '36px',
            boxSizing: 'border-box'
          }}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>

        {/* Profile Dropdown Container */}
        <div className="profile-dropdown-container">
          <div className="profile-dropdown-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="profile-dropdown-avatar">
              {userInitials}
            </div>
            <span className="profile-dropdown-email">{userEmail}</span>
            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>▼</span>
          </div>

          {dropdownOpen && (
            <div className="profile-dropdown-menu">
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', marginBottom: 4 }}>
                <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.08)', color: '#6d28d9', border: '1px solid rgba(139, 92, 246, 0.15)', display: 'block', textAlign: 'center', fontSize: 10 }}>
                  Role: {displayRole}
                </span>
              </div>
              <button 
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/settings');
                }}
              >
                ⚙️ Workspace Settings
              </button>
              <button 
                className="profile-dropdown-item"
                style={{ color: '#fb7185' }}
                onClick={() => {
                  setDropdownOpen(false);
                  handleLogout();
                }}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
