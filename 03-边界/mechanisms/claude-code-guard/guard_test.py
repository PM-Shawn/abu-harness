import json
import subprocess
import sys
from pathlib import Path

# 测试同目录的 guard.py：逐条喂给它一个工具调用，核对退出码（2 = 拦截，0 = 放行）。
# 放在哪里：与 guard.py 同一个目录（~/.claude/hooks/ 或 <your-repo>/.claude/hooks/）。
# 运行：python3 guard_test.py；全部通过时退出码为 0，有失败时为 1。
# 本脚本不写任何文件。给 guard.py 增加规则时，在 cases 里同时加上“该拦的”和“不该拦的”两类用例。

GUARD = Path(__file__).resolve().with_name("guard.py")

cases = [
    # 该拦截：git 回滚类命令
    ("Bash", {"command": "git reset --hard HEAD~1"}, 2),
    ("Bash", {"command": "git -C my-repo restore src/a.ts"}, 2),
    ("Bash", {"command": "git checkout -- src/a.ts"}, 2),
    ("Bash", {"command": "git checkout HEAD~2 -- file.ts"}, 2),
    ("Bash", {"command": "git checkout ."}, 2),
    ("Bash", {"command": "git stash"}, 2),
    ("Bash", {"command": "git stash pop"}, 2),
    ("Bash", {"command": "git revert abc123"}, 2),
    ("Bash", {"command": "git clean -fd"}, 2),
    ("Bash", {"command": "cd x && git reset src"}, 2),
    ("Bash", {"command": "git checkout -p"}, 2),
    ("Bash", {"command": "git checkout --patch src/a.ts"}, 2),
    ("Bash", {"command": "git switch --discard-changes main"}, 2),
    ("Bash", {"command": "git switch -f main"}, 2),
    ("Bash", {"command": "git -C my-repo switch --force dev"}, 2),
    # 该拦截：命令里读写 /tmp
    ("Bash", {"command": "ls /tmp/foo"}, 2),
    ("Bash", {"command": "echo hi > /private/tmp/x.txt"}, 2),
    # 不该拦截：只读或切换分支的 git 命令、普通命令、名字里带 tmp 的其他目录
    ("Bash", {"command": "git status"}, 0),
    ("Bash", {"command": "git checkout -b feature/x"}, 0),
    ("Bash", {"command": "git checkout dev"}, 0),
    ("Bash", {"command": "git switch main"}, 0),
    ("Bash", {"command": "git switch -c feature/x"}, 0),
    ("Bash", {"command": "git switch feature/force-push-fix"}, 0),
    ("Bash", {"command": "git checkout feature/patch-1"}, 0),
    ("Bash", {"command": "git checkout -b fix-p"}, 0),
    # 放行但属于规则禁止的写法：不带 -- 的 git checkout <文件> 从命令文本上和切换分支分不清，
    # guard.py 不去猜，靠规范约束（见 guard.py 开头的说明）
    ("Bash", {"command": "git checkout src/a.ts"}, 0),
    ("Bash", {"command": "git stash list"}, 0),
    ("Bash", {"command": "git log --oneline"}, 0),
    ("Bash", {"command": "ls ~/Documents/tmp/x"}, 0),
    ("Bash", {"command": "ls ./tmp"}, 0),
    ("Bash", {"command": "npm run verify"}, 0),
    # 文件类工具：/tmp 一律拦截，只放行读取 Claude 自身的附件目录
    ("Read", {"file_path": "/tmp/a.txt"}, 2),
    ("Read", {"file_path": "/private/tmp/claude-501/x/images/1.png"}, 0),
    ("Write", {"file_path": "/private/tmp/claude-501/x/a.md"}, 2),
    ("Edit", {"file_path": "/home/me/project/a.md"}, 0),
    ("Grep", {"path": "/tmp"}, 2),
    # Glob：path 和 pattern 两处都检查
    ("Glob", {"pattern": "/tmp/**/*.log"}, 2),
    ("Glob", {"pattern": "/private/tmp/x/*.md"}, 2),
    ("Glob", {"pattern": "**/*.log", "path": "/tmp"}, 2),
    ("Glob", {"pattern": "src/**/tmp/*.ts"}, 0),
    ("Glob", {"pattern": "**/*.ts", "path": "/home/me/project"}, 0),
]

failed = 0
for tool, tool_input, expected in cases:
    payload = json.dumps({"tool_name": tool, "tool_input": tool_input})
    result = subprocess.run([sys.executable, str(GUARD)], input=payload, text=True, capture_output=True)
    ok = result.returncode == expected
    failed += 0 if ok else 1
    print(("PASS" if ok else "FAIL"), tool, tool_input, "->", result.returncode)

print("failed:", failed)
raise SystemExit(1 if failed else 0)
