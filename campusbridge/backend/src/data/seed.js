// Sample data used to fill the database the first time the server starts.
// IMPORTANT: every course, instructor, organisation and opportunity below is
// SAMPLE DATA for demonstration. Replace it with real listings before real use.
// The seed runs on every start and updates rows that have the same id.
//
// Deadlines are written as "N days from today" so the demo never expires on its own. A deadline is only
// reset when it has already passed (see db/index.js), so dates stay stable while a listing is still open.

// Today + n days, as "YYYY-MM-DD" (the format PostgreSQL DATE columns expect).
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export const courses = [
  {
    "id": "c1",
    "title": "Introduction to Web Development",
    "instructor": "Dr. Tigist Bekele",
    "category": "Computer Science",
    "level": "Beginner",
    "duration": "8 weeks",
    "description": "Build modern, responsive websites from scratch using HTML, CSS, and JavaScript. Designed for students starting their journey into software development.",
    "syllabus": [
      "HTML5 Semantic Markup",
      "CSS Flexbox & Grid",
      "JavaScript Fundamentals",
      "DOM Manipulation",
      "Responsive Design Principles",
      "Git & Version Control Basics"
    ],
    "tags": [
      "HTML",
      "CSS",
      "JavaScript",
      "Web"
    ]
  },
  {
    "id": "c2",
    "title": "Data Structures & Algorithms",
    "instructor": "Prof. Michael Okonkwo",
    "category": "Computer Science",
    "level": "Intermediate",
    "duration": "12 weeks",
    "description": "Master the data structures and algorithms used in technical interviews and real-world engineering. Practice problems tailored for African tech hiring patterns.",
    "syllabus": [
      "Arrays & Linked Lists",
      "Stacks & Queues",
      "Trees & Graphs",
      "Sorting Algorithms",
      "Searching Techniques",
      "Dynamic Programming Intro"
    ],
    "tags": [
      "DSA",
      "Algorithms",
      "Interview Prep"
    ]
  },
  {
    "id": "c3",
    "title": "UI/UX Design Fundamentals",
    "instructor": "Amina Hassan",
    "category": "Design",
    "level": "Beginner",
    "duration": "6 weeks",
    "description": "Learn user-centered design principles and create interfaces that work well for diverse African users and low-bandwidth contexts.",
    "syllabus": [
      "Design Thinking Process",
      "User Research Methods",
      "Wireframing & Prototyping",
      "Visual Hierarchy",
      "Color Theory & Typography",
      "Usability Testing"
    ],
    "tags": [
      "UI",
      "UX",
      "Figma",
      "Design"
    ]
  },
  {
    "id": "c4",
    "title": "Python for Data Analysis",
    "instructor": "Dr. Kwame Asante",
    "category": "Data Science",
    "level": "Intermediate",
    "duration": "10 weeks",
    "description": "Use Python to clean, analyze, and visualize data. Ideal for students in economics, public health, agriculture, and computer science.",
    "syllabus": [
      "Python Basics Refresh",
      "NumPy & Pandas",
      "Data Cleaning",
      "Matplotlib & Seaborn",
      "Intro to Scikit-learn",
      "Real-world Projects"
    ],
    "tags": [
      "Python",
      "Data Science",
      "Analytics"
    ]
  },
  {
    "id": "c5",
    "title": "Mobile App Development with React Native",
    "instructor": "Fatuma Yusuf",
    "category": "Mobile Development",
    "level": "Intermediate",
    "duration": "10 weeks",
    "description": "Build cross-platform mobile apps for iOS and Android. Focus on practical apps relevant to African markets and offline-first design.",
    "syllabus": [
      "React Native Setup",
      "Components & Navigation",
      "State Management",
      "API Integration",
      "Offline Storage",
      "App Deployment"
    ],
    "tags": [
      "React Native",
      "Mobile",
      "JavaScript"
    ]
  },
  {
    "id": "c6",
    "title": "Entrepreneurship & Startup Basics",
    "instructor": "Yonas Gebre",
    "category": "Business",
    "level": "Beginner",
    "duration": "5 weeks",
    "description": "Understand how to validate ideas, build a lean business model, and navigate the startup ecosystem in Ethiopia and East Africa.",
    "syllabus": [
      "Problem Discovery",
      "Business Model Canvas",
      "Customer Interviews",
      "MVP Design",
      "Pitching Fundamentals",
      "Funding Landscape Overview"
    ],
    "tags": [
      "Business",
      "Startups",
      "Entrepreneurship"
    ]
  }
];

