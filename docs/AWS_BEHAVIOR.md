# AWS behavior and model boundaries

Sources reviewed 2026-10-24. QueueFlight implements an educational model of selected behaviors, not an AWS emulator.

## Envelope and metadata import

- [ReceiveMessage API](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html): response shape, string bodies, system attributes, receive counts, and epoch-millisecond timestamps.
- [Lambda SQS events](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html): SQS event records and the at-least-once processing model.

The importer normalizes AWS API names (`Body`, `MessageId`, `Attributes`) and Lambda names (`body`, `messageId`, `attributes`). It requires a string body. Receive count is shown only when supplied as an attribute string. Queue configuration, queue state, redrive policy, retention, visibility timeout, and actual processing errors are not inferred from a capture.

Recognized nested envelopes are SNS Notification objects with a string Message, and objects with source, detail-type, and detail fields. Envelope recognition follows shape, not authenticated origin. Imported JSON is untrusted data; a matching shape does not prove AWS produced it. Decoding stops after six steps and preserves the remainder.

## Retry behavior

[Lambda error handling for SQS](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) explains:

- A function error fails the whole batch by default, potentially retrying already-processed messages.
- Partial responses require ReportBatchItemFailures and return failed IDs as batchItemFailures[].itemIdentifier.
- An exception still makes the invocation a complete failure.
- With FIFO, stop processing after the first failure and return failed and unprocessed messages to preserve order.

QueueFlight's whole-batch mode models a thrown error if any hypothetical failure is marked. Partial mode models successful processing of every unmarked record. FIFO mode returns every record from the first marked failure onward in input order, a deliberately conservative example. It does not model group-specific concurrency or earlier effects from your handler. With no marked failures, all selected records succeed in the model.

At-least-once delivery can still produce duplicate processing. A partial response is not a guarantee of exactly-once behavior. Real results also depend on handler implementation, event source settings, idempotency, timeouts, throttling, and queue policies.

## Fixtures

Fixtures keep the original body and supplied IDs. Missing IDs are assigned a visible queueflight-local prefix. Receipt handles are always replaced with QUEUEFLIGHT_LOCAL_FIXTURE. Missing ARN/region/MD5 fields use documented local placeholders (account 000000000000, us-east-1, and a zero MD5). Message attributes are mapped from API field casing to Lambda casing.

These are local handler-input fixtures, not ReceiveMessage API replays or proof that a payload will be accepted by a live system. A zero MD5 is not a digest of the body. Missing system attributes are not fabricated. Do not submit placeholder receipt handles to AWS APIs. The tool never executes AWS operations.
