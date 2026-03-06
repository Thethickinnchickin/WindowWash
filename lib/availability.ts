import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const DEFAULT_SLOT_MINUTES = 30;
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 18;

type WorkerWithCapacity = {
  id: string;
  name: string;
  serviceState: string | null;
  dailyJobCapacity: number;
};

type WorkerJobWindow = {
  id: string;
  assignedWorkerId: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
};

function buildDayWindow(dateValue: Date) {
  const dayStart = new Date(dateValue);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

function parseDateOnly(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "INVALID_DATE", "Invalid date");
  }
  return parsed;
}

function overlaps(start: Date, end: Date, job: WorkerJobWindow) {
  return job.scheduledStart < end && job.scheduledEnd > start;
}

function eligibleWorkerFilter(state?: string | null): Prisma.UserWhereInput {
  if (!state?.trim()) {
    return {
      role: "worker",
      isActive: true,
    };
  }

  return {
    role: "worker",
    isActive: true,
    OR: [{ serviceState: null }, { serviceState: state.trim().toUpperCase() }],
  };
}

async function getEligibleWorkers(state?: string | null) {
  return prisma.user.findMany({
    where: eligibleWorkerFilter(state),
    select: {
      id: true,
      name: true,
      serviceState: true,
      dailyJobCapacity: true,
    },
    orderBy: [{ dailyJobCapacity: "desc" }, { createdAt: "asc" }],
  });
}

async function getWorkerJobsForWindow(params: {
  workerIds: string[];
  start: Date;
  end: Date;
  excludeJobId?: string;
}) {
  if (!params.workerIds.length) {
    return [];
  }

  return prisma.job.findMany({
    where: {
      assignedWorkerId: {
        in: params.workerIds,
      },
      status: {
        not: "canceled",
      },
      scheduledStart: {
        lt: params.end,
      },
      scheduledEnd: {
        gt: params.start,
      },
      ...(params.excludeJobId ? { id: { not: params.excludeJobId } } : {}),
    },
    select: {
      id: true,
      assignedWorkerId: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
    },
  });
}

function buildWorkerJobMap(workerIds: string[], jobs: WorkerJobWindow[]) {
  const byWorker = new Map<string, WorkerJobWindow[]>();
  for (const workerId of workerIds) {
    byWorker.set(workerId, []);
  }

  for (const job of jobs) {
    if (!job.assignedWorkerId) {
      continue;
    }
    byWorker.get(job.assignedWorkerId)?.push(job);
  }

  return byWorker;
}

function jobsCountForDay(jobs: WorkerJobWindow[], dayStart: Date, dayEnd: Date) {
  return jobs.filter((job) => job.scheduledStart >= dayStart && job.scheduledStart < dayEnd).length;
}

function workerIsAvailable(params: {
  worker: WorkerWithCapacity;
  workerJobs: WorkerJobWindow[];
  slotStart: Date;
  slotEnd: Date;
  dayStart: Date;
  dayEnd: Date;
}) {
  const scheduledToday = jobsCountForDay(params.workerJobs, params.dayStart, params.dayEnd);
  if (scheduledToday >= params.worker.dailyJobCapacity) {
    return false;
  }

  return !params.workerJobs.some((job) => overlaps(params.slotStart, params.slotEnd, job));
}

