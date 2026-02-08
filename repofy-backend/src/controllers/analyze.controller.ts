import { RequestHandler } from "express";
import OpenAI from "openai";
import { env } from "../config/env";
import { fetchGitHubUserData, GitHubError } from "../services/github.service";
import { SYSTEM_PROMPT } from "../lib/prompts";

const openai = new OpenAI({ apiKey: env.openaiApiKey });

const JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    candidate_level: {
      type: "string" as const,
      enum: ["Junior", "Mid-Level", "Senior", "Staff"],
    },
    hiring_recommendation: {
      type: "string" as const,
      enum: ["Strong No Hire", "No Hire", "Leaning Hire", "Hire", "Strong Hire"],
    },
    career_capital_score: { type: "integer" as const },
    summary_narrative: { type: "string" as const },
    radar_chart: {
      type: "object" as const,
      properties: {
        code_quality: { type: "integer" as const },
        project_complexity: { type: "integer" as const },
        technical_breadth: { type: "integer" as const },
        engineering_practices: { type: "integer" as const },
        consistency_activity: { type: "integer" as const },
        collaboration_docs: { type: "integer" as const },
      },
      required: [
        "code_quality",
        "project_complexity",
        "technical_breadth",
        "engineering_practices",
        "consistency_activity",
        "collaboration_docs",
      ],
      additionalProperties: false,
    },
    top_repos_analysis: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          description: { type: "string" as const },
          tech_stack: { type: "array" as const, items: { type: "string" as const } },
          code_quality_grade: {
            type: "string" as const,
            enum: ["Excellent", "Good", "Fair", "Poor"],
          },
          testing_status: {
            type: "string" as const,
            enum: ["Strong", "Minimal", "None"],
          },
          ci_cd_status: {
            type: "string" as const,
            enum: ["Pipeline Configured", "Partial", "None"],
          },
          ai_verdict: { type: "string" as const },
        },
        required: [
          "name",
          "description",
          "tech_stack",
          "code_quality_grade",
          "testing_status",
          "ci_cd_status",
          "ai_verdict",
        ],
        additionalProperties: false,
      },
    },
    key_strengths: { type: "array" as const, items: { type: "string" as const } },
    weaknesses: { type: "array" as const, items: { type: "string" as const } },
    red_flags: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          flag: { type: "string" as const },
          severity: {
            type: "string" as const,
            enum: ["Minor", "Notable", "Critical"],
          },
        },
        required: ["flag", "severity"],
        additionalProperties: false,
      },
    },
    suggested_interview_questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          question: { type: "string" as const },
          context: { type: "string" as const },
        },
        required: ["question", "context"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "candidate_level",
    "hiring_recommendation",
    "career_capital_score",
    "summary_narrative",
    "radar_chart",
    "top_repos_analysis",
    "key_strengths",
    "weaknesses",
    "red_flags",
    "suggested_interview_questions",
  ],
  additionalProperties: false,
};

export const postAnalyze: RequestHandler = async (req, res) => {
  try {
    const { username } = req.body as { username?: string };
    const targetUsername = (username || "").trim();
    if (!targetUsername) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    if (!env.openaiApiKey) {
      res.status(500).json({
        error: "OpenAI API key not configured. Set OPENAI_API_KEY in .env",
      });
      return;
    }

    const data = await fetchGitHubUserData(targetUsername);

    const contributionsCollection = {
      totalContributions: data.contributions?.totalContributions ?? 0,
      heatmap: data.contributions?.heatmap ?? [],
      activity: data.activity,
    };

    const codeEvidence = data.topRepositories.slice(0, 6).map((r) => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stars,
      topics: r.topics,
      url: r.url,
      isArchived: r.isArchived,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            candidate: data.profile.username,
            bio: data.profile.bio,
            contributions: contributionsCollection,
            code_evidence: codeEvidence,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "comprehensive_evaluation",
          strict: true,
          schema: JSON_SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "Analysis Failed: No response from AI" });
      return;
    }

    const analysis = JSON.parse(content);

    res.json({
      success: true,
      data: {
        profile: data.profile,
        repositories: data.repositories,
        stats: data.stats,
        activity: data.activity,
        languages: data.languages,
        contributions: data.contributions,
        analysis,
      },
    });
  } catch (err) {
    if (err instanceof GitHubError) {
      res.status(err.statusCode).json({
        success: false,
        error: err.message,
      });
      return;
    }
    console.error("Analysis Failed:", err);
    res.status(500).json({
      success: false,
      error: "Analysis Failed",
    });
  }
};
