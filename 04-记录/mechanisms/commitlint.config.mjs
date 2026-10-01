// commitlint 配置：提交信息必须符合 Conventional Commits（feat: / fix: / docs: ...）。
// 放在哪里：<your-repo>/commitlint.config.mjs（仓库根目录）。
//
// 安装：npm install --save-dev @commitlint/cli @commitlint/config-conventional
// （husky 已经按 INSTALL.md 装好；带包名的安装不运行 prepare，装完运行一次 npx husky）。
// 配合本目录的 commit-msg 钩子（本地）和 commit-message-policy.yml（CI）使用。
//
// 要改的地方：
// 1. type-enum：你的项目允许的前缀。
// 2. ascii-only：要求标题和正文只用 ASCII 可见字符（便于各种工具处理）；
//    团队用中文写提交信息时删掉这条规则和 plugins。
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'ascii-only': ({ header, body }) => {
          const text = `${header ?? ''}\n${body ?? ''}`;
          // 允许换行、制表符和 ASCII 可见字符
          const ok = /^[\t\n\r\x20-\x7e]*$/.test(text);
          return [ok, 'commit header and body must use printable ASCII only'];
        },
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'ci', 'build', 'perf', 'revert']],
    'header-max-length': [2, 'always', 100],
    'ascii-only': [2, 'always'],
  },
};
