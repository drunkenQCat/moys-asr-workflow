# Cat Fork Flatpak 验证自审

试验以 `12a4f6d9` 构建的 AppImage 为输入，使用独立应用 ID 将已验证的 MAW 文件封装成 `.flatpak`。工作流限定 Cat Fork 的验证分支。实际安装和验证在不同 runner 上进行，测试机只装 Freedesktop Platform。

OCR 和本地 ASR 通过真实 Launcher 的后端接口按需安装。安装就绪后，在同一个沙箱内使用生成的 venv 处理合成图片和语音。校验至少识别出约定文本，本地 ASR 同时检查 SRT 和 `.mosp`。Qt 调试端口只在 CI 测试进程启用，绑定回环地址。

独立复审核对了应用入口、批量事件、工作流条件与 Platform-only 安装，无结构性 blocker。实际执行需核对 Platform 的 Python 与 ensurepip、原生 wheel 和 Qt 动态库是否可用。

本次验证覆盖有网络的 CPU 冷安装和真实推理。正式发布、Flathub 提交、GPU、已有 runtime 迁移和升级留待分别验收。输入产物是有保留期限的 CI 工件。[AppImage 构建证据](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45625061279/job/139251698331)
