/** @jest-environment node */

import {
  Counter,
  Histogram,
  counter,
  histogram,
  renderMetrics,
  normalizeRoute,
  __resetMetricsForTests,
} from '@/lib/observability/metrics';

afterEach(() => __resetMetricsForTests());

describe('Counter', () => {
  it('is directly constructible', () => {
    const direct = new Counter('direct_total', 'help');
    direct.inc();
    expect(direct).toBeInstanceOf(Counter);
    expect(new Histogram('direct_hist', 'help', [1])).toBeInstanceOf(Histogram);
    expect(direct.value()).toBe(1);
  });

  it('increments unlabeled and labeled series independently', () => {
    const c = counter('test_total', 'help text');
    c.inc();
    c.inc({}, 2);
    c.inc({ method: 'GET' });
    c.inc({ method: 'GET' });
    c.inc({ method: 'POST' });

    expect(c.value()).toBe(3);
    expect(c.value({ method: 'GET' })).toBe(2);
    expect(c.value({ method: 'POST' })).toBe(1);
    expect(c.value({ method: 'DELETE' })).toBe(0);
  });

  it('sorts label keys so ordering never splits a series', () => {
    const c = counter('sorted_total', 'help');
    c.inc({ b: '2', a: '1' });
    c.inc({ a: '1', b: '2' });
    expect(c.value({ b: '2', a: '1' })).toBe(2);
  });

  it('renders HELP, TYPE, and every series', () => {
    const c = counter('render_total', 'my help');
    c.inc();
    c.inc({ route: '/api/x' }, 5);

    const out = c.render();
    expect(out).toContain('# HELP render_total my help');
    expect(out).toContain('# TYPE render_total counter');
    expect(out).toContain('render_total 1');
    expect(out).toContain('render_total{route="/api/x"} 5');
  });

  it('escapes backslash, quote, and newline in label values', () => {
    const c = counter('escape_total', 'help');
    c.inc({ v: 'a\\b"c\nd' });
    expect(c.render()).toContain('escape_total{v="a\\\\b\\"c\\nd"} 1');
  });
});

describe('Histogram', () => {
  it('fills cumulative buckets, sum and count', () => {
    const h = histogram('lat_seconds', 'latency', [0.1, 0.5, 1]);
    h.observe(0.05);
    h.observe(0.3);
    h.observe(2); // above every bucket → only +Inf

    expect(h.count()).toBe(3);
    const out = h.render();
    expect(out).toContain('# TYPE lat_seconds histogram');
    expect(out).toContain('lat_seconds_bucket{le="0.1"} 1');
    expect(out).toContain('lat_seconds_bucket{le="0.5"} 2');
    expect(out).toContain('lat_seconds_bucket{le="1"} 2');
    expect(out).toContain('lat_seconds_bucket{le="+Inf"} 3');
    expect(out).toContain('lat_seconds_sum 2.35');
    expect(out).toContain('lat_seconds_count 3');
  });

  it('renders labeled series with le merged into the label set', () => {
    const h = histogram('req_seconds', 'latency', [1]);
    h.observe(0.5, { route: '/api/y' });

    const out = h.render();
    expect(out).toContain('req_seconds_bucket{route="/api/y",le="1"} 1');
    expect(out).toContain('req_seconds_bucket{route="/api/y",le="+Inf"} 1');
    expect(out).toContain('req_seconds_sum{route="/api/y"} 0.5');
    expect(out).toContain('req_seconds_count{route="/api/y"} 1');
    expect(h.count({ route: '/api/y' })).toBe(1);
    expect(h.count({ route: '/api/z' })).toBe(0);
  });
});

describe('registry', () => {
  it('returns the same instrument for the same name', () => {
    const a = counter('same_total', 'help');
    const b = counter('same_total', 'ignored on re-create');
    expect(b).toBe(a);

    const h1 = histogram('same_hist', 'help', [1]);
    const h2 = histogram('same_hist', 'help', [99]);
    expect(h2).toBe(h1);
  });

  it('renderMetrics joins every instrument and ends with a newline', () => {
    counter('one_total', 'first').inc();
    histogram('two_hist', 'second', [1]).observe(0.5);

    const out = renderMetrics();
    expect(out).toContain('one_total 1');
    expect(out).toContain('two_hist_count 1');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('reset drops all instruments', () => {
    counter('gone_total', 'help').inc();
    __resetMetricsForTests();
    expect(renderMetrics()).not.toContain('gone_total');
  });
});

describe('normalizeRoute', () => {
  it('collapses addresses, UUIDs, numbers, and long hex to :param', () => {
    expect(normalizeRoute('/api/provider/patients/aeth1qypqxpq9qcrsszg2p/records'))
      .toBe('/api/provider/patients/:param/records');
    expect(normalizeRoute('/api/records/6e401e50-72ac-4c7b-9a45-4c5eab1e1e1e'))
      .toBe('/api/records/:param');
    expect(normalizeRoute('/api/items/12345')).toBe('/api/items/:param');
    expect(normalizeRoute(`/api/tx/${'ab'.repeat(16)}`)).toBe('/api/tx/:param');
  });

  it('leaves static segments untouched', () => {
    expect(normalizeRoute('/api/wallet/connect')).toBe('/api/wallet/connect');
  });
});
