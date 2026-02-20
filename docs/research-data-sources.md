# 内置数据源研究报告：可获取的真实数据分析

> 研究日期：2026-02-20

## 1. 现状总结

当前 SkillsHub 有 5 个内置数据源，但大部分数据字段（下载量、评分、热度排名等）**未真实获取**：

| 字段 | ClawHub | Git 源 (4个) | HTTP/Local |
|------|---------|-------------|------------|
| downloads | 部分获取 ✅ | 始终 None ❌ | 始终 None ❌ |
| rating | 始终 None ❌ | 始终 None ❌ | 始终 None ❌ |
| stars | API 有但被注释掉 ⚠️ | 未获取 ❌ | N/A |
| author | 始终 None ❌ | 从 SKILL.md 解析 | 从 SKILL.md 解析 |
| tags | 始终空数组 ❌ | 从 SKILL.md 解析 | 从 SKILL.md 解析 |
| 更新时间 | API 有但未使用 ⚠️ | 未获取 ❌ | N/A |
| 热度/排名 | 不存在 ❌ | 不存在 ❌ | 不存在 ❌ |

---

## 2. 各数据源可获取的真实数据

### 2.1 ClawHub API (`https://auth.clawdhub.com/api/v1`)

**当前使用的字段：**
- `slug` → id
- `displayName` → name
- `summary` → description
- `latestVersion.version` → version
- `stats.downloads` → downloads（已获取）

**API 有但未使用的字段：**

| 字段 | 路径 | 说明 |
|------|------|------|
| `stats.stars` | `ClawHubStats.stars` | **已在代码中定义但被注释掉**（`clawhub.rs:43`） |
| `tags` | 搜索结果中的 tags 字段 | 已在 schema 中定义，当前返回空数组 |
| `createdAt` | Skill 创建时间 | API 返回但未解析 |
| `updatedAt` | 最后更新时间 | API 返回但未解析 |
| author/owner | 通过 slug 或 user endpoint | ClawHub 有用户系统，可通过额外请求获取 |

**可用的额外 API 端点（来自 clawhub-schema routes.ts）：**
- `/stars` - 收藏/Star 功能
- `/search` - 向量搜索
- `/users` - 用户信息
- `/resolve` - 解析技能详情

**建议操作：**
1. **立即可做**：取消注释 `stats.stars` 字段并映射到 `rating` 或新增 `stars` 字段
2. **立即可做**：解析 `tags` 字段
3. **立即可做**：解析 `createdAt`/`updatedAt` 时间戳
4. **需要额外请求**：通过 skill detail 接口获取 author 信息

---

### 2.2 GitHub 仓库源（4个 Git 仓库）

GitHub API 提供了丰富的仓库级和目录级元数据：

#### 2.2.1 仓库级数据（`GET /repos/{owner}/{repo}`）

| 仓库 | Stars | Forks | Watchers | Subscribers | Skills 数量 | 语言 |
|------|-------|-------|----------|-------------|-----------|------|
| anthropics/skills | 72,033 | 7,365 | 72,033 | 534 | 16 | Python |
| obra/superpowers | 55,496 | 4,200 | 55,496 | 308 | 14 | Shell |
| ComposioHQ/awesome-claude-skills | 36,029 | 3,516 | 36,029 | 264 | 33 | Python |
| vercel-labs/agent-skills | 20,775 | 1,890 | 20,775 | 106 | 5 | JavaScript |

**可获取的仓库级字段：**
- `stargazers_count` - GitHub Stars 数（可作为热度指标）
- `forks_count` - Fork 数
- `watchers_count` - 关注数
- `subscribers_count` - 订阅数
- `open_issues_count` - 开放 Issue 数
- `topics` - 仓库标签/主题
- `description` - 仓库描述
- `updated_at` - 最后更新时间
- `created_at` - 创建时间
- `license` - 许可证信息

#### 2.2.2 每个 Skill 级别数据（`GET /repos/{owner}/{repo}/commits?path=skills/{name}`）

- **最后更新时间**：通过 `path` 参数查询特定目录的最新 commit 时间
- **最后修改者**：commit 的 author 信息
- **活跃度**：该目录的 commit 频率

#### 2.2.3 贡献者数据（`GET /repos/{owner}/{repo}/contributors`）

- 每个贡献者的贡献次数
- 贡献者 GitHub 用户名和头像

**建议操作：**
1. **仓库级元数据缓存**：在 `sync_repo()` 时调用 GitHub API 获取仓库 stars/forks 等数据
2. **Stars 映射为热度**：将 repo 的 `stargazers_count` 按比例分配给该 repo 下所有 skills 作为热度指标
3. **最后更新时间**：使用 Git commit 历史获取每个 skill 目录的最后更新日期
4. **Topics 作为 Tags**：将 repo 的 `topics` 作为该仓库所有 skills 的补充 tags

---

## 3. 数据模型改进建议

### 3.1 扩展 `SkillListing` 结构

