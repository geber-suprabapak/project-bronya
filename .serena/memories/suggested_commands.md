# Suggested Commands

The following commands are used for developing and maintaining the project.

## Development
```bash
pnpm dev
```
Starts the Next.js development server.

## Building
```bash
pnpm build
```
Builds the application for production.

## Production
```bash
pnpm start
```
Starts the production server after building.

## Linting & Formatting
```bash
pnpm lint
```
Checks for linting and formatting issues using Biome.

```bash
pnpm format
```
Automatically fixes formatting issues using Biome.

## Database (Drizzle)
```bash
pnpm drizzle-kit push
```
Pushes the schema changes to the database (if configured).

```bash
pnpm drizzle-kit generate
```
Generates migrations from the schema (if configured).
