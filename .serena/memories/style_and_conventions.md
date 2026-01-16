# Style and Conventions

## General Guidelines
- Use **TypeScript** for all code.
- Follow **React 19** best practices (e.g., server components where possible).
- Use **Biome** for consistent linting and formatting.

## UI Components
- Use **Shadcn UI** components located in `src/components/ui`.
- Use **Tailwind CSS 4** for styling.
- Prioritize **Radix UI** primitives for accessible interactive elements.

## Database
- Define schema using **Drizzle ORM** in `src/server/db/schema.ts`.
- Use snake_case for database column names and camelCase for TypeScript property names (if not already handled by Drizzle).

## Naming Conventions
- Files: `kebab-case.ts` or `kebab-case.tsx`.
- Components: `PascalCase`.
- Functions and variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE`.
