#!/usr/bin/env bash
# 放在哪里：<your-repo>/scripts/run-gate.sh。用法：
#   bash scripts/run-gate.sh verify
#   bash scripts/run-gate.sh test:coverage
#
# 作用：运行一个门禁命令，报告它自己的真实退出码。
# 不要写 `npm run verify | tail -20`：shell 报告的是管道最后一个命令（tail）的退出码，
# tail 总是成功，门禁失败会被显示成成功。这里先把完整输出写进日志文件，再读日志末尾给人看。
#
# 输出的最后一行是 REAL_EXIT=<退出码>，脚本自己的退出码与它相同。
# 日志写在 <your-repo>/.scratch/gate-logs/<脚本名>-<UTC 时间>.log。任务书、交付说明、派活指令模板
# 都按这个位置引用门禁日志；写交付说明时把用到的日志复制到 docs/evidence/ 下的证据目录。
#
# 要改的地方：
#   1. LOG_DIR：日志目录。放在仓库里的一个被 .gitignore 忽略的目录，不要放 /tmp（重启后证据会丢失）。
#   2. EXPECTED_TAIL（可选）：完整跑完时输出末尾一定会出现的文字。
#      例如 vitest 覆盖率输出里的 "Coverage summary" 或 "% Stmts"。设置后，
#      即使退出码为 0，末尾找不到这段文字也判定为失败，说明命令链条中途断了。
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: bash scripts/run-gate.sh <npm-script-name>" >&2
  exit 2
fi

SCRIPT_NAME="$1"
REPO_ROOT="$(git rev-parse --show-toplevel)" || exit 2
LOG_DIR="$REPO_ROOT/.scratch/gate-logs"
EXPECTED_TAIL="${EXPECTED_TAIL:-}"

mkdir -p "$LOG_DIR" || exit 2
SAFE_NAME="$(printf '%s' "$SCRIPT_NAME" | tr ':/' '__')"
LOG_FILE="$LOG_DIR/${SAFE_NAME}-$(date -u +%Y%m%dT%H%M%SZ).log"

cd "$REPO_ROOT" || exit 2
npm run "$SCRIPT_NAME" > "$LOG_FILE" 2>&1
STATUS=$?

echo "----- last 30 lines of $LOG_FILE -----"
tail -n 30 "$LOG_FILE"
echo "---------------------------------------"
echo "REAL_EXIT=$STATUS"

if [ "$STATUS" -eq 0 ] && [ -n "$EXPECTED_TAIL" ] && ! grep -qF -- "$EXPECTED_TAIL" "$LOG_FILE"; then
  echo "Gate exited 0 but the log never printed \"$EXPECTED_TAIL\"; the command chain stopped early." >&2
  exit 1
fi

exit "$STATUS"
