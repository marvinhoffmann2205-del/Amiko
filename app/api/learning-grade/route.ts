import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { original, correction, meaning, answer } = await req.json();

    if (!answer?.trim()) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is missing" },
        { status: 500 }
      );
    }

    const prompt = `
You are grading a Spanish learner's answer.

Original sentence:
"${original ?? ""}"

Suggested correction:
"${correction ?? ""}"

Target meaning / teaching point:
"${meaning ?? ""}"

Student answer:
"${answer}"

Decide whether the student's answer demonstrates that they understood
the target correction.

IMPORTANT GRADING RULES:
- Accept natural Spanish alternatives that preserve the intended meaning.
- Do not require an exact match with the suggested correction.
- Subject pronouns such as "yo" may be included or omitted when both are grammatical.
- Ignore capitalization.
- Do not mark an answer wrong only because Spanish accents/diacritics are missing.
- Different word order is acceptable when natural Spanish allows it.
- Accept different grammatical constructions when they correctly express the intended meaning.
- For example, "mañana voy", "mañana yo voy", "yo voy mañana", and "mañana iré"
  can all be correct depending on the target.
- Focus on whether the learner fixed the actual mistake being tested.
- Do not accept an answer if it repeats the target mistake.
- "almost" means the learner fixed the main target mistake but still made another
  meaningful Spanish error.
- Keep feedback short and encouraging.

Return ONLY valid JSON in exactly this shape:

{
  "result": "correct" | "almost" | "incorrect",
  "feedback": "short explanation",
  "betterSpanish": "natural corrected Spanish"
}
`;

    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 250,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning grader API error:", errorText);

      return NextResponse.json(
        { error: "Learning grader failed" },
        { status: 500 }
      );
    }

    const data = await response.json();

    const raw =
      data?.content?.[0]?.text?.trim() ?? "";

    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      console.error("Learning grader invalid response:", raw);

      return NextResponse.json(
        { error: "Invalid grader response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(match[0]);

    if (
      !["correct", "almost", "incorrect"].includes(parsed.result)
    ) {
      throw new Error("Invalid grading result");
    }

    return NextResponse.json({
      success: true,
      result: parsed.result,
      feedback: parsed.feedback ?? "",
      betterSpanish: parsed.betterSpanish ?? correction ?? "",
    });
  } catch (error) {
    console.error("Learning grade error:", error);

    return NextResponse.json(
      { error: "Failed to grade answer" },
      { status: 500 }
    );
  }
}