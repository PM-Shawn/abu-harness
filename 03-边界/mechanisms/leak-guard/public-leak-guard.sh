#!/usr/bin/env bash
#
# 公开仓泄露检查：按路径名单拦截不该公开的文件。
# 放在哪里：<your-repo>/scripts/public-leak-guard.sh
#
# 适用情况：代码分成公开仓和私有仓（open-core），私有实现只能在私有仓里。
# 私有代码一旦推送进公开仓，git 历史里就清除不掉；编译和测试也发现不了这类问题。
#
# 它只看文件路径，不看文件内容：把私有实现换个文件名放进公开仓，这个检查拦不住。
# 内容上的把关仍然靠“公开仓只放接口和空插槽”这条规则和人工复审。
#
# 用法：
#   bash scripts/public-leak-guard.sh [名单文件]
#   名单文件默认是仓库根目录的 .leak-guard-paths（格式见同目录 leak-guard-paths.example）。
#
# 退出码：0 = 没有命中；1 = 命中，列出命中的文件；
#         2 = 名单文件缺失、没有任何条目，或者还留着示例里带尖括号的占位条目。
#
# 要改的地方：
#   1. 按 leak-guard-paths.example 写好 <your-repo>/.leak-guard-paths，填入只属于私有仓的路径片段；
#   2. 在 package.json 的 scripts 里加一行 "check:leak": "bash scripts/public-leak-guard.sh"；
#   3. 在三处运行同一条命令：
#        提交钩子：<your-repo>/.husky/pre-commit 里去掉 npm run check:leak 一行的注释
#                  （钩子文件见 02-判定/mechanisms/husky-pre-commit）；
#        本地门禁：package.json 的 verify:full 第一步写 npm run check:leak；
#        CI：见 leak-guard.ci.yml。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

LIST_FILE="${1:-.leak-guard-paths}"
if [ ! -f "$LIST_FILE" ]; then
  echo "public-leak-guard: 找不到名单文件 $LIST_FILE，请先按 leak-guard-paths.example 写好。" >&2
  exit 2
fi

scan_dirs=()
fragments=()
exact_paths=()
placeholders=()
while IFS= read -r line || [ -n "$line" ]; do
  # 去掉行首和行尾的空白
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  case "$line" in
    ''|'#'*) continue ;;
  esac
  # 示例名单里的条目都带尖括号；真实路径里不会出现这两个字符
  case "$line" in
    *'<'*|*'>'*) placeholders+=("$line") ;;
  esac
  case "$line" in
    scan:*) scan_dirs+=("${line#scan:}") ;;
    exact:*) exact_paths+=("${line#exact:}") ;;
    *) fragments+=("$line") ;;
  esac
done < "$LIST_FILE"

if [ "${#placeholders[@]}" -gt 0 ]; then
  echo "public-leak-guard: 名单文件 $LIST_FILE 还是示例内容，下面的条目带着尖括号占位，请换成真实路径：" >&2
  printf '  %s\n' "${placeholders[@]}" >&2
  exit 2
fi
if [ "${#fragments[@]}" -eq 0 ] && [ "${#exact_paths[@]}" -eq 0 ]; then
  echo "public-leak-guard: 名单文件 $LIST_FILE 里没有任何路径条目。" >&2
  exit 2
fi
if [ "${#scan_dirs[@]}" -eq 0 ]; then
  scan_dirs=(".")
fi

# 已跟踪的文件，加上未跟踪但没有被 .gitignore 忽略的文件：这些文件下一次 git add 就可能进入提交
files=$(git ls-files --cached --others --exclude-standard -- "${scan_dirs[@]}" | while IFS= read -r file; do
  # 已跟踪但已经在工作区删除的文件不算
  if [ -e "$file" ]; then
    printf '%s\n' "$file"
  fi
done)

hits=""
if [ "${#fragments[@]}" -gt 0 ]; then
  for fragment in "${fragments[@]}"; do
    matched=$(printf '%s\n' "$files" | grep -iF -- "$fragment" || true)
    if [ -n "$matched" ]; then
      hits="${hits}${matched}"$'\n'
    fi
  done
fi
if [ "${#exact_paths[@]}" -gt 0 ]; then
  for path in "${exact_paths[@]}"; do
    if [ -e "$path" ]; then
      hits="${hits}${path}"$'\n'
    fi
  done
fi

if [ -n "$hits" ]; then
  echo "public-leak-guard: 公开仓里出现了只属于私有仓的文件：" >&2
  printf '%s' "$hits" | sort -u | sed 's/^/  /' >&2
  echo "这些文件只能放在私有仓。移走后再提交。" >&2
  exit 1
fi

echo "public-leak-guard: 没有发现只属于私有仓的文件。"
