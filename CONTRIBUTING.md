# Contributing to Shiora Health AI

Thank you for your interest in contributing to Shiora. This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Conventions](#commit-conventions)

## Development Setup

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Git

### Getting Started

1. Fork the repository on GitHub.

2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/shiora.git
   cd shiora
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy the environment file:

   ```bash
   cp .env.example .env.local
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Run the validation suite to confirm everything works:

   ```bash
   npm run validate
   ```

   This runs type checking, linting, format checking, and the full test suite.

## Code Style

### TypeScript

- Strict mode is enabled. All code must pass `tsc --noEmit` with zero errors.
- Use explicit return types on exported functions and hooks.
- Prefer `interface` over `type` for object shapes that may be extended.
- Use Zod schemas for runtime validation of API inputs and external data.
- Avoid `any`. Use `unknown` with type guards where the type is genuinely uncertain.

### React

- Use functional components exclusively.
- Custom hooks must follow the `use` prefix convention (e.g., `useHealthRecords`).
- Use React Query (TanStack Query) for all server state management.
- Prefer composition over prop drilling. Use context providers for cross-cutting concerns.
- Keep components focused. Extract complex logic into custom hooks.

### Styling

- Use Tailwind CSS utility classes for all styling.
- Avoid inline styles and CSS modules.
- Use the design tokens and color palette defined in `tailwind.config.ts`.
- Maintain responsive design across all pages (mobile-first approach).

### File Organization

- Components are organized by domain in `src/components/<domain>/`.
- Each domain directory has a barrel `index.ts` for clean imports.
- Hooks live in `src/hooks/` with a barrel `index.ts`.
- Types live in `src/types/`.
- API route handlers live in `src/app/api/<domain>/`.

### Formatting

- Prettier is configured for consistent formatting.
- Run `npm run format` before committing, or configure your editor to format on save.
- Do not modify the Prettier configuration without team discussion.

## Testing Requirements

All contributions must include appropriate tests and must not break existing tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Guidelines

- Write tests for all new hooks, API routes, and non-trivial components.
- Use Testing Library for component tests. Query by accessible roles and text, not by implementation details.
- Use MSW (Mock Service Worker) for mocking API calls in tests.
- Tests must be deterministic. Do not rely on timing, network, or external state.
- Aim for meaningful coverage, not 100% line coverage. Test behavior, not implementation.

### Before Submitting

All of the following must pass:

```bash
npm run validate
```

This runs:
1. `tsc --noEmit` -- TypeScript type checking
2. `next lint` -- ESLint
3. `prettier --check .` -- Format verification
4. `jest` -- Full test suite

## Pull Request Process

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes, ensuring all tests pass and the code follows the style guidelines.

3. Run the full validation suite:

   ```bash
   npm run validate
   ```

4. Push your branch and open a pull request against `main`.

5. Fill out the pull request template with:
   - A clear description of the changes
   - The motivation or issue being addressed
   - Any breaking changes
   - Screenshots for UI changes

6. Address review feedback. Push additional commits rather than force-pushing.

7. Once approved, a maintainer will merge your pull request.

### PR Requirements

- All CI checks must pass.
- At least one approving review from a maintainer.
- No unresolved review comments.
- Branch must be up to date with `main`.

## Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Formatting changes (no code logic change) |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling |
| `perf` | Performance improvements |

### Scope

Use the domain name when applicable: `consent`, `vault`, `chat`, `governance`, `marketplace`, `zkp`, `fhir`, `alerts`, `wearables`, `research`, `rewards`, `reputation`, `xai`, `privacy`, `community`.

### Examples

```
feat(vault): add compartment encryption for reproductive data
fix(consent): resolve expiration check for time-bound grants
test(hooks): add tests for useHealthRecords pagination
docs: update API routes overview in README
refactor(components): organize components into domain subdirectories
chore: update React Query to v5.17
```

---

If you have questions about contributing, please open an issue for discussion.