export async function getAvailableSlotsForDate(params: {
  date: string;
  state?: string | null;
  durationMinutes: number;
  slotMinutes?: number;
}) {
  const day = parseDateOnly(params.date);
  const { dayStart, dayEnd } = buildDayWindow(day);
  const slotMinutes = params.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const durationMinutes = Math.max(30, params.durationMinutes);

  const workers = await getEligibleWorkers(params.state);
  if (!workers.length) {
    return {
      date: params.date,
      workersConsidered: 0,
      slots: [] as {
        startIso: string;
        endIso: string;
        label: string;
        availableWorkerCount: number;
      }[],
    };
  }

  const workerJobs = await getWorkerJobsForWindow({
    workerIds: workers.map((worker) => worker.id),
    start: dayStart,
    end: dayEnd,
  });
  const jobsByWorker = buildWorkerJobMap(
    workers.map((worker) => worker.id),
    workerJobs,
  );

  const slots: {
    startIso: string;
    endIso: string;
    label: string;
    availableWorkerCount: number;
  }[] = [];

  for (
    let minuteOfDay = WORKDAY_START_HOUR * 60;
    minuteOfDay + durationMinutes <= WORKDAY_END_HOUR * 60;
    minuteOfDay += slotMinutes
  ) {
    const slotStart = new Date(dayStart);
    slotStart.setMinutes(minuteOfDay);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

    let availableWorkerCount = 0;
    for (const worker of workers) {
      const schedule = jobsByWorker.get(worker.id) ?? [];
      if (
        workerIsAvailable({
          worker,
          workerJobs: schedule,
          slotStart,
          slotEnd,
          dayStart,
          dayEnd,
        })
      ) {
        availableWorkerCount += 1;
      }
    }

    if (availableWorkerCount > 0) {
      slots.push({
        startIso: slotStart.toISOString(),
        endIso: slotEnd.toISOString(),
        label: slotStart.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        availableWorkerCount,
      });
    }
  }

  return {
    date: params.date,
    workersConsidered: workers.length,
    slots,
  };
}

export async function pickBestWorkerForSlot(params: {
  state?: string | null;
  start: Date;
  end: Date;
  excludeJobId?: string;
  preferredWorkerId?: string | null;
}) {
  const { dayStart, dayEnd } = buildDayWindow(params.start);
  const workers = await getEligibleWorkers(params.state);
  if (!workers.length) {
    return null;
  }

  const workerJobs = await getWorkerJobsForWindow({
    workerIds: workers.map((worker) => worker.id),
    start: dayStart,
    end: dayEnd,
    excludeJobId: params.excludeJobId,
  });
  const jobsByWorker = buildWorkerJobMap(
    workers.map((worker) => worker.id),
    workerJobs,
  );

  const scoredWorkers = workers
    .map((worker) => {
      const jobs = jobsByWorker.get(worker.id) ?? [];
      const scheduledToday = jobsCountForDay(jobs, dayStart, dayEnd);
      const available = workerIsAvailable({
        worker,
        workerJobs: jobs,
        slotStart: params.start,
        slotEnd: params.end,
        dayStart,
        dayEnd,
      });

      return {
        worker,
        jobsToday: scheduledToday,
        available,
      };
    })
    .filter((entry) => entry.available);

  if (!scoredWorkers.length) {
    return null;
  }

  if (params.preferredWorkerId) {
    const preferred = scoredWorkers.find((entry) => entry.worker.id === params.preferredWorkerId);
    if (preferred) {
      return preferred.worker;
    }
  }

  scoredWorkers.sort((left, right) => left.jobsToday - right.jobsToday);
  return scoredWorkers[0].worker;
}

export async function assertWorkerCanTakeSlot(params: {
  workerId: string;
  start: Date;
  end: Date;
  excludeJobId?: string;
}) {
  const worker = await prisma.user.findFirst({
    where: {
      id: params.workerId,
      role: "worker",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      dailyJobCapacity: true,
    },
  });

  if (!worker) {
    throw new HttpError(404, "WORKER_NOT_FOUND", "Worker not found");
  }

  const { dayStart, dayEnd } = buildDayWindow(params.start);
  const jobs = await getWorkerJobsForWindow({
    workerIds: [worker.id],
    start: dayStart,
    end: dayEnd,
    excludeJobId: params.excludeJobId,
  });
  const schedule = jobs;

  const isAvailable = workerIsAvailable({
    worker: {
      id: worker.id,
      name: worker.name,
      serviceState: null,
      dailyJobCapacity: worker.dailyJobCapacity,
    },
    workerJobs: schedule,
    slotStart: params.start,
    slotEnd: params.end,
    dayStart,
    dayEnd,
  });

  if (!isAvailable) {
    throw new HttpError(
      409,
      "WORKER_NOT_AVAILABLE",
      "Worker is not available in the selected schedule window",
    );
  }
}
