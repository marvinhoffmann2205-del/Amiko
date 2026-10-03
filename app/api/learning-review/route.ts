import { NextResponse } from "next/server";
import { updateLearningReview } from "../../../lib/camiLearning";

export async function POST(req: Request) {
  try {
    const {
      id,
      result,
    } = await req.json();

    if (!id || !["correct", "almost", "incorrect"].includes(result)) {
      return NextResponse.json(
        { success: false, error: "Invalid review data" },
        { status: 400 }
      );
    }

    const updatedEvent = await updateLearningReview(
      id,
      result
    );

    return NextResponse.json({
      success: true,
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Learning review API failed:", error);

    return NextResponse.json(
      { success: false, error: "Could not update review" },
      { status: 500 }
    );
  }
}
