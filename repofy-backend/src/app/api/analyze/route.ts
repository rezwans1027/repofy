import { NextResponse } from "next/server";
import { getDeepProfileData } from "@/lib/github";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { username, token } = await request.json();

    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch Deep Data (Profile + Readmes + File Trees)
    const data = await getDeepProfileData(username || "me", token);
    
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. Call OpenAI with Strict JSON Schema
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06", // MUST use this model for strict schema
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({
            candidate: data.userProfile.login,
            bio: data.userProfile.bio,
            contributions: data.userProfile.contributionsCollection,
            // We feed the AI the Evidence here
            code_evidence: data.repoDetails 
        }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "comprehensive_evaluation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              candidate_level: { type: "string", enum: ["Junior", "Mid-Level", "Senior", "Staff"] },
              hiring_recommendation: { type: "string", enum: ["Strong No Hire", "No Hire", "Leaning Hire", "Hire", "Strong Hire"] },
              career_capital_score: { type: "integer" },
              summary_narrative: { type: "string" },
              
              radar_chart: {
                type: "object",
                properties: {
                  code_quality: { type: "integer" },
                  project_complexity: { type: "integer" },
                  technical_breadth: { type: "integer" },
                  engineering_practices: { type: "integer" },
                  consistency_activity: { type: "integer" },
                  collaboration_docs: { type: "integer" }
                },
                required: ["code_quality", "project_complexity", "technical_breadth", "engineering_practices", "consistency_activity", "collaboration_docs"],
                additionalProperties: false
              },

              top_repos_analysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    tech_stack: { type: "array", items: { type: "string" } },
                    code_quality_grade: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
                    testing_status: { type: "string", enum: ["Strong", "Minimal", "None"] },
                    ci_cd_status: { type: "string", enum: ["Pipeline Configured", "Partial", "None"] },
                    ai_verdict: { type: "string" }
                  },
                  required: ["name", "description", "tech_stack", "code_quality_grade", "testing_status", "ci_cd_status", "ai_verdict"],
                  additionalProperties: false
                }
              },

              key_strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              
              red_flags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    flag: { type: "string" },
                    severity: { type: "string", enum: ["Minor", "Notable", "Critical"] }
                  },
                  required: ["flag", "severity"],
                  additionalProperties: false
                }
              },

              suggested_interview_questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    context: { type: "string" }
                  },
                  required: ["question", "context"],
                  additionalProperties: false
                }
              }
            },
            required: ["candidate_level", "hiring_recommendation", "career_capital_score", "summary_narrative", "radar_chart", "top_repos_analysis", "key_strengths", "weaknesses", "red_flags", "suggested_interview_questions"],
            additionalProperties: false
          }
        }
      }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content as string);

    return NextResponse.json({
      profile: data.userProfile,
      analysis: aiResponse
    });

  } catch (error) {
    console.error("Analysis Failed:", error);
    return NextResponse.json({ error: "Analysis Failed" }, { status: 500 });
  }
}