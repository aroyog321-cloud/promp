export interface Job {
  id: string;
  type: string;
  payload: Record<string, any>;
  attempts: number;
  createdAt: number;
}

export interface QueueProvider {
  enqueue(type: string, payload: Record<string, any>): Promise<string>;
  process(type: string, handler: (job: Job) => Promise<void>): void;
  health(): Promise<boolean>;
  shutdown(): Promise<void>;
}

export class MemoryQueue implements QueueProvider {
  private jobs = new Map<string, Job>();

  async enqueue(type: string, payload: Record<string, any>): Promise<string> {
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

export class UpstashQueue implements QueueProvider {
  async enqueue(type: string, payload: Record<string, any>): Promise<string> {
    console.log(`[Queue: Upstash] Stub enqueue ${type}`);
    return "stub-id";
  }
  process(type: string, handler: (job: Job) => Promise<void>): void {
    console.log(`[Queue: Upstash] Stub process ${type}`);
  }
  async health(): Promise<boolean> { return true; }
  async shutdown(): Promise<void> {}
}

export class InngestQueue implements QueueProvider {
  async enqueue(type: string, payload: Record<string, any>): Promise<string> {
    console.log(`[Queue: Inngest] Stub enqueue ${type}`);
    return "stub-id";
  }
  process(type: string, handler: (job: Job) => Promise<void>): void {
    console.log(`[Queue: Inngest] Stub process ${type}`);
  }
  async health(): Promise<boolean> { return true; }
  async shutdown(): Promise<void> {}
}

let activeQueue: QueueProvider | null = null;

export const getQueue = (): QueueProvider => {
  if (activeQueue) return activeQueue;
  
  const provider = process.env.QUEUE_PROVIDER || 'memory';
  switch (provider) {
    case 'upstash': activeQueue = new UpstashQueue(); break;
    case 'inngest': activeQueue = new InngestQueue(); break;
    case 'memory':
    default:
      activeQueue = new MemoryQueue(); break;
  }
  return activeQueue;
};
