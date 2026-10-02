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

type GradeResult = "correct" | "almost" | "incorrect";

export default function LearnPage() {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answerResult, setAnswerResult] =
    useState<GradeResult | null>(null);
  const [feedback, setFeedback] = useState("");
  const [betterSpanish, setBetterSpanish] = useState("");
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
    if (!userAnswer.trim() || submitting) return;

    const event = events[currentIndex];
    if (!event) return;

    setSubmitting(true);

    try {
      const gradeResponse = await fetch("/api/learning-grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          original: event.original,
          correction: event.correction,
          meaning: event.meaning,
          answer: userAnswer,
        }),
      });

      const gradeData = await gradeResponse.json();

      if (!gradeResponse.ok || !gradeData.success) {
        throw new Error(
          gradeData.error || "AI grading failed"
        );
      }

      const result = gradeData.result as GradeResult;

      setAnswerResult(result);
      setFeedback(gradeData.feedback ?? "");
      setBetterSpanish(
        gradeData.betterSpanish ||
          event.correction ||
          ""
      );
      setShowAnswer(true);

      const reviewResponse = await fetch(
        "/api/learning-review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: event.id,
            result,
            currentMastery: event.mastery,
            currentReviewCount: event.review_count,
          }),
        }
      );

      const reviewData = await reviewResponse.json();

      if (!reviewResponse.ok || !reviewData.success) {
        console.error(
          "Could not update review:",
          reviewData
        );
      }
    } catch (error) {
      console.error("Learn checkAnswer error:", error);
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (currentIndex >= events.length - 1) return;

    setCurrentIndex((index) => index + 1);
    setShowAnswer(false);
    setUserAnswer("");
    setAnswerResult(null);
    setFeedback("");
    setBetterSpanish("");
  }

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        Loading your review...
      </main>
    );
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
            onChange={(e) =>
              setUserAnswer(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !submitting &&
                userAnswer.trim()
              ) {
                checkAnswer();
              }
            }}
            placeholder="Type the correct Spanish..."
            disabled={submitting || showAnswer}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
          />

          {!showAnswer && (
            <button
              type="button"
              disabled={
                submitting || !userAnswer.trim()
              }
              onClick={checkAnswer}
            >
              {submitting
                ? "Checking..."
                : "Check answer"}
            </button>
          )}

          {showAnswer && (
            <div style={{ marginTop: 20 }}>
              <p>
                <strong>
                  {answerResult === "correct"
                    ? "✅ Correct!"
                    : answerResult === "almost"
                    ? "🟡 Almost!"
                    : "❌ Not quite"}
                </strong>
              </p>

              {feedback && <p>{feedback}</p>}

              <p>
                <strong>Better Spanish:</strong>
              </p>

              <h2>
                {betterSpanish ||
                  event.correction}
              </h2>

              {event.explanation && (
                <p>{event.explanation}</p>
              )}

              {currentIndex <
                events.length - 1 && (
                <button
                  type="button"
                  onClick={nextQuestion}
                >
                  Next
                </button>
              )}

              {currentIndex ===
                events.length - 1 && (
                <p>
                  🎉 Review complete!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
