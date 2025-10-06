/**
 * Commitlint 配置文件
 * 使用 Angular 提交规范
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档更新
        'style', // 代码格式化，不影响代码逻辑
        'refactor', // 重构代码
        'perf', // 性能优化
        'test', // 测试相关
        'build', // 构建系统或外部依赖的更改
        'ci', // CI配置文件和脚本的更改
        'chore', // 其他不修改src或test文件的更改
        'revert', // 回滚之前的提交
      ],
    ],
    // 主题不能为空
    'subject-empty': [2, 'never'],
    // 主题不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // 主题格式（允许任意大小写）
    'subject-case': [0],
    // 类型不能为空
    'type-empty': [2, 'never'],
    // 类型格式（小写）
    'type-case': [2, 'always', 'lower-case'],
  },
};
