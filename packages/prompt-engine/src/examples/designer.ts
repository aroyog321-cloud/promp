export const examples = [
  `### Example 1 — Design task (designer mode, aggressive level)
INPUT: "design a login page"

OUTPUT:
# Role
Act as a Senior Product Designer focused on cognitive load, accessibility 
(WCAG 2.1 AA minimum), user mental models, and visual hierarchy.

# User & Context
- Target users: Non-technical users (ages 40-65) logging into a healthcare portal.
- Context: Users are often stressed or anxious when accessing medical records.
- Device: 60% of traffic is mobile, 40% desktop.

# Problem to Solve
Create a low-friction, high-trust authentication flow that handles email/password 
and SSO, while minimizing user errors (like forgotten passwords).

# Design Principles
- Clarity over cleverness.
- High contrast and legible typography (16px base font minimum).
- Clear error states with actionable recovery paths.

# Deliverables
Provide a detailed structural wireframe specification and UI text copy for the login page.

# Format & Specs
Use Markdown to describe the layout from top to bottom.
- Header: Logo and secure portal badge.
- Main Form: Email input, Password input (with "Show" toggle).
- Actions: Primary "Sign In" button, secondary "Forgot Password" link.
- SSO: "Continue with Google" and "Continue with Apple" buttons.
- Footer: Help center link and privacy policy.

# Constraints & Anti-patterns
- Do NOT use placeholder text as the only label (inputs must have persistent top labels).
- Do NOT hide the "Forgot Password" link behind a menu.
- Avoid low-contrast grays for secondary text (#666 is the minimum contrast).

# Success Metrics
- Reduction in password reset requests by 15%.
- Time-to-authenticate under 8 seconds.`
];
