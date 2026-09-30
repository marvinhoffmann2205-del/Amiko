"use client";

import { useEffect, useState } from "react";

type LearningEvent = {
  id: string;
  type: string;
  original: string;
  correction: string | null;
  meaning: string | null;
  explanation: string | null;
  importance: number;
  mastery: number;
  review_count: number;
  next_review_at: string;
};

export default function LearnPage() {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<"correct" | "incorrect" | null>(null);
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await fetch("/api/learning-test");
        const data = await response.json();

        if (data.success) {
          setEvents(data.events ?? []);
        }
      } catch (error) {
        console.error("Could not load learning reviews:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, []);

  async function checkAnswer() {
  if (!userAnswer.trim()) return;

  const event = events[currentIndex];
  if (!event) return;

const normalize = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;:]/g, "")
    .replace(/\s+/g, " ");

  const userNormalized = normalize(userAnswer);
const correctionNormalized = normalize(event.correction ?? "");

const removeOptionalYo = (text: string) =>
  text
    .replace(/\byo\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const correctionOptions = correctionNormalized
  .split("/")
  .map((option) => option.trim());

const correct = correctionOptions.some((option) =>
  userNormalized === option ||
  removeOptionalYo(userNormalized) === removeOptionalYo(option)
);
  setAnswerResult(correct ? "correct" : "incorrect");
  setShowAnswer(true);
  setSubmitting(true);

  try {
    const response = await fetch("/api/learning-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: event.id,
        correct,
        currentMastery: event.mastery,
        currentReviewCount: event.review_count,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error("Could not update review:", data);
    }
  } catch (error) {
    console.error("Could not submit review:", error);
  } finally {
    setSubmitting(false);
  }
}


  if (loading) {
    return <main style={{ padding: 40 }}>Loading your review...</main>;
  }

  if (events.length === 0) {
    return (
      <main style={{ padding: 40 }}>
        <h1>You're caught up 🎉</h1>
        <p>No reviews are due right now.</p>
      </main>
    );
  }

  const event = events[currentIndex];

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "60px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <p>
        Review {currentIndex + 1} of {events.length}
      </p>

      <h1>Learn with Cami</h1>

      <div
        style={{
          marginTop: 30,
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 16,
        }}
      >
        <p>
          <strong>Fix this:</strong>
        </p>

        <h2>{event.original}</h2>

       <div style={{ marginTop: 24 }}>
  <input
    type="text"
    value={userAnswer}
    onChange={(e) => setUserAnswer(e.target.value)}
    placeholder="Type the correct Spanish..."
    disabled={submitting}
    style={{
      width: "100%",
      padding: 12,
      fontSize: 16,
      borderRadius: 8,
      border: "1px solid #ccc",
      marginBottom: 12,
    }}
  />

  <button
    disabled={submitting || !userAnswer.trim()}
    onClick={async () => {
      setSubmitting(true);

      const correct =
        userAnswer.trim().toLowerCase() ===
        (event.correction ?? "").trim().toLowerCase();

      setAnswerResult(correct ? "correct" : "incorrect");
      setShowAnswer(true);

      try {
        await fetch("/api/learning-review", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: event.id,
            correct,
          }),
        });
      } catch (error) {
        console.error("Could not save review:", error);
      } finally {
        setSubmitting(false);
      }
    }}
  >
    Check answer
  </button>

  {showAnswer && (
    <div style={{ marginTop: 20 }}>
      <p>
        <strong>
          {answerResult === "correct" ? "✅ Correct!" : "❌ Not quite"}
        </strong>
      </p>

      <p>
        <strong>Better Spanish:</strong>
      </p>

      <h2>{event.correction}</h2>

      {event.explanation && <p>{event.explanation}</p>}

      <button
        onClick={() => {
          if (currentIndex < events.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setShowAnswer(false);
            setUserAnswer("");
            setAnswerResult(null);
          }
        }}
      >
        Next
      </button>
    </div>
  )}
</div>
    </div>
  </main>
);
}
            
