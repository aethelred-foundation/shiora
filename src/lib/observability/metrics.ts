// ============================================================
// Shiora on Aethelred — In-process metrics registry (GAP-03)
//
// Zero-dependency counters and histograms with labels, rendered in the
// Prometheus text exposition format by GET /api/system/metrics.
//
// HONEST SCOPE: metrics are per-process. That is the correct model for the
// standalone deployment (one process per instance; scrape each instance and
// aggregate in the collector, as Prometheus is designed for). They are not a
// cross-replica shared state and do not survive restarts.
// ============================================================

type LabelSet = Record<string, string>;

/** Stable serialization for a label set → `{k="v",…}` (keys sorted). */
function labelKey(labels: LabelSet): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) {
    return '';
  }
  const parts = keys.map((k) => `${k}="${escapeLabelValue(labels[k])}"`);
  return `{${parts.join(',')}}`;
}

/** Prometheus label-value escaping: backslash, double-quote, newline. */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export class Counter {
  private readonly series: Map<string, number>;

  constructor(
    readonly name: string,
    readonly help: string,
  ) {
    this.series = new Map();
  }

  inc(labels: LabelSet = {}, value = 1): void {
    const key = labelKey(labels);
    this.series.set(key, (this.series.get(key) ?? 0) + value);
  }

  /** Current value for a label set (0 when never incremented). */
  value(labels: LabelSet = {}): number {
    return this.series.get(labelKey(labels)) ?? 0;
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [key, count] of Array.from(this.series.entries())) {
      lines.push(`${this.name}${key} ${count}`);
    }
    return lines.join('\n');
  }
}

interface HistogramSeries {
  bucketCounts: number[];
  sum: number;
  count: number;
}

export class Histogram {
  private readonly series: Map<string, HistogramSeries>;

  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: number[],
  ) {
    this.series = new Map();
  }

  observe(value: number, labels: LabelSet = {}): void {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      entry = { bucketCounts: this.buckets.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        entry.bucketCounts[i] += 1;
      }
    }
    entry.sum += value;
    entry.count += 1;
  }

  /** Observation count for a label set (0 when never observed). */
  count(labels: LabelSet = {}): number {
    return this.series.get(labelKey(labels))?.count ?? 0;
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, entry] of Array.from(this.series.entries())) {
      // Cumulative buckets, then the mandatory +Inf bucket, sum and count.
      const inner = key === '' ? '' : key.slice(1, -1);
      const withLe = (le: string) =>
        inner === '' ? `{le="${le}"}` : `{${inner},le="${le}"}`;
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket${withLe(String(this.buckets[i]))} ${entry.bucketCounts[i]}`);
      }
      lines.push(`${this.name}_bucket${withLe('+Inf')} ${entry.count}`);
      lines.push(`${this.name}_sum${key} ${entry.sum}`);
      lines.push(`${this.name}_count${key} ${entry.count}`);
    }
    return lines.join('\n');
  }
}

class Registry {
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  counter(name: string, help: string): Counter {
    let instrument = this.counters.get(name);
    if (!instrument) {
      instrument = new Counter(name, help);
      this.counters.set(name, instrument);
    }
    return instrument;
  }

  histogram(name: string, help: string, buckets: number[]): Histogram {
    let instrument = this.histograms.get(name);
    if (!instrument) {
      instrument = new Histogram(name, help, buckets);
      this.histograms.set(name, instrument);
    }
    return instrument;
  }

  render(): string {
    const blocks: string[] = [];
    for (const counter of Array.from(this.counters.values())) {
      blocks.push(counter.render());
    }
    for (const histogram of Array.from(this.histograms.values())) {
      blocks.push(histogram.render());
    }
    return blocks.join('\n') + '\n';
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

const registry = new Registry();

/** Get-or-create a counter. */
export function counter(name: string, help: string): Counter {
  return registry.counter(name, help);
}

/** Get-or-create a histogram (bucket boundaries in ascending order). */
export function histogram(name: string, help: string, buckets: number[]): Histogram {
  return registry.histogram(name, help, buckets);
}

/** Render every registered instrument in Prometheus text exposition format. */
export function renderMetrics(): string {
  return registry.render();
}

/** Test hook: drop all instruments and series. */
export function __resetMetricsForTests(): void {
  registry.reset();
}

// ────────────────────────────────────────────────────────────
// Route-label normalization
// ────────────────────────────────────────────────────────────

/**
 * Collapse dynamic path segments (bech32 addresses, UUIDs, numeric ids,
 * long hex) to `:param` so metric label cardinality stays bounded.
 */
export function normalizeRoute(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (
        /^aeth1[a-z0-9]{8,}$/.test(segment)
        || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
        || /^\d+$/.test(segment)
        || /^[0-9a-f]{16,}$/i.test(segment)
      ) {
        return ':param';
      }
      return segment;
    })
    .join('/');
}
