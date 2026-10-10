/* =====================================================================
   EDIT YOUR CONTENT HERE.
   Everything on the site (3D world, panels, simple view and the
   /api/portfolio endpoint) is built from this one object. You never need
   to touch the 3D code to change content.

   Any link set to "#" is shown as a dashed "soon" placeholder.
   ===================================================================== */

export interface Job {
  company: string;
  /** Label on the stepping stone in the 3D world. */
  short: string;
  role: string;
  period: string;
  location?: string;
  points: string[];
  /** Which looping animated clip to show for this role. */
  clip?: "agents" | "pos" | "tools" | "health" | "review";
  /** Optional real video (e.g. "/clips/qss.mp4" in the public folder). Replaces the animated clip. */
  video?: string;
}

export interface Service {
  icon: "web" | "mobile" | "ai" | "cloud";
  title: string;
  text: string;
}

export interface Project {
  name: string;
  /** Label on the lantern in the 3D world. */
  short: string;
  when: string;
  desc: string;
  stack: string[];
  live: string;
  github: string;
  /** Which illustrated mock-up to show on the project card. */
  preview?: "rtg" | "scrum" | "jarvis" | "cv" | "dam" | "game" | "company";
  /** Optional real screenshot (e.g. "/projects/rtg.png" in the public folder). Replaces the mock-up. */
  image?: string;
}

export interface Portfolio {
  name: string;
  title: string;
  location: string;
  availability: string;
  intro: string;
  resumeUrl: string;
  highlights: { value: string; label: string }[];
  services: Service[];
  experience: Job[];
  projects: Project[];
  skills: { strongest: string[]; also: string[] };
  education: { degree: string; school: string; period: string; note?: string }[];
  certifications: string[];
  contact: { email: string; phone: string; links: { label: string; url: string }[] };
}

