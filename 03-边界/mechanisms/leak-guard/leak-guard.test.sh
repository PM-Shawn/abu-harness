#!/usr/bin/env bash
#
# public-leak-guard.sh 的测试：在一个临时 git 仓库里逐项核对退出码，并验证提交钩子能挡住提交。
# 放在哪里：<your-repo>/scripts/leak-guard.test.sh，与 public-leak-guard.sh 同目录。
#
# 用法：bash scripts/leak-guard.test.sh <一个不存在或为空的工作目录>
#   例如：bash scripts/leak-guard.test.sh "$PWD/.scratch/leak-guard-test"
#   工作目录由调用者指定，测试不往系统临时目录写任何东西；测试结束后可以手动删除该目录。
# 退出码：全部通过为 0，有失败为 1；工作目录不为空为 2。
#
# 它是 shell 脚本，test:infra（node --test）不会运行它。接入办法：
#   package.json 加一条脚本（每次用一个带时间的新目录，verify-scripts.jsonc 的可选脚本里有同样的一行）：
#     "test:leak-guard": "bash scripts/leak-guard.test.sh \"$PWD/.scratch/leak-guard-test-$(date -u +%Y%m%dT%H%M%SZ)\""
#   CI 里在 leak-guard job 的泄露检查后面加一步 npm run test:leak-guard。
set -euo pipefail

WORK_ROOT="${1:?用法：bash leak-guard.test.sh <一个不存在或为空的工作目录>}"
GUARD="$(cd "$(dirname "$0")" && pwd)/public-leak-guard.sh"

if [ -e "$WORK_ROOT" ] && [ -n "$(ls -A "$WORK_ROOT")" ]; then
  echo "工作目录 $WORK_ROOT 不是空目录，请换一个。" >&2
  exit 2
fi
mkdir -p "$WORK_ROOT"
REPO="$WORK_ROOT/repo"
mkdir "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email "test@example.com"
git -C "$REPO" config user.name "leak-guard-test"
git -C "$REPO" config commit.gpgsign false

failed=0
expect_exit() {
  local name="$1" expected="$2"
  shift 2
  local actual=0
  (cd "$REPO" && "$@") > "$WORK_ROOT/last.log" 2>&1 || actual=$?
  if [ "$actual" -eq "$expected" ]; then
    echo "PASS $name -> $actual"
  else
    echo "FAIL $name -> $actual（期望 $expected）"
    sed 's/^/    /' "$WORK_ROOT/last.log"
    failed=$((failed + 1))
  fi
}

# 1. 没有名单文件：配置缺失，退出码 2
expect_exit "名单文件缺失" 2 bash "$GUARD"

# 2. 名单文件只有注释和扫描目录：没有路径条目，退出码 2
printf '# 只有注释\nscan:src/\n' > "$REPO/.leak-guard-paths"
expect_exit "名单为空" 2 bash "$GUARD"

# 3. 名单里还留着示例的尖括号占位：当作没有配置好，退出码 2
printf 'scan:src/\nsrc/<private-feature-dir>/\nexact:src/<public-slot-dir>/<implementation-file>.ts\n' > "$REPO/.leak-guard-paths"
expect_exit "名单还是示例内容" 2 bash "$GUARD"

# 正式名单
cat > "$REPO/.leak-guard-paths" <<'EOF'
scan:src/
src/private-feature/
SecretPanel
exact:src/slot/impl.ts
EOF
mkdir -p "$REPO/src/slot" "$REPO/docs"
printf 'export type Slot = unknown\n' > "$REPO/src/slot/types.ts"
printf 'ignored/\n' > "$REPO/.gitignore"
git -C "$REPO" add -A
git -C "$REPO" commit -q -m "init"

# 4. 干净的仓库：通过
expect_exit "干净的仓库" 0 bash "$GUARD"

# 5. 未跟踪文件命中路径片段
mkdir -p "$REPO/src/private-feature"
printf 'x\n' > "$REPO/src/private-feature/a.ts"
expect_exit "未跟踪文件命中片段" 1 bash "$GUARD"
rm -r "$REPO/src/private-feature"

# 6. 已跟踪文件命中片段，并且不区分大小写
printf 'x\n' > "$REPO/src/secretpanel.tsx"
git -C "$REPO" add src/secretpanel.tsx
expect_exit "已暂存文件命中片段（不区分大小写）" 1 bash "$GUARD"
git -C "$REPO" rm -q --cached src/secretpanel.tsx
rm "$REPO/src/secretpanel.tsx"

# 7. 完整路径命中
printf 'x\n' > "$REPO/src/slot/impl.ts"
expect_exit "完整路径命中" 1 bash "$GUARD"
rm "$REPO/src/slot/impl.ts"

# 8. 被 .gitignore 忽略的文件不算
mkdir -p "$REPO/src/ignored"
printf 'x\n' > "$REPO/src/ignored/SecretPanel.tsx"
expect_exit "被忽略的文件不算" 0 bash "$GUARD"
rm -r "$REPO/src/ignored"

# 9. 扫描目录之外的文件不算
printf 'x\n' > "$REPO/docs/SecretPanel.md"
expect_exit "扫描目录之外的文件不算" 0 bash "$GUARD"
rm "$REPO/docs/SecretPanel.md"

# 10. 从子目录运行也按仓库根目录扫描
expect_exit "从子目录运行" 0 bash -c "cd src && bash '$GUARD'"

# 11. 提交钩子接入：命中时提交被阻止，移走后可以提交
HOOKS="$WORK_ROOT/hooks"
mkdir "$HOOKS"
printf '#!/bin/sh -e\nbash "%s"\n' "$GUARD" > "$HOOKS/pre-commit"
chmod +x "$HOOKS/pre-commit"
git -C "$REPO" config core.hooksPath "$HOOKS"
printf 'x\n' > "$REPO/src/SecretPanel.tsx"
git -C "$REPO" add src/SecretPanel.tsx
expect_exit "钩子阻止带泄露文件的提交" 1 git commit -q -m "leak"
git -C "$REPO" rm -q --cached src/SecretPanel.tsx
rm "$REPO/src/SecretPanel.tsx"
printf 'export const ok = 1\n' > "$REPO/src/ok.ts"
git -C "$REPO" add src/ok.ts
expect_exit "钩子放行正常提交" 0 git commit -q -m "ok"

echo "failed: $failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
