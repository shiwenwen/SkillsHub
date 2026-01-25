# Contribution Guidelines

感谢您对 SkillsHub 的关注！欢迎各种形式的贡献。

## 如何贡献

### 报告问题

1. 在 [Issues](https://github.com/skillshub/skillshub/issues) 中搜索是否已存在相同问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（OS、Rust 版本、Node 版本）

### 提交代码

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- Rust 代码遵循 `rustfmt` 格式化
- TypeScript/React 代码遵循项目 ESLint 配置
- 提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/)

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/skillshub/skillshub.git
cd skillshub

# 安装依赖
npm install

# 运行测试
cargo test --workspace

# 开发模式运行
npm run tauri dev
```

## 项目结构

- `crates/skillshub-core` - 核心库
- `crates/skillshub-cli` - CLI 工具
- `src-tauri` - Tauri 后端
- `src` - React 前端

## 行为准则

请友善对待项目参与者，营造开放包容的社区氛围。

## 许可证

贡献的代码将按照 MIT 许可证发布。