export const portfolio: Portfolio = {
  name: "Shubham Sinha",
  title: "Senior Software Engineer · Full Stack & Agentic AI",
  location: "India",
  availability: "", // optional, e.g. "Open to remote roles". Left empty: not stated on the résumé.

  intro:
    "Full-stack engineer with 5 years of experience building production web and mobile apps with React, React Native, Next.js and Node.js. " +
    "Right now I build agentic AI systems with LangGraph and a multi-module financial platform at QSS Technosoft. " +
    "Before that I engineered the Rista POS platform at DotPe.",

  // Put your PDF at public/resume.pdf (or change the path here). Until the file exists the button shows as a placeholder.
  resumeUrl: "/resume.pdf",

  // Three headline numbers shown on About Island.
  highlights: [
    { value: "5", label: "years shipping production apps" },
    { value: "500+", label: "athletes on the RTG site" },
    { value: "2", label: "YES Awards for excellence" }
  ],

  // "What I do", shown on About Island and in the simple view.
  services: [
    { icon: "web", title: "Web apps", text: "React and Next.js front ends with Node.js, GraphQL and REST back ends." },
    { icon: "mobile", title: "Mobile apps", text: "React Native apps for Android and iOS, built to keep working offline." },
    { icon: "ai", title: "Agentic AI", text: "LangGraph agent workflows using Claude, OpenAI and local Ollama models." },
    { icon: "cloud", title: "Cloud and delivery", text: "AWS deployments with CI/CD pipelines on GitHub Actions." }
  ],

  // Newest first. The first entry is the glowing stone at the top of the staircase.
  experience: [
    {
      company: "QSS Technosoft Pvt. Ltd.",
      short: "QSS Technosoft",
      clip: "agents",
      role: "Senior Software Engineer",
      period: "Jun 2026 – Present",
      location: "India",
      points: [
        "Built AI Scrum Master on LangGraph: stateful agent graphs that automate sprint planning, stand-up summaries, backlog grooming and blocker tracking",
        "Orchestrated Claude Sonnet for reasoning-heavy steps and local Ollama models for private, low-cost inference",
        "Building StarPro, a financial platform with Marketing, Finance, Operations, People and Exit Planning tools for business owners and advisory firms",
        "Engineered the US firm tax and budgeting modules: tax workflows, budget and variance views, and decision dashboards"
      ]
    },
    {
      company: "NeoSoft · Client: DotPe (Rista POS)",
      short: "NeoSoft · DotPe",
      clip: "pos",
      role: "Senior Software Engineer",
      period: "Dec 2025 – Jun 2026",
      location: "India",
      points: [
        "6 cart lifecycle events tracked by a Cart Audit System built on Redux middleware in a TypeScript and React codebase",
        "Offline-first persistence with IndexedDB (Dexie.js) in an NW.js desktop app, plus an idempotent bulk event flush that prevents duplicates on retry",
        "Fixed multi-session Redux state bugs and wired frontend triggers across a Node.js monorepo",
        "Shipped React Native apps for Android and iOS with offline sync and performance tuning",
        "Ran AWS deployments (EC2, S3, CloudFront, Route 53, Lambda, CloudWatch) with CI/CD automation"
      ]
    },
    {
      company: "RWS Group (USA)",
      short: "RWS Group",
      clip: "tools",
      role: "Full Stack Developer",
      period: "Aug 2024 – Dec 2025",
      location: "Remote, India",
      points: [
        "4 production internal tools shipped end to end (UB Keep, UB Password Manager, UB Mail, UB Drive) with Next.js, Node.js and Tailwind CSS",
        "15+ REST APIs built for uploads, user management and version control",
        "Built a Digital Asset Management system on MERN and React Native with versioning, tagging, permissions and sharing",
        "Added JWT and bcrypt auth with role-based access control, with CI/CD on GitHub Actions"
      ]
    },
    {
      company: "Magneto Pvt. Ltd.",
      short: "Magneto",
      clip: "health",
      role: "Associate – Junior Full Stack Developer",
      period: "Aug 2022 – Aug 2024",
      location: "Bihar, India",
      points: [
        "Thousands of end users across India served by pharmacy management and customer engagement web apps",
        "2 YES Awards for excellence (FY23-24 and FY24-25) and positive feedback from 3 of 3 clients",
        "Built responsive UIs in React, React Native, Redux and Next.js, plus Node.js, Express and MongoDB APIs for auth, orders and inventory"
      ]
    },
    {
      company: "Programming Classes",
      short: "Programming Classes",
      clip: "review",
      role: "Full Stack Developer Intern",
      period: "Jan 2022 – Jun 2022",
      location: "Patna, Bihar",
      points: [
        "30% faster code reviews and 15% fewer production defects from an automated static-analysis review system for a 50-developer startup"
      ]
    }
  ],

  // Set live/github to real URLs when you have them.
  projects: [
    {
      name: "Ride Tea GupShup (RTG)",
      short: "RTG",
      preview: "rtg",
      when: "2026 · Freelance",
      desc: "Complete website for an endurance sports community (cycling, running, swimming, triathlon): 500+ athletes across 8+ Indian cities, with events, challenges and community pages.",
      stack: ["Next.js", "React", "PostgreSQL", "Supabase", "AWS"],
      live: "https://rideteagupshup.com/",
      github: "https://github.com/Shubham270617/ride-to-gupsup"
    },
    {
      name: "AI Scrum Master",
      short: "AI Scrum Master",
      preview: "scrum",
      when: "2026",
      desc: "Stateful multi-agent system that plans sprints, summarises stand-ups and flags blockers, combining cloud (Claude Sonnet) and local (Ollama) models.",
      stack: ["LangGraph", "Claude Sonnet", "Ollama", "Cursor AI"],
      live: "#",
      github: "#"
    },
    {
      name: "Jarvis 2.0 · AI Desktop Assistant",
      short: "Jarvis 2.0",
      preview: "jarvis",
      when: "Oct 2025",
      desc: "AI desktop assistant on the OpenAI API with natural-language task execution, real-time response streaming and a robotics-inspired UI.",
      stack: ["MERN", "React Native", "OpenAI API", "Next.js"],
      live: "https://aiclock.vercel.app",
      github: "https://github.com/Shubham270617/AI_Clock"
    },
    {
      name: "CV Builder · AI Résumé Generator",
      short: "CV Builder",
      preview: "cv",
      when: "Jul 2025",
      desc: "AI-powered résumé platform that uses prompt engineering for content suggestions. UI/UX designed and shipped independently.",
      stack: ["MERN", "OpenAI API", "MongoDB"],
      live: "https://cv-builder-eight-coral.vercel.app",
      github: "https://github.com/Shubham270617/cv_builder"
    },
    {
      name: "Spidy Gaming · Gaming Website",
      short: "Spidy Gaming",
      preview: "game",
      when: "Gaming landing site",
      desc: "Animated gaming website with GSAP-driven sections (hero, about, features, story, contact) plus login and sign-up pages.",
      stack: ["React", "GSAP", "Tailwind CSS", "React Router", "React Hook Form"],
      live: "https://gaming-website-eta-nine.vercel.app",
      github: "https://github.com/Shubham270617/gaming_website"
    },
    {
      name: "Fonetricks Website",
      short: "Fonetricks",
      preview: "company",
      when: "Company website",
      desc: "Company website for Fonetricks, which provides Unified Communication, Agentic AI and custom CRM/ERP solutions.",
      stack: ["React", "GSAP"],
      live: "https://fonetricks.com/",
      github: "https://github.com/ShivaniShirke1219/FonetricksWebsite"
    },
    {
      name: "Digital Asset Management System",
      short: "DAM System",
      preview: "dam",
      when: "Mar 2025",
      desc: "Full-stack DAM platform with Google OAuth and Cloudinary hosting, supporting asset versioning and team-wide sharing.",
      stack: ["MERN", "Redux", "Cloudinary", "Google Auth"],
      live: "#",
      github: "#"
    }
  ],

  // "strongest" tags are larger and glow on the Skills tree.
  skills: {
    strongest: ["React", "Next.js", "React Native", "Node.js", "TypeScript", "MongoDB"],
    also: [
      "PostgreSQL", "GraphQL", "AWS", "LangGraph", "Redux", "Tailwind CSS", "Express.js",
      "OpenAI API", "Claude Sonnet", "Ollama", "Supabase", "IndexedDB (Dexie.js)", "Prisma",
      "WebSockets", "JWT", "MySQL", "GitHub Actions", "CI/CD", "Docker (basics)", "GSAP",
      "Framer Motion", "Cypress", "Postman", "JMeter", "Figma", "C++", "SQL"
    ]
  },

  education: [
    { degree: "B.Sc. in Information Technology", school: "Sikkim Manipal University", period: "2017 – 2021", note: "7.87 / 10" }
  ],

  certifications: [
    "YES Award for Excellence, FY23-24 and FY24-25 (Magneto)",
    "Claude 101, Anthropic (2026)",
    "AI Fluency for Small Businesses, Anthropic & PayPal (2026)",
    "Certified Full Stack Developer (2021)",
    "Certified C & C++ Developer (2021)"
  ],

  contact: {
    email: "shub88510@gmail.com",
    phone: "+91-9199574670", // set to "" to keep your phone number off the public site
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/shubham-sinha-581790149" },
      { label: "GitHub", url: "https://github.com/Shubham270617" }
    ]
  }
};
