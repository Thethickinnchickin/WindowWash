import { addHours, isAfter, isBefore } from "date-fns";
import { JobStatus } from "@prisma/client";
import { createAppointmentActionToken } from "@/lib/appointment-action-links";
import { prisma } from "@/lib/prisma";
import { sendSmsForJob } from "@/lib/sms/service";

type ReminderWindow = {
  templateKey: "REMINDER_24H" | "REMINDER_2H";
  targetHours: number;
  toleranceMinutes: number;
};

const REMINDER_WINDOWS: ReminderWindow[] = [
  {
    templateKey: "REMINDER_24H",
    targetHours: 24,
    toleranceMinutes: 45,
  },
  {
    templateKey: "REMINDER_2H",
    targetHours: 2,
    toleranceMinutes: 20,
  },
];

const UPCOMING_STATUSES: JobStatus[] = ["scheduled", "on_my_way"];

function isInReminderWindow(params: {
  now: Date;
  scheduledStart: Date;
  targetHours: number;
  toleranceMinutes: number;
}) {
  const target = addHours(params.now, params.targetHours);
  const lowerBound = new Date(target.getTime() - params.toleranceMinutes * 60_000);
  const upperBound = new Date(target.getTime() + params.toleranceMinutes * 60_000);

  return (
    (isAfter(params.scheduledStart, lowerBound) || params.scheduledStart.getTime() === lowerBound.getTime()) &&
    (isBefore(params.scheduledStart, upperBound) || params.scheduledStart.getTime() === upperBound.getTime())
  );
}

function hasSuccessfulReminderLog(params: {
  templateKey: ReminderWindow["templateKey"];
  smsLogs: { templateKey: string; status: string }[];
}) {
  return params.smsLogs.some(
    (log) =>
      log.templateKey === params.templateKey &&
      ["sent", "mock_sent", "queued"].includes(log.status),
  );
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function runAppointmentReminderDispatch(params: {
  baseUrl: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const earliestStart = addHours(now, 1);
  const latestStart = addHours(now, 26);

  const jobs = await prisma.job.findMany({
    where: {
      status: {
        in: UPCOMING_STATUSES,
      },
      scheduledStart: {
        gte: earliestStart,
        lte: latestStart,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phoneE164: true,
          smsOptOut: true,
        },
      },
      assignedWorker: {
        select: {
          name: true,
        },
      },
      smsLogs: {
        where: {
          templateKey: {
            in: REMINDER_WINDOWS.map((window) => window.templateKey),
          },
        },
        select: {
          templateKey: true,
          status: true,
        },
      },
    },
  });

  let attempted = 0;
  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedWindow = 0;

  const baseUrl = normalizeBaseUrl(params.baseUrl);

  for (const job of jobs) {
    for (const window of REMINDER_WINDOWS) {
      if (
        !isInReminderWindow({
          now,
          scheduledStart: job.scheduledStart,
          targetHours: window.targetHours,
          toleranceMinutes: window.toleranceMinutes,
        })
      ) {
        skippedWindow += 1;
        continue;
      }

      if (hasSuccessfulReminderLog({ templateKey: window.templateKey, smsLogs: job.smsLogs })) {
        skippedAlreadySent += 1;
        continue;
      }

      const token = await createAppointmentActionToken({
        jobId: job.id,
        action: "confirm",
        expiresAt: addHours(job.scheduledStart, 6),
      });

      const confirmUrl = `${baseUrl}/customer/confirm/${job.id}?token=${encodeURIComponent(token)}`;
      const rescheduleUrl = `${baseUrl}/customer/portal`;

      attempted += 1;
      const result = await sendSmsForJob({
        job,
        templateKey: window.templateKey,
        templateValues: {
          confirmUrl,
          rescheduleUrl,
        },
      });

      if ("status" in result && (result.status === "sent" || result.status === "mock_sent")) {
        sent += 1;
      }
    }
  }

  return {
    scannedJobs: jobs.length,
    attempted,
    sent,
    skippedAlreadySent,
    skippedWindow,
    runAt: now.toISOString(),
  };
}
