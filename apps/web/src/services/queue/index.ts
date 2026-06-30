export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: number;
}

export interface QueueProvider {
  enqueue(type: string, payload: Record<string, unknown>): Promise<string>;
  process(type: string, handler: (job: Job) => Promise<void>): void;
  health(): Promise<boolean>;
  shutdown(): Promise<void>;
}

/**
 * In-process queue used in all environments until Upstash or Inngest is wired up.
 *
 * KNOWN LIMITATION: Jobs are held in the Node.js process heap.
 * On Vercel, every cold start begins with an empty queue — any jobs that were
 * enqueued in a previous lambda invocation are lost. This is intentional and
 * acceptable while queue volume is low. When you need durable job persistence,
 * replace this with a real Upstash/Inngest implementation.
 *
 * Do NOT reinstate the UpstashQueue or InngestQueue stubs — those silently
 * drop jobs (they log a message and return "stub-id" without actually enqueuing
 * anything), which is worse than this in-process queue.
 */
export class MemoryQueue implements QueueProvider {
  private jobs = new Map<string, Job>();

  async enqueue(type: string, payload: Record<string, unknown>): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const job: Job = { id, type, payload, attempts: 0, createdAt: Date.now() };
    this.jobs.set(id, job);
    console.log(`[Queue: Memory] Enqueued ${type} job ${id}:`, payload);
    return id;
  }

  process(type: string, handler: (job: Job) => Promise<void>): void {
    console.log(`[Queue: Memory] Registered handler for ${type}`);
    // Simulate background processing for local dev
    setInterval(async () => {
      for (const [id, job] of this.jobs.entries()) {
        if (job.type === type) {
          this.jobs.delete(id); // Simple pop
          try {
            job.attempts++;
            await handler(job);
            console.log(`[Queue: Memory] Processed ${type} job ${id} successfully.`);
          } catch (e) {
            console.error(`[Queue: Memory] Failed to process ${type} job ${id}:`, e);
            if (job.attempts < 3) {
              this.jobs.set(id, job); // Retry
            }
          }
        }
      }
    }, 1000);
  }

  async health(): Promise<boolean> {
    return true;
  }

  async shutdown(): Promise<void> {
    console.log('[Queue: Memory] Shutting down');
  }
}

let activeQueue: QueueProvider | null = null;

export const getQueue = (): QueueProvider => {
  if (activeQueue) return activeQueue;
  // Always use MemoryQueue until a real provider is configured.
  // See the MemoryQueue comment above for limitations.
  activeQueue = new MemoryQueue();
  return activeQueue;
};
