// ─── Bagel Availability Service ───────────────────────────────────────────────
// Central orchestration for bagel type availability control.
//
// Responsibilities:
//  1. Update local BagelAvailabilityState (source of truth)
//  2. Write AvailabilityAuditLog
//  3. Enqueue AvailabilitySyncJob for each enabled channel mapping
//  4. Execute pending sync jobs (called by background job runner or inline for UI)
//  5. Aggregate results for the admin UI
//
// Remote API failures never revert local state.

import "server-only";
import { prisma } from "@/lib/db";
import type { BagelChangeSource, SyncJobStatus } from "@/app/generated/prisma/enums";
import { AvailabilityAuditAction, ChannelSyncResult } from "@/app/generated/prisma/enums";
import type { AvailabilityChannel, AvailabilityAdapter, ChannelMapping, SyncOutcome } from "@/lib/integrations/availability/base";
import { loyverseAvailabilityAdapter } from "@/lib/integrations/availability/loyverse";
import { uberEatsAvailabilityAdapter } from "@/lib/integrations/availability/uber-eats";
import { doordashAvailabilityAdapter } from "@/lib/integrations/availability/doordash";

// ── Adapter registry ──────────────────────────────────────────────────────────

const ADAPTERS: Record<AvailabilityChannel, AvailabilityAdapter> = {
  loyverse: loyverseAvailabilityAdapter,
  uber_eats: uberEatsAvailabilityAdapter,
  doordash: doordashAvailabilityAdapter,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BagelTypeWithState {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  lastChangedAt: Date | null;
  channelStatuses: ChannelStatusSummary[];
}

export interface ChannelStatusSummary {
  channel: AvailabilityChannel;
  lastResult: string;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  lastKnownRemoteState: boolean | null;
}

export interface ToggleResult {
  success: boolean;
  bagelTypeId: string;
  newState: boolean;
  enqueuedJobs: string[];
  error?: string;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function listBagelTypesWithState(): Promise<BagelTypeWithState[]> {
  const bagelTypes = await prisma.bagelType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      availabilityStates: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      channelSyncStatuses: true,
    },
  });

  return bagelTypes.map((bt) => {
    const latestState = bt.availabilityStates[0];
    return {
      id: bt.id,
      code: bt.code,
      name: bt.name,
      sortOrder: bt.sortOrder,
      isActive: bt.isActive,
      isAvailable: latestState?.isAvailable ?? true,
      lastChangedAt: latestState?.createdAt ?? null,
      channelStatuses: bt.channelSyncStatuses.map((cs) => ({
        channel: cs.channel as AvailabilityChannel,
        lastResult: cs.lastResult,
        lastAttemptAt: cs.lastAttemptAt,
        lastSuccessAt: cs.lastSuccessAt,
        lastError: cs.lastError,
        lastKnownRemoteState: cs.lastKnownRemoteState,
      })),
    };
  });
}

// ── Toggle operation ──────────────────────────────────────────────────────────

