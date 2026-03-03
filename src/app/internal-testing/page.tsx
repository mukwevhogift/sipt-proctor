'use client';

import { useState, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════
// Google Play Console – "Create Internal Testing Release" page
// Pure UI/visual implementation matching the design spec pixel-perfect.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────────
interface UploadedFile {
  name: string;
  hasError: boolean;
  errorMessages: string[];
}

// ─── Sidebar menu structure ─────────────────────────────────────────
interface MenuItem {
  label: string;
  icon?: string;
  active?: boolean;
  expanded?: boolean;
  indent?: number;
  children?: MenuItem[];
}

const SIDEBAR_MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Statistics', icon: 'statistics' },
  { label: 'Publishing overview', icon: 'publishing' },
  {
    label: 'Test and release',
    icon: 'test',
    active: true,
    expanded: true,
    children: [
      { label: 'Latest releases and bundles' },
      { label: 'Production' },
      {
        label: 'Testing',
        expanded: true,
        children: [
          { label: 'Open testing' },
          { label: 'Closed testing' },
          { label: 'Internal testing', active: true },
        ],
      },
      { label: 'Pre-launch report', children: [{ label: '' }] },
      { label: 'Internal app sharing' },
    ],
  },
  { label: 'Pre-registration', icon: 'pre-reg' },
  { label: 'App integrity', icon: 'integrity' },
  { label: 'Advanced settings', icon: 'settings' },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function InternalTestingRelease() {
  // ─── Upload state ─────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
    {
      name: 'application-d7dc34ce-b19a-4c86-b5e6-79eb793f5e72.aab',
      hasError: true,
      errorMessages: [
        'Remove conflicts from the manifest before uploading. The following content provider authorities are in use by other developers: com.bookworm.app.FileSystemFileProvider, com.bookworm.app.ImagePickerFileProvider, com.bookworm.app.com.pairip.licensecheck.LicenseContentProvider, com.bookworm.app.androidx.startup, com.bookworm.app.cropper.fileprovider.',
        'You need to use a different package name because "com.bookworm.app" already exists in Google Play.',
      ],
    },
  ]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Drag & drop handlers (visual only) ───────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    // Visual-only: no actual file processing
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const hasErrors = uploadedFiles.some(f => f.hasError);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
      <div className="flex flex-col h-screen overflow-hidden">
        {/* ════════════════════ HEADER ════════════════════ */}
        <header className="h-16 min-h-[64px] bg-white border-b border-[#DADCE0] flex items-center justify-between px-4 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {/* Left */}
          <div className="flex items-center gap-4">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-[#F1F3F4] transition-colors"
            >
              <svg className="w-6 h-6 text-[#5F6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92z" fill="#4285F4" />
                <path d="M17.556 8.243l-3.764 3.757 3.764 3.757 4.245-2.377a1.004 1.004 0 000-1.76l-4.245-2.377z" fill="#FBBC04" />
                <path d="M3.609 22.186a.994.994 0 00.39.562l.006.003 9.787-5.994-3.764-3.757-6.419 9.186z" fill="#EA4335" />
                <path d="M13.792 12L3.609 1.814A.994.994 0 003.219 2.376l.006.003L13.012 8.373 9.248 12.13l-5.639 10.056z" fill="#34A853" />
              </svg>
              <span className="text-[18px] font-medium text-[#5F6368]">Google Play</span>
              <span className="text-[18px] font-normal text-[#5F6368]">Console</span>
            </div>

            {/* All apps button */}
            <button className="hidden sm:flex items-center gap-1.5 ml-4 px-3 py-1.5 rounded-full border border-[#DADCE0] text-[13px] font-medium text-[#3C4043] hover:bg-[#F1F3F4] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All apps
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-full hover:bg-[#F1F3F4] transition-colors border border-[#1A73E8] text-[#1A73E8]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-[11px] font-medium ml-1 hidden sm:inline">Notifications</span>
            </button>

            {/* App avatar */}
            <div className="flex items-center gap-2 ml-2 px-2 py-1 rounded-lg hover:bg-[#F1F3F4] cursor-pointer transition-colors">
              <div className="w-8 h-8 rounded bg-[#E8F0FE] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#5F6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25c0 .828.672 1.5 1.5 1.5z" />
                </svg>
              </div>
              <span className="text-[14px] font-medium text-[#3C4043] hidden md:inline">Bookworm</span>
              <svg className="w-4 h-4 text-[#5F6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
          </div>
        </header>

        {/* ════════════════════ BODY ════════════════════ */}
        <div className="flex flex-1 overflow-hidden">
          {/* ──────────── SIDEBAR ──────────── */}
          <aside
            className={`
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:translate-x-0
              fixed lg:static inset-y-16 left-0 z-40
              w-[280px] min-w-[280px] bg-[#F8F9FA] border-r border-[#DADCE0]
              overflow-y-auto transition-transform duration-200
            `}
          >
            <nav className="py-2">
              {SIDEBAR_MENU.map((item, i) => (
                <SidebarItem key={i} item={item} depth={0} />
              ))}
            </nav>
          </aside>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ──────────── MAIN CONTENT ──────────── */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-8 pb-32">
              {/* ─── Page title ─────────────────────────── */}
              <h1 className="text-[28px] font-medium text-[#202124] leading-tight">
                Create internal testing release
              </h1>
              <p className="text-[14px] text-[#5F6368] mt-1.5 mb-6">
                Internal testing releases are available to up to 100 testers that you choose
              </p>

              {/* ─── Progress steps ────────────────────── */}
              <div className="flex items-center gap-0 mb-8">
                {/* Step 1 (active) */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1A73E8] text-white text-[13px] font-medium flex items-center justify-center">
                    1
                  </div>
                  <span className="text-[14px] font-medium text-[#202124]">Create release</span>
                </div>
                {/* Connector */}
                <div className="w-12 h-[2px] bg-[#DADCE0] mx-3" />
                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full border-2 border-[#DADCE0] text-[#9AA0A6] text-[13px] font-medium flex items-center justify-center">
                    2
                  </div>
                  <span className="text-[14px] text-[#9AA0A6]">Preview and confirm</span>
                </div>
                {/* Discard draft link */}
                <div className="flex-1" />
                <button className="text-[14px] font-medium text-[#1A73E8] hover:text-[#185ABC] transition-colors">
                  Discard draft release
                </button>
              </div>

              {/* ─── App Integrity ──────────────────────── */}
              <section className="mb-8">
                <h2 className="text-[20px] font-medium text-[#202124] mb-3">App integrity</h2>
                <div className="flex items-center gap-6 mb-3">
                  {/* Green check 1 */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#34A853]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    <span className="text-[14px] text-[#202124]">Automatic protection is on</span>
                  </div>
                  <span className="text-[#DADCE0]">·</span>
                  {/* Green check 2 */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#34A853]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    <span className="text-[14px] text-[#202124]">Releases signed by Google Play</span>
                  </div>
                </div>
                <p className="text-[14px] text-[#5F6368] mb-3">
                  App integrity tools help you to ensure users experience your apps and games the way you intend
                </p>
                <div className="flex items-center gap-4">
                  <button className="text-[14px] font-medium text-[#1A73E8] hover:text-[#185ABC] transition-colors">
                    Manage integrity protection
                  </button>
                  <button className="text-[14px] font-medium text-[#1A73E8] hover:text-[#185ABC] transition-colors">
                    Change signing key
                  </button>
                </div>
              </section>

              {/* ─── App Bundles ────────────────────────── */}
              <section className="mb-8">
                <h2 className="text-[20px] font-medium text-[#202124] mb-4">App bundles</h2>

                {/* Upload dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative rounded-lg border-2 border-dashed transition-all duration-200
                    flex flex-col items-center justify-center
                    h-[240px] mb-3
                    ${isDragOver
                      ? 'border-[#1A73E8] bg-[#E8F0FE]/30'
                      : 'border-[#DADCE0] bg-white hover:border-[#1A73E8] hover:bg-[#F8F9FA]'
                    }
                  `}
                >
                  {/* Document stack icon */}
                  <div className="mb-3">
                    <svg className="w-16 h-16 text-[#9AA0A6]" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="14" y="8" width="36" height="48" rx="3" className="fill-[#F1F3F4] stroke-[#DADCE0]" />
                      <rect x="10" y="12" width="36" height="48" rx="3" className="fill-[#F8F9FA] stroke-[#DADCE0]" />
                      <path d="M20 28h16M20 34h12M20 40h14" stroke="#DADCE0" strokeWidth={2} strokeLinecap="round" />
                      <path d="M32 20l4-4h8a2 2 0 012 2v6" stroke="#DADCE0" strokeWidth={1.5} />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[#5F6368] mb-4">Drop app bundles here to upload</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-[#1A73E8] text-white text-[14px] font-medium rounded-[4px] hover:bg-[#185ABC] hover:shadow-md active:bg-[#1967D2] transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:ring-offset-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload
                    </button>
                    <button className="inline-flex items-center gap-2 px-5 py-2 border border-[#DADCE0] text-[#1A73E8] text-[14px] font-medium rounded-[4px] bg-white hover:bg-[#F8F9FA] hover:border-[#1A73E8] transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:ring-offset-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                      Add from library
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".aab"
                    className="hidden"
                    onChange={() => {/* visual only */}}
                  />
                </div>

                {/* Uploaded files */}
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="mb-4">
                    {/* File row */}
                    <div className={`flex items-center justify-between px-4 py-2.5 border rounded-t-lg ${file.hasError ? 'border-[#D93025]/30 bg-white' : 'border-[#DADCE0] bg-white'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.hasError && (
                          <svg className="w-5 h-5 text-[#D93025] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                          </svg>
                        )}
                        <span className="text-[13px] text-[#202124] truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#202124] transition-colors flex-shrink-0 ml-3"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* Error messages */}
                    {file.hasError && (
                      <div className="border border-t-0 border-[#D93025]/30 rounded-b-lg px-4 py-3 bg-white">
                        {file.errorMessages.map((msg, mi) => (
                          <p key={mi} className="text-[12px] leading-[1.5] text-[#D93025]">
                            {msg}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>

              {/* ─── Release Details (placeholder) ─────── */}
              <section>
                <h2 className="text-[20px] font-medium text-[#202124]">Release details</h2>
              </section>
            </div>

            {/* ──────────── BOTTOM ACTION BAR ──────────── */}
            <div className="fixed bottom-0 left-0 lg:left-[280px] right-0 bg-white border-t border-[#DADCE0] z-40">
              <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-3 flex items-center justify-end gap-3">
                <button className="px-4 py-2 text-[14px] font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] rounded-[4px] transition-all">
                  Discard changes
                </button>
                <button className="px-5 py-2 text-[14px] font-medium text-[#5F6368] border border-[#DADCE0] rounded-[4px] bg-[#F8F9FA] hover:bg-[#F1F3F4] hover:border-[#9AA0A6] transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:ring-offset-2">
                  Save as draft
                </button>
                <button
                  disabled={hasErrors}
                  className={`px-6 py-2 text-[14px] font-medium rounded-[4px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:ring-offset-2 ${
                    hasErrors
                      ? 'bg-[#9AA0A6] text-white cursor-not-allowed'
                      : 'bg-[#1A73E8] text-white hover:bg-[#185ABC] hover:shadow-md active:bg-[#1967D2]'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR ITEM COMPONENT (recursive)
// ═══════════════════════════════════════════════════════════════════
function SidebarItem({ item, depth }: { item: MenuItem; depth: number }) {
  const isTopLevel = depth === 0;
  const paddingLeft = isTopLevel ? 16 : 16 + depth * 16;

  // Icon for top-level items
  const renderIcon = () => {
    if (!isTopLevel) return null;
    const iconClass = 'w-5 h-5 flex-shrink-0';
    switch (item.icon) {
      case 'dashboard':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        );
      case 'statistics':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        );
      case 'publishing':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V7.875c0-.621.504-1.125 1.125-1.125H6.75" />
          </svg>
        );
      case 'test':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 5.003c.146.52-.235 1.047-.774 1.047H3.572c-.539 0-.92-.527-.774-1.047L4.2 15.3" />
          </svg>
        );
      case 'pre-reg':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        );
      case 'integrity':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0012 2.714z" />
          </svg>
        );
      case 'settings':
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return <div className="w-5" />;
    }
  };

  // Expand chevron for items with children
  const hasChildren = item.children && item.children.length > 0;
  const renderChevron = () => {
    if (!hasChildren) return null;
    return (
      <svg
        className={`w-4 h-4 text-[#5F6368] transition-transform ${item.expanded ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div>
      <div
        style={{ paddingLeft }}
        className={`
          flex items-center gap-3 pr-4 h-10 text-[14px] font-medium cursor-pointer transition-colors relative
          ${item.active && !hasChildren
            ? 'bg-[#E8F0FE] text-[#1A73E8]'
            : item.active && hasChildren
              ? 'bg-[#E8F0FE] text-[#1A73E8]'
              : 'text-[#3C4043] hover:bg-[#F1F3F4]'
          }
        `}
      >
        {/* Active indicator bar */}
        {item.active && !hasChildren && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1A73E8] rounded-r" />
        )}

        {renderIcon()}
        <span className="flex-1 truncate">{item.label}</span>
        {renderChevron()}
      </div>

      {/* Children */}
      {hasChildren && item.expanded && (
        <div>
          {item.children!.map((child, ci) => (
            <SidebarItem key={ci} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
