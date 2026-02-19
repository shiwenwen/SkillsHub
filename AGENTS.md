1. 每次功能修改完成，都需要视情况更新CHANGELOG.md，必要时更新README.md文档。
2. 每次全部修改完成后，需要修复linit问题。
3. UI界面问题要确保进行多语言国际化翻译适配（Skill这个是专业词汇，不用进行翻译，始终保持SKill就行）。
4. 本项目是基于 Tauri 构建的桌面应用，后端使用 Rust，前端使用 TypeScript。进行修改时，需确保前后端同步更新（例如新增前端设置项时，同时添加对应的后端 API/配置处理逻辑）。

## 发版规则

5. **确定版本号**：执行发版时，若已指定版本号则直接使用；否则根据本次变更内容自动递增版本号（breaking change → major，新功能 → minor，bugfix/其他 → patch），版本号格式遵循 [Semantic Versioning](https://semver.org/)（`MAJOR.MINOR.PATCH`）。

6. **同步所有版本相关信息**：确定版本号后，更新项目中所有涉及版本号的文件，包括但不限于：
   - `README.md`（徽章、安装说明、版本声明等处的版本号）
   - `package.json` / `Cargo.toml` / `tauri.conf.json` 等构建配置文件中的 `version` 字段
   - 其他任何硬编码版本号的文件

7. **整合 CHANGELOG 并生成 Release Notes**：将 `CHANGELOG.md` 中 `[Unreleased]` 区块下的所有条目，整合为以新版本号和发版日期命名的正式版本区块（格式：`## [x.y.z] - YYYY-MM-DD`），同时基于这些条目生成对应的 **Release Notes**（Markdown 格式，内容与 CHANGELOG 该版本区块保持一致，可适当精简或补充说明）。

8. **打 Tag 并推送（仅限主分支）**：
   - 发版操作**只能在主分支**（`main` 或 `master`）上执行，禁止在其他分支打版本 tag。
   - 提交上述所有文件变更后，使用 `git tag v<version>` 打上对应版本 tag。
   - 执行 `git push` 推送提交，再执行 `git push origin v<version>` 推送 tag。
