import React from 'react';

interface LandingPageProps {
  token: string | null;
  navigate: (to: string) => void;
  showToast: (msg: string) => void;
}

export function LandingPage({ token, navigate, showToast }: LandingPageProps) {
  const [emailInput, setEmailInput] = React.useState('');

  const handleQuickRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      localStorage.setItem('quickEmail', emailInput.trim());
      navigate('/register');
    }
  };

  return (
    <div className="bg-[#090D16] text-[#94A3B8] min-h-screen font-sans overflow-x-hidden selection:bg-[#8B5CF6]/30 selection:text-white">
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(240px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.4; }
        }
        .animate-scan {
          animation: scan 3.5s ease-in-out infinite;
        }
        .gradient-border {
          position: relative;
          background: rgba(15, 23, 42, 0.6);
          border-radius: 1rem;
        }
        .gradient-border::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 1rem;
          padding: 1px;
          background: linear-gradient(135deg, #6366F1, #8B5CF6, transparent);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#090D16]/80 border-b border-slate-800/80 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
              ContractIQ
            </span>
            <span className="bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#8B5CF6] text-[10px] px-2 py-0.5 rounded-full font-bold">AI v2.0</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-[#8B5CF6] transition-colors">Features</a>
            <a href="#workflow" className="hover:text-[#8B5CF6] transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-[#8B5CF6] transition-colors">Pricing</a>
            <a href="#security" className="hover:text-[#8B5CF6] transition-colors">Security</a>
          </nav>

          <div className="flex items-center gap-4">
            {token ? (
              <button 
                className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5046e5] hover:to-[#7c3aed] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-[#8B5CF6]/25 transition-all duration-300 transform hover:-translate-y-0.5"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <button 
                  className="text-slate-300 hover:text-white px-4 py-2 text-sm font-semibold transition-colors"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </button>
                <button 
                  className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5046e5] hover:to-[#7c3aed] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-[#8B5CF6]/20 transition-all duration-300 transform hover:-translate-y-0.5"
                  onClick={() => navigate('/register')}
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section: Deep Obsidian (#090D16) with radial purple gradient */}
      <section className="relative bg-[#090D16] overflow-hidden">
        {/* Radial Purple Glow Background Effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#8B5CF6]/5 blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-28 grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] px-3.5 py-1.5 rounded-full text-xs font-semibold w-fit">
              ✨ Next-Gen SaaS Legal Compliance Engine
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
              AI-Powered Contract Review & <span className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">Risk Analysis</span> Platform
            </h1>
            <p className="text-base lg:text-lg text-slate-400 leading-relaxed max-w-xl">
              Instantly upload legal agreements, extract critical expirations, surface compliance risk scores, and collaborate securely with external counterparties.
            </p>

            <form onSubmit={handleQuickRegister} className="flex flex-col sm:flex-row gap-3 mt-4 max-w-md">
              <input 
                type="email" 
                placeholder="Enter company email" 
                className="bg-slate-900/60 border border-slate-800 focus:border-[#8B5CF6] rounded-lg px-4 py-3.5 text-sm text-white focus:outline-none flex-grow shadow-inner transition-colors"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
              <button 
                type="submit" 
                className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5046e5] hover:to-[#7c3aed] text-white font-bold px-6 py-3.5 rounded-lg text-sm transition-all duration-300 shadow-lg shadow-[#8B5CF6]/20 hover:-translate-y-0.5 whitespace-nowrap"
              >
                Get Started Free
              </button>
            </form>
          </div>

          {/* Interactive Mockup Card */}
          <div className="relative mx-auto md:ml-auto w-full max-w-[440px] bg-slate-950/60 border border-slate-850 rounded-2xl p-6 shadow-2xl backdrop-blur-md overflow-hidden h-[340px]">
            {/* Glowing laser line scan */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent shadow-[0_0_15px_#8B5CF6] opacity-75 animate-scan z-10"></div>
            
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
              </div>
              <div className="text-xs text-slate-400 font-mono">vendor-agreement-v3.pdf</div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-850 p-3 rounded-xl">
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase">Active Evaluation</div>
                  <div className="text-sm font-bold text-white mt-0.5">SaaS Service Agreement</div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] px-2.5 py-1 rounded-full text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse"></span>
                  SCANNING
                </div>
              </div>

              <div className="space-y-2 text-[11px] text-slate-500 font-mono">
                <p className="bg-slate-950/40 p-2 rounded border border-slate-900/60">1. LICENSE GRANT. Counterparty hereby grants a non-exclusive, non-transferable perpetual license...</p>
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-2 rounded-lg text-xs">
                  ⚠️ <strong>IP Clause:</strong> Moderate risk. Broad IP coverage.
                </div>
                <p className="bg-slate-950/40 p-2 rounded border border-slate-900/60">2. LIMITATION OF LIABILITY. In no event shall either party's aggregate liability exceed 5x...</p>
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg text-xs">
                  🚨 <strong>Limitation of Liability:</strong> HIGH RISK (92/100).
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">Risk Assessment Index</span>
                <span className="text-sm font-black text-red-455">82% HIGH RISK</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Metrics Bar: High-contrast Dark Indigo (#1E1B4B) */}
      <section className="border-y border-[#6366F1]/10 bg-[#1E1B4B]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="text-[#8B5CF6]/80 text-sm font-semibold tracking-wider uppercase text-center lg:text-left lg:max-w-xs">
            Trusted by enterprise legal & procurement teams
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16 w-full lg:w-auto">
            <div className="flex flex-col items-center lg:items-start">
              <span className="text-3xl font-black text-white bg-gradient-to-r from-indigo-400 to-[#8B5CF6] bg-clip-text text-transparent">10x</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Faster Review Cycles</span>
            </div>
            <div className="flex flex-col items-center lg:items-start">
              <span className="text-3xl font-black text-white bg-gradient-to-r from-[#8B5CF6] to-emerald-400 bg-clip-text text-transparent">99.8%</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Risk Identification</span>
            </div>
            <div className="flex flex-col items-center lg:items-start col-span-2 md:col-span-1">
              <span className="text-3xl font-black text-white bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">$1.2M</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Average Dispute Savings</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features & AI Capabilities: Off-White / Light Gray background (#F8FAFC) with Dark slate text (#0F172A) */}
      <section id="features" className="bg-[#F8FAFC] py-24 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-4">Complete AI Contract Lifecycle Control</h2>
            <p className="text-slate-500 text-sm lg:text-base">Everything legal teams need to automate risk scoring, audit compliance, and close deals faster.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200/80 p-8 rounded-2xl hover:border-[#8B5CF6]/50 hover:shadow-lg transition-all duration-300 group">
              <span className="text-3xl">🤖</span>
              <h3 className="text-lg font-bold text-[#0F172A] mt-4 mb-2 group-hover:text-[#6366F1] transition-colors">Instant AI Clause Analysis</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Upload PDF agreements and run instant semantic risk checks against custom-tuned Ollama LLM models. Surface liabilities and mitigations instantly.
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-8 rounded-2xl hover:border-[#8B5CF6]/50 hover:shadow-lg transition-all duration-300 group">
              <span className="text-3xl">🛡️</span>
              <h3 className="text-lg font-bold text-[#0F172A] mt-4 mb-2 group-hover:text-[#6366F1] transition-colors">Tenant Isolation & Security</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Strict workspace data isolation ensures your vectors and contracts are entirely isolated by tenant key claims. Granular user roles block access for reviewers.
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-8 rounded-2xl hover:border-[#8B5CF6]/50 hover:shadow-lg transition-all duration-300 group">
              <span className="text-3xl">✉️</span>
              <h3 className="text-lg font-bold text-[#0F172A] mt-4 mb-2 group-hover:text-[#6366F1] transition-colors">Magic Link Vendor Collaboration</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Share secure passwordless links with vendors. Counterparties can reply to public comment threads and upload revised contract versions directly.
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-8 rounded-2xl hover:border-[#8B5CF6]/50 hover:shadow-lg transition-all duration-300 group">
              <span className="text-3xl">💬</span>
              <h3 className="text-lg font-bold text-[#0F172A] mt-4 mb-2 group-hover:text-[#6366F1] transition-colors">"Ask Me Anything" Chat</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Use a robust PGVector Similarity-Search context RAG system to chat with your agreement. Get direct citations and legal answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works & Workflow: Deep Slate background (#0F172A) with vibrant violet borders */}
      <section id="workflow" className="bg-[#0F172A] py-24 text-slate-100 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-white mb-4">Simplified Compliance Workflow</h2>
            <p className="text-slate-400 text-sm">Move from upload to signature in minutes instead of weeks.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 bg-slate-900/50 border border-[#8B5CF6]/20 rounded-xl relative group hover:border-[#8B5CF6]/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 flex items-center justify-center text-xl text-[#8B5CF6] font-bold mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-white mb-2">Upload Agreement</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Drag and drop your B2B contract PDF. ContractIQ registers metadata and extracts key timelines.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 bg-slate-900/50 border border-[#8B5CF6]/20 rounded-xl relative group hover:border-[#8B5CF6]/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-xl text-emerald-400 font-bold mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-white mb-2">AI Risk Audit</h3>
              <p className="text-xs text-slate-400 leading-relaxed">AI analyzes clauses, highlights vulnerabilities, and indexes text for instant assistant RAG queries.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 bg-slate-900/50 border border-[#8B5CF6]/20 rounded-xl relative group hover:border-[#8B5CF6]/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-xl text-indigo-400 font-bold mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-white mb-2">Vendor Alignment</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Share access via passwordless secure review. Align, reply, upload revisions, and close quickly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Section: Crisp White background (#FFFFFF) with slate borders (#E2E8F0) and Indigo CTAs */}
      <section id="pricing" className="bg-white py-24 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-4">Flexible SaaS Pricing Plans</h2>
            <p className="text-slate-500 text-sm">Choose the access tier tailored to your legal compliance team size.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-slate-50/50 border border-[#E2E8F0] p-8 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-1">Sandbox Starter</h3>
                <p className="text-xs text-slate-500">For individual legal specialists & tests</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-[#0F172A]">$0</span>
                  <span className="text-slate-500 text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600 border-t border-slate-200/80 pt-6">
                  <li className="flex items-center gap-2">✓ Up to 5 uploaded agreements</li>
                  <li className="flex items-center gap-2">✓ Basic AI clause evaluation</li>
                  <li className="flex items-center gap-2">✓ Single user seat access</li>
                  <li className="flex items-center gap-2">✓ Standard community support</li>
                </ul>
              </div>
              <button 
                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg text-sm mt-8 transition-colors"
                onClick={() => navigate('/register')}
              >
                Start Sandbox Free
              </button>
            </div>

            {/* Professional Plan */}
            <div className="bg-slate-50/80 border-2 border-[#6366F1] p-8 rounded-2xl flex flex-col justify-between relative shadow-lg">
              <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-[#6366F1] text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-1">Professional Reviewer</h3>
                <p className="text-xs text-slate-500">For mid-market legal & business operations</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-[#0F172A]">$149</span>
                  <span className="text-slate-500 text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600 border-t border-slate-200/80 pt-6">
                  <li className="flex items-center gap-2 text-[#6366F1]">✓ Up to 50 active contracts</li>
                  <li className="flex items-center gap-2">✓ 5 collaborator seats</li>
                  <li className="flex items-center gap-2">✓ Full AI Risk Analysis & scores</li>
                  <li className="flex items-center gap-2">✓ Secure passwordless vendor portals</li>
                  <li className="flex items-center gap-2">✓ "Ask AI" chat assistant access</li>
                </ul>
              </div>
              <button 
                className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5046e5] hover:to-[#7c3aed] text-white font-bold py-3 px-4 rounded-lg text-sm mt-8 shadow-lg shadow-[#6366F1]/20 transition-all duration-300"
                onClick={() => navigate('/register')}
              >
                Go Professional
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-slate-50/50 border border-[#E2E8F0] p-8 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-1">Enterprise Elite</h3>
                <p className="text-xs text-slate-500">For large procurement & compliance divisions</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-[#0F172A]">$499</span>
                  <span className="text-slate-500 text-sm"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-600 border-t border-slate-200/80 pt-6">
                  <li className="flex items-center gap-2">✓ Unlimited uploaded agreements</li>
                  <li className="flex items-center gap-2">✓ Uncapped seats & review versions</li>
                  <li className="flex items-center gap-2">✓ Isolated vector indexing SLA</li>
                  <li className="flex items-center gap-2">✓ Custom AI prompts tuning</li>
                  <li className="flex items-center gap-2">✓ 24/7 dedicated account manager</li>
                </ul>
              </div>
              <button 
                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg text-sm mt-8 transition-colors"
                onClick={() => navigate('/register')}
              >
                Contact Enterprise Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Shield Callout: Deep Obsidian (#090D16) */}
      <section id="security" className="bg-[#090D16] py-20 text-center border-t border-slate-900">
        <div className="max-w-2xl mx-auto px-6 flex flex-col items-center gap-4">
          <span className="text-4xl">🛡️</span>
          <h3 className="text-xl font-bold text-white">Military-Grade Multi-Tenant Isolation</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            ContractIQ guarantees strict multi-tenant isolation. No private data is ever shared across organizations, and metadata/vector storage are strictly mapped via tenant credentials.
          </p>
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-full border border-slate-850 text-[11px] text-[#8B5CF6] font-mono mt-2">
            🛡️ SOC-2 TYPE II COMPLIANCE ASSURED • SSL ENCRYPTED
          </div>
        </div>
      </section>

      {/* Footer: Deep Obsidian (#090D16) */}
      <footer className="border-t border-slate-900 py-12 bg-[#090D16]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
              ContractIQ
            </span>
            <span className="text-xs text-slate-500 font-mono">© 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300">Terms of Service</a>
            <a href="#" className="hover:text-slate-300">Compliance & Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
