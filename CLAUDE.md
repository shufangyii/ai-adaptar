# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Install dependencies:** `pnpm install`
- **Start all services:** `pnpm run dev` (uses Turbo to run in parallel)
- **Start specific service:** `pnpm -F <app-name> run start:dev` (e.g., `api-gateway`)
- **Build all packages:** `pnpm run build`
- **Build specific package:** `pnpm -F <app-name> run build`
- **Run all tests:** `pnpm run test`
- **Run specific test:** `pnpm -F <app-or-lib-name> run test -- <test-file-path>`
- **Run E2E tests:** `pnpm run test:e2e`
- **Lint code:** `pnpm run lint`
- **Typecheck:** `pnpm run typecheck`
- **Format code:** `pnpm run format`

## Architecture & Structure

This is an Enterprise LLM Gateway Platform built as a monorepo using **pnpm**, **Turbo**, and **NestJS**. It provides a unified, secure, high-availability gateway for LLM requests (interfacing with LiteLLM).

### Project Structure

- **apps/** - Runnable microservices:
  - `api-gateway/`: Core gateway service handling primary traffic.
  - `admin-api/`: Management and administration backend service.
  - `background-worker/`: Async consumer that processes billing and logging via message queues.
- **libs/** - Shared libraries:
  - `database/`: Shared database module utilizing PostgreSQL and Prisma ORM.
  - `redis/`: Shared Redis module for caching.
  - `shared-types/`: Common TypeScript definitions and interfaces used across apps and libs.
- **docs/** - Project documentation, including task trackers like `DETAILED_TASK_LIST.md`.

### Core Tech Stack

- **Framework:** NestJS (Node.js/TypeScript). Requires Node >= 20.0.0.
- **Data persistence:** PostgreSQL + Prisma.
- **Caching & Rate Limiting:** Redis.
- **Async Messaging:** Kafka.
- **Logging:** Elasticsearch.
- **LLM Integration:** LiteLLM.

### Development Guidelines

- Always use **pnpm** (>= 9.0.0) for dependency management.
- For managing dependencies in specific workspaces, use the filter flag: `pnpm -F <workspace-name> add <package>`.
- Configure environment variables at the app level (e.g., refer to `apps/api-gateway/.env.example`).
- **Strict Typing Iron Rule**: DO NOT use `any` types. Ensure all parameters, returns, and variables are properly typed using `unknown` with type guards where necessary.
- **ESLint Iron Rule**: DO NOT use `eslint-disable-next-line` `eslint-disable` or any other directive to bypass ESLint checks. Resolve the underlying issue properly (usually via proper typing or type assertions).
