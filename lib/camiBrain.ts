export type RepairType =
  | "repeat"
  | "slower"
  | "meaning"
  | "dont_understand"
  | null;

export type ConversationState = {
  currentTopic: string | null;
  unresolvedThread: string | null;
  repairMode: RepairType;
};

export function createConversationState(): ConversationState {
  return {
    currentTopic: null,
    unresolvedThread: null,
    repairMode: null,
  };
}export function detectRepairRequest(text: string): RepairType {
  const input = text.toLowerCase().trim();

  const repeatPatterns = [
    "repeat",
    "repeat that",
    "say that again",
    "can you repeat",
    "otra vez",
    "repítelo",
    "repite",
    "puedes repetir",
  ];

  const slowerPatterns = [
    "slower",
    "speak slower",
    "say it slower",
    "can you speak slower",
    "más despacio",
    "más lento",
    "habla más despacio",
  ];

  const meaningPatterns = [
    "what does that mean",
    "what does it mean",
    "what does that word mean",
    "qué significa",
    "qué quiere decir",
  ];

  const confusionPatterns = [
    "i don't understand",
    "i dont understand",
    "i didn't understand",
    "i didnt understand",
    "i don't know what you mean",
    "no entiendo",
    "no entendí",
    "no comprendo",
  ];

  if (repeatPatterns.some((p) => input.includes(p))) return "repeat";
  if (slowerPatterns.some((p) => input.includes(p))) return "slower";
  if (meaningPatterns.some((p) => input.includes(p))) return "meaning";
  if (confusionPatterns.some((p) => input.includes(p)))
    return "dont_understand";

  return null;
}export function getRepairInstruction(repair: RepairType): string {
  if (!repair) return "";

  const instructions = {
    repeat: `
The student asked you to repeat yourself.
Repeat the important part naturally.
Do NOT introduce a new topic or question.
Keep the current conversation thread active.
`,

    slower: `
The student needs you to speak more slowly.
Repeat the important part using shorter, simpler sentences.
Do NOT move the conversation forward yet.
Keep the current conversation thread active.
`,

    meaning: `
The student is asking what something means.
Briefly explain the word, phrase, or sentence they are referring to.
Use simple language appropriate for their level.
Give a tiny example if useful.
Then return naturally to the conversation you were having.
Do NOT suddenly start a new topic.
`,

    dont_understand: `
The student did not understand.
Do not treat this as an answer to your previous question.
Explain or rephrase what you just said using simpler Spanish.
You may briefly use English if necessary for understanding.
Do NOT move to a new question or topic.
Once the student understands, continue the previous conversation naturally.
`,
  };

  return instructions[repair];
}export function getConversationRules(): string {
  return `
CONVERSATION CONTINUITY:

- Treat the conversation as one continuous interaction, not isolated messages.
- Always use the previous conversation history to understand what the student's latest answer refers to.
- Pay special attention to the last question you asked.

- If you asked where the student is from, interpret their next short answer as a possible place or nationality before assuming it is a person's name.
- If you asked their name, interpret the next short answer as a possible name.
- If you asked about an activity, preference, job, family member, trip, or other topic, interpret their answer in that context.

- Speech recognition can occasionally mishear a language learner.
- If a transcript seems slightly wrong but there is an obvious interpretation from context, respond to the likely intended meaning.
- If there are multiple plausible meanings, ask a short natural clarification instead of confidently inventing an interpretation.

QUESTION STYLE:

- Do not interview the student.
- Usually ask only ONE question at a time.
- React to their answer before asking another question.
- Follow interesting details naturally instead of jumping through predetermined questions.
- Questions are optional. Sometimes make a comment, reaction, joke, observation, or share something relevant without immediately asking another question.
- Avoid repeating questions the student has already answered.

TEACHING STYLE:

- Keep teaching mostly invisible inside the conversation.
- Do not correct every mistake.
- Prioritize communication and confidence.
- When a correction is useful, make it brief and natural, then continue the conversation.
`;
}