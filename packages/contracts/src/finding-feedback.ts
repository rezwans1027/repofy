import { z } from "zod";
import { KeySchema, TimestampSchema, IdempotencyKeySchema } from "./primitives";
export const FEEDBACK_CHOICES = ["accurate", "inaccurate", "unclear", "irrelevant"] as const;
export const REVIEW_STATES = ["open", "needs_reproduction", "confirmed_issue", "not_reproduced", "resolved", "duplicate"] as const;
export const REVIEW_NOTES = ["needs_fixture", "reproduced_synthetic", "not_reproduced", "coverage_limitation", "wording_issue", "duplicate", "requires_authorization"] as const;
export const FindingReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("capability"), id: KeySchema }),
  z.strictObject({ kind: z.enum(["claim", "evidence", "improvement"]), id: z.uuid() }),
]);
// Text is owner-only and rendered as text. Reject invisible control/direction overrides.
export const FeedbackCommentSchema = z.string().trim().max(1000).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(s));
export const FindingFeedbackRequestSchema = z.strictObject({ classification: z.enum(FEEDBACK_CHOICES), comment: FeedbackCommentSchema.default(""),
  expectedRevision: z.number().int().min(0).max(100000), idempotencyKey: IdempotencyKeySchema });
export const FindingFeedbackSchema = z.strictObject({ id: z.uuid(), reportId: z.uuid(), finding: FindingReferenceSchema,
  classification: z.enum(FEEDBACK_CHOICES), comment: FeedbackCommentSchema, revision: z.number().int().positive(), updatedAt: TimestampSchema,
  disposition: z.enum(REVIEW_STATES) });
export const FindingFeedbackResponseSchema = z.strictObject({ feedback: FindingFeedbackSchema.nullable(), writable: z.boolean() });
export const ReviewRequestSchema = z.strictObject({ expectedRevision: z.number().int().positive(), expectedReviewRevision: z.number().int().min(0),
  disposition: z.enum(REVIEW_STATES), note: z.enum(REVIEW_NOTES),
  benchmarkCase: z.enum(["run15.fork", "run15.template", "run15.bulk", "run15.identities", "run15.unknown", "run15.generated"]).nullable(), idempotencyKey: IdempotencyKeySchema });
export const ReviewQueueQuerySchema = z.strictObject({ afterId: z.uuid().optional(), limit: z.number().int().min(1).max(50).default(20), disposition: z.enum(REVIEW_STATES).optional() });
export const ReviewItemSchema = z.strictObject({ id: z.uuid(), kind: z.enum(["capability", "claim", "evidence", "improvement"]),
  classification: z.enum(FEEDBACK_CHOICES), revision: z.number().int().positive(), reviewRevision: z.number().int().min(0),
  updatedAt: TimestampSchema, disposition: z.enum(REVIEW_STATES), note: z.enum(REVIEW_NOTES).nullable(), benchmarkCase: ReviewRequestSchema.shape.benchmarkCase,
  detector: z.strictObject({ id: KeySchema, version: z.string().max(64) }).nullable() });
export const ReviewQueueSchema = z.strictObject({ items: z.array(ReviewItemSchema).max(50), nextId: z.uuid().nullable() });
export type FindingReference = z.infer<typeof FindingReferenceSchema>;
export type FindingFeedback = z.infer<typeof FindingFeedbackSchema>;
export type FindingFeedbackResponse = z.infer<typeof FindingFeedbackResponseSchema>;
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
