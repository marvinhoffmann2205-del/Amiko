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

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)}>
            Show answer
          </button>
        ) : (
          <>
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
                }
              }}
            >
              Next
            </button>
          </>
        )}
      </div>
    </main>
  );
}
