import React from 'react';
import './LatticeHero.css';

/**
 * Pixel-directed reproduction of the APPROVED Lattice Concept 3 hero.
 * Scoped CSS classes (lx3-*) avoid changing other site pages.
 *
 * INTEGRATION:
 *   1. Put lattice-icon.png and lattice-wordmark.png in Vite's /public folder.
 *   2. Import LatticeHero from './LatticeHero' and place it at the top of HomePage.
 *   3. Keep the existing stats and all sections below the hero unchanged.
 *
 * All right-side panels are illustrative previews — NOT live directory data.
 * Hero action links are live existing routes. Optional nav destinations are
 * visually present but are deliberately non-clickable until their routes are approved.
 */

type IconName = 'search'|'grid'|'filter'|'chevron'|'bookmark'|'share'|'back'|'check'|'arrow'|'calendar'|'users'|'tag'|'wrench'|'doc'|'bell'|'pin'|'leaf'|'menu'|'close';
const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  filter: <path d="M3 5h18l-7.5 8v5l-4 2v-7z"/>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
  share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
  back: <><path d="m12 4-8 8 8 8M4 12h17"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  arrow: <path d="M4 12h16m-7-7 7 7-7 7"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 3a6 6 0 0 1 3 5v2"/></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1"/></>,
  wrench: <path d="M21 7a6 6 0 0 1-8 5L6 19a3 3 0 0 1-4-4l7-7a6 6 0 0 1 8-8l-4 4 3 3z"/>,
  doc: <><path d="M6 2h9l5 5v15H6zM15 2v6h5M9 12h8M9 16h8"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10"/><path d="M10 21h4"/></>,
  pin: <><path d="M12 22s-8-8-8-13a8 8 0 1 1 16 0c0 5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></>,
  leaf: <><path d="M20 4C8 4 4 10 4 17c0 3 3 4 5 3 7-2 11-7 11-16Z"/><path d="M4 21c3-6 7-9 13-12"/></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18"/>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
};
function Icon({name,size=18,className=''}:{name:IconName,size?:number,className?:string}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const sampleRecords = [
  { name:'Georgia Food Bank Network', place:'Statewide', detail:'Food distribution, pantry support, and referrals to local nutrition programs.', symbol:'leaf', type:'Food & Nutrition' },
  { name:'Community Food Access Center',place:'Metro Atlanta',detail:'Emergency food, weekly pantry, and family nutrition resources.',symbol:'users',type:'Food & Nutrition' },
  { name:"Neighbor's Table",place:'Central Georgia',detail:'Meals, groceries, and wraparound support for individuals and families.',symbol:'tag',type:'Food & Nutrition' },
];

function DirectoryPanel(){
  return <div className="lx3-directory lx3-paper">
    <div className="lx3-panel-heading"><Icon name="grid" size={22}/><strong>Resource Directory</strong></div>
    <div className="lx3-search-row"><span className="lx3-mock-input"><Icon name="search" size={19}/><span>food assistance</span><Icon name="close" size={15}/></span><span className="lx3-mock-search">Search</span></div>
    <div className="lx3-result-count"><span>48 resources found for “food assistance”</span><small>Sort: Relevance⌄</small></div>
    <div className="lx3-results-content">
      <aside className="lx3-filters">
        <strong><Icon name="filter" size={12}/> Filter Results</strong>
        <h4>Service Area <span>⌃</span></h4>
        {['Statewide (6)','Metro Atlanta (18)','North Georgia (9)','Central Georgia (7)','Coastal Georgia (8)'].map((t,i)=><div key={t} className="lx3-checkline"><span className={'lx3-checkbox '+(i===1?'lx3-checked':'')}>{i===1?'✓':''}</span>{t}</div>)}
        <h4>Service Type <span>⌃</span></h4>
        {['Food & Nutrition','Housing & Stability','Health & Wellness','Family Support'].map((t,i)=><div key={t} className="lx3-checkline"><span className={'lx3-checkbox '+(i===0?'lx3-checked':'')}>{i===0?'✓':''}</span>{t}</div>)}
        <h4 className="lx3-population">Population Served <span>⌄</span></h4>
      </aside>
      <div className="lx3-results-list">
        {sampleRecords.map((r,i)=><div className="lx3-result-card" key={r.name}>
          <div className={'lx3-result-symbol lx3-result-symbol-'+i}><Icon name={r.symbol as IconName} size={24}/></div>
          <div className="lx3-result-text"><strong>{r.name}</strong><div>{r.type} <b>·</b> {r.place}</div><p>{r.detail}</p></div>
          <Icon name="bookmark" size={17} className="lx3-result-bookmark"/>
        </div>)}
      </div>
    </div>
  </div>;
}
function ProfilePanel(){
  return <div className="lx3-profile lx3-paper">
    <div className="lx3-profile-top"><span><Icon name="back" size={16}/> Back to results</span><span><Icon name="bookmark" size={20}/><Icon name="share" size={19}/></span></div>
    <div className="lx3-provider-head"><div className="lx3-provider-icon"><Icon name="leaf" size={43}/></div><div><h3>Georgia Food Bank Network</h3><div className="lx3-chips"><span>Food & Nutrition</span><span><Icon name="pin" size={13}/> Statewide</span></div></div></div>
    <p className="lx3-provider-description">Food distribution, pantry support, and referrals to local nutrition programs across Georgia.</p>
    <div className="lx3-tabs"><span className="lx3-active">Overview</span><span>Eligibility</span><span>Locations</span><span>Contact</span></div>
    <div className="lx3-profile-stats"><div><Icon name="calendar" size={25}/><span>Ongoing</span></div><div><Icon name="users" size={26}/><span>Individuals &amp; Families</span></div><div><Icon name="tag" size={26}/><span>No Cost</span></div></div>
    <div className="lx3-key-services"><strong>Key Services</strong>{['Food pantry and grocery distribution','SNAP application assistance','Referrals to additional support services'].map(s=><div key={s}><Icon name="check" size={18}/><span>{s}</span></div>)}</div>
  </div>;
}
function UpdatesPanel(){
  return <div className="lx3-updates lx3-paper">
    <div className="lx3-updates-heading"><Icon name="wrench" size={24}/><strong>Tools &amp; Updates</strong></div>
    <div className="lx3-update-row"><span><Icon name="calendar" size={20}/></span><div><strong>Funding Opportunity</strong><small>Community Food Access Grant (Due Mar 15)</small></div><span className="lx3-up-arrow">›</span></div>
    <div className="lx3-update-row"><span><Icon name="doc" size={20}/></span><div><strong>Eligibility Navigator</strong><small>Check program eligibility and next steps</small></div><span className="lx3-up-arrow">›</span></div>
    <div className="lx3-update-row"><span><Icon name="bell" size={20}/></span><div><strong>Network Update</strong><small>New food distribution sites added in 5 counties</small></div><span className="lx3-up-arrow">›</span></div>
  </div>;
}

export default function LatticeHero(){
  return <section className="lx3-root" aria-labelledby="lx3-hero-title">
    <header className="lx3-header">
      <a className="lx3-logo" href="/" aria-label="Lattice homepage"><img src="/lattice-icon.png" alt=""/><img src="/lattice-wordmark.png" alt="Lattice"/></a>
      <nav className="lx3-nav" aria-label="Primary navigation">
        <a href="/directory">Directory</a>
        <span title="Link target pending approval">Tools</span>
        <a href="/join">Membership</a>
        <span title="Link target pending approval">Resources</span>
        <span title="Link target pending approval">About</span>
      </nav>
      <div className="lx3-header-actions"><a href="/directory" className="lx3-icon-search" aria-label="Search the directory"><Icon name="search" size={25}/></a><a className="lx3-signin" href="/login">Sign In</a><a className="lx3-join" href="/join">Join Lattice</a></div>
    </header>
    <div className="lx3-stage lattice-hero">
      <img src="/images/lattice-hero-ribbon.webp" className="lattice-hero-ribbon" alt="" aria-hidden="true" />
      <div className="lattice-hero-content">
        <div className="lx3-hero-copy">
          <div className="lx3-eyebrow">Visibility · Access · Coordination · Capacity</div>
          <h1 id="lx3-hero-title">Access starts<br/>with <span>visibility.</span></h1>
          <p className="lx3-positioning">The coordination platform for Georgia’s community support network.</p>
          <p className="lx3-description">One place to discover resources, navigate eligibility, access practical tools, and strengthen connections among the organizations supporting individuals and families.</p>
          <div className="lx3-hero-buttons"><a href="/directory" className="lx3-primary">Explore the Directory <Icon name="arrow" size={22}/></a><a href="/join" className="lx3-secondary">Membership</a></div>
          <div className="lx3-attribution"><img src="/tse-icon.png" className="lx3-attr-icon" alt=""/><span className="lx3-attribution-rule"/><span className="lx3-attr-label">Powered by</span><img src="/tse-wordmark.png" className="lx3-attr-wordmark" alt="The Seed Exchange"/></div>
        </div>
        <div className="lx3-previews" aria-label="Illustrative preview of Lattice directory, resource profiles and tools">
          <div className="lx3-preview-layout" aria-hidden="true"><DirectoryPanel/><ProfilePanel/><UpdatesPanel/></div>
        </div>
      </div>
    </div>
  </section>;
}