```rust
pub struct SkillListing {
    // 现有字段
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub version: String,
    pub downloads: Option<u64>,
    pub rating: Option<f32>,
    pub source: SkillSource,

    // 建议新增字段
    pub stars: Option<u64>,           // ClawHub stars 或 GitHub stars
    pub updated_at: Option<String>,   // 最后更新时间
    pub created_at: Option<String>,   // 创建时间
    pub repo_stars: Option<u64>,      // 所属仓库的 GitHub stars（仅 Git 源）
    pub repo_forks: Option<u64>,      // 所属仓库的 Fork 数（仅 Git 源）
}
```

### 3.2 前端 `SkillListing` 接口同步更新

```typescript
interface SkillListing {
    // 现有字段
    id: string;
    name: string;
    description: string;
    author: string;
    tags: string[];
    version: string;
    downloads: number;
    rating: number;
    source: string;

    // 建议新增字段
    stars?: number;           // Stars 数
    updated_at?: string;      // 最后更新时间
    created_at?: string;      // 创建时间
    repo_stars?: number;      // 仓库 Stars（Git 源）
    repo_forks?: number;      // 仓库 Fork 数（Git 源）
}
```

---

## 4. 实现优先级建议

### P0 - 立即可做（小改动，大收益）

| 编号 | 改动 | 影响文件 | 说明 |
|------|------|---------|------|
| 1 | ClawHub: 取消注释 `stars` | `clawhub.rs` | 已有字段定义，只需取消注释并映射 |
| 2 | ClawHub: 解析 `tags` | `clawhub.rs` | API 返回了 tags 但未解析 |
| 3 | ClawHub: 解析 `createdAt`/`updatedAt` | `clawhub.rs` + `mod.rs` | 需新增字段 |

### P1 - GitHub 仓库元数据获取

| 编号 | 改动 | 影响文件 | 说明 |
|------|------|---------|------|
| 4 | Git: 调用 GitHub API 获取 repo stars/forks | `git.rs` | 新增 HTTP 请求获取仓库级数据 |
| 5 | Git: 通过 git log 获取每个 skill 的最后更新时间 | `git.rs` | 使用 `git log -1 --format=%ci -- <path>` |
| 6 | Git: 将 repo topics 作为补充 tags | `git.rs` | GitHub API `/repos/{owner}/{repo}` 的 topics 字段 |

### P2 - 排序和热度计算

| 编号 | 改动 | 影响文件 | 说明 |
|------|------|---------|------|
| 7 | 综合热度评分算法 | `mod.rs` / 新文件 | 基于 stars、downloads、更新时间计算热度分 |
| 8 | UI 排序选项 | `Discover.tsx` | 添加按下载量、Stars、更新时间等排序 |
| 9 | 热度/趋势标签 | `Discover.tsx` | 显示 "Trending"、"Popular" 等标签 |

### P3 - 进阶功能

| 编号 | 改动 | 说明 |
|------|------|------|
| 10 | 本地 download 计数 | 记录用户本地安装次数作为下载量补充 |
| 11 | GitHub API rate limiting 处理 | 未认证限制 60 次/小时，需要缓存策略 |
| 12 | 数据缓存层 | 避免每次搜索都请求 GitHub API |

---

## 5. GitHub API 速率限制注意事项

- **未认证请求**：60 次/小时
- **认证请求（token）**：5,000 次/小时
- **建议**：
  - 仓库级数据在 `sync_repo()` 时获取并缓存到本地文件
  - 设置缓存有效期（如 1 小时）
  - 提供可选的 GitHub token 配置以提高速率限制

---

## 6. 具体代码位置参考

| 文件 | 行号 | 当前问题 |
|------|------|---------|
| `crates/skillshub-core/src/registry/clawhub.rs:42-43` | `stars` 被注释掉 | 取消注释即可获取 stars |
| `crates/skillshub-core/src/registry/clawhub.rs:119` | author 始终 None | ClawHub 搜索 API 未暴露 author |
| `crates/skillshub-core/src/registry/clawhub.rs:120` | tags 始终空 | 需要解析 API 返回的 tags |
| `crates/skillshub-core/src/registry/git.rs:136` | downloads 始终 None | Git 源无下载计数，可用 repo stars 替代 |
| `crates/skillshub-core/src/registry/git.rs:137` | rating 始终 None | 无数据来源，可用计算热度替代 |
| `crates/skillshub-core/src/registry/mod.rs:53-65` | SkillListing 缺少时间字段 | 需扩展结构体 |
| `src/pages/Discover.tsx:314` | downloads 显示 0 | 因为 Git 源返回 None |
| `src/pages/Discover.tsx:318` | rating 显示 "-" | 所有源都返回 None |

---

## 7. 结论

当前数据获取的主要问题：

1. **ClawHub 源**：API 返回的 `stars`、`tags`、`createdAt`/`updatedAt` 等字段都未被解析使用
2. **Git 仓库源**：完全没有利用 GitHub API 获取仓库级元数据（stars、forks、topics 等），也没有利用 git 命令获取每个 skill 的更新时间
3. **UI 层面**：没有排序功能、没有热度指标、没有趋势展示
4. **`rating` 字段**：当前没有任何数据来源可以直接获取评分，建议用 stars 数或计算的热度分代替

最大的快速收益来自 **P0 和 P1** 的改动：取消 ClawHub stars 的注释、解析 tags、调用 GitHub API 获取仓库元数据。这些改动可以让 Discover 页面从"全是 0 和 -"变成有真实数据的状态。
