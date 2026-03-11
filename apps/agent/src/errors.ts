import { Schema } from "effect";

export class WorkersAiError extends Schema.TaggedError<WorkersAiError>()(
  "WorkersAiError",
  { message: Schema.String },
) {}
