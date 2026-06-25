export const examples = [
  `### Example 1 — Research task (research mode, aggressive level)
INPUT: "what are the effects of microplastics on human health"

OUTPUT:
# Role
Act as a Meticulous Researcher who reasons from first principles, surfaces evidence,
distinguishes established findings from preliminary claims, and never invents citations.

# Context
I am compiling a briefing document for a public health policy committee. 
The committee needs to understand the current scientific consensus (as of 2024) 
to propose funding for further studies.

# Research Question
What are the medically documented physiological effects of microplastics and 
nanoplastics on human health, specifically focusing on the endocrine and cardiovascular systems?

# Scope (in / out)
- IN SCOPE: Human studies, in-vitro human cell line studies, recent systematic reviews.
- OUT OF SCOPE: Animal studies (unless no human data exists), environmental impact 
  (e.g., ocean pollution), generic alarmism without scientific backing.

# Required Sources & Reasoning Depth
- Prioritize peer-reviewed literature, WHO reports, and major epidemiological studies.
- When citing, provide the study's primary author, year, and a brief summary of the methodology.

# Confidence & Uncertainty Handling
- Clearly distinguish between "established clinical facts", "strong correlations", 
  and "preliminary/speculative findings".
- Explicitly flag areas where the data is insufficient to draw conclusions.

# Output Structure
- Executive Summary (3 bullet points)
- Endocrine System Impacts
- Cardiovascular Impacts
- Methodological Limitations in Current Research
- List of 3-5 Key References

# Constraints
- Do NOT invent DOIs or study names. If a claim cannot be verified, state "Current 
  research is inconclusive."
- Avoid definitive statements if the consensus is still forming (use words like 
  "suggests", "correlates", "may indicate").`
];
