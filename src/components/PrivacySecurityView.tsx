import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Lock, EyeOff, UserCheck, CheckCircle2, 
  AlertTriangle, Key, Smartphone, FileText, User, Award, UploadCloud, 
  Server, HardDrive, Bell, Layers, Sliders, RefreshCw, Phone, Mail, 
  Clock, MapPin, Search, ChevronDown, ChevronUp, AlertCircle, Send, X,
  FileSpreadsheet, Shield, ExternalLink, HelpCircle, Check, Info,
  Sparkles, Zap
} from 'lucide-react';
import { motion } from 'motion/react';

export interface PrivacySecurityData {
  hero: {
    heading: string;
    subtitle: string;
    badgeText: string;
    trustCards: Array<{ id: string; title: string; description: string; icon: string }>;
  };
  mayRequest: {
    title: string;
    subtitle: string;
    importantNote: string;
    items: Array<{ id: string; name: string; examples: string; category: string; icon: string }>;
  };
  neverRequest: {
    title: string;
    warningHeading: string;
    largeWarning: string;
    redItems: string[];
  };
  dataProtection: {
    title: string;
    subtitle: string;
    measures: Array<{ id: string; title: string; description: string; icon: string }>;
  };
  dataUsage: {
    title: string;
    allowedPurposes: string[];
    neverSellStatement: string;
    neverShareStatement: string;
  };
  dataRetention: {
    title: string;
    description: string;
    customerRights: string;
    purgeOptionEnabled: boolean;
  };
  employeeControls: {
    title: string;
    rules: string[];
  };
  customerResponsibilities: {
    title: string;
    checklist: Array<{ id: string; title: string; description: string }>;
  };
  fraudTimeline: {
    title: string;
    subtitle: string;
    steps: Array<{ step: number; title: string; description: string }>;
  };
  securityContact: {
    title: string;
    securityEmail: string;
    supportEmail: string;
    customerCarePhone: string;
    emergencyHotline: string;
    businessHours: string;
    officeAddress: string;
  };
  legalCompliance: {
    title: string;
    statement: string;
  };
  faqs: Array<{ question: string; answer: string }>;
}

