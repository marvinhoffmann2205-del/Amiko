import { NextResponse } from "next/server";
import { loadDueLearningEvents } from "../../../lib/camiLearning";

export async function GET() {
  try {
    const events = await loadDueLearningEvents();

    console.log("Due learning events:", events);

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Learning test failed:", error);

    return NextResponse.json(
      { success: false, error: "Learning test failed" },
      { status: 500 }
    );
  }
}
