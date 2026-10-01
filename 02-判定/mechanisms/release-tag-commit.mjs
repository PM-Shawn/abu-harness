// 放在哪里：<your-repo>/scripts/release-tag-commit.mjs，由 release-preflight.mjs 调用。
//
// 作用：正式版 tag 只能打在已经进入发版分支的提交上。
// 发版分支只接受从集成分支快进（fast-forward）过来的提交，所以打在别处的正式 tag
// 会把没有经过集成分支门禁的代码发出去。RC tag（名字里带 "-"）在集成分支上打，不检查。
//
// 要改的地方：
//   1. RELEASE_BRANCH：你的发版分支名（例如 main 或 release）。
//   2. 如果你的 CI 里有“手动触发、只出内部候选包、不对外发布”的运行，
//      只有那种运行可以传 --skip-tag-commit-check；其余事件一律检查。
import { spawnSync } from 'node:child_process';

export const RELEASE_BRANCH = 'main';
export const RELEASE_BRANCH_REF = `refs/remotes/origin/${RELEASE_BRANCH}`;

export function shouldCheckTagCommit({ tag, skipRequested, githubEventName }) {
  // 只有手动触发的候选构建可以跳过；本地运行和 tag push 触发的运行都不允许跳过
  if (skipRequested && githubEventName !== 'workflow_dispatch') {
    throw new Error('--skip-tag-commit-check is only allowed in a manually dispatched release workflow run');
  }
  if (skipRequested || !tag) return false;
  // RC tag 在集成分支上打，不对外发布
  return !tag.includes('-');
}

export function spawnGit(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function gitFailure(result) {
  return `exit ${result.status ?? 'unknown'}: ${String(result.stderr || result.stdout || '').trim()}`;
}

// 返回错误信息数组；空数组表示通过。每条错误都写明原因和修正办法。
export function verifyTagCommitOnReleaseBranch({ tag, git }) {
  const shallow = git(['rev-parse', '--is-shallow-repository']);
  if (shallow.status !== 0) {
    return [`could not inspect the git checkout (${gitFailure(shallow)})`];
  }
  // 浅克隆时祖先关系不可知，直接失败，不猜
  if (shallow.stdout.trim() === 'true') {
    return [
      `cannot verify that tag ${tag} is on ${RELEASE_BRANCH}: the checkout is shallow, so ancestry is unknown. ` +
        'Check out with full history (actions/checkout `fetch-depth: 0`, or `git fetch --unshallow origin` locally).',
    ];
  }

  const tagCommit = git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
  if (tagCommit.status !== 0) {
    return [
      `tag ${tag} does not exist in this checkout, so the commit it points to cannot be checked. ` +
        'Fetch tags (`git fetch origin --tags`) or create the tag before passing --tag.',
    ];
  }
  const tagSha = tagCommit.stdout.trim();

  const branchCommit = git(['rev-parse', '--verify', '--quiet', `${RELEASE_BRANCH_REF}^{commit}`]);
  if (branchCommit.status !== 0) {
    return [
      `cannot resolve origin/${RELEASE_BRANCH}, so tag ${tag} (commit ${tagSha}) cannot be checked against the release branch. ` +
        `Run \`git fetch origin ${RELEASE_BRANCH}\`; in CI, check out with \`fetch-depth: 0\`.`,
    ];
  }
  const branchSha = branchCommit.stdout.trim();

  // merge-base --is-ancestor：0 = 是祖先，1 = 不是，其他 = git 出错
  const ancestry = git(['merge-base', '--is-ancestor', tagSha, branchSha]);
  if (ancestry.status === 0) return [];
  if (ancestry.status === 1) {
    return [
      `tag ${tag} points to commit ${tagSha}, which is not on origin/${RELEASE_BRANCH} (${branchSha}). ` +
        `A stable release must be a commit that was fast-forwarded onto ${RELEASE_BRANCH}, ` +
        'otherwise code that never passed the integration gate would be published. ' +
        `Delete the tag (\`git push origin :refs/tags/${tag}\` and \`git tag -d ${tag}\`), ` +
        `promote the release commit onto ${RELEASE_BRANCH}, then tag that commit.`,
    ];
  }
  return [`could not compare tag ${tag} (commit ${tagSha}) with origin/${RELEASE_BRANCH} (${gitFailure(ancestry)})`];
}
