// GENERATED FILE — DO NOT EDIT.
//
// Compiled from standards/*.yaml by scripts/build-standards.ts.
// Edit the YAML and run `npm run standards:build`.

import type { Standard } from "./types";

export const STANDARD_IDS = [
  "st0585",
] as const;

export type StandardId = (typeof STANDARD_IDS)[number];

export const STANDARDS: Record<string, Standard> = {
  "st0585": {
  "id": "st0585",
  "reference": "ST0585/AP01",
  "title": "Data Scientist (integrated degree)",
  "level": 6,
  "published": "2025-10-24",
  "methods": {
    "professional_discussion": {
      "key": "professional_discussion",
      "label": "Professional discussion",
      "abbr": "PD",
      "note": "Explored in a professional discussion with an independent assessor, underpinned by the evidence in your portfolio.",
      "collectsEvidence": true,
      "supportsCards": true,
      "colour": {
        "bg": "#eef2ff",
        "fg": "#4338ca"
      }
    },
    "report": {
      "key": "report",
      "label": "Report",
      "abbr": "Report",
      "note": "Evidenced through the report on your work-based Data Science project.",
      "collectsEvidence": true,
      "supportsCards": false,
      "colour": {
        "bg": "#f0fdfa",
        "fg": "#0f766e"
      }
    },
    "knowledge_test": {
      "key": "knowledge_test",
      "label": "Knowledge test",
      "abbr": "KT",
      "note": "Assessed by examination at end-point assessment. No portfolio evidence is required for this method.",
      "collectsEvidence": false,
      "supportsCards": true,
      "colour": {
        "bg": "#f5f3ff",
        "fg": "#6d28d9"
      }
    }
  },
  "ksbs": [
    {
      "id": "K1",
      "category": "Knowledge",
      "short": "Context of Data Science",
      "statement": "The context of Data Science and the Data Science community in relation to computer science, statistics and software engineering. How differing schools of thought in these disciplines have driven new approaches to data systems.",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "K2",
      "category": "Knowledge",
      "short": "Governance, ethics & bias",
      "statement": "How Data Science operates within the context of data governance, data security, and communications. How Data Science can be applied to improve an organisation's processes, operations and outputs. How data and analysis may exhibit biases and prejudice. How ethics and compliance affect Data Science work, and the impact of international regulations (including the General Data Protection Regulation.)",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "K3",
      "category": "Knowledge",
      "short": "Data platforms",
      "statement": "How data can be used systematically, through an awareness of key platforms for data and analysis in an organisation, including:",
      "methods": [
        "professional_discussion",
        "knowledge_test"
      ],
      "points": [
        {
          "id": "K3.1",
          "text": "Data processing and storage, including on-premise and cloud technologies.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K3.2",
          "text": "Database systems including relational, data warehousing & online analytical processing, \"NoSQL\" and real-time approaches; the pros and cons of each approach.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K3.3",
          "text": "Data-driven decision making and the good use of evidence and analytics in making choices and decisions.",
          "methods": [
            "professional_discussion"
          ]
        }
      ]
    },
    {
      "id": "K4",
      "category": "Knowledge",
      "short": "Analytical algorithms",
      "statement": "How to design, implement and optimise analytical algorithms – as prototypes and at production scale – using:",
      "methods": [
        "knowledge_test"
      ],
      "points": [
        {
          "id": "K4.1",
          "text": "Statistical and mathematical models and methods.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K4.2",
          "text": "Advanced and predictive analytics, machine learning and artificial intelligence techniques, simulations, optimisation, and automation.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K4.3",
          "text": "Applications such as computer vision and Natural Language Processing.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K4.4",
          "text": "An awareness of the computing and organisational resource constraints and trade-offs involved in selecting models, algorithms and tools.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K4.5",
          "text": "Development standards, including programming practice, testing, source control.",
          "methods": [
            "knowledge_test"
          ]
        }
      ]
    },
    {
      "id": "K5",
      "category": "Knowledge",
      "short": "The data landscape",
      "statement": "The data landscape: how to critically analyse, interpret and evaluate complex information from diverse datasets:",
      "methods": [
        "professional_discussion",
        "knowledge_test"
      ],
      "points": [
        {
          "id": "K5.1",
          "text": "Sources of data including but not exclusive to files, operational systems, databases, web services, open data, government data, news and social media.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K5.2",
          "text": "Data formats, structures and data delivery methods including \"unstructured\" data.",
          "methods": [
            "knowledge_test"
          ]
        },
        {
          "id": "K5.3",
          "text": "Common patterns in real-world data.",
          "methods": [
            "professional_discussion"
          ]
        }
      ]
    },
    {
      "id": "S1",
      "category": "Skill",
      "short": "Problem framing & method",
      "statement": "Identify and clarify problems an organisation faces, and reformulate them into Data Science problems. Devise solutions and make decisions in context by seeking feedback from stakeholders. Apply scientific methods through experiment design, measurement, hypothesis testing and delivery of results. Collaborate with colleagues to gather requirements.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "S2",
      "category": "Skill",
      "short": "Data engineering",
      "statement": "Perform data engineering: create and handle datasets for analysis. Use tools and techniques to source, access, explore, profile, pipeline, combine, transform and store data, and apply governance (quality control, security, privacy) to data.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "S3",
      "category": "Skill",
      "short": "Programming & reproducibility",
      "statement": "Identify and use an appropriate range of programming languages and tools for data manipulation, analysis, visualisation, and system integration. Select appropriate data structures and algorithms for the problem. Develop reproducible analysis and robust code, working in accordance with software development standards, including security, accessibility, code quality and version control.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "S4",
      "category": "Skill",
      "short": "Modelling & validation",
      "statement": "Use analysis and models to inform and improve organisational outcomes, building models and validating results with statistical testing: perform statistical analysis, correlation vs causation, feature selection and engineering, machine learning, optimisation, and simulations, using the appropriate techniques for the problem.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "S5",
      "category": "Skill",
      "short": "Implementing solutions",
      "statement": "Implement data solutions, using relevant software engineering architectures and design patterns. Evaluate Cloud vs. on-premise deployment. Determine the implicit and explicit value of data. Assess value for money and Return on Investment. Scale a system up/out. Evaluate emerging trends and new approaches. Compare the pros and cons of software applications and techniques.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "S6",
      "category": "Skill",
      "short": "Communication & storytelling",
      "statement": "Find, present, communicate and disseminate outputs effectively and with high impact through creative storytelling, tailoring the message for the audience. Use the best medium for each audience, such as technical writing, reporting and dashboards. Visualise data to tell compelling and actionable narratives. Make recommendations to decision makers to contribute towards the achievement of organisation goals.",
      "methods": [
        "professional_discussion",
        "report"
      ]
    },
    {
      "id": "S7",
      "category": "Skill",
      "short": "Collaborative relationships",
      "statement": "Develop and maintain collaborative relationships at strategic and operational levels, using methods of organisational empathy (human, organisation and technical) and build relationships through active listening and trust development.",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "S8",
      "category": "Skill",
      "short": "Project delivery",
      "statement": "Use project delivery techniques and tools appropriate to their Data Science project and organisation. Plan, organise and manage resources to successfully run a small Data Science project, achieve organisational goals and enable effective change.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "B1",
      "category": "Behaviour",
      "short": "Inquisitive approach",
      "statement": "An inquisitive approach: the curiosity to explore new questions, opportunities, data, and techniques; tenacity to improve methods and maximise insights; and relentless creativity in their approach to solutions.",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "B2",
      "category": "Behaviour",
      "short": "Empathy & engagement",
      "statement": "Empathy and positive engagement to enable working and collaborating in multidisciplinary teams, championing and highlighting ethics and diversity in data work.",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "B3",
      "category": "Behaviour",
      "short": "Adaptability",
      "statement": "Adaptability and dynamism when responding to varied tasks and organisational timescales, and pragmatism in the face of real-world scenarios.",
      "methods": [
        "professional_discussion"
      ]
    },
    {
      "id": "B4",
      "category": "Behaviour",
      "short": "Organisational context",
      "statement": "Consideration of problems in the context of organisation goals.",
      "methods": [
        "professional_discussion",
        "report"
      ]
    },
    {
      "id": "B5",
      "category": "Behaviour",
      "short": "Scientific integrity",
      "statement": "An impartial, scientific, hypothesis-driven approach to work, rigorous data analysis methods, and integrity in presenting data and conclusions in a truthful and appropriate manner.",
      "methods": [
        "report"
      ]
    },
    {
      "id": "B6",
      "category": "Behaviour",
      "short": "Continuous development",
      "statement": "A commitment to keeping up to date with current thinking and maintaining personal development. Including collaborating with the data science community.",
      "methods": [
        "professional_discussion"
      ]
    }
  ]
},
};
