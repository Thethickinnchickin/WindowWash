import { withApiErrorHandling } from "@/lib/api";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { jsonData } from "@/lib/errors";
import { availabilityQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const parsed = availabilityQuerySchema.safeParse({
      date: url.searchParams.get("date") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      durationMinutes: url.searchParams.get("durationMinutes") ?? undefined,
    });

    if (!parsed.success) {
      throw {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid availability query",
        details: parsed.error.flatten(),
      };
    }

    const availability = await getAvailableSlotsForDate({
      date: parsed.data.date,
      state: parsed.data.state,
      durationMinutes: parsed.data.durationMinutes,
    });

    return jsonData(availability);
  });
}
