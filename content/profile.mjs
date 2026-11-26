/**
 * content/profile.mjs
 * ---------------------------------------------------------------------------
 * The single file to edit to keep the site up to date. The build script
 * (scripts/build.mjs) turns this into plain static HTML in dist/.
 *
 * Carried over from the original Next.js project (src/data/profile.ts).
 * Links that were placeholders there (YOUR_...) are left empty ("") here and
 * render as disabled buttons. Add the real URL and rebuild to make them live.
 * ---------------------------------------------------------------------------
 */

export const siteConfig = {
  name: "Shanuka B. Herath",
  shortName: "Shanuka Herath",
  initials: "SH",
  role: "Computer Science Graduate | Software & AI Developer",
  seoTitle: "Shanuka B. Herath | Computer Science Graduate & Software Developer",
  location: "Sri Lanka",
  email: "shanbhera@gmail.com",
  siteUrl: "https://shanukab.herath.dev",
  cvPath: "cv/shanuka-herath-cv.pdf",
  social: {
    github: "https://github.com/shanukabherath-solutions",
    linkedin: "https://www.linkedin.com/in/shanuka-b-herath/",
  },
  heroHeadline: "Shanuka B. Herath",
  heroSubhead:
    "I build modern web applications, AI-powered tools, and practical software solutions with a focus on usability, performance, and clean design.",
  metaDescription:
    "Portfolio of Shanuka B. Herath, a Computer Science Graduate focused on software development, AI-powered applications, web development, and cybersecurity.",
  keywords: [
    "Software Developer Sri Lanka",
    "AI Developer",
    "Web Developer",
    "React Developer",
    "FastAPI Developer",
    "Python Developer",
    "AI Web Application Developer",
  ],
};

export const about = {
  paragraphs: [
    "I have completed my BSc (Hons) in Computer Science at the University of Bedfordshire with a Second Class Upper Division, and I focus on building practical software solutions across web development, artificial intelligence, and cybersecurity.",
    "My projects include Photosphere, an AI-powered photo editing web application with Sinhala language support, and AESA, an AI-assisted security-focused engineering agent designed to inspect repositories, propose code changes, and apply automated security and code-quality checks.",
    "With a background in graphic design and hands-on experience with full-stack development, APIs, Docker, and security tooling, I aim to build software that is functional, secure, and thoughtfully designed.",
  ],
  interests: [
    "Software Development",
    "Artificial Intelligence",
    "Web Development",
    "Cybersecurity",
    "UI/UX",
    "API Development",
    "DevSecOps",
  ],
};

/** `icon` is a key from scripts/icons.mjs */
export const skillGroups = [
  { category: "Programming & Backend", icon: "code", blurb: "Core languages and backend work I use in my projects.", items: ["Python", "FastAPI", "REST APIs", "Swagger / OpenAPI"] },
  { category: "Frontend", icon: "globe", blurb: "Interfaces for the web apps I build.", items: ["React", "Next.js", "JavaScript", "TypeScript", "HTML and CSS"] },
  {
    category: "AI & AI-Assisted Development",
    icon: "brain",
    blurb: "Integrating AI services into working applications.",
    items: ["Gemini API integration", "AI-powered application development", "AI agent workflow design", "AI prompt processing", "Speech-to-text integration", "Image processing"],
  },
  {
    category: "Cybersecurity & DevSecOps",
    icon: "shield",
    blurb: "Fundamentals and security tooling I'm applying in projects and still learning.",
    items: ["Web security fundamentals", "Authentication", "Password hashing", "Encryption", "Burp Suite", "Bandit", "Gitleaks", "Trivy", "Secure coding practices", "Automated security testing", "Human approval workflows", "Security gates"],
  },
  { category: "Databases", icon: "database", blurb: "Where application data lives.", items: ["MongoDB", "MongoDB Atlas", "SQLite"] },
  { category: "DevOps & Tools", icon: "wrench", blurb: "Practical project experience; still building depth.", items: ["Docker", "Docker Compose", "Git", "GitHub", "CI/CD concepts", "pytest", "Ruff", "mypy", "VS Code"] },
];

