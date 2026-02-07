// src/lib/types.ts

export interface AnalysisReport {
    // 1. The "Verdict" Snapshot
    candidate_level: "Junior" | "Mid-Level" | "Senior" | "Staff";
    hiring_recommendation: "Strong No Hire" | "No Hire" | "Leaning Hire" | "Hire" | "Strong Hire";
    career_capital_score: number; // 0-100
    summary_narrative: string; // 2-3 sentences executive summary
  
    // 2. The Radar Chart (Holistic Dimensions)
    radar_chart: {
      code_quality: number; // 1-10
      project_complexity: number; // 1-10
      technical_breadth: number; // 1-10
      engineering_practices: number; // 1-10 (CI/CD, Tests)
      consistency_activity: number; // 1-10
      collaboration_docs: number; // 1-10
    };
  
    // 3. The "Deep Dive" (Per Repo Evidence)
    top_repos_analysis: Array<{
      name: string;
      description: string;
      tech_stack: string[];
      // The "Why"
      code_quality_grade: "Excellent" | "Good" | "Fair" | "Poor";
      testing_status: "Strong" | "Minimal" | "None";
      ci_cd_status: "Pipeline Configured" | "Partial" | "None";
      ai_verdict: string; // 1 sentence insight
    }>;
  
    // 4. The Lists
    key_strengths: string[];
    weaknesses: string[];
    red_flags: Array<{
      flag: string;
      severity: "Minor" | "Notable" | "Critical";
    }>;
  
    // 5. The Interview Prep (High Value Add)
    suggested_interview_questions: Array<{
      question: string;
      context: string; // "Ask this because their repo lacks tests..."
    }>;
  }