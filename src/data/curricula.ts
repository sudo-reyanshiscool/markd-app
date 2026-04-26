export const PALETTE = [
  "#3D3DF5", "#D68A3A", "#5A8C5A", "#C14A4A", "#7C5BD6",
  "#E07A7A", "#3A8FD6", "#A86CD6", "#E0A85A", "#5C9C8C",
];

export const EXAM_BOARDS = ["AQA", "Edexcel", "OCR", "WJEC", "Cambridge (CIE)", "IB", "Other"] as const;

export type CurriculumKey = "GCSE" | "A-Level" | "IB" | "IGCSE" | "Other";

interface CurriculumDef {
  label: string;
  defaultBoard: string;
  grades: string[];
  defaultTarget: string;
  subjects: { name: string; board: string }[];
}

export const CURRICULA: Record<CurriculumKey, CurriculumDef> = {
  GCSE: {
    label: "GCSE",
    defaultBoard: "AQA",
    grades: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
    defaultTarget: "7",
    subjects: [
      { name: "English Language", board: "AQA" },
      { name: "English Literature", board: "AQA" },
      { name: "Mathematics", board: "Edexcel" },
      { name: "Biology", board: "AQA" },
      { name: "Chemistry", board: "AQA" },
      { name: "Physics", board: "AQA" },
      { name: "Combined Science", board: "AQA" },
      { name: "History", board: "Edexcel" },
      { name: "Geography", board: "AQA" },
      { name: "French", board: "AQA" },
      { name: "Spanish", board: "AQA" },
      { name: "Computer Science", board: "OCR" },
      { name: "Art & Design", board: "AQA" },
      { name: "Music", board: "Edexcel" },
      { name: "Drama", board: "AQA" },
      { name: "Business Studies", board: "Edexcel" },
      { name: "Economics", board: "Edexcel" },
      { name: "Religious Studies", board: "AQA" },
      { name: "Design & Technology", board: "AQA" },
      { name: "Physical Education", board: "AQA" },
    ],
  },
  "A-Level": {
    label: "A-Level",
    defaultBoard: "AQA",
    grades: ["A*", "A", "B", "C", "D", "E"],
    defaultTarget: "A",
    subjects: [
      { name: "Mathematics", board: "Edexcel" },
      { name: "Further Mathematics", board: "AQA" },
      { name: "Biology", board: "AQA" },
      { name: "Chemistry", board: "OCR" },
      { name: "Physics", board: "AQA" },
      { name: "English Literature", board: "AQA" },
      { name: "History", board: "Edexcel" },
      { name: "Geography", board: "AQA" },
      { name: "Economics", board: "Edexcel" },
      { name: "Politics", board: "Edexcel" },
      { name: "Psychology", board: "AQA" },
      { name: "Sociology", board: "AQA" },
      { name: "Computer Science", board: "OCR" },
      { name: "Art & Design", board: "AQA" },
      { name: "French", board: "AQA" },
      { name: "Spanish", board: "AQA" },
      { name: "Business", board: "Edexcel" },
      { name: "Philosophy", board: "AQA" },
    ],
  },
  IB: {
    label: "IB Diploma",
    defaultBoard: "IB",
    grades: ["7", "6", "5", "4", "3", "2", "1"],
    defaultTarget: "6",
    subjects: [
      { name: "English A: Lit", board: "IB" },
      { name: "Mathematics AA HL", board: "IB" },
      { name: "Mathematics AI SL", board: "IB" },
      { name: "Biology HL", board: "IB" },
      { name: "Chemistry HL", board: "IB" },
      { name: "Physics HL", board: "IB" },
      { name: "History HL", board: "IB" },
      { name: "Economics HL", board: "IB" },
      { name: "French B SL", board: "IB" },
      { name: "Spanish B SL", board: "IB" },
      { name: "Visual Arts", board: "IB" },
      { name: "Theory of Knowledge", board: "IB" },
    ],
  },
  IGCSE: {
    label: "IGCSE",
    defaultBoard: "Cambridge (CIE)",
    grades: ["A*", "A", "B", "C", "D", "E", "F", "G"],
    defaultTarget: "A",
    subjects: [
      { name: "First Language English", board: "Cambridge (CIE)" },
      { name: "Mathematics", board: "Cambridge (CIE)" },
      { name: "Biology", board: "Cambridge (CIE)" },
      { name: "Chemistry", board: "Cambridge (CIE)" },
      { name: "Physics", board: "Cambridge (CIE)" },
      { name: "Coordinated Sciences", board: "Cambridge (CIE)" },
      { name: "History", board: "Cambridge (CIE)" },
      { name: "Geography", board: "Cambridge (CIE)" },
      { name: "Computer Science", board: "Cambridge (CIE)" },
      { name: "Economics", board: "Cambridge (CIE)" },
    ],
  },
  Other: {
    label: "Other",
    defaultBoard: "Other",
    grades: ["A*", "A", "B", "C", "D", "E"],
    defaultTarget: "A",
    subjects: [],
  },
};

export const PAPER_LINKS = [
  { name: "AQA", url: "https://www.aqa.org.uk/find-past-papers-and-mark-schemes", desc: "Official AQA past papers and mark schemes." },
  { name: "Edexcel", url: "https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html", desc: "Pearson Edexcel past papers." },
  { name: "OCR", url: "https://www.ocr.org.uk/students/past-papers/", desc: "OCR past papers by subject." },
  { name: "Cambridge", url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse/past-papers/", desc: "Cambridge IGCSE past papers." },
  { name: "Save My Exams", url: "https://www.savemyexams.com/", desc: "Revision notes, topic questions, papers." },
  { name: "Physics & Maths Tutor", url: "https://www.physicsandmathstutor.com/", desc: "Past papers and worked solutions." },
];
