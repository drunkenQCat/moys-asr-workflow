# Cat Fork Flatpak 验证自审

试验以 `12a4f6d9` 构建的 AppImage 为输入，使用独立应用 ID 将已验证的 MAW 文件封装成 `.flatpak`。工作流限定 Cat Fork 的验证分支。实际安装和验证在不同 runner 上进行，测试机只装 Freedesktop Platform。

OCR 和本地 ASR 通过真实 Launcher 的后端接口按需安装。安装就绪后，在同一个沙箱内使用生成的 venv 处理合成图片和语音。校验至少识别出约定文本，本地 ASR 同时检查 SRT 和 `.mosp`。Qt 调试端口只在 CI 测试进程启用，绑定回环地址。

独立复审核对了应用入口、批量事件、工作流条件与 Platform-only 安装，无结构性 blocker。实际执行需核对 Platform 的 Python 与 ensurepip、原生 wheel 和 Qt 动态库是否可用。

本次验证覆盖有网络的 CPU 冷安装和真实推理。正式发布、Flathub 提交、GPU、已有 runtime 迁移和升级留待分别验收。输入产物是有保留期限的 CI 工件。[AppImage 构建证据](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45625061279/job/139251698331)

第一轮成功导出 Flatpak，测试机准备时受 Node 自动 pnpm 缓存探测阻塞。关闭缓存后复用原包。只装 Platform 的 OCR 测试识别了两帧预期文本。普通本地 ASR 安装下载 CPU wheel 时收到 `ENOSPC`，验证脚本改用应用私有磁盘目录作为临时目录，并记录沙箱内两处容量。[导出运行](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45747011812) · [Platform 默认环境运行](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45748296097)

改用磁盘目录后，ASR 安装从空间错误推进到依赖校验。Platform 的 Python 3.14.9 需要 `audioread` 的额外依赖 `standard-aifc`，已冻结的 CPU 清单没有它的固定版本和哈希。验证包改为随包提供固定并校验的 CPython 3.11.18，启动命令把临时目录指向应用私有缓存目录。验收使用打包后的入口，不注入临时目录或解释器覆盖。[磁盘临时目录运行](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45748973953)

`8158dd17` 的构建与两项验收均通过。测试机只安装 Freedesktop Platform `26.08`，包内入口解析到 `/app/bin/python3` 3.11.18。Launcher 冷安装 OCR 后，包内 FFmpeg 解码的两帧均识别出 `MAW TEST 123`。本地 ASR 冷安装后，以 Whisper `tiny.en` 在 CPU 上转写合成语音，生成 SRT 和 `.mosp`，SRT 包含预期文本。[OCR 作业](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45749828481/job/139678217479) · [ASR 作业](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45749828481/job/139678217380) · [试验包](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45749828481/artifacts/15085626500)

CI 使用沙箱私有目录中的合成素材。runner 的文档 portal 出现挂载错误，桌面文件选择和外部路径存取未验证。GPU、应用升级后已有 venv 的复用及其他宿主发行版也未覆盖。

## Flatpak 平台的 FFmpeg

Python 验证包使用 AppImage 里的静态 FFmpeg。另增独立探针，只安装 Freedesktop Platform `26.08` 和 `codecs-extra`，直接执行平台的 `/usr/bin/ffmpeg` 和 `/usr/bin/ffprobe`。独立复审核对了工具来源、实际编解码、硬字幕和 glibc 记录，无 blocker 或 major。

首轮两台 runner 拿到相同的 Platform `df26daaf` 和 `codecs-extra` `2b9f95bc`，均使用 FFmpeg／FFprobe 8.1.3，动态链接扩展目录下的 libav 库。Ubuntu 22.04 和 24.04 的宿主 glibc 分别是 2.35 和 2.39，沙箱内均为 2.44。AAC 编解码、16 kHz PCM、libx264 编码和 H.264 抽帧通过，字幕烧录失败。[探针首轮](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45771410500)

复测两台 runner 都重复了媒体处理结果。两台的 `ffmpeg -filters` 均无 `subtitles`，工作流因这项 MAW 功能缺失返回失败。Platform 提供的二进制足以验证所测媒体操作和宿主 glibc 隔离，ASS 烧录仍缺平台支持。本次没有改变应用的 FFmpeg 来源。[复测](https://github.com/drunkenQCat/moys-asr-workflow/actions/runs/45771688204)

## 供维护者安装的 Freedesktop 试验包

复用已验证的 MAW 与 Python 3.11.18，组装时排除 AppImage 的 FFmpeg，使用独立应用 ID 和桌面入口。CI 检查沙箱与 Launcher 均选用平台的 `/usr/bin/ffmpeg` 和 `/usr/bin/ffprobe`，再实测 OCR 和本地 ASR。独立复审核对了打包排除规则、桌面入口及安装与验收路径，无 blocker 或 major。
