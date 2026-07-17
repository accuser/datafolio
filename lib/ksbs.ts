import type { Ksb } from "./types";

// The 19 KSBs of the Level 6 Data Scientist standard (ST0585), with routes and
// sub-points. Static reference data (from KSBS.json in the design bundle).
export const KSBS: Ksb[] = [
  {
    id: "K1",
    cat: "Knowledge",
    route: "portfolio",
    short: "Context of Data Science",
    title:
      "The context of Data Science in relation to computer science, statistics and software engineering, and how differing schools of thought drive new approaches.",
  },
  {
    id: "K2",
    cat: "Knowledge",
    route: "portfolio",
    short: "Governance, ethics & bias",
    title:
      "How Data Science operates within data governance, security, ethics and compliance (including GDPR), and how data and analysis can exhibit bias.",
  },
  {
    id: "K3",
    cat: "Knowledge",
    route: "portfolio",
    short: "Data platforms",
    title:
      "How data is used systematically across the key platforms for data and analysis in an organisation.",
    points: [
      {
        id: "K3.1",
        text: "Data processing and storage, including on-premise and cloud technologies.",
      },
      {
        id: "K3.2",
        text: "Database systems — relational, warehousing & OLAP, NoSQL and real-time approaches, and their trade-offs.",
      },
      {
        id: "K3.3",
        text: "Data-driven decision making and the good use of evidence and analytics.",
      },
    ],
  },
  {
    id: "K4",
    cat: "Knowledge",
    route: "both",
    short: "Analytical algorithms",
    title:
      "How to design, implement and optimise analytical algorithms, as prototypes and at production scale.",
    points: [
      { id: "K4.1", text: "Statistical and mathematical models and methods." },
      {
        id: "K4.2",
        text: "Advanced & predictive analytics, machine learning, AI, simulation, optimisation and automation.",
      },
      {
        id: "K4.3",
        text: "Applications such as computer vision and Natural Language Processing.",
      },
      {
        id: "K4.4",
        text: "Computing and organisational resource constraints and trade-offs in selecting models and tools.",
      },
      {
        id: "K4.5",
        text: "Development standards, including programming practice, testing and source control.",
      },
    ],
  },
  {
    id: "K5",
    cat: "Knowledge",
    route: "portfolio",
    short: "The data landscape",
    title:
      "The data landscape: how to critically analyse, interpret and evaluate complex information from diverse datasets.",
    points: [
      {
        id: "K5.1",
        text: "Sources of data — files, operational systems, databases, web services, open and government data, social media.",
      },
      {
        id: "K5.2",
        text: 'Data formats, structures and delivery methods, including "unstructured" data.',
      },
      { id: "K5.3", text: "Common patterns in real-world data." },
    ],
  },
  {
    id: "S1",
    cat: "Skill",
    route: "project",
    short: "Problem framing & method",
    title:
      "Identify and reformulate organisational problems into Data Science problems, and apply scientific methods through experiment design and hypothesis testing.",
  },
  {
    id: "S2",
    cat: "Skill",
    route: "project",
    short: "Data engineering",
    title:
      "Perform data engineering — source, access, explore, combine, transform and store data, and apply governance.",
  },
  {
    id: "S3",
    cat: "Skill",
    route: "project",
    short: "Programming & reproducibility",
    title:
      "Select and use appropriate programming languages and tools; develop reproducible analysis and robust code with version control.",
  },
  {
    id: "S4",
    cat: "Skill",
    route: "project",
    short: "Modelling & validation",
    title:
      "Use analysis and models to improve organisational outcomes, validating results with statistical testing.",
  },
  {
    id: "S5",
    cat: "Skill",
    route: "project",
    short: "Implementing solutions",
    title:
      "Implement data solutions using software engineering architectures; evaluate deployment options, value and ROI.",
  },
  {
    id: "S6",
    cat: "Skill",
    route: "both",
    short: "Communication & storytelling",
    title:
      "Find, communicate and disseminate outputs with high impact through storytelling, visualisation and tailored reporting.",
  },
  {
    id: "S7",
    cat: "Skill",
    route: "portfolio",
    short: "Collaborative relationships",
    title:
      "Develop and maintain collaborative relationships at strategic and operational levels.",
  },
  {
    id: "S8",
    cat: "Skill",
    route: "project",
    short: "Project delivery",
    title:
      "Use project delivery techniques and tools to plan, organise and manage a Data Science project.",
  },
  {
    id: "B1",
    cat: "Behaviour",
    route: "both",
    short: "Inquisitive approach",
    title:
      "An inquisitive approach — curiosity, tenacity and creativity in exploring data, questions and techniques.",
  },
  {
    id: "B2",
    cat: "Behaviour",
    route: "portfolio",
    short: "Empathy & engagement",
    title:
      "Empathy and positive engagement in multi-disciplinary teams, championing ethics and diversity in data work.",
  },
  {
    id: "B3",
    cat: "Behaviour",
    route: "both",
    short: "Adaptability",
    title:
      "Adaptability and dynamism in responding to varied tasks and timescales, with pragmatism in real-world scenarios.",
  },
  {
    id: "B4",
    cat: "Behaviour",
    route: "project",
    short: "Organisational context",
    title: "Consideration of problems in the context of organisation goals.",
  },
  {
    id: "B5",
    cat: "Behaviour",
    route: "both",
    short: "Scientific integrity",
    title:
      "An impartial, scientific, hypothesis-driven approach with integrity in presenting data and conclusions truthfully.",
  },
  {
    id: "B6",
    cat: "Behaviour",
    route: "portfolio",
    short: "Continuous development",
    title:
      "A commitment to keeping up to date and maintaining personal development, including engaging with the data science community.",
  },
];

export const KSB_BY_ID: Record<string, Ksb> = Object.fromEntries(
  KSBS.map((k) => [k.id, k]),
);
