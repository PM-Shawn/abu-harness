// 带允许清单的 npm audit 门禁。
// 放在哪里：<your-repo>/scripts/npm-audit-check.mjs；
// 允许清单 npm-audit-allowlist.json 放在 <your-repo>/.github/npm-audit-allowlist.json
// （JSON 不能写注释，格式说明在它的 "$comment" 字段里，复制后换成真实条目或清空 entries）。
//
// npm audit 自己没有办法“接受”一条上游还没有修复版本的漏洞，
// 于是审计 job 会永远是红的，大家不再看它，它也就不再传递信号。
// 本脚本：生产依赖里任何 high / critical 漏洞，如果没有被一条未过期的允许条目覆盖，就失败；
// 允许条目过期了也失败，让每一次“接受”到期后都要重新审一遍。
//
//   npm audit --omit=dev --json > audit.json || true
//   node scripts/npm-audit-check.mjs audit.json [--allowlist=path] [--asof=YYYY-MM-DD]
// 退出码：0 通过；1 有未接受的漏洞或过期条目；参数或输入格式错误时直接抛出错误，同样以非零退出码结束。
//
// 允许清单格式（npm-audit-allowlist.json）：
//   { "entries": [ { "ghsa", "package", "reason", "expires" } ] }
//
// 要改的地方：DEFAULT_ALLOWLIST_PATH 换成你放允许清单的位置。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ALLOWLIST_PATH = '.github/npm-audit-allowlist.json';
const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const GHSA_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function ghsaIdFromUrl(url) {
  const match = typeof url === 'string' ? url.match(GHSA_PATTERN) : null;
  return match ? match[0].toUpperCase() : null;
}

function assertIsoDate(value, label) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function parseAllowlist(allowlist, asOf) {
  assertIsoDate(asOf, 'asOf');
  const entries = allowlist?.entries;
  if (!Array.isArray(entries)) throw new Error('allowlist must be an object with an "entries" array');
  const active = new Map();
  const expired = [];
  for (const entry of entries) {
    for (const field of ['ghsa', 'package', 'reason', 'expires']) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
        throw new Error(`allowlist entry is missing "${field}": ${JSON.stringify(entry)}`);
      }
    }
    const ghsa = ghsaIdFromUrl(entry.ghsa);
    if (!ghsa) throw new Error(`allowlist entry has a malformed GHSA id: ${entry.ghsa}`);
    assertIsoDate(entry.expires, `allowlist entry ${ghsa} "expires"`);
    // ISO 日期可以直接按字符串比较
    if (entry.expires < asOf) expired.push({ ...entry, ghsa });
    else active.set(ghsa, { ...entry, ghsa });
  }
  return { active, expired };
}

export function evaluateAudit(report, allowlist, asOf) {
  if (!report || typeof report !== 'object' || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    const detail = report?.error ? ` (npm reported: ${JSON.stringify(report.error)})` : '';
    throw new Error(`audit report has no "vulnerabilities" object${detail}`);
  }
  const { active, expired } = parseAllowlist(allowlist, asOf);
  const vulnerabilities = report.vulnerabilities;
  const coveredByName = new Map();
  const usedEntries = new Set();

  // 一个包算“被覆盖”，要求让它有漏洞的每一条路径都被覆盖：
  // 直接的漏洞对象要有一条该包的有效允许条目；传递来的（via 另一个包）要求那个包被覆盖
  function isCovered(name, stack) {
    if (coveredByName.has(name)) return coveredByName.get(name);
    if (stack.has(name)) return false;
    const vulnerability = vulnerabilities[name];
    if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) return false;
    stack.add(name);
    let covered = true;
    for (const via of vulnerability.via) {
      if (typeof via === 'string') {
        if (!isCovered(via, stack)) covered = false;
        continue;
      }
      const ghsa = ghsaIdFromUrl(via.url);
      const entry = ghsa ? active.get(ghsa) : null;
      if (entry && entry.package === via.name) usedEntries.add(ghsa);
      else covered = false;
    }
    stack.delete(name);
    coveredByName.set(name, covered);
    return covered;
  }

  const blocking = [];
  const allowlisted = [];
  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!BLOCKING_SEVERITIES.has(vulnerability.severity)) continue;
    const advisories = vulnerability.via
      .filter((via) => typeof via === 'object' && via !== null)
      .map((via) => ({ ghsa: ghsaIdFromUrl(via.url), title: via.title }));
    const viaPackages = vulnerability.via.filter((via) => typeof via === 'string');
    const item = { name, severity: vulnerability.severity, advisories, viaPackages };
    (isCovered(name, new Set()) ? allowlisted : blocking).push(item);
  }
  const unused = [...active.values()].filter((entry) => !usedEntries.has(entry.ghsa));
  return { blocking, allowlisted, expired, unused, asOf };
}

