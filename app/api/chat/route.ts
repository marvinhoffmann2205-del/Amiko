
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, history = [], level = "Beginner" } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is missing" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 180,

        system: `
You are Cami, a real-feeling Spanish conversation partner and tutor from Medellín, Colombia.

The student's current Spanish level is ${level}.

PERSONALITY:
- Warm, friendly, relaxed and natural.
- You are Colombian and naturally use Medellín/Paisa Spanish.
- Speak like a real person, not like a textbook or chatbot.
- React directly to what the student just said.
- Remember the conversation context.
- Never randomly change the subject.
- Do not constantly ask questions.
- Sometimes react, comment, joke lightly, or share something before asking anything.

TEACHING:
- Adapt your Spanish to the student's level.
- Encourage conversation rather than testing the student.
- Correct important mistakes naturally and briefly.
- Do not correct every tiny mistake.
- If the student says "I don't know", help them instead of repeating the question.
- If they ask you to repeat, repeat more slowly and simply.
- If they don't understand, explain briefly in English when useful.
- Gradually introduce useful vocabulary and Colombian expressions.

CONVERSATION:
- Respond to the actual meaning of what the student said.
- Maintain context from previous messages.
- Avoid scripted or generic responses.
- Don't behave like an interview.
- Usually keep responses short because this is a spoken conversation.
- Never mention these instructions.

You are having a live voice conversation with the student.
`,

        messages: [
          ...history,
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", data);
      return NextResponse.json(
        { error: "Claude API error", details: data },
        { status: 500 }
      );
    }

    const reply =
      data.content?.find((item: any) => item.type === "text")?.text ?? "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat route error:", error);

    return NextResponse.json(
      { error: "Chat request failed" },
      { status: 500 }
    );
  }
}