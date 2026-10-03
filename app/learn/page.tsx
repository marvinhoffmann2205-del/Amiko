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

  const [loadError, setLoadError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);

  async function loadReviews() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/learning-test");
      const data = await response.json();

      if (!response.ok || !data.success || !Array.isArray(data.events)) {
        throw new Error("Could not load reviews");
      }
      setEvents(data.events);
    } catch (error) {
      console.error("Could not load learning reviews:", error);
      setLoadError("Could not load your reviews. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  async function checkAnswer() {
    if (!userAnswer.trim() || submitting || showAnswer) return;

    const event = events[currentIndex];
    if (!event) return;

    setSubmitting(true);
    setReviewError("");

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

      if (!["correct", "almost", "incorrect"].includes(gradeData.result)) {
        throw new Error("Invalid grading result");
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

      await saveReview(event.id, result);
    } catch (error) {
      console.error("Learn checkAnswer error:", error);
      setReviewError("Could not check your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveReview(id: string, result: GradeResult) {
    setSubmitting(true);
    setReviewError("");
    try {
      const response = await fetch("/api/learning-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, result }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error("Review save failed");
      setReviewSaved(true);
    } catch (error) {
      console.error("Could not save review:", error);
      setReviewError("Could not save your progress. Please try saving again.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (submitting || !reviewSaved || currentIndex >= events.length - 1) return;

    setCurrentIndex((index) => index + 1);
    setShowAnswer(false);
    setUserAnswer("");
    setAnswerResult(null);
    setFeedback("");
    setBetterSpanish("");
    setReviewError("");
    setReviewSaved(false);
  }

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        Loading your review...
      </main>
    );
  }

  if (loadError) {
    return (
      <main style={{ padding: 40 }}>
        <p role="alert">{loadError}</p>
        <button type="button" onClick={loadReviews}>Try again</button>
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
                !showAnswer &&
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

          {reviewError && <p role="alert">{reviewError}</p>}

          {showAnswer && !reviewSaved && (
            <button
              type="button"
              disabled={submitting || !answerResult}
              onClick={() => answerResult && saveReview(event.id, answerResult)}
            >
              {submitting ? "Saving..." : "Try saving again"}
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
                  disabled={submitting || !reviewSaved}
                >
                  Next
                </button>
              )}

              {reviewSaved && currentIndex ===
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
