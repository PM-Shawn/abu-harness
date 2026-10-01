import json
import re
import sys

# Claude Code PreToolUse hook：在工具真正执行前拦截两类操作
#   1. 用 git 丢弃改动：reset、restore、revert、clean、stash，
#      checkout 带 -- / . / -f / --force / -p / --patch，switch 带 --discard-changes / -f / --force
#   2. 读写 /tmp 与 /private/tmp
# 退出码 2 表示拦截，stderr 的文字会交给 Agent，让它改用正确做法；退出码 0 表示放行。
#
# 拦不住的写法（只能靠规则约束）：
#   - git checkout <文件>、git checkout <提交> <文件>（不带 --）。从命令文本上看，它和
#     git checkout <分支> 分不清，这里不去猜。在规范里要求 Agent 切换分支一律用 git switch，
#     git checkout 后面跟着文件路径的写法一律不用。
#   - 把 git 命令写进脚本文件再运行，这里看不到脚本内容。
#
# 放在哪里：用户级放在 ~/.claude/hooks/guard.py，项目级放在 <your-repo>/.claude/hooks/guard.py，
# 并在对应的 settings.json 里登记（见同目录 settings.snippet.json）。guard_test.py 放在同一个目录。
#
# 要改的地方：
#   - 下面两条拦截提示里的 `.scratch/`：换成你的项目存放中间结果的目录。
#   - HARNESS_READ_DIR：Claude Code 把附件和子任务输出放在 /private/tmp/claude-<uid>/ 下，
#     这里只放行“读取”这个目录；如果你的 Claude Code 版本把附件放在别处，按实际位置修改。

# git 命令前面可能带 -C <dir>、-c key=value 或 --no-pager 之类的全局参数
GIT = r"\bgit\s+(?:-[Cc]\s+\S+\s+|--?[\w-]+(?:=\S+)?\s+)*"

# git 回滚类命令
ROLLBACK_PATTERNS = [
    re.compile(GIT + r"(reset|restore|revert|clean)\b"),
    # stash list / stash show 只读，放行；其余 stash 子命令都会把改动移出工作区
    re.compile(GIT + r"stash\b(?!\s+(list|show)\b)"),
    # checkout 只拦截明确丢弃文件改动的写法；切换分支、新建分支放行
    re.compile(GIT + r"checkout\b[^;&|\n]*?(\s--(\s|$)|\s\.(\s|$)|\s-f\b|\s--force\b|\s-p\b|\s--patch\b)"),
    # switch 带这几个参数时会丢掉工作区里未提交的改动；普通的切换分支放行
    re.compile(GIT + r"switch\b[^;&|\n]*?(\s--discard-changes\b|\s-f\b|\s--force\b)"),
]

# 命令里出现独立的 /tmp 或 /private/tmp 路径；~/Documents/tmp、./tmp 这类相对或嵌套路径不算
TMP_IN_COMMAND = re.compile(r"(?<![\w.~/-])(/private)?/tmp(/|\b)")
TMP_PATH = re.compile(r"^(/private)?/tmp(/|$)")
# Claude 自身放附件和任务输出的目录，只允许读取
HARNESS_READ_DIR = re.compile(r"^/private/tmp/claude-\d+/")

ROLLBACK_MESSAGE = "已拦截：禁止用 git 回滚代码（reset、restore、revert、clean、stash、checkout 或 switch 丢弃改动）。需要恢复时用文件编辑工具手动改回。"
TMP_MESSAGE = "已拦截：禁止读写 /tmp。中间结果放在仓库根目录的 .scratch/ 下。"


def block(reason):
    print(reason, file=sys.stderr)
    sys.exit(2)


payload = json.load(sys.stdin)
tool = payload.get("tool_name", "")
tool_input = payload.get("tool_input", {}) or {}

if tool == "Bash":
    command = tool_input.get("command", "")
    for pattern in ROLLBACK_PATTERNS:
        if pattern.search(command):
            block(ROLLBACK_MESSAGE)
    if TMP_IN_COMMAND.search(command):
        block(TMP_MESSAGE)
elif tool in ("Read", "Write", "Edit", "NotebookEdit", "Glob", "Grep"):
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or tool_input.get("path") or ""
    if TMP_PATH.match(path):
        if tool == "Read" and HARNESS_READ_DIR.match(path):
            sys.exit(0)
        block(TMP_MESSAGE)
    # Glob 可以不传 path，把绝对路径直接写在 pattern 里
    if tool == "Glob" and TMP_PATH.match(tool_input.get("pattern") or ""):
        block(TMP_MESSAGE)

sys.exit(0)
