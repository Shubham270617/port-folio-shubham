/* Small animated UI mock-ups, one per project, drawn in CSS so they cost nothing to load.
   They are illustrations, not screenshots. To show the real thing, set `image` on the project
   in src/data/portfolio.ts (for example "/projects/rtg.png" in the public folder). */

import type { Project } from "@/data/portfolio";

function Rtg() {
  return (
    <div className="pv-body pv-rtg">
      <div className="pv-nav"><b>RTG</b><i /><i /><i /><span className="pv-cta">Join</span></div>
      <div className="pv-hero">
        <strong>Ride · Tea · GupShup</strong>
        <small>Cycling · Running · Swimming · Triathlon</small>
        <svg className="pv-route" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30 C 30 5, 55 38, 85 20 S 140 2, 200 22" />
        </svg>
        <span className="pv-rider" />
      </div>
      <div className="pv-stats">
        <span><b>500+</b>athletes</span><span><b>8+</b>cities</span><span><b>Events</b>&amp; challenges</span>
      </div>
    </div>
  );
}

function Scrum() {
  return (
    <div className="pv-body pv-scrum">
      <div className="pv-agent"><i />Stand-up summary ready</div>
      <div className="pv-cols">
        <div><small>To do</small><span /><span /><span className="pv-move" /></div>
        <div><small>Doing</small><span /><span /></div>
        <div><small>Done</small><span /><span /><span /></div>
      </div>
      <div className="pv-flag">Blocker flagged</div>
    </div>
  );
}

function Jarvis() {
  return (
    <div className="pv-body pv-jarvis">
      <div className="pv-orb"><i /><i /><i /></div>
      <div className="pv-chat">
        <span className="me">Summarise my inbox</span>
        <span className="ai">Streaming response<em><i /><i /><i /></em></span>
        <div className="pv-wave">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 70}ms` }} />)}</div>
      </div>
    </div>
  );
}

function Cv() {
  return (
    <div className="pv-body pv-cv">
      <div className="pv-form"><small>Experience</small><span /><span /><span className="short" /><div className="pv-ai">AI suggestion</div></div>
      <div className="pv-page">
        <b /><span className="w1" /><span className="w2" /><span className="w3" /><span className="w4" /><span className="w5" />
      </div>
    </div>
  );
}

function Dam() {
  return (
    <div className="pv-body pv-dam">
      <div className="pv-side"><i /><i /><i /><i /></div>
      <div className="pv-main">
        <div className="pv-upload"><i /></div>
        <div className="pv-grid">
          <span /><span /><span><em>v2</em></span><span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function Game() {
  return (
    <div className="pv-body pv-game">
      <div className="pv-nav"><b>SPIDY</b><i /><i /><span className="pv-cta">Login</span></div>
      <div className="pv-ghero">
        <i className="g1" /><i className="g2" />
        <strong>SPIDY GAMING</strong>
        <span className="pv-play" />
      </div>
      <div className="pv-bento"><span /><span /><span /></div>
    </div>
  );
}

function Company() {
  return (
    <div className="pv-body pv-co">
      <div className="pv-nav"><b>Fonetricks</b><i /><i /><i /><span className="pv-cta">Contact</span></div>
      <div className="pv-cohero">
        <strong>Unified Communication &amp; Agentic AI</strong>
        <svg viewBox="0 0 120 70" aria-hidden="true">
          <path d="M18 14 L60 36 M102 14 L60 36 M60 62 L60 36" fill="none" stroke="#2B2140" strokeWidth="1.6" strokeDasharray="4 4" className="cl-dash" />
          <circle r="3.4" fill="#FF5A3C" className="cl-travel" style={{ offsetPath: "path('M18 14 L60 36')", animationDuration: "2.4s" }} />
          <circle r="3.4" fill="#FF5A3C" className="cl-travel" style={{ offsetPath: "path('M102 14 L60 36')", animationDuration: "2.4s", animationDelay: ".8s" }} />
          <circle r="3.4" fill="#FF5A3C" className="cl-travel" style={{ offsetPath: "path('M60 62 L60 36')", animationDuration: "2.4s", animationDelay: "1.6s" }} />
          <circle cx="18" cy="14" r="9" fill="#FFF8EE" stroke="#2B2140" strokeWidth="1.6" />
          <circle cx="102" cy="14" r="9" fill="#FFF8EE" stroke="#2B2140" strokeWidth="1.6" />
          <circle cx="60" cy="62" r="7" fill="#FFF8EE" stroke="#2B2140" strokeWidth="1.6" />
          <g className="cl-pulse"><circle cx="60" cy="36" r="13" fill="#FFC93C" stroke="#2B2140" strokeWidth="1.8" /><text x="60" y="40" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2B2140">AI</text></g>
        </svg>
      </div>
      <div className="pv-stats">
        <span><b>VoIP</b>SIP · WebRTC</span><span><b>Contact</b>omnichannel</span><span><b>CRM / ERP</b>custom</span>
      </div>
    </div>
  );
}

const KINDS = { rtg: Rtg, scrum: Scrum, jarvis: Jarvis, cv: Cv, dam: Dam, game: Game, company: Company } as const;

export default function ProjectPreview({ p }: { p: Project }) {
  const Body = p.preview ? KINDS[p.preview] : null;
  if (!p.image && !Body) return null;
  return (
    <figure className="pv">
      <div className="pv-bar" aria-hidden="true"><i /><i /><i /><span>{p.short}</span></div>
      {p.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="pv-img" src={p.image} alt={`Screenshot of ${p.name}`} loading="lazy" />
        : Body && <div role="img" aria-label={`Illustrated mock-up of the ${p.name} interface`}><Body /></div>}
      {!p.image && <figcaption>Illustration</figcaption>}
    </figure>
  );
}