const baseOpportunities = [
  {
    "id": "o1",
    "title": "Frontend Developer Intern",
    "company": "Addis Tech Collective",
    "location": "Addis Ababa · Hybrid",
    "type": "Internship",
    "duration": "3 months",
    "stipend": "ETB 12,000/month",
    "deadline": inDays(75),
    "category": "Technology",
    "description": "Join a small product team building tools for local businesses. You will work on React interfaces, collaborate with designers, and ship features used by real customers in Ethiopia.",
    "requirements": [
      "Currently enrolled in Computer Science or related field",
      "Solid HTML, CSS, and JavaScript fundamentals",
      "Basic familiarity with React is a plus",
      "Ability to work from Addis Ababa or remotely within Ethiopia"
    ],
    "tags": [
      "React",
      "Frontend",
      "Hybrid"
    ]
  },
  {
    "id": "o2",
    "title": "Data Analyst Intern",
    "company": "East Africa Insights",
    "location": "Addis Ababa",
    "type": "Internship",
    "duration": "4 months",
    "stipend": "ETB 15,000/month",
    "deadline": inDays(100),
    "category": "Data Science",
    "description": "Support research and analytics projects focused on education, agriculture, and urban development across East Africa. Clean datasets, build dashboards, and present findings.",
    "requirements": [
      "Background in Statistics, Economics, Math, or Computer Science",
      "Comfortable with Excel and basic SQL",
      "Python or R experience preferred",
      "Strong written communication in English"
    ],
    "tags": [
      "Data",
      "Python",
      "Analytics"
    ]
  },
  {
    "id": "o3",
    "title": "UX Design Intern",
    "company": "Bloom Digital Studio",
    "location": "Nairobi · Hybrid",
    "type": "Internship",
    "duration": "3 months",
    "stipend": "KES 25,000/month",
    "deadline": inDays(60),
    "category": "Design",
    "description": "Contribute to product design for education and fintech clients. Create user flows, wireframes, and high-fidelity prototypes while learning from experienced designers.",
    "requirements": [
      "Portfolio of design work (student projects welcome)",
      "Familiarity with Figma or Adobe XD",
      "Understanding of basic UX principles",
      "Interest in designing for African users"
    ],
    "tags": [
      "UX",
      "Figma",
      "Design"
    ]
  },
  {
    "id": "o4",
    "title": "Software Engineering Intern",
    "company": "Nairobi Innovation Hub",
    "location": "Nairobi, Kenya",
    "type": "Internship",
    "duration": "6 months",
    "stipend": "KES 40,000/month",
    "deadline": inDays(45),
    "category": "Technology",
    "description": "Work on production systems that serve millions of users. Gain experience with large-scale engineering practices, code reviews, and agile delivery.",
    "requirements": [
      "Strong programming fundamentals in any language",
      "Understanding of data structures and algorithms",
      "Team player with a growth mindset",
      "Available for the full internship duration"
    ],
    "tags": [
      "Backend",
      "Full-stack",
      "Enterprise"
    ]
  },
  {
    "id": "o5",
    "title": "Content & Community Intern",
    "company": "EduSpark Africa",
    "location": "Remote (Africa)",
    "type": "Internship",
    "duration": "3 months",
    "stipend": "USD 400/month",
    "deadline": inDays(90),
    "category": "Marketing",
    "description": "Help grow a community of student learners across Africa. Create educational content, manage social channels, and support online events.",
    "requirements": [
      "Excellent written communication in English",
      "Interest in education technology",
      "Comfortable with social media platforms",
      "Creative storytelling ability"
    ],
    "tags": [
      "Content",
      "Community",
      "Remote"
    ]
  },
  {
    "id": "o6",
    "title": "Research Assistant — EdTech",
    "company": "University Innovation Lab",
    "location": "Hybrid · Ethiopia",
    "type": "Research Opportunity",
    "duration": "5 months",
    "stipend": "Stipend available",
    "deadline": inDays(120),
    "category": "Research",
    "description": "Support faculty research on digital learning tools and student outcomes in Ethiopian universities. Ideal for students interested in education research and policy.",
    "requirements": [
      "Strong academic standing",
      "Interest in education technology or policy",
      "Good research and writing skills",
      "Ability to work independently"
    ],
    "tags": [
      "Research",
      "EdTech",
      "Education"
    ]
  },
  {
    "id": "o7",
    "title": "Undergraduate Merit Scholarship",
    "company": "Horn of Africa Education Fund (sample)",
    "location": "Ethiopia · Any public university",
    "type": "Scholarship",
    "duration": "1 academic year (renewable)",
    "stipend": "Tuition support + ETB 3,000/month",
    "deadline": inDays(80),
    "category": "Education",
    "description": "A sample scholarship for high-achieving undergraduate students who need financial support to continue their studies. Recipients also join a mentoring circle with working professionals.",
    "requirements": [
      "Enrolled full-time at an Ethiopian public university",
      "Cumulative GPA of 3.2 or higher",
      "Demonstrated financial need",
      "A short statement describing your academic goals"
    ],
    "tags": [
      "Scholarship",
      "Undergraduate",
      "Financial aid"
    ]
  },
  {
    "id": "o8",
    "title": "Women in STEM Scholarship",
    "company": "Rift Valley Scholars Trust (sample)",
    "location": "Ethiopia · All regions",
    "type": "Scholarship",
    "duration": "2 academic years",
    "stipend": "Tuition support + laptop grant",
    "deadline": inDays(110),
    "category": "Education",
    "description": "A sample scholarship that supports female students in science, technology, engineering and mathematics, with a laptop grant and a summer learning programme.",
    "requirements": [
      "Female student in a STEM degree programme",
      "2nd or 3rd year of study",
      "Strong academic record",
      "Reference from one lecturer"
    ],
    "tags": [
      "Scholarship",
      "STEM",
      "Women"
    ]
  },
  {
    "id": "o9",
    "title": "Community Health Research Assistant",
    "company": "Southwest Ethiopia Health Research Group (sample)",
    "location": "Jimma · On-site",
    "type": "Research Opportunity",
    "duration": "6 months",
    "stipend": "ETB 8,000/month",
    "deadline": inDays(55),
    "category": "Research",
    "description": "Assist a small research team collecting and analysing community health survey data in South West Ethiopia. You will learn field survey methods, data entry and basic statistical analysis.",
    "requirements": [
      "Student in health sciences, public health, statistics or a related field",
      "Able to work on-site in Jimma for the full period",
      "Basic Excel or SPSS skills are a plus",
      "Fluent in Afaan Oromoo or Amharic and English"
    ],
    "tags": [
      "Research",
      "Health",
      "South West Ethiopia"
    ]
  }
];

