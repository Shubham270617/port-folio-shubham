/* Where each island sits. Shared by the 3D world, the top nav and the live map. */

export type SectionId = "about" | "experience" | "projects" | "skills" | "contact";

export interface Section {
  id: SectionId;
  name: string;
  place: string;
  x: number;
  z: number;
  r: number;
}

/** Tour order, clockwise around the sea. */
export const SECTIONS: readonly Section[] = [
  { id: "about", name: "About", place: "About Island", x: 0, z: -50, r: 10 },
  { id: "experience", name: "Experience", place: "Experience Island", x: 54, z: -18, r: 11 },
  { id: "projects", name: "Projects", place: "Projects Bay", x: 46, z: 42, r: 8 },
  { id: "skills", name: "Skills", place: "Skills Island", x: -48, z: 36, r: 11 },
  { id: "contact", name: "Contact", place: "Contact Lighthouse", x: -52, z: -26, r: 8 }
];

export const sectionOf = (id: SectionId): Section => SECTIONS.find(s => s.id === id) as Section;

/** Map percent per world unit. */
export const MAP_SCALE = 36 / 76;

/** World position to map position, in percent of the map's size. */
export function toMapPct(x: number, z: number): [number, number] {
  let mx = x * MAP_SCALE, mz = z * MAP_SCALE;
  const m = Math.hypot(mx, mz), lim = 46;
  if (m > lim) { mx *= lim / m; mz *= lim / m; }
  return [50 + mx, 50 + mz];
}

/** Map position (percent) back to a world position. */
export function fromMapPct(px: number, py: number): [number, number] {
  return [(px - 50) / MAP_SCALE, (py - 50) / MAP_SCALE];
}
