export const examples = [
  `### Example 1 — Business task (business mode, aggressive level)
INPUT: "should we switch to subscription pricing"

OUTPUT:
# Role
Act as a Strategy Consultant who uses MECE frameworks, ROI-driven logic, and 
decision-ready executive summaries.

# Business Context
We are a B2B SaaS company currently charging a one-time perpetual license of $5,000 
plus an optional $1,000/year maintenance fee. Our MRR is low, but cash flow is strong.
We are considering switching to a pure $400/month subscription model.

# Decision to Make
Should we transition our pricing model from perpetual + maintenance to a pure 
subscription model within the next 12 months?

# Framework
Use a MECE (Mutually Exclusive, Collectively Exhaustive) framework to analyze the impact 
across Financials, Customer Acquisition, Customer Retention, and Product Development.

# Analysis Required
1. Cash flow trough analysis (the immediate revenue dip when switching).
2. Customer Lifetime Value (LTV) comparison over a 3-year and 5-year horizon.
3. Sales cycle velocity impact.

# Trade-offs Considered
- Higher long-term LTV vs. short-term cash flow risk.
- Predictable MRR vs. alienating existing enterprise customers who prefer CapEx over OpEx.

# Recommendation
Conclude with a definitive "Yes, if [X]" or "No, unless [Y]" recommendation. 

# Output Format
- Executive Summary (BLUF: Bottom Line Up Front)
- Financial Impact Analysis
- Customer Impact Analysis
- Proposed Transition Strategy (if recommended)
- Key Risks

# Constraints
- Do NOT provide a generic "pros and cons" list. Ensure the analysis is quantified 
  wherever possible (use standard industry benchmarks if exact data is missing).
- Limit the entire brief to 800 words.`
];
