import { Job, JobStatus } from "@prisma/client";
import { SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";

export function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") {
    throw new HttpError(403, "FORBIDDEN", "Admin access required");
  }
}

export function assertWorker(user: SessionUser) {
  if (user.role !== "worker") {
    throw new HttpError(403, "FORBIDDEN", "Worker access required");
  }
}

export function assertJobAccess(user: SessionUser, job: Pick<Job, "assignedWorkerId">) {
  if (user.role === "admin") {
    return;
  }

  if (job.assignedWorkerId !== user.id) {
    throw new HttpError(403, "FORBIDDEN", "Not assigned to this job");
  }
}

export function assertCollectPaymentAllowed(user: SessionUser, status: JobStatus) {
  if (user.role === "admin") {
    return;
  }

  if (status !== "finished") {
    throw new HttpError(
      400,
      "INVALID_JOB_STATUS",
      "Worker can only collect payment for finished jobs",
    );
  }
}