export function formatReport(result) {
  const lines = ['### npm audit (production, high+, allowlist-aware)', ''];
  const describe = (item) => {
    const advisories = item.advisories.map((a) => `${a.ghsa ?? '?'} ${a.title ?? ''}`.trim());
    const via = item.viaPackages.map((name) => `via ${name}`);
    return `- **${item.name}** (${item.severity}): ${[...advisories, ...via].join('; ')}`;
  };
  if (result.blocking.length > 0) {
    lines.push(`❌ ${result.blocking.length} blocking finding(s) not covered by the allowlist:`, ...result.blocking.map(describe), '');
  }
  if (result.expired.length > 0) {
    lines.push(
      `❌ ${result.expired.length} allowlist entr${result.expired.length === 1 ? 'y' : 'ies'} expired (as of ${result.asOf}) — re-review and extend or remove:`,
      ...result.expired.map((e) => `- ${e.ghsa} (${e.package}) expired ${e.expires}: ${e.reason}`),
      '',
    );
  }
  if (result.allowlisted.length > 0) {
    lines.push(`⚠️ ${result.allowlisted.length} finding(s) accepted by allowlist:`, ...result.allowlisted.map(describe), '');
  }
  if (result.unused.length > 0) {
    lines.push(
      `ℹ️ ${result.unused.length} allowlist entr${result.unused.length === 1 ? 'y' : 'ies'} no longer matched by npm audit — safe to delete:`,
      ...result.unused.map((e) => `- ${e.ghsa} (${e.package})`),
      '',
    );
  }
  if (result.blocking.length === 0 && result.expired.length === 0) {
    lines.push(result.allowlisted.length === 0 ? '✅ no high/critical findings.' : '✅ no unaccepted high/critical findings.');
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = { reportPath: null, allowlistPath: DEFAULT_ALLOWLIST_PATH, asOf: null };
  for (const arg of argv) {
    if (arg.startsWith('--allowlist=')) options.allowlistPath = arg.slice('--allowlist='.length);
    else if (arg.startsWith('--asof=')) options.asOf = arg.slice('--asof='.length);
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (options.reportPath === null) options.reportPath = arg;
    else throw new Error(`unexpected argument ${arg}`);
  }
  if (options.reportPath === null) {
    throw new Error('usage: node scripts/npm-audit-check.mjs <audit.json> [--allowlist=path] [--asof=YYYY-MM-DD]');
  }
  return options;
}

export function runCli(argv, { cwd = process.cwd(), env = process.env, today } = {}) {
  const options = parseArgs(argv);
  const asOf = options.asOf ?? env.NPM_AUDIT_ASOF ?? today ?? new Date().toISOString().slice(0, 10);
  const report = JSON.parse(readFileSync(path.resolve(cwd, options.reportPath), 'utf8'));
  const allowlist = JSON.parse(readFileSync(path.resolve(cwd, options.allowlistPath), 'utf8'));
  const result = evaluateAudit(report, allowlist, asOf);
  return { result, output: formatReport(result), ok: result.blocking.length === 0 && result.expired.length === 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output, ok } = runCli(process.argv.slice(2));
  console.log(output);
  process.exitCode = ok ? 0 : 1;
}
