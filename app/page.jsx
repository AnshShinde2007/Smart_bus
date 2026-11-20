import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar" id="sidebar" aria-label="SmartBus navigation">
          <a className="brand" href="#home" aria-label="SmartBus home">
            <span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 23V10.5C7 8.6 8.6 7 10.5 7h11c1.9 0 3.5 1.6 3.5 3.5V23M7 18h18M11 23v2m10-2v2M10 12h12"/><circle cx="11" cy="22" r="1.4"/><circle cx="21" cy="22" r="1.4"/></svg></span>
            <span className="brand-name">smart<span>bus</span></span>
          </a>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav className="main-nav" aria-label="Main navigation">
            <button className="nav-link active" data-view="passenger"><span className="nav-icon">⌕</span><span>Explore trips</span><span className="nav-count">01</span></button>
            <button className="nav-link" data-view="tickets"><span className="nav-icon">▤</span><span>My tickets</span><span className="nav-count" id="ticket-count">00</span></button>
          </nav>
          <div className="sidebar-divider" />
          <div className="workspace-label">OPERATIONS</div>
          <nav className="main-nav" aria-label="Operations navigation">
            <button className="nav-link" data-view="driver"><span className="nav-icon">⌖</span><span>Driver panel</span></button>
            <button className="nav-link" data-view="admin"><span className="nav-icon">▦</span><span>Operator desk</span></button>
          </nav>
          <div className="sidebar-bottom">
            <div className="help-panel"><div className="help-icon">i</div><div><strong>Need a hand?</strong><span>We&apos;re here around the clock.</span></div><button aria-label="Contact support">↗</button></div>
            <div className="profile"><div className="avatar">SB</div><div className="profile-copy"><strong>Signed out</strong><span>SmartBus account</span></div><button className="more-button" id="logout" aria-label="Sign out">↗</button></div>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="topbar-leading"><button type="button" id="menu-toggle" className="menu-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar"><span /><span /><span /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong id="crumb-current">Explore trips</strong></div></div>
            <div className="topbar-actions"><span className="today-label" id="today-label" /><button className="icon-button notification-button" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></svg><i /></button><div className="avatar avatar-small">AR</div></div>
          </header>
          <section id="app-view" aria-live="polite" />
          <footer className="app-footer"><span>SMARTBUS <span className="footer-dot">•</span> CITY TRANSIT, MADE SIMPLE</span><span>Demo environment <i className="demo-pulse" /></span></footer>
        </main>
      </div>
      <button type="button" id="menu-overlay" className="menu-overlay" aria-label="Close navigation" tabIndex={-1} />
      <dialog id="booking-dialog" className="booking-dialog" aria-labelledby="dialog-title" />
      <div id="toast" className="toast" role="status" aria-live="polite" />
      <Script src="/smartbus.js" strategy="afterInteractive" />
      <Script src="/navigation.js" strategy="afterInteractive" />
    </>
  );
}
