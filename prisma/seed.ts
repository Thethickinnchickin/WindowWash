import {
  JobEventType,
  JobStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";

const prisma = new PrismaClient();

type SeedJob = {
  customerIndex: number;
  workerEmail: string;
  dayOffset: number;
  startHour: number;
  durationHours: number;
  status: JobStatus;
  amountDueCents: number;
  notes?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

function buildDate(dayOffset: number, hour: number, minutes = 0): Date {
  const base = addDays(new Date(), dayOffset);
  base.setHours(hour, minutes, 0, 0);
  return base;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  await prisma.idempotencyKey.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.jobEvent.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Alex Admin",
      email: "admin@windowwash.local",
      passwordHash,
      role: Role.admin,
    },
  });

  const workerOne = await prisma.user.create({
    data: {
      name: "Wendy Worker",
      email: "wendy@windowwash.local",
      passwordHash,
      role: Role.worker,
    },
  });

  const workerTwo = await prisma.user.create({
    data: {
      name: "Ben Buffer",
      email: "ben@windowwash.local",
      passwordHash,
      role: Role.worker,
    },
  });

  const workersByEmail = new Map([
    [workerOne.email, workerOne],
    [workerTwo.email, workerTwo],
  ]);

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Jordan Mills",
        phoneE164: "+14155550101",
        email: "jordan@example.com",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Riley Chen",
        phoneE164: "+14155550102",
        email: "riley@example.com",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Taylor Ramirez",
        phoneE164: "+14155550103",
        smsOptOut: true,
      },
    }),
  ]);

  const jobs: SeedJob[] = [
    {
      customerIndex: 0,
      workerEmail: workerOne.email,
      dayOffset: 0,
      startHour: 8,
      durationHours: 2,
      status: JobStatus.scheduled,
      amountDueCents: 18000,
      notes: "Gate code 2048",
      street: "101 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
    },
    {
      customerIndex: 1,
      workerEmail: workerOne.email,
      dayOffset: 0,
      startHour: 10,
      durationHours: 2,
      status: JobStatus.on_my_way,
      amountDueCents: 22500,
      notes: "Call before arrival",
      street: "2401 Fillmore St",
      city: "San Francisco",
      state: "CA",
      zip: "94115",
    },
    {
      customerIndex: 2,
      workerEmail: workerTwo.email,
      dayOffset: 0,
      startHour: 11,
      durationHours: 2,
      status: JobStatus.in_progress,
      amountDueCents: 25000,
      street: "501 Embarcadero",
      city: "Oakland",
      state: "CA",
      zip: "94607",
    },
    {
      customerIndex: 0,
      workerEmail: workerTwo.email,
      dayOffset: 0,
      startHour: 13,
      durationHours: 2,
      status: JobStatus.finished,
      amountDueCents: 20500,
      street: "12 Mission Bay Blvd",
      city: "San Francisco",
      state: "CA",
      zip: "94158",
    },
    {
      customerIndex: 1,
      workerEmail: workerOne.email,
      dayOffset: 0,
      startHour: 15,
      durationHours: 2,
      status: JobStatus.paid,
      amountDueCents: 30000,
      street: "800 Howard St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
    },
    {
      customerIndex: 2,
      workerEmail: workerTwo.email,
      dayOffset: 1,
      startHour: 9,
      durationHours: 2,
      status: JobStatus.scheduled,
      amountDueCents: 19000,
      street: "330 14th St",
      city: "Oakland",
      state: "CA",
      zip: "94612",
    },
    {
      customerIndex: 0,
      workerEmail: workerOne.email,
      dayOffset: 2,
      startHour: 10,
      durationHours: 2,
      status: JobStatus.scheduled,
      amountDueCents: 21000,
      street: "91 9th St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
    },
    {
      customerIndex: 1,
      workerEmail: workerTwo.email,
      dayOffset: 4,
      startHour: 8,
      durationHours: 2,
      status: JobStatus.canceled,
      amountDueCents: 17500,
      notes: "Customer requested next month",
      street: "1820 Telegraph Ave",
      city: "Berkeley",
      state: "CA",
      zip: "94704",
    },
  ];

  for (const jobSeed of jobs) {
    const worker = workersByEmail.get(jobSeed.workerEmail);
    if (!worker) {
      throw new Error(`Missing worker ${jobSeed.workerEmail}`);
    }

    const scheduledStart = buildDate(jobSeed.dayOffset, jobSeed.startHour);
    const scheduledEnd = buildDate(
      jobSeed.dayOffset,
      jobSeed.startHour + jobSeed.durationHours,
    );

    const job = await prisma.job.create({
      data: {
        customerId: customers[jobSeed.customerIndex].id,
        assignedWorkerId: worker.id,
        scheduledStart,
        scheduledEnd,
        status: jobSeed.status,
        amountDueCents: jobSeed.amountDueCents,
        notes: jobSeed.notes,
        street: jobSeed.street,
        city: jobSeed.city,
        state: jobSeed.state,
        zip: jobSeed.zip,
      },
    });

    await prisma.jobEvent.create({
      data: {
        jobId: job.id,
        userId: admin.id,
        type: JobEventType.JOB_CREATED,
        metadata: { createdBy: admin.email },
      },
    });

    await prisma.jobEvent.create({
      data: {
        jobId: job.id,
        userId: admin.id,
        type: JobEventType.JOB_ASSIGNED,
        metadata: { workerId: worker.id },
      },
    });

    if (jobSeed.status === JobStatus.canceled) {
      await prisma.jobEvent.create({
        data: {
          jobId: job.id,
          userId: admin.id,
          type: JobEventType.JOB_CANCELED,
          metadata: { reason: jobSeed.notes ?? "Canceled in seed" },
        },
      });
      continue;
    }

    if (jobSeed.status !== JobStatus.scheduled) {
      await prisma.jobEvent.create({
        data: {
          jobId: job.id,
          userId: worker.id,
          type: JobEventType.STATUS_CHANGED,
          metadata: { from: JobStatus.scheduled, to: jobSeed.status },
        },
      });
    }

    if (jobSeed.status === JobStatus.paid) {
      await prisma.payment.create({
        data: {
          jobId: job.id,
          status: PaymentStatus.succeeded,
          method: PaymentMethod.card,
          amountCents: jobSeed.amountDueCents,
          cardBrand: "visa",
          cardLast4: "4242",
        },
      });

      await prisma.jobEvent.create({
        data: {
          jobId: job.id,
          userId: worker.id,
          type: JobEventType.PAYMENT_RECORDED,
          metadata: {
            method: PaymentMethod.card,
            amountCents: jobSeed.amountDueCents,
            status: PaymentStatus.succeeded,
          },
        },
      });
    }
  }

  // Keep the sample credentials easy to discover in local dev output.
  console.log("Seed complete.");
  console.log("Admin: admin@windowwash.local / Password123!");
  console.log("Worker: wendy@windowwash.local / Password123!");
  console.log("Worker: ben@windowwash.local / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