export default function PrivacySecurityView({ setView }: { setView?: (v: string) => void }) {
  const [data, setData] = useState<PrivacySecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Modals state
  const [showScamModal, setShowScamModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  // Scam report form
  const [scamName, setScamName] = useState('');
  const [scamEmail, setScamEmail] = useState('');
  const [scamPhone, setScamPhone] = useState('');
  const [scamImpersonator, setScamImpersonator] = useState('');
  const [scamChannel, setScamChannel] = useState('Phone Call');
  const [scamDetails, setScamDetails] = useState('');
  const [scamSubmitting, setScamSubmitting] = useState(false);
  const [scamSuccess, setScamSuccess] = useState('');

  // Data deletion form
  const [delName, setDelName] = useState('');
  const [delEmail, setDelEmail] = useState('');
  const [delPhone, setDelPhone] = useState('');
  const [delOrderId, setDelOrderId] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delSubmitting, setDelSubmitting] = useState(false);
  const [delSuccess, setDelSuccess] = useState('');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch('/api/privacy-security');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load Privacy & Security settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  const handleReportScam = async (e: React.FormEvent) => {
    e.preventDefault();
    setScamSubmitting(true);
    try {
      const res = await fetch('/api/security/report-scam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterName: scamName,
          reporterEmail: scamEmail,
          reporterPhone: scamPhone,
          impersonatorContact: scamImpersonator,
          channelUsed: scamChannel,
          scamDetails: scamDetails
        })
      });
      const resJson = await res.json();
      if (res.ok) {
        setScamSuccess('Report submitted successfully! Our Security Incident Team is investigating.');
        setTimeout(() => {
          setShowScamModal(false);
          setScamSuccess('');
          setScamName('');
          setScamEmail('');
          setScamPhone('');
          setScamImpersonator('');
          setScamDetails('');
        }, 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScamSubmitting(false);
    }
  };

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelSubmitting(true);
    try {
      const res = await fetch('/api/security/request-data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: delName,
          customerEmail: delEmail,
          customerPhone: delPhone,
          orderId: delOrderId,
          reason: delReason
        })
      });
      const resJson = await res.json();
      if (res.ok) {
        setDelSuccess(resJson.message);
        setTimeout(() => {
          setShowDeletionModal(false);
          setDelSuccess('');
          setDelName('');
          setDelEmail('');
          setDelPhone('');
          setDelOrderId('');
          setDelReason('');
        }, 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDelSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-xs text-slate-500 font-medium">
        <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
        <span>Loading Privacy & Security Center...</span>
      </div>
    );
  }

  if (!data) return null;

  // Render icon map helper
  const getIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'Lock': return <Lock className={className} />;
      case 'EyeOff': return <EyeOff className={className} />;
      case 'UserCheck': return <UserCheck className={className} />;
      case 'CheckCircle2': return <CheckCircle2 className={className} />;
      case 'User': return <User className={className} />;
      case 'FileText': return <FileText className={className} />;
      case 'Award': return <Award className={className} />;
      case 'Key': return <Key className={className} />;
      case 'Smartphone': return <Smartphone className={className} />;
      case 'UploadCloud': return <UploadCloud className={className} />;
      case 'Server': return <Server className={className} />;
      case 'HardDrive': return <HardDrive className={className} />;
      case 'Bell': return <Bell className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Sliders': return <Sliders className={className} />;
      case 'RefreshCw': return <RefreshCw className={className} />;
      default: return <ShieldCheck className={className} />;
    }
  };

  // Search filter
  const isMatch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div id="easydesk-privacy-view" className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      
      {/* 1. TOP TRUST ANNOUNCEMENT BAR */}
      <div className="bg-[#0B2545] text-white py-2.5 px-4 border-b border-blue-900/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-200">EasyDesk Trust Center — ISO 27001 Certified Security & DPDP Compliance</span>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search security guidelines (e.g., OTP, PIN, Purge)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 text-slate-100 placeholder:text-slate-400 pl-9 pr-3 py-1.5 rounded-xl text-xs border border-slate-700 focus:outline-none input-focus-glow transition"
            />
          </div>
        </div>
      </div>

      {/* 2. HERO SECTION (Matching AboutUs Gradient Banner & Pulse Badge) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white py-14 sm:py-16 border-b border-slate-200/60 mb-10">
        
        {/* Subtle Decorative Background Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden opacity-60">
          <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-4xl mx-auto text-center space-y-5"
          >
            <div className="inline-flex items-center gap-2 bg-blue-100/90 border border-blue-200/70 px-4 py-1.5 rounded-full text-xs font-black text-[#0F4C81] shadow-2xs pulse-badge">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{data.hero.badgeText}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              {data.hero.heading}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
              {data.hero.subtitle}
            </p>

            {/* Action CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => setShowScamModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover-scale-sm"
              >
                <ShieldAlert className="w-4 h-4" /> Report Fraud / Scam Attempt
              </button>
              <button 
                onClick={() => setShowDeletionModal(true)}
                className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-5 py-3 rounded-xl shadow-2xs transition-all flex items-center gap-2 cursor-pointer hover-scale-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#0F4C81]" /> Request Data Deletion / Purge
              </button>
            </div>

            {/* Trust Badges Bar */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-start">
              {data.hero.trustCards.map((tc) => (
                <div key={tc.id} className="bg-white border border-slate-200/80 p-4 rounded-2xl flex flex-col gap-2 shadow-2xs hover-lift hover-glow-blue transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-[#0F4C81] flex items-center justify-center shrink-0">
                    {getIcon(tc.icon, "w-4 h-4")}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-tight m-0">{tc.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 mb-0 leading-snug font-medium">{tc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-14">

        {/* SECTION 2: INFORMATION EASYDESK MAY REQUEST */}
        {isMatch(data.mayRequest.title + data.mayRequest.items.map(i => i.name + i.examples).join(' ')) && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 hover-lift hover-glow-blue transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <span className="badge-soft-primary rounded-full text-[10px] font-black uppercase tracking-wider px-3.5 py-1 inline-block">
                  Voluntary Data Collection
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 mb-0">
                  {data.mayRequest.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-0 font-normal">
                  {data.mayRequest.subtitle}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.mayRequest.items.map((item) => (
                <div key={item.id} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between hover-lift hover-glow-blue transition-all duration-300 group">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 text-[#0F4C81] flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                        {getIcon(item.icon, "w-4 h-4")}
                      </div>
                      <span className="bg-blue-50 text-[#0F4C81] border border-blue-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="text-xs font-black text-slate-900 m-0">{item.name}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 m-0 font-medium">
                      {item.examples}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Important Callout Note */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 font-medium leading-relaxed m-0">
                <strong className="font-bold text-amber-950">Important Notice: </strong>
                {data.mayRequest.importantNote}
              </p>
            </div>
          </div>
        )}

        {/* SECTION 3: INFORMATION EASYDESK WILL NEVER REQUEST (RED ALERT) */}
        {isMatch(data.neverRequest.title + data.neverRequest.redItems.join(' ')) && (
          <section className="bg-gradient-to-br from-[#7F1D1D] to-[#450A0A] text-white rounded-3xl border border-red-800/80 p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6 hover-lift transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-800/80 pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  {data.neverRequest.warningHeading}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white m-0">
                  {data.neverRequest.title}
                </h2>
              </div>
              <button
                onClick={() => setShowScamModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 hover-scale-sm"
              >
                <AlertTriangle className="w-4 h-4" /> Report Impersonator Now
              </button>
            </div>

            <p className="text-xs text-red-100 leading-relaxed m-0 font-medium">
              To protect your financial accounts from phishing and fraud, EasyDesk software and personnel will <strong className="text-white underline decoration-red-400">NEVER</strong> ask you for any of the following secret credentials:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {data.neverRequest.redItems.map((item, idx) => (
                <div key={idx} className="bg-red-900/40 border border-red-800/60 p-3 rounded-xl flex items-center gap-2 text-xs text-red-100 font-semibold hover-scale-sm transition-transform">
                  <span className="w-5 h-5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    ✕
                  </span>
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>

            {/* Warning Callout Banner */}
            <div className="bg-red-900/70 border border-red-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-white m-0">
                    {data.neverRequest.largeWarning}
                  </p>
                  <p className="text-[11px] text-red-200 mt-0.5 mb-0 font-normal">
                    Never share financial secrets on phone calls, WhatsApp, or email claiming to be from EasyDesk.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowScamModal(true)}
                className="bg-white hover:bg-slate-100 text-red-950 text-xs font-black px-4 py-2.5 rounded-xl shrink-0 transition-all hover-scale-sm cursor-pointer shadow-sm"
              >
                Report Scam Incident
              </button>
            </div>
          </section>
        )}

        {/* SECTION 4: HOW EASYDESK PROTECTS YOUR DATA */}
        {isMatch(data.dataProtection.title + data.dataProtection.measures.map(m => m.title + m.description).join(' ')) && (
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="badge-soft-primary rounded-full text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 inline-block">
                Security Infrastructure
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 m-0">
                {data.dataProtection.title}
              </h2>
              <p className="text-xs text-slate-500 m-0 font-normal">
                {data.dataProtection.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.dataProtection.measures.map((m) => (
                <div key={m.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 hover-lift hover-glow-blue transition-all duration-300 space-y-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center shadow-2xs">
                    {getIcon(m.icon, "w-5 h-5")}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 m-0">{m.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-0 leading-relaxed font-normal">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 5 & 6: DATA USAGE & DATA RETENTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Data Usage Policy */}
          {isMatch(data.dataUsage.title + data.dataUsage.allowedPurposes.join(' ')) && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 space-y-5 shadow-xs hover-lift hover-glow-blue transition-all duration-300">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">{data.dataUsage.title}</h3>
                  <p className="text-[10px] text-slate-400 m-0 font-medium">Strictly limited operational purposes</p>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-600 p-0 list-none m-0">
                {data.dataUsage.allowedPurposes.map((purpose, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{purpose}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 space-y-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  {data.dataUsage.neverSellStatement}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-bold text-blue-900 flex items-center gap-2 shadow-2xs">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                  {data.dataUsage.neverShareStatement}
                </div>
              </div>
            </div>
          )}

          {/* Data Retention & Rights */}
          {isMatch(data.dataRetention.title + data.dataRetention.description) && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 space-y-5 shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shadow-2xs">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 m-0">{data.dataRetention.title}</h3>
                    <p className="text-[10px] text-slate-400 m-0 font-medium">Time-bound storage & customer deletion rights</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 m-0 font-medium">
                  {data.dataRetention.description}
                </p>

                <p className="text-xs text-slate-600 leading-relaxed m-0 font-medium">
                  <strong className="text-slate-900 font-bold">Your Rights: </strong>
                  {data.dataRetention.customerRights}
                </p>
              </div>

              {data.dataRetention.purgeOptionEnabled && (
                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setShowDeletionModal(true)}
                    className="w-full bg-[#0F4C81] hover:bg-[#0b3b64] text-white btn-glow-primary text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer hover-scale-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-cyan-300" /> Request Data Deletion / Purge
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* SECTION 7: EMPLOYEE PRIVACY CONTROLS */}
        {isMatch(data.employeeControls.title + data.employeeControls.rules.join(' ')) && (
          <section className="bg-[#0B2545] text-white rounded-3xl p-6 sm:p-8 space-y-5 hover-lift transition-all duration-300 shadow-xl border border-blue-900/40">
            <div className="flex items-center gap-3 border-b border-blue-900/60 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-2xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white m-0">{data.employeeControls.title}</h3>
                <p className="text-xs text-slate-300 m-0 font-normal">Monitored desk officer access controls</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.employeeControls.rules.map((rule, idx) => (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex items-start gap-3 hover-scale-sm transition-transform">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-xs text-slate-200 leading-relaxed font-medium">{rule}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 8: CUSTOMER RESPONSIBILITIES */}
        {isMatch(data.customerResponsibilities.title + data.customerResponsibilities.checklist.map(c => c.title + c.description).join(' ')) && (
          <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6 hover-lift hover-glow-blue transition-all duration-300">
            <div className="border-b border-slate-100 pb-4">
              <span className="badge-soft-warning rounded-full text-[10px] font-black uppercase tracking-wider px-3.5 py-1 inline-block">
                Security Checklist
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 mb-0">
                {data.customerResponsibilities.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.customerResponsibilities.checklist.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2 hover-lift transition-all">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="text-xs font-black text-slate-900 m-0">{item.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-6 m-0 font-medium">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 9: FRAUD & SCAM AWARENESS TIMELINE */}
        {isMatch(data.fraudTimeline.title + data.fraudTimeline.steps.map(s => s.title + s.description).join(' ')) && (
          <section className="bg-gradient-to-br from-[#0F4C81] to-[#0B2545] text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl hover-lift transition-all duration-300 border border-blue-900/40">
            <div className="space-y-1">
              <span className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 inline-block">
                Scam Prevention Protocol
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white pt-2 m-0">
                {data.fraudTimeline.title}
              </h2>
              <p className="text-xs text-blue-100 m-0 font-normal">
                {data.fraudTimeline.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {data.fraudTimeline.steps.map((st) => (
                <div key={st.step} className="bg-white/10 backdrop-blur-sm border border-white/10 p-4 rounded-2xl space-y-2 hover-scale-sm transition-transform">
                  <div className="w-7 h-7 rounded-xl bg-red-500 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                    {st.step}
                  </div>
                  <h3 className="text-xs font-black text-white m-0">{st.title}</h3>
                  <p className="text-[11px] text-blue-100 leading-relaxed m-0 font-normal">{st.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 10 & 11: SECURITY CONTACT & LEGAL COMPLIANCE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Security Contact details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 space-y-5 shadow-xs hover-lift hover-glow-blue transition-all duration-300">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2 m-0">
                <Phone className="w-5 h-5 text-[#0F4C81]" />
                {data.securityContact.title}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Security Incident Email</span>
                  <p className="font-black text-slate-900 flex items-center gap-1.5 m-0">
                    <Mail className="w-3.5 h-3.5 text-[#0F4C81]" />
                    {data.securityContact.securityEmail}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">General Support</span>
                  <p className="font-black text-slate-900 flex items-center gap-1.5 m-0">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    {data.securityContact.supportEmail}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Customer Care Helpline</span>
                  <p className="font-black text-slate-900 flex items-center gap-1.5 m-0">
                    <Phone className="w-3.5 h-3.5 text-[#0F4C81]" />
                    {data.securityContact.customerCarePhone}
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] text-red-600 font-extrabold uppercase block">Emergency Scam Line</span>
                  <p className="font-black text-red-900 flex items-center gap-1.5 m-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    {data.securityContact.emergencyHotline}
                  </p>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {data.securityContact.businessHours}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {data.securityContact.officeAddress}
                </span>
              </div>
            </div>
          </div>

          {/* Legal Compliance */}
          <div className="lg:col-span-1">
            <div className="bg-[#0B2545] text-white rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl border border-blue-900/40 flex flex-col justify-between hover-lift transition-all duration-300 h-full">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-2xs">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white m-0">{data.legalCompliance.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed m-0 font-normal">
                  {data.legalCompliance.statement}
                </p>
              </div>
              
              <div className="pt-4 border-t border-blue-900/60 text-[10px] text-slate-400 font-medium">
                Compliant with Digital Personal Data Protection (DPDP) Act 2023 & Information Technology Rules.
              </div>
            </div>
          </div>

        </div>

        {/* SECTION 12: SECURITY & PRIVACY FAQS ACCORDION */}
        {data.faqs && data.faqs.length > 0 && (
          <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6 hover-lift hover-glow-blue transition-all duration-300">
            <div className="text-center max-w-2xl mx-auto space-y-1">
              <span className="badge-soft-primary rounded-full text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 inline-block">
                Common Inquiries
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 pt-1 m-0">
                Security & Privacy FAQs
              </h2>
            </div>

            <div className="space-y-3 max-w-3xl mx-auto">
              {data.faqs.map((faq, idx) => (
                <div key={idx} className="border border-slate-200/80 rounded-2xl overflow-hidden transition-all shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-start p-4 bg-slate-50/70 hover:bg-blue-50/40 font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-3 transition cursor-pointer border-0"
                  >
                    <span>{faq.question}</span>
                    {openFaq === idx ? (
                      <ChevronUp className="w-4 h-4 text-[#0F4C81] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {openFaq === idx && (
                    <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 font-normal">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* REPORT SCAM MODAL */}
      {showScamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-black text-slate-900 text-sm">Report Impersonator / Scam Attempt</h3>
              </div>
              <button onClick={() => setShowScamModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {scamSuccess ? (
              <div className="p-5 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold text-center space-y-2 shadow-2xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="m-0">{scamSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleReportScam} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Your Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={scamName} 
                    onChange={e => setScamName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Your Email *</label>
                    <input 
                      type="email" 
                      required 
                      value={scamEmail} 
                      onChange={e => setScamEmail(e.target.value)}
                      placeholder="rahul@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Your Phone</label>
                    <input 
                      type="text" 
                      value={scamPhone} 
                      onChange={e => setScamPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Caller Phone / Email ID *</label>
                    <input 
                      type="text" 
                      required
                      value={scamImpersonator} 
                      onChange={e => setScamImpersonator(e.target.value)}
                      placeholder="e.g. +91 9123456789"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Channel Used</label>
                    <select 
                      value={scamChannel} 
                      onChange={e => setScamChannel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    >
                      <option value="Phone Call">Phone Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="SMS">SMS</option>
                      <option value="Email">Email</option>
                      <option value="Telegram / Social">Telegram / Social</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">What did they ask for? *</label>
                  <textarea 
                    rows={3} 
                    required
                    value={scamDetails} 
                    onChange={e => setScamDetails(e.target.value)}
                    placeholder="They claimed to be an EasyDesk desk officer and asked for my Bank OTP / UPI PIN..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowScamModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={scamSubmitting}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover-scale-sm disabled:opacity-50"
                  >
                    {scamSubmitting ? 'Submitting...' : 'Submit Fraud Alert'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DATA DELETION MODAL */}
      {showDeletionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="w-5 h-5 text-[#0F4C81]" />
                <h3 className="font-black text-slate-900 text-sm">Request Account Data Purge / Deletion</h3>
              </div>
              <button onClick={() => setShowDeletionModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {delSuccess ? (
              <div className="p-5 bg-blue-50 text-blue-900 rounded-2xl text-xs font-bold text-center space-y-2 shadow-2xs">
                <CheckCircle2 className="w-8 h-8 text-[#0F4C81] mx-auto" />
                <p className="m-0">{delSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleRequestDeletion} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Customer Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={delName} 
                    onChange={e => setDelName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Email Address *</label>
                    <input 
                      type="email" 
                      required 
                      value={delEmail} 
                      onChange={e => setDelEmail(e.target.value)}
                      placeholder="registered@email.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Mobile Number</label>
                    <input 
                      type="text" 
                      value={delPhone} 
                      onChange={e => setDelPhone(e.target.value)}
                      placeholder="Registered mobile"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Order ID (Optional)</label>
                  <input 
                    type="text" 
                    value={delOrderId} 
                    onChange={e => setDelOrderId(e.target.value)}
                    placeholder="e.g. ORD-10024 or All Completed Orders"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Reason for Purge Request</label>
                  <textarea 
                    rows={2} 
                    value={delReason} 
                    onChange={e => setDelReason(e.target.value)}
                    placeholder="Order completed, requesting permanent document wipe..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white input-focus-glow outline-none font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowDeletionModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={delSubmitting}
                    className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white btn-glow-primary font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm hover-scale-sm disabled:opacity-50"
                  >
                    {delSubmitting ? 'Submitting...' : 'Submit Purge Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
