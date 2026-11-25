# Linux 发布 FFmpeg 自审

审查基于 `2.0dev@3cf512a2`。范围包括 Linux 发布 CI、AppImage 打包、发布资产解析及回归测试。

- 上游 MAW 的 Linux 作业在 FFmpeg 下载步骤收到 HTTP 404。FFmpeg-Builds 每轮先发布带日期的构建，再刷新滚动 `latest`。同一日期发布的旧固定文件名返回 404，带版本号的实际归档及校验清单可访问。[MAW 失败作业](https://github.com/Moyf/moys-asr-workflow/actions/runs/45617338002) · [FFmpeg-Builds 发布作业](https://github.com/FFmpeg-Builds/FFmpeg-Builds/actions/runs/45611068521/job/139211716289)
- 初审发现，按上游补丁读取发布元数据后仍可能取得字面值为 `latest` 的可变 tag。已改为在最近三条发布中选择最新的带日期构建，从同一 tag 下载归档和清单。保持 Linux x86_64、静态 GPL、8.1 与 SHA-256 校验要求。
- 复审无 blocker 或 major。接受两项边界。上游发布或命名规则改变后，找不到有效的日期构建或归档会明确报错。迁移前留下的 AppImage 目录缓存缺少归档记录时，`SOURCE.txt` 将相应字段标为不可用。

两项打包契约在旧实现上失败。更新后，解析、打包契约和 SHA-256 回归共 49 项通过。实时发布列表成功解析 `autobuild-2026-11-25-12-41` 的版本化归档，清单与发布元数据的 SHA-256 一致。本机完整归档下载超时，Linux 编解码和 AppImage 产物以 Cat Fork 发布工作流的实跑记录为准。
