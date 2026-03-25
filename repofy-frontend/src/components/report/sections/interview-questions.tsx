import { SectionCard } from "@/components/ui/section-card";
import type { ReportData } from "@shared/types/report";

interface InterviewQuestionsProps {
  questions: ReportData["interviewQuestions"];
}

export function InterviewQuestions({ questions }: InterviewQuestionsProps) {
  return (
    <SectionCard delay={0.54} title="Suggested Interview Questions" subtitle="Tailored to this candidate's profile">
        <div className="space-y-0 divide-y divide-border">
          {questions.map((q, i) => (
            <div
              key={q.question}
              className={`py-3 ${i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"} ${i === 0 ? "pt-0" : ""}`}
            >
              <p className="text-sm">
                <span className="font-mono text-cyan mr-2">{i + 1}.</span>
                {q.question}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground ml-5">
                ({q.why})
              </p>
            </div>
          ))}
        </div>
    </SectionCard>
  );
}
