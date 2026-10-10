/* Section content, shared by the docking panel and the simple view so both always show the same thing. */

import type { CSSProperties, ReactNode } from "react";
import type { Portfolio, Project } from "@/data/portfolio";
import ExperienceClip from "./ExperienceClip";
import ProjectPreview from "./ProjectPreview";

export const isReal = (url?: string) => !!url && url !== "#";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const DownloadIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>
);
export const MailIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
);

const ExternalIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5" /></svg>
);

const SERVICE_ICONS = {
  web: <><rect x="3" y="4" width="18" height="14" rx="2.5" /><path d="M3 9h18M8 21h8" /></>,
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  ai: <><circle cx="6" cy="7" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="12" cy="17.5" r="2.3" /><path d="M8.2 7h7.6M7.2 9l3.6 6.5M16.8 9l-3.6 6.5" /></>,
  cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18.5z" />
} as const;

/** "What I do": four cards with gently floating icons. */
export function Services({ data }: { data: Portfolio }) {
  return (
    <ul className="services">
      {data.services.map(s => (
        <li className="service" key={s.title}>
          <span className="service-ico"><svg className="ico" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>{SERVICE_ICONS[s.icon]}</svg></span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** Day / night switch: the sun spins away and a crescent moon swings in. */
export function ThemeToggle({ night, onToggle, cls = "btn sm" }: { night: boolean; onToggle: () => void; cls?: string }) {
  return (
    <button className={`${cls} theme-toggle`} type="button" aria-pressed={night} aria-label={night ? "Switch to day" : "Switch to night"} onClick={onToggle}>
      <span className="tt" aria-hidden="true"><i className="tt-sun" /><i className="tt-moon" /></span>
      <span className="lbl">{night ? "Night" : "Day"}</span>
    </button>
  );
}

/** A link button. Links still set to "#" render as a clearly marked placeholder. */
export function LinkBtn({ url, children, cls = "btn sm", download = false }: { url: string; children: ReactNode; cls?: string; download?: boolean }) {
  if (!isReal(url)) {
    return <span className={`${cls} is-placeholder`} title="Link not added yet">{children} <small>soon</small></span>;
  }
  return download
    ? <a className={cls} href={url} download>{children}</a>
    : <a className={cls} href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function ResumeBtn({ data, cls = "btn sm" }: { data: Portfolio; cls?: string }) {
  return <LinkBtn url={data.resumeUrl} cls={cls} download><DownloadIcon /><span className="lbl">Résumé</span></LinkBtn>;
}

/** Tags pop in one after another (the --i variable staggers the CSS animation). */
export function Chips({ items, strong = false }: { items: string[]; strong?: boolean }) {
  return (
    <ul className="chips">
      {items.map((s, i) => <li key={s} className={strong ? "chip strong" : "chip"} style={{ "--i": i } as CSSProperties}>{s}</li>)}
    </ul>
  );
}

export function Stats({ data }: { data: Portfolio }) {
  return (
    <ul className="stats">
      {data.highlights.map(h => <li key={h.label}><b>{h.value}</b><span>{h.label}</span></li>)}
    </ul>
  );
}

export function Background({ data }: { data: Portfolio }) {
  return (
    <>
      <h3>Education</h3>
      {data.education.map(e => (
        <p className="facts" key={e.degree}>
          <b>{e.degree}</b>
          <span>{e.school}</span>
          <span className="mono">{e.period}{e.note ? ` · ${e.note}` : ""}</span>
        </p>
      ))}
      <h3>Certifications and awards</h3>
      <ul className="ticks">{data.certifications.map(c => <li key={c}>{c}</li>)}</ul>
    </>
  );
}

export function Timeline({ data, reveal = false }: { data: Portfolio; reveal?: boolean }) {
  return (
    <ol className="timeline">
      {data.experience.map((j, i) => (
        <li key={j.company + j.period} className={[i === 0 ? "current" : "", reveal ? "reveal from-l" : ""].join(" ").trim() || undefined}>
          <span className="mono">{j.period}{j.location ? ` · ${j.location}` : ""}</span>
          <h3>{j.role}</h3>
          <p className="at">{j.company}</p>
          <ExperienceClip job={j} />
          <ul>{j.points.map(p => <li key={p}>{p}</li>)}</ul>
        </li>
      ))}
    </ol>
  );
}

export function ProjectCard({ p }: { p: Project }) {
  return (
    <article className="proj">
      {isReal(p.live)
        ? <a className="pv-link" href={p.live} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${p.name} website`}><ProjectPreview p={p} /></a>
        : <ProjectPreview p={p} />}
      <span className="mono">{p.when}</span>
      <h3>{p.name}</h3>
      <p>{p.desc}</p>
      <Chips items={p.stack} />
      <div className="link-row">
        {isReal(p.live)
          ? <LinkBtn url={p.live} cls="btn sm live-link">Visit live site <ExternalIcon /></LinkBtn>
          : <LinkBtn url={p.live}>Live site</LinkBtn>}
        <LinkBtn url={p.github}>GitHub</LinkBtn>
      </div>
    </article>
  );
}

export function Skills({ data }: { data: Portfolio }) {
  return (
    <>
      <h3>Strongest</h3>
      <Chips items={data.skills.strongest} strong />
      <h3>Also comfortable with</h3>
      <Chips items={data.skills.also} />
    </>
  );
}

export function ContactBlock({ data, onCopy }: { data: Portfolio; onCopy: () => void }) {
  const c = data.contact;
  return (
    <>
      <p>Email is the fastest way to reach me.</p>
      <div className="email-row">
        <a href={`mailto:${c.email}`}>{c.email}</a>
        <button className="btn sm primary" type="button" onClick={onCopy}>Copy</button>
      </div>
      {c.phone && (
        <div className="email-row">
          <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a>
        </div>
      )}
      <div className="link-row">
        {c.links.map(l => <LinkBtn key={l.label} url={l.url}>{l.label}</LinkBtn>)}
        <ResumeBtn data={data} />
      </div>
    </>
  );
}