export const featuredProject = {
  title: "Photosphere",
  tagline: "AI-based photo editing web app with Sinhala language support",
  description:
    "Photosphere is an AI-powered photo editing web application built to help Sinhala-speaking users edit images using Sinhala text prompts, Sinhala voice input, and icon-based controls — without needing to know English editing terminology.",
  features: [
    "Sinhala text prompts", "Sinhala voice input", "Complex Sinhala prompt processing", "Icon-based editing controls",
    "AI-assisted photo editing", "Background removal", "Color enhancement", "Sharpening", "Noise reduction", "Image upscaling",
    "Before/after preview", "Undo/redo editing history", "Responsive web interface", "User authentication",
    "Gallery / export functionality", "REST API backend", "Swagger / OpenAPI documentation",
  ],
  technologies: ["React", "FastAPI", "Python", "MongoDB", "Gemini API", "U\u00B2-Net", "AI image-processing services"],
  links: {
    github: { label: "GitHub", href: "https://github.com/shanukabherath-solutions/Photosphere" },
    liveDemo: { label: "Live Demo", href: "https://photosphere-iota.vercel.app/" },
    demoVideo: { label: "Demo Video", href: "https://vimeo.com/1248930571/c1f9e50684?share=copy&fl=sv&fe=ci" },
  },
  media: {
    before: "assets/img/photosphere-before.webp",
    after: "assets/img/photosphere-after.webp",
  },
  promptExample: {
    sinhala: "පසුබිම ඉවත් කර වර්ණ වැඩි දියුණු කරන්න",
    translation: "Remove the background and enhance the colours",
  },
  caseStudy: [
    { heading: "Problem", body: ["Most photo-editing tools use English-only menus and technical vocabulary. That's a real barrier for Sinhala-speaking users who are comfortable describing what they want in their own language but not in editing jargon."] },
    { heading: "Goal", body: ["Build a photo editor where a Sinhala-speaking user can describe an edit in their own words — typed or spoken — and have it applied correctly, while keeping a familiar icon-based toolbar for users who prefer direct manipulation."] },
    { heading: "Solution", body: ["A React frontend handles image upload, prompt input (text or voice), and the editing canvas, while a FastAPI backend interprets the prompt, routes it to the correct image-processing operation, and returns the result. User accounts, edit history, and exported images are stored in MongoDB."] },
    { heading: "Technical Architecture", body: ["The frontend communicates with the backend through a documented REST API (Swagger/OpenAPI). Editing operations — background removal, sharpening, noise reduction, upscaling, colour enhancement — are implemented as separate backend services so each can be tested and improved independently. Background removal uses U\u00B2-Net; other operations use standard image-processing techniques rather than a trained model, which is intentional — not every step in the pipeline is an AI model, and the project distinguishes between the two."] },
    { heading: "AI Integration", body: ["The Gemini API is used to interpret free-form Sinhala prompts and map them to one or more supported editing operations, including cases where a single sentence requests more than one change."] },
    { heading: "Sinhala Prompt Processing", body: ["Prompts can be typed directly in Sinhala or spoken and converted to text through speech-to-text before being sent to the interpretation step. This was one of the more time-consuming parts of the project, since everyday Sinhala phrasing for editing requests doesn't map neatly onto a fixed command list."] },
    { heading: "Complex Prompt Processing", body: ["Some prompts describe more than one edit at once (for example, brightening and sharpening in the same sentence). The backend breaks these down into an ordered sequence of operations rather than requiring one instruction per action."] },
    { heading: "Undo/Redo System", body: ["Every applied edit is stored as a step in a history stack tied to the user's session, so edits can be undone or redone without reprocessing the whole image from scratch."] },
    { heading: "Testing", body: ["Backend endpoints were tested individually through the Swagger UI during development, alongside manual end-to-end testing of the prompt-to-edit flow across the supported operations."] },
    { heading: "Results", body: ["Photosphere works as an end-to-end prototype: a user can sign in, upload a photo, describe an edit in Sinhala (typed or spoken) or use the icon toolbar, preview a before/after comparison, and export the result. No performance or accuracy figures are published here, as they haven't been formally benchmarked yet."] },
    { heading: "Future Improvements", body: ["Planned next steps include expanding the range of supported Sinhala phrasing, adding more editing operations, and running structured usability testing with Sinhala-speaking users."] },
  ],
};

