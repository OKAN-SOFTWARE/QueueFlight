# GitHub launch kit

Working repository name: queueflight. The name has not been checked for trademark clearance or global uniqueness.

Description:

Local AWS SQS workbench: unwrap SNS/EventBridge payloads, compare messages, explore Lambda retries, and export fixtures. TypeScript + Rust desktop source.

Topics: aws, sqs, lambda, eventbridge, sns, developer-tools, debugging, typescript, rust, tauri, local-first.

Upload the complete repository contents at the GitHub repository root, including .github and dist. Confirm the Checks workflow passes. The desktop build is manually triggered separately. Do not describe that source as a tested desktop release until it has actually compiled and passed platform checks.

## Demo sequence

1. Load the fictional capture.
2. Follow the first message through SNS to EventBridge detail.
3. Point out the two identical Phoenix bodies and explain that matching content alone does not prove duplicate delivery.
4. Mark Mira's observation as a hypothetical failure in Retry lab.
5. Compare whole-batch, partial, and FIFO results.
6. Export a local fixture without connecting an AWS account.

Use entirely fictional data when recording or sharing. docs/cover.svg is an illustrated project cover, not a screenshot.

## Suggested announcement

I built QueueFlight to make failed-message debugging easier. It opens exported SQS/Lambda captures locally, unwraps nested SNS and EventBridge payloads, compares records, and generates local handler fixtures. Its retry lab explains whole-batch versus partial-batch behavior without touching a queue.

Browser app and CLI are available now; Tauri/Rust desktop source is included for platform validation. No account, AWS credentials, or cloud connection is needed for the demo.

I'd appreciate synthetic edge cases and accessibility feedback.

Source: [your repository link]

A clear, honest demonstration and a useful bug report are more valuable than inflated adoption numbers. Popularity cannot be guaranteed.
