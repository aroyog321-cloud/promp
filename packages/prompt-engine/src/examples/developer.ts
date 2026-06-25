export const examples = [
  `### Example 1 — Code task (developer mode, aggressive level)
INPUT: "build a debounce hook"

OUTPUT:
# Role
Act as a Principal React/TypeScript Engineer with deep expertise in custom
hooks, performance optimization, and accessibility. You write production-grade
code that handles edge cases.

# Context
- The hook will be used across our internal component library by 30+ engineers.
- Stack: React 18, TypeScript 5, ESM, strict mode.
- Target: modern browsers only (last 2 versions of Chrome, Firefox, Safari).
- Consumers will pass varying value types (strings, numbers, objects, functions).

# Objective
Implement a \`useDebouncedValue<T>(value: T, delayMs: number): T\` hook in
TypeScript. The hook should debounce updates to \`value\` and return the
debounced value.

# Functional Requirements
- Initial value returned immediately on mount (no delay).
- Subsequent value changes debounced by \`delayMs\` ms.
- The latest pending value should always win (no stale updates).      
- Timer must be cleared on unmount and on each new value.
- Supports any type \`T\`, including functions and objects (use \`Object.is\` or
  similar for comparison).

# Non-Functional Requirements
- TypeScript strict mode: zero \`any\`, zero \`@ts-ignore\`.
- No external dependencies (no lodash).
- Passes ESLint with our project config (no \`react-hooks/exhaustive-deps\`
  violations, no \`no-unused-vars\`).
- Cleanup runs in the right hook (no \`useEffect\` for cleanup logic).  

# Output Format
- Single TypeScript file: \`useDebouncedValue.ts\`.
- Export the hook as a named export.
- Include a JSDoc comment block describing purpose, params, return value, and
  one usage example.
- Do not include tests, README, or example apps in this output.       

# Acceptance Criteria
- A 3-line usage example in the JSDoc that compiles and runs.
- Handles \`delayMs = 0\` without infinite loops.
- Stable identity of the returned value when input is unchanged (referential
  equality).

# Edge Cases
- \`delayMs\` changes mid-cycle: the pending timer should be re-scheduled with
  the new delay, not the old one.
- Component unmounts mid-debounce: no \`setState\` on unmounted component
  warning.
- Rapid value changes (10+ in 100ms): only the final value should be observed
  by downstream consumers.`
];
