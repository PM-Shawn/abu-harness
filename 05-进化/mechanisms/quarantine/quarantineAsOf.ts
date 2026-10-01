// 隔离区期限检查用的“截止日期”（as-of date）和期限判断。
// 放在哪里：<your-repo>/src/test/quarantineAsOf.ts（路径可改，改了要同步 quarantine-sla.test.ts 和 specQuarantine.ts 的 import）。
//
// CI 注入 QUARANTINE_ASOF=YYYY-MM-DD（见 ci-quarantine-asof.yml），每次 CI 运行日期都会前进；
// 本地通常没有这个环境变量，使用提交在代码里的固定日期，让测试保持确定性（不用 Date.now()）。
//
// 格式错误时直接抛出错误，不退回固定日期：CI 里一个拼写错误不能让期限时钟悄悄停住。
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuarantineAsOf {
  date: Date;
  // true 表示日期来自 CI 注入的 QUARANTINE_ASOF，是真实的当天日期；false 表示用的是代码里的固定日期
  injected: boolean;
}

export function parseUtcDate(value: string): Date | null {
  const m = YMD.exec(value);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 拒绝不存在的日期（例如 2026-13-40 会被 Date.UTC 悄悄进位）
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function resolveQuarantineAsOf(
  env: Record<string, string | undefined>,
  fallback: string,
): QuarantineAsOf {
  const raw = env.QUARANTINE_ASOF;
  const injected = raw !== undefined && raw.length > 0;
  const source = injected ? raw : fallback;
  const date = parseUtcDate(source);
  if (!date) {
    throw new Error(`QUARANTINE_ASOF must be YYYY-MM-DD, got "${source}"`);
  }
  return { date, injected };
}

// Vitest 隔离文件和 Playwright spec 共用的期限判断。返回问题描述；没有问题返回 null。
//   - 超过期限：任何时候都算问题。
//   - 隔离日期晚于截止日期：截止日期是 CI 注入的当天日期时算问题（日期写错，条目永远不会过期）；
//     截止日期是代码里的固定日期时不算，本地新加的隔离条目日期本来就晚于它。
export function quarantineAgeProblem(
  quarantinedOn: string,
  asOf: QuarantineAsOf,
  slaDays: number,
): string | null {
  const quarantineDate = parseUtcDate(quarantinedOn);
  if (!quarantineDate) return `could not parse quarantine date "${quarantinedOn}"`;
  const asOfText = asOf.date.toISOString().slice(0, 10);
  const ageMs = asOf.date.getTime() - quarantineDate.getTime();
  if (ageMs < 0) {
    return asOf.injected ? `quarantine date ${quarantinedOn} is after as-of ${asOfText}` : null;
  }
  if (ageMs > slaDays * DAY_MS) {
    return (
      `quarantined on ${quarantinedOn}, ${Math.ceil(ageMs / DAY_MS)} days before ${asOfText} — ` +
      `exceeds the ${slaDays}-day SLA. Fix the test and move it out of quarantine, or delete it.`
    );
  }
  return null;
}
