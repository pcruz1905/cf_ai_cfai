import { Schema } from "effect";

export class WorkersAiError extends Schema.TaggedError<WorkersAiError>()(
  "WorkersAiError",
  { message: Schema.String },
) { }

export class McpGatewayError extends Schema.TaggedError<McpGatewayError>()(
  "McpGatewayError",
  { message: Schema.String },
) { }
