import subprocess
import sys
from pathlib import Path

# 检查源文件里有没有原始 NUL 字节。
# git 看到文件开头附近有 NUL 就把整个文件当成二进制，diff 和 PR 里只显示“Bin 12614 -> 30636 bytes”，改动内容没人能看到。
# 需要这个值时在代码里写转义 \x00，不要写入这个字节本身。
#
# 放在哪里：<your-repo>/scripts/check-nul-bytes.py
# 用法：python3 scripts/check-nul-bytes.py [目录 ...]（在仓库里任意位置运行，目录相对仓库根目录；不写目录时检查整个仓库）
# 退出码：0 = 没有；1 = 有，列出文件。
# 接入门禁：package.json 加 "check:nul": "python3 scripts/check-nul-bytes.py"
# （verify-scripts.jsonc 的可选脚本里有同样的一行），再串进 verify:full 或放进 CI 的 lint job。
# 要改的地方：SOURCE_SUFFIXES 换成你项目的源文件后缀；图片、字体等二进制文件本来就含 NUL，不要放进来。

SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".md", ".css", ".html", ".sh"}

root = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True).stdout.strip())
dirs = sys.argv[1:] or ["."]
listed = subprocess.run(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", *dirs],
    cwd=root,
    check=True,
    capture_output=True,
).stdout

hits = []
for raw in listed.split(b"\0"):
    if not raw:
        continue
    path = root / raw.decode("utf-8")
    if path.suffix not in SOURCE_SUFFIXES or not path.is_file():
        continue
    if b"\0" in path.read_bytes():
        hits.append(path.relative_to(root))

if hits:
    print("以下源文件含有原始 NUL 字节，请改成转义写法 \\x00：", file=sys.stderr)
    for hit in hits:
        print(f"  {hit}", file=sys.stderr)
    sys.exit(1)

print("check-nul-bytes: 没有发现含 NUL 字节的源文件。")
