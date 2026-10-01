// 放在哪里：<your-repo>/scripts/release-tag-commit.test.mjs，与 release-tag-commit.mjs 同目录。
// package.json 的 test:infra（node --test "scripts/*.test.mjs"）会运行它，不用另外登记。
// 用替身 git 覆盖全部分支：通过、不在发版分支、发版分支解析不到、浅克隆、tag 不存在、git 出错、跳过规则。
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RELEASE_BRANCH_REF,
  shouldCheckTagCommit,
  verifyTagCommitOnReleaseBranch,
} from './release-tag-commit.mjs';

const TAG = 'v1.2.3';
const TAG_SHA = 'a'.repeat(40);
const BRANCH_SHA = 'b'.repeat(40);

function fakeGit({ shallow = 'false', tagSha = TAG_SHA, branchSha = BRANCH_SHA, ancestorStatus = 0 } = {}) {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    const key = args.join(' ');
    if (key === 'rev-parse --is-shallow-repository') return { status: 0, stdout: `${shallow}\n`, stderr: '' };
    if (key === `rev-parse --verify --quiet refs/tags/${TAG}^{commit}`) {
      return tagSha ? { status: 0, stdout: `${tagSha}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' };
    }
    if (key === `rev-parse --verify --quiet ${RELEASE_BRANCH_REF}^{commit}`) {
      return branchSha ? { status: 0, stdout: `${branchSha}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' };
    }
    if (key === `merge-base --is-ancestor ${TAG_SHA} ${BRANCH_SHA}`) {
      return { status: ancestorStatus, stdout: '', stderr: ancestorStatus > 1 ? 'fatal: bad object' : '' };
    }
    throw new Error(`unexpected git call: ${key}`);
  };
  return { git, calls };
}

test('tag 所在提交在发版分支上时通过', () => {
  const { git, calls } = fakeGit();
  assert.deepEqual(verifyTagCommitOnReleaseBranch({ tag: TAG, git }), []);
  assert.deepEqual(calls.at(-1), ['merge-base', '--is-ancestor', TAG_SHA, BRANCH_SHA]);
});

test('tag 所在提交不在发版分支上时失败，并写明两个提交号和修正办法', () => {
  const { git } = fakeGit({ ancestorStatus: 1 });
  const errors = verifyTagCommitOnReleaseBranch({ tag: TAG, git });
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`tag ${TAG} points to commit ${TAG_SHA}`));
  assert.match(errors[0], new RegExp(`\\(${BRANCH_SHA}\\)`));
  assert.match(errors[0], /Delete the tag/);
});

test('发版分支解析不到时失败，不做比较', () => {
  const { git, calls } = fakeGit({ branchSha: null });
  const errors = verifyTagCommitOnReleaseBranch({ tag: TAG, git });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /cannot resolve origin\//);
  assert.ok(!calls.some((args) => args[0] === 'merge-base'), 'must not compare without a branch ref');
});

test('浅克隆时直接失败，不猜', () => {
  const { git, calls } = fakeGit({ shallow: 'true' });
  const errors = verifyTagCommitOnReleaseBranch({ tag: TAG, git });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /checkout is shallow/);
  assert.equal(calls.length, 1);
});

test('tag 不存在时失败', () => {
  const { git } = fakeGit({ tagSha: null });
  const errors = verifyTagCommitOnReleaseBranch({ tag: TAG, git });
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`tag ${TAG} does not exist`));
});

test('祖先比较时 git 出错会报告出来', () => {
  const { git } = fakeGit({ ancestorStatus: 128 });
  const errors = verifyTagCommitOnReleaseBranch({ tag: TAG, git });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /exit 128: fatal: bad object/);
});

test('只检查正式版 tag，只有手动触发的运行可以跳过', () => {
  assert.equal(shouldCheckTagCommit({ tag: 'v1.2.3', skipRequested: false, githubEventName: 'push' }), true);
  assert.equal(shouldCheckTagCommit({ tag: 'v1.2.3', skipRequested: false, githubEventName: undefined }), true);
  assert.equal(shouldCheckTagCommit({ tag: 'v1.2.3-rc1', skipRequested: false, githubEventName: 'push' }), false);
  assert.equal(shouldCheckTagCommit({ tag: null, skipRequested: false, githubEventName: undefined }), false);
  assert.equal(shouldCheckTagCommit({ tag: 'v1.2.3', skipRequested: true, githubEventName: 'workflow_dispatch' }), false);
  for (const githubEventName of ['push', undefined]) {
    assert.throws(
      () => shouldCheckTagCommit({ tag: 'v1.2.3', skipRequested: true, githubEventName }),
      /only allowed in a manually dispatched release workflow run/,
    );
  }
});