export const aesaProject = {
  title: "AESA",
  fullName: "AI Execution Security Agent",
  categories: ["AI Agents", "Cybersecurity", "DevSecOps"],
  summary:
    "An AI-assisted engineering agent that inspects code, runs approved checks in a sandbox, and proposes fixes. It can never merge, push to a default branch, or deploy without explicit human approval.",
  description:
    "AESA explores how to give a coding agent least privilege: every action the model requests passes a default-deny policy engine, runs inside a locked-down Docker sandbox, and is recorded in an audit log, so the AI model is never the security boundary. It is a learning project and has not been independently audited.",
  featureGroups: [
    { group: "Controlled execution", items: ["Default-deny policy engine evaluated before every agent action", "Structured command registry and a hardened, network-less Docker sandbox", "Patches go to a Git proposal branch, never the default branch"] },
    { group: "Quality and security checks", items: ["pytest, Ruff and mypy checks on the exact proposed patch", "Bandit, Gitleaks and Trivy security scans", "A failing or missing check blocks approval"] },
    { group: "Oversight and workflow", items: ["Human approval for the patch, plus a separate approval for deployment", "Tamper-evident, hash-chained audit log", "CI/CD pipeline with GitHub Actions"] },
    { group: "Interface and platform", items: ["React and TypeScript dashboard for tasks, diffs, scan results and audit logs", "Argon2id password hashing, JWT authentication and role-based access control", "Provider-agnostic AI layer: OpenAI-compatible, Gemini or an offline rule-based provider"] },
  ],
  technologies: ["Python", "FastAPI", "React", "TypeScript", "Docker", "SQLite", "GitHub Actions", "pytest", "Ruff", "mypy", "Bandit", "Gitleaks", "Trivy"],
  // Simplified, illustrative workflow diagram (not a screenshot). `icon` keys live in scripts/icons.mjs.
  pipeline: [
    { label: "Repository analysis", icon: "folderSearch", detail: "The agent inspects an isolated clone of the repository" },
    { label: "Proposed change", icon: "gitBranch", detail: "A patch is proposed on a Git feature branch", tools: ["Git"] },
    { label: "Docker sandbox", icon: "container", detail: "Allowlisted commands run in isolation", tools: ["Docker"] },
    { label: "Quality checks", icon: "listChecks", detail: "Lint, type and test checks", tools: ["Ruff", "mypy", "pytest"] },
    { label: "Security scans", icon: "shield", detail: "Code, secrets and dependency/image scanning", tools: ["Bandit", "Gitleaks", "Trivy"] },
    { label: "Human approval", icon: "userCheck", detail: "A person approves the patch; deployment needs a second approval" },
  ],
  links: {
    github: { label: "View on GitHub", href: "https://github.com/shanukabherath-solutions/AESA" },
    documentation: { label: "View Documentation", href: "https://github.com/shanukabherath-solutions/AESA/tree/main/docs" },
  },
};

/**
 * Smaller project cards, shown under the two featured projects.
 * Only the descriptions/technologies stated in each repository's README are used.
 */
