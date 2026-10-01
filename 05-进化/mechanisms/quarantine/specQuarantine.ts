// 检查 Playwright spec 里的隔离标记：每个 QUARANTINED: 都必须写成
//   test.fixme(true, 'QUARANTINED: <issue-url> (YYYY-MM-DD)')
// 并且没有超过期限。不符合时直接抛出错误。期限判断与 Vitest 隔离文件共用 quarantineAgeProblem。
// 放在哪里：<your-repo>/src/test/specQuarantine.ts（路径可改，改了要同步 quarantine-sla.test.ts 的 import）。
import { quarantineAgeProblem, type QuarantineAsOf } from './quarantineAsOf';

const SPEC_QUARANTINE_MARKER = /QUARANTINED:/g;
const SPEC_QUARANTINE_FIXME = /test\.fixme\s*\(\s*true\s*,\s*(['"`])QUARANTINED: (https?:\/\/\S+) \((\d{4}-\d{2}-\d{2})\)\1\s*\)/g;

export interface SpecQuarantine {
  issueUrl: string;
  date: string;
}

export function inspectSpecQuarantines(
  filename: string,
  content: string,
  asOf: QuarantineAsOf,
  slaDays = 28,
): SpecQuarantine[] {
  const markerCount = [...content.matchAll(SPEC_QUARANTINE_MARKER)].length;
  const quarantines = [...content.matchAll(SPEC_QUARANTINE_FIXME)].map((match) => ({
    issueUrl: match[2],
    date: match[3],
  }));

  // 标记数量与合规写法数量不一致，说明有标记没用 test.fixme 写法
  if (quarantines.length !== markerCount) {
    throw new Error(
      `${filename}: every QUARANTINED marker must use ` +
        "test.fixme(true, 'QUARANTINED: <issue-url> (YYYY-MM-DD)')",
    );
  }

  for (const quarantine of quarantines) {
    const problem = quarantineAgeProblem(quarantine.date, asOf, slaDays);
    if (problem) throw new Error(`${filename}: ${problem}`);
  }

  return quarantines;
}
