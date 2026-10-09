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

const KINDS = { rtg: Rtg, scrum: Scrum, jarvis: Jarvis, cv: Cv, dam: Dam } as const;

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