// ---------------------------------------------------------------------------------------------
// Opportunity hub additions. Matching metadata for the original sample listings (empty list = no restriction),
// then new listings. Real programmes below link only to the organisation's own website and carry NO deadline:
// their intakes, deadlines and eligibility change every year and differ by partner, so students must confirm
// them on the official page. Entries marked "(sample)" are made-up examples for demonstration.
// ---------------------------------------------------------------------------------------------
const CS_FIELDS = ['Computer Science', 'Software Engineering', 'Information Technology', 'Information Systems'];
const metadata = {
  o1: { scope: 'Ethiopia', eligibleFields: CS_FIELDS, eligibleYears: ['3rd Year', '4th Year', '5th Year', 'Graduate'], skills: ['HTML', 'CSS', 'JavaScript', 'React'] },
  o2: { scope: 'Ethiopia', eligibleFields: [...CS_FIELDS, 'Statistics', 'Economics', 'Mathematics'], eligibleYears: ['3rd Year', '4th Year', '5th Year', 'Graduate'], skills: ['Python', 'SQL', 'Excel', 'Statistics'] },
  o3: { scope: 'Ethiopia', eligibleFields: [...CS_FIELDS, 'Graphic Design', 'Architecture'], skills: ['Figma', 'UX', 'Prototyping'] },
  o4: { scope: 'International', eligibleFields: CS_FIELDS, eligibleYears: ['4th Year', '5th Year', 'Graduate'], skills: ['JavaScript', 'Python', 'Java', 'SQL'] },
  o5: { scope: 'Ethiopia', skills: ['Writing', 'Social media', 'Communication'] },
  o6: { scope: 'Ethiopia', eligibleFields: ['Education', 'Psychology', ...CS_FIELDS], eligibleYears: ['3rd Year', '4th Year', '5th Year', 'Graduate'], skills: ['Research', 'Writing', 'Data collection'] },
  o7: { scope: 'Ethiopia', eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'], skills: [] },
  o8: { scope: 'Ethiopia', eligibleFields: [...CS_FIELDS, 'Engineering', 'Mathematics', 'Physics', 'Chemistry', 'Biology'], skills: [] },
  o9: { scope: 'Ethiopia', eligibleUniversities: ['Mizan-Tepi University', 'Jimma University'], eligibleFields: ['Public Health', 'Health Science', 'Medicine', 'Nursing', 'Statistics'], skills: ['Research', 'Data collection', 'Statistics'] }
};

const hub = [
  {
    id: 'h1', title: 'Mastercard Foundation Scholars Program', company: 'Mastercard Foundation', location: 'Partner universities in Africa and abroad',
    type: 'Scholarship', duration: 'Varies by partner university', stipend: 'Scholarship support (varies by partner)', deadline: null, category: 'Education', scope: 'International',
    description: 'A scholarship programme delivered through partner universities for talented young Africans who face financial barriers. Each partner university sets its own application process, intake and deadline, so use the official page to find the partner and the current dates.',
    requirements: ['Citizen of an African country (confirm the exact rule with each partner)', 'Strong academic record', 'Financial need, as defined by the partner university', 'Confirm all requirements and deadlines on the official page'],
    tags: ['Scholarship', 'Africa', 'Leadership'], sourceUrl: 'https://mastercardfdn.org', eligibleYears: ['3rd Year', '4th Year', '5th Year', 'Graduate']
  },
  {
    id: 'h2', title: 'Chevening Scholarships', company: 'Chevening (UK Government)', location: 'United Kingdom',
    type: 'Scholarship', duration: 'One-year master’s degree', stipend: 'Funded by the UK Government (see official page)', deadline: null, category: 'Education', scope: 'International',
    description: 'The UK Government’s international scholarship scheme for future leaders to study a master’s degree in the UK. Applications open once a year. Check the official page for the current round, dates and country-specific requirements.',
    requirements: ['Citizen of an eligible Chevening country (Ethiopia is listed by the programme; confirm the current list)', 'An undergraduate degree', 'Work experience as required by the programme', 'Confirm all requirements and deadlines on the official page'],
    tags: ['Scholarship', 'Master’s', 'UK'], sourceUrl: 'https://www.chevening.org', eligibleYears: ['4th Year', '5th Year', 'Graduate']
  },
  {
    id: 'h3', title: 'Tony Elumelu Foundation Entrepreneurship Programme', company: 'Tony Elumelu Foundation', location: 'Online · Africa-wide',
    type: 'Fellowship', duration: 'Programme cycle (see official page)', stipend: 'Training, mentoring and seed funding (see official page)', deadline: null, category: 'Entrepreneurship', scope: 'International',
    description: 'A pan-African programme that supports early-stage entrepreneurs with training, mentoring and seed funding. Applications are made through the official portal in annual cycles. Confirm the current cycle and rules on the official page.',
    requirements: ['A business idea or early-stage business', 'Resident in an African country (confirm eligibility on the official page)', 'Confirm all requirements and deadlines on the official page'],
    tags: ['Entrepreneurship', 'Startup', 'Funding'], sourceUrl: 'https://www.tefconnect.com', skills: ['Business planning', 'Communication']
  },
  {
    id: 'h4', title: 'ICPC Programming Contests', company: 'ICPC Foundation', location: 'Regional contests, in person and online',
    type: 'Competition', duration: 'Contest season', stipend: 'Prizes and qualification to later rounds', deadline: null, category: 'Technology', scope: 'International',
    description: 'The International Collegiate Programming Contest runs team programming competitions for university students, with regional rounds. University teams register through their coach. Check the official page for your region’s rounds and dates.',
    requirements: ['Currently enrolled at a university', 'A team of university students led by a coach', 'Confirm all requirements and dates on the official page'],
    tags: ['Programming', 'Algorithms', 'Teams'], sourceUrl: 'https://icpc.global', eligibleFields: CS_FIELDS, skills: ['Algorithms', 'Data structures', 'C++', 'Java', 'Python']
  },
  {
    id: 'h5', title: 'Africa Prize for Engineering Innovation', company: 'Royal Academy of Engineering', location: 'Africa-wide',
    type: 'Competition', duration: 'Annual prize programme', stipend: 'Funding and mentoring for winners (see official page)', deadline: null, category: 'Technology', scope: 'International',
    description: 'A prize programme that supports engineers in sub-Saharan Africa who are developing scalable innovations. Entries are accepted in annual rounds. Check the official page for the current round and entry rules.',
    requirements: ['An engineering innovation with a working prototype or product', 'Confirm all requirements and dates on the official page'],
    tags: ['Engineering', 'Innovation', 'Prize'], sourceUrl: 'https://raeng.org.uk', eligibleFields: [...CS_FIELDS, 'Engineering'], skills: ['Engineering', 'Prototyping', 'Problem solving']
  },
  {
    id: 'h6', title: 'Addis Ababa Tech Fellowship (sample)', company: 'Addis Tech Collective (sample)', location: 'Addis Ababa · Hybrid',
    type: 'Fellowship', duration: '6 months', stipend: 'ETB 8,000/month', deadline: inDays(50), category: 'Technology', scope: 'Ethiopia', owner: 'organization',
    description: 'A sample six-month fellowship placing senior students and recent graduates with Addis Ababa product teams, with weekly mentoring and a small team project. This is made-up demonstration data.',
    requirements: ['Studying or recently graduated in Computer Science or a related field', 'Comfortable with at least one programming language', 'Available for 6 months'],
    tags: ['Fellowship', 'Mentoring', 'Software'], eligibleFields: CS_FIELDS, eligibleYears: ['4th Year', '5th Year', 'Graduate'], skills: ['JavaScript', 'Python', 'Git']
  },
  {
    id: 'h7', title: 'Ethiopian Universities Hackathon (sample)', company: 'Addis Tech Collective (sample)', location: 'Addis Ababa · On-site',
    type: 'Competition', duration: '2 days', stipend: 'Cash prizes and mentorship', deadline: inDays(35), category: 'Technology', scope: 'Ethiopia', owner: 'organization',
    description: 'A sample two-day hackathon open to students from any Ethiopian university. Teams build a working prototype that solves a local problem. This is made-up demonstration data.',
    requirements: ['Enrolled at an Ethiopian university', 'Teams of 2 to 4 students'],
    tags: ['Hackathon', 'Teams', 'Prototype'], skills: ['JavaScript', 'Python', 'Design', 'Teamwork']
  }
];

export const opportunities = [...baseOpportunities.map((o) => ({ ...o, ...(metadata[o.id] || {}) })), ...hub];