export const moreProjects = [
  {
    id: "no-exit-online",
    variant: "spotlight", // wide card with an expandable details section
    shortTitle: "No Exit Online",
    title: "No Exit Online - Browser-Based Game & Security Engineering",
    // Two equal pillars: the card must read as game development AND security engineering.
    categories: [
      { label: "Game Development", tone: "accent" },
      { label: "Security Engineering", tone: "warm" },
    ],
    description:
      "A browser-based puzzle game developed using Godot Engine and GDScript, supported by a security-focused CI/CD workflow. Combines game development, application security testing, automated security scanning, and secure build pipeline engineering.",
    pillars: [
      {
        icon: "gamepad",
        tone: "accent",
        label: "Game development",
        text: "A browser-based puzzle game developed using Godot Engine and GDScript, exported for HTML5 browser execution and deployed to Vercel.",
      },
      {
        icon: "shield",
        tone: "warm",
        label: "Security engineering",
        text: "Automated security tests that run against the actual game, a hardened build pipeline with hash-pinned dependencies, and scanning with CodeQL, Trivy, and Gitleaks.",
      },
    ],
    detailsTitle: "Read the project details",
    detailsSubtitle: "Full description, technologies and project focus.",
    detailParagraphs: [
      "No Exit Online is a browser-based puzzle game developed using Godot Engine and GDScript, with a supporting security and CI/CD engineering workflow.",
      "The original game project is maintained separately from the surrounding engineering components. The project incorporates automated security tests that run against the actual game, a hardened build pipeline with hash-pinned dependencies, and GitHub Actions workflows for continuous integration and deployment.",
      "Security analysis and scanning are integrated into the development workflow using CodeQL, Trivy, and Gitleaks. Security findings, test results, and verification limitations are documented to provide transparency into what was implemented, configured, successfully verified, and left untested.",
      "The game is exported for HTML5 browser execution and deployed to Vercel.",
    ],
    technologies: ["Godot Engine", "GDScript", "HTML5", "Git", "GitHub", "GitHub Actions", "Vercel", "CodeQL", "Trivy", "Gitleaks"],
    focus: ["Game Development", "Application Security", "DevSecOps", "CI/CD Automation", "Secure Build Pipelines", "Software Supply Chain Security"],
    liveDemo: "https://no-exit-online.vercel.app/",
    github: "https://github.com/shanukabherath-solutions/No-Exit-Online",
  },
  {
    id: "q-learning-agent",
    title: "Q-Learning Agent",
    category: "Reinforcement Learning",
    description:
      "A tabular Q-learning agent that learns to reach a goal in a 2-D grid world, with a Tkinter GUI and live training graphs. It compares standard Q-learning with reward shaping from a distance heuristic, which in the repository's measurements reaches reliable performance in about 6.5\u00D7 fewer episodes.",
    technologies: ["Python", "NumPy", "Matplotlib", "Tkinter", "pytest"],
    github: "https://github.com/shanukabherath-solutions/q-learning-agent",
  },
  {
    id: "healthcare-appointment-system",
    title: "Healthcare Appointment System",
    category: "Desktop Application",
    description:
      "A Java Swing desktop application for managing healthcare appointments. Patients register and book appointments, administrators manage them from a dashboard, and confirmation emails are sent with JavaMail, with data stored in MongoDB.",
    technologies: ["Java", "Swing", "MongoDB", "JavaMail API", "MVC"],
    github: "https://github.com/shanukabherath-solutions/healthcare-appointment-system",
  },
];

/**
 * Software Releases: packaged, installable software. Each entry renders as one release card in #software-releases,
 * so a future release only needs a new object here (rebuild, nothing else to wire up).
 *
 * Stofree links were checked against the public GitHub release page: the installer and checksum file are real
 * assets of tag v1.0.0. The download points at that exact tag, so the button always matches the version shown.
 * When you publish a new version, update `version`, `released`, `size` and the three release URLs together.
 * (`releases/latest/download/<file>` also works because the asset name has no version in it, but then the
 * card could show an older version number than the file people actually receive.)
 */
const STOFREE_REPO = "https://github.com/shanukabherath-solutions/Stofree";
const STOFREE_TAG = `${STOFREE_REPO}/releases/download/v1.0.0`;

export const softwareReleases = {
  title: "Software Releases",
  tagline: "Software I've built, packaged, and released.",
  items: [
    {
      id: "stofree",
      name: "Stofree",
      category: "Windows Disk Space Analyzer",
      version: "1.0.0",
      description: [
        "Stofree is a Windows disk space analyzer designed to help users understand how their storage is being used. It provides visual drive and folder analysis, identifies the largest files, and presents file-type breakdowns to make storage usage easier to understand.",
        "Stofree is strictly read-only. It never deletes, moves, or modifies files. Users can also export storage analysis reports in CSV and JSON formats.",
      ],
      features: [
        "Visual drive and folder analysis",
        "Identify and explore the largest files",
        "File-type breakdown and storage insights",
        "Export analysis reports in CSV and JSON formats",
        "Strictly read-only storage scanning",
      ],
      // Supplied logo, only resized (see src/assets/img/stofree-logo-*.webp; original in tools/Stofree.original.png)
      logo: {
        src: "assets/img/stofree-logo-512.webp",
        srcset: "assets/img/stofree-logo-256.webp 256w, assets/img/stofree-logo-512.webp 512w, assets/img/stofree-logo-1024.webp 1024w",
        alt: "Stofree logo: a yellow warning triangle with a crumpled sheet of paper and a pixel mouse pointer",
        size: 1024,
      },
      facts: [
        { label: "Platform", value: "Windows 10 and 11, 64-bit" },
        { label: "Installer", value: "Setup .exe, 35.1 MB" },
        { label: "Released", value: "26 Nov 2026", iso: "2026-11-26" },
      ],
      checksum: { label: "SHA-256 checksums", href: `${STOFREE_TAG}/SHA256SUMS.txt` },
      links: {
        download: { label: "Download for Windows", href: `${STOFREE_TAG}/Stofree-Windows-10-11-x64-Setup.exe` },
        github: { label: "View on GitHub", href: STOFREE_REPO },
      },
    },
  ],
};

