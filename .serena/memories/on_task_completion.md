# On Task Completion

Before considering a task complete, follow these steps:

1. **Lint & Format**: Run `pnpm lint` and `pnpm format` to ensure code quality and consistency.
2. **Build Check**: If the changes are significant, run `pnpm build` to ensure there are no build errors (especially TypeScript errors).
3. **Verify Functionality**: Test the affected parts of the application to ensure the changes work as expected.
4. **Clean Up**: Remove any temporary files or debug logs.
5. **Documentation**: Update memory files or README if necessary.
