import { addHours, isAfter, isBefore } from "date-fns";
import { JobStatus } from "@prisma/client";
import { createAppointmentActionToken } from "@/lib/appointment-action-links";
import {
  hasSuccessfulAppointmentEmailEvent,
  sendAppointmentEmailBestEffort,
} from "@/lib/email/appointments";
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
const BUSINESS_TIME_ZONE = "America/Los_Angeles";
const DAY_OF_EMAIL_REMINDER_START_HOUR = 6;

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

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .find((item) => item.type === "hour")?.value;
  const parsed = Number.parseInt(hour || "0", 10);

  return parsed === 24 ? 0 : parsed;
}

function isDayOfEmailReminderDue(params: {
  now: Date;
  scheduledStart: Date;
}) {
  if (params.scheduledStart.getTime() <= params.now.getTime()) {
    return false;
  }

  return (
    localDateKey(params.now) === localDateKey(params.scheduledStart) &&
    localHour(params.now) >= DAY_OF_EMAIL_REMINDER_START_HOUR
  );
}

export async function runAppointmentReminderDispatch(params: {
  baseUrl: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const earliestStart = now;
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
          email: true,
          phoneE164: true,
          smsOptOut: true,
        },
      },
      assignedWorker: {
        select: {
          name: true,
        },
      },
      events: {
        where: {
          type: "MESSAGE_SENT",
        },
        select: {
          type: true,
          metadata: true,
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
  let emailAttempted = 0;
  let emailSent = 0;
  let emailSkippedAlreadySent = 0;
  let emailSkippedNoEmail = 0;
  let emailSkippedWindow = 0;

  const baseUrl = normalizeBaseUrl(params.baseUrl);

  for (const job of jobs) {
    if (
      isDayOfEmailReminderDue({
        now,
        scheduledStart: job.scheduledStart,
      })
    ) {
      if (
        hasSuccessfulAppointmentEmailEvent({
          events: job.events,
          templateKey: "APPOINTMENT_DAY_OF_REMINDER",
        })
      ) {
        emailSkippedAlreadySent += 1;
      } else if (!job.customer.email) {
        emailSkippedNoEmail += 1;
      } else {
        emailAttempted += 1;
        const emailResult = await sendAppointmentEmailBestEffort({
          job,
          templateKey: "APPOINTMENT_DAY_OF_REMINDER",
          baseUrl,
        });

        if (emailResult.status === "sent" || emailResult.status === "mock_sent") {
          emailSent += 1;
        }
      }
    } else {
      emailSkippedWindow += 1;
    }

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
    emailAttempted,
    emailSent,
    emailSkippedAlreadySent,
    emailSkippedNoEmail,
    emailSkippedWindow,
    runAt: now.toISOString(),
  };
}