export async function toggleBagelAvailability(params: {
  bagelTypeId: string;
  isAvailable: boolean;
  source: BagelChangeSource;
  userId?: string | null;
  actorLabel?: string;
  note?: string;
}): Promise<ToggleResult> {
  const { bagelTypeId, isAvailable, source, userId, actorLabel, note } = params;

  try {
    // 1. Verify bagel type exists
    const bagelType = await prisma.bagelType.findUnique({ where: { id: bagelTypeId } });
    if (!bagelType) {
      return { success: false, bagelTypeId, newState: isAvailable, enqueuedJobs: [], error: "Bagel type not found" };
    }

    // 2. Save new availability state (append-only — never overwrite)
    await prisma.bagelAvailabilityState.create({
      data: {
        bagelTypeId,
        isAvailable,
        changedByUserId: userId ?? null,
        changeSource: source,
        note: note ?? null,
      },
    });

    // 3. Write audit log
    await prisma.availabilityAuditLog.create({
      data: {
        bagelTypeId,
        action: isAvailable ? AvailabilityAuditAction.turned_on : AvailabilityAuditAction.turned_off,
        source,
        actorUserId: userId ?? null,
        actorLabel: actorLabel ?? null,
        details: { note },
      },
    });

    // 4. Enqueue sync jobs for all enabled channel mappings
    const mappings = await prisma.channelBagelMapping.findMany({
      where: { bagelTypeId, isEnabled: true },
    });

    // Group by channel
    const channelSet = new Set(mappings.map((m) => m.channel as AvailabilityChannel));
    const enqueuedJobs: string[] = [];

    for (const channel of channelSet) {
      const job = await prisma.availabilitySyncJob.create({
        data: {
          bagelTypeId,
          channel,
          targetState: isAvailable,
          status: "pending",
        },
      });
      enqueuedJobs.push(job.id);
    }

    return { success: true, bagelTypeId, newState: isAvailable, enqueuedJobs };
  } catch (err) {
    console.error("[BagelAvailabilityService] toggleBagelAvailability error:", err);
    return {
      success: false,
      bagelTypeId,
      newState: isAvailable,
      enqueuedJobs: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Batch toggle (all ON / all OFF) ──────────────────────────────────────────

export async function toggleAllBagelAvailability(params: {
  isAvailable: boolean;
  source: BagelChangeSource;
  userId?: string | null;
}): Promise<ToggleResult[]> {
  const bagelTypes = await prisma.bagelType.findMany({ where: { isActive: true } });
  const results = await Promise.all(
    bagelTypes.map((bt) =>
      toggleBagelAvailability({
        bagelTypeId: bt.id,
        isAvailable: params.isAvailable,
        source: params.source,
        userId: params.userId,
      })
    )
  );
  return results;
}

// ── Restore last change (undo last toggle) ────────────────────────────────────

export async function restoreLastChange(params: {
  bagelTypeId: string;
  source: BagelChangeSource;
  userId?: string | null;
}): Promise<ToggleResult> {
  const { bagelTypeId, source, userId } = params;

  // Get the two most recent states
  const recentStates = await prisma.bagelAvailabilityState.findMany({
    where: { bagelTypeId },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (recentStates.length < 2) {
    return { success: false, bagelTypeId, newState: true, enqueuedJobs: [], error: "No previous state to restore" };
  }

  const previousState = recentStates[1];

  return toggleBagelAvailability({
    bagelTypeId,
    isAvailable: previousState.isAvailable,
    source,
    userId,
    note: "Restored from previous state",
  });
}

// ── Job execution ─────────────────────────────────────────────────────────────

const BASE_RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 3_600_000; // 1 hour

export async function processPendingSyncJobs(limit = 20): Promise<void> {
  const now = new Date();
  const jobs = await prisma.availabilitySyncJob.findMany({
    where: {
      status: "pending",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { bagelType: true },
  });

  for (const job of jobs) {
    await executeSyncJob(job.id);
  }
}

export async function executeSyncJob(jobId: string): Promise<SyncOutcome | null> {
  const job = await prisma.availabilitySyncJob.findUnique({
    where: { id: jobId },
    include: {
      bagelType: true,
    },
  });

  if (!job) return null;

  // Mark as processing
  await prisma.availabilitySyncJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  const adapter = ADAPTERS[job.channel as AvailabilityChannel];
  if (!adapter) {
    await prisma.availabilitySyncJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        lastError: `No adapter found for channel: ${job.channel}`,
      },
    });
    return { status: "failed", error: `No adapter for channel: ${job.channel}`, retryable: false };
  }

  // Get channel mappings
  const mappings = await prisma.channelBagelMapping.findMany({
    where: { bagelTypeId: job.bagelTypeId, channel: job.channel as AvailabilityChannel, isEnabled: true },
  });

  const channelMappings: ChannelMapping[] = mappings.map((m) => ({
    id: m.id,
    bagelTypeId: m.bagelTypeId,
    channel: m.channel as AvailabilityChannel,
    remoteEntityType: m.remoteEntityType,
    remoteMenuId: m.remoteMenuId,
    remoteStoreId: m.remoteStoreId,
    metadata: m.metadata as Record<string, unknown> | null,
    isEnabled: m.isEnabled,
    remoteEntityId: m.remoteEntityId,
  }));

  let outcome: SyncOutcome;
  try {
    outcome = await adapter.pushAvailability(job.bagelType.code, job.targetState, channelMappings);
  } catch (err) {
    outcome = { status: "failed", error: String(err), retryable: true };
  }

  const now = new Date();
  const isSuccess = outcome.status === "success";
  const isFailed = outcome.status === "failed" || outcome.status === "partial";
  const shouldRetry =
    isFailed &&
    (outcome.status === "failed" ? outcome.retryable : true) &&
    job.retryCount < job.maxRetries;

  // Calculate next retry using exponential backoff
  let nextRetryAt: Date | null = null;
  let newStatus: SyncJobStatus = "success";
  if (shouldRetry) {
    const backoffMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, job.retryCount), MAX_RETRY_DELAY_MS);
    nextRetryAt = new Date(now.getTime() + backoffMs);
    newStatus = "pending";
  } else if (isFailed) {
    newStatus = "failed";
  }

  const errorMsg =
    outcome.status === "failed"
      ? outcome.error
      : outcome.status === "partial"
      ? outcome.errors.join("; ")
      : null;

  await prisma.availabilitySyncJob.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      retryCount: job.retryCount + (isFailed ? 1 : 0),
      nextRetryAt,
      lastError: errorMsg,
      responsePayload: JSON.parse(JSON.stringify(outcome)),
    },
  });

  // Update ChannelSyncStatus
  await prisma.channelSyncStatus.upsert({
    where: {
      bagelTypeId_channel: {
        bagelTypeId: job.bagelTypeId,
        channel: job.channel as AvailabilityChannel,
      },
    },
    update: {
      lastAttemptAt: now,
      ...(isSuccess ? { lastSuccessAt: now } : {}),
      lastResult: isSuccess
        ? ChannelSyncResult.success
        : outcome.status === "skipped"
        ? ChannelSyncResult.skipped
        : ChannelSyncResult.failed,
      lastError: errorMsg,
      ...(isSuccess ? { lastKnownRemoteState: job.targetState } : {}),
    },
    create: {
      bagelTypeId: job.bagelTypeId,
      channel: job.channel as AvailabilityChannel,
      lastAttemptAt: now,
      lastSuccessAt: isSuccess ? now : null,
      lastResult: isSuccess
        ? ChannelSyncResult.success
        : outcome.status === "skipped"
        ? ChannelSyncResult.skipped
        : ChannelSyncResult.failed,
      lastError: errorMsg,
      lastKnownRemoteState: isSuccess ? job.targetState : null,
    },
  });

  return outcome;
}

// ── Manual retry ──────────────────────────────────────────────────────────────

export async function retryFailedSyncs(bagelTypeId?: string): Promise<void> {
  const where = {
    status: "failed" as SyncJobStatus,
    ...(bagelTypeId ? { bagelTypeId } : {}),
  };

  // Reset failed jobs to pending so they get picked up by processPendingSyncJobs
  await prisma.availabilitySyncJob.updateMany({
    where,
    data: { status: "pending", nextRetryAt: null },
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function getAuditLogs(params: { bagelTypeId?: string; limit?: number }) {
  return prisma.availabilityAuditLog.findMany({
    where: params.bagelTypeId ? { bagelTypeId: params.bagelTypeId } : undefined,
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50,
    include: { bagelType: { select: { name: true, code: true } } },
  });
}