/** Earlier practice projects carried over from the original portfolio. No public links, so none are shown. */
export const practiceProjects = [
  { title: "Password Strength Analyzer", category: "Cybersecurity", description: "A Python-based application that evaluates password strength and gives feedback on how it could be improved.", technologies: ["Python"] },
  { title: "File Encryption App", category: "Cybersecurity", description: "An application that demonstrates AES-based file encryption and decryption.", technologies: ["Python", "AES"] },
  { title: "Secure Login System", category: "Cybersecurity", description: "A simple authentication system demonstrating password hashing and secure login concepts.", technologies: ["Python"] },
];

export const experience = [
  {
    role: "Freelance Software Developer",
    organisation: "Freelance",
    platform: { label: "Fiverr", href: "https://www.fiverr.com/users/shanukabherath" },
    period: "",
    summary: "Freelance software development work offered through a Fiverr seller profile.",
    highlights: [],
  },
  {
    role: "Graphic Designer",
    organisation: "Multimedia Studio",
    period: "April 2023 \u2013 October 2023",
    summary: "Worked on visual design and image editing for client projects, before moving into software development.",
    highlights: ["Visual design and layout for client projects", "Branding-related design work", "Image editing", "Client-oriented design work"],
  },
];
export const graphicDesignNote =
  "This design background carries over into how I build interfaces today — I think about layout, hierarchy, and visual polish alongside functionality, not after it.";

export const education = [
  { qualification: "BSc (Hons) Computer Science", institution: "University of Bedfordshire", status: "Completed", detail: "Second Class Upper Division" },
  { qualification: "HND in IT", institution: "SCU \u2013 SLIIT City University", status: "Completed", detail: "" },
];

/** Single credentials. */
export const certifications = [
  { name: "Burp Suite (Web Security)", issuer: "PortSwigger", status: "Completed" },
  { name: "Certified Artificial Intelligence Security & Risk (CAISR)", issuer: "Red Team Leaders", status: "Completed" },
  { name: "Future in Quality Assurance", issuer: "SLIIT City UNI", status: "Completed" },
  { name: "IBM Python 101", issuer: "IBM / Cognitive Class", status: "Completed" },
  { name: "Introduction to Machine Learning", issuer: "Kaggle", status: "Completed" },
  { name: "Introduction to DevOps and Site Reliability Engineering", issuer: "LFS162", status: "Completed" },
];

/** Several credentials grouped under one issuer, plus self-directed learning (no issuer or status claimed). */
export const certificationGroups = [
  {
    title: "Microsoft",
    kind: "issuer",
    subtitle: "Issuer: Microsoft",
    status: "Completed",
    items: [
      "Introduction to AI concepts",
      "Introduction to generative AI and agents",
      "Introduction to natural language processing concepts",
      "Introduction to machine learning concepts",
      "Introduction to AI speech concepts",
      "Introduction to computer vision concepts",
      "Introduction to AI-powered information extraction concepts",
      "AI concepts for developers and technology professionals",
      "Explore and analyze data with Python",
    ],
  },
  {
    title: "Other self-learning",
    kind: "self",
    subtitle: "Self-directed learning",
    status: "",
    items: [
      "AI Security, CI/CD, LLM Risks, OWASP Top 10 & DevSecOps",
      "Game Security Lab - DevSecOps Masterclass",
    ],
  },
];

export const services = [
  { title: "Website development", description: "Modern, responsive websites built with React and Next.js." },
  { title: "Frontend development", description: "React / Next.js interfaces focused on usability and clean UI." },
  { title: "Backend & API development", description: "FastAPI backends and REST API integration." },
  { title: "AI API integration", description: "Adding AI-powered features to existing or new web applications." },
  { title: "Image-processing features", description: "Editing, enhancement, and processing tools built into web apps." },
  { title: "Authentication systems", description: "Login, password hashing, and access-control implementation." },
];
export const servicesNote = "I take on these as a junior developer / freelancer — happy to discuss scope before starting.";
