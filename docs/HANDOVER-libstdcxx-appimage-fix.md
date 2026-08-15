# 交接：修复 Linux AppImage 在 SteamOS 上启动即崩溃（内置旧 libstdc++ 污染）

分支：`feat/linux-compat`。目标：让 `MAW-x86_64-*.AppImage` 在 Steam Deck
（SteamOS，Wayland 会话，系统 libstdc++ 为 GCC 14 / 6.0.34）上正常启动。

## 1. 现象

在 SteamOS 桌面模式（Wayland）下直接运行 AppImage，进程在启动早期
`SIGABRT`、核心转储。关键日志（`./MAW-x86_64-v1.4.0-beta.7.AppImage`）：

```text
qt.qpa.wayland: EGL not available
QRhiGles2: Failed to create temporary context
QRhiGles2: Failed to create context
Failed to create RHI for backend: OpenGL
vkDebug: setup_loader_term_phys_devs:  Failed to detect any valid GPUs in the current config
No physical devices
GBM is not supported with the current configuration and Vulkan is not available. Fallback to software rendering.
ANGLE Display::initialize error 12289: Failed to get system egl display
libva error: dlopen of /usr/lib/dri/radeonsi_drv_video.so failed: /tmp/.mount_MAW-xxx/_internal/libstdc++.so.6: version `GLIBCXX_3.4.32' not found (required by /usr/lib/libSPIRV-Tools.so)
QQuickWidget: Failed to get a QRhi from the top-level widget's window
QQuickWidget: Attempted to render scene with no rhi
已中止 （核心已转储）./MAW-x86_64-v1.4.0-beta.7.AppImage
```

## 2. 根因（已用证据坐实）

PyInstaller 在构建机（ubuntu-22.04，GCC 11）上把 `libstdc++.so.6` 与
`libgcc_s.so.1` 收进了 `_internal/`。AppImage 启动时 `_internal` 进入
`LD_LIBRARY_PATH`，动态链接器**优先命中内置旧库**；而 SteamOS 的系统 Mesa /
LLVM 栈要求更新的 C++ ABI 符号。于是：

- 系统 `/usr/lib/` 中由 GCC 14 构建的组件（`libSPIRV-Tools.so`、`libLLVM`、
  Mesa 的 `radeonsi_drv_video.so` / EGL / Vulkan 驱动）加载失败或直接无符号可解；
- 连锁反应：EGL / Vulkan / VA-API 全部初始化失败（上面的 ANGLE 12289、
  `No physical devices`、libva 报错），QtWebEngine 拿不到任何渲染后端；
- Qt 侧 RHI（`QRhiGles2`）建不出上下文 → `QQuickWidget` 无 `rhi` →
  QtWebEngine 判定环境不可用 → `abort()`。

实测数据（v1.4.0-beta.7 解包后）：

| 库 | 符号上限 | 是否含 `GLIBCXX_3.4.32` |
| --- | --- | --- |
| 包内 `_internal/libstdc++.so.6`（GCC 11） | `GLIBCXX_3.4.30` | 否 |
| 系统 `/usr/lib/libstdc++.so.6`（GCC 14，6.0.34） | `GLIBCXX_3.4.34` | 是 |

`libva` 报错本身就是一锤定音的证据：它尝试加载系统驱动的过程中，解析
`/usr/lib/libSPIRV-Tools.so` 的 `libstdc++` 依赖时命中了
`_internal/libstdc++.so.6`。

注：`qt.qpa.wayland: EGL not available` 不是 Wayland 本身的独立问题，
而是 EGL 驱动加载失败的同一连锁反应。

## 3. 为什么 CI 没抓到

`release-linux.yml` 的 smoke 测试跑在 ubuntu-22.04 上，其系统 libstdc++
恰好与包内同一个版本（都是 GCC 11），系统驱动也不需要新符号——问题只在
"系统 libstdc++ 比包内新"的真机（SteamOS / Arch 等）爆发。CI 需要加
"包内不得内置 libstdc++/libgcc_s" 的回归断言，而不是继续依赖 xvfb smoke。

## 4. 修改方案

原则：不碰 `MAW.spec`（它被 Windows / macOS 打包共用，C++ 运行时策略不同；
剔除应只作用于 AppImage）；在 `scripts/build-appimage.sh` 组装 AppDir 后、
`appimagetool` 打包前删除两把旧库，让系统（更新的）版本接管。
`libstdc++` ABI 向后兼容，主流发行版（SteamOS、Arch、Ubuntu 22.04+）系统库
都满足要求。

### 4.1 `scripts/build-appimage.sh`

在 "3/6 组装 AppDir" 的 `cp -a dist/MAW/. "$APP_DIR/"` 之后追加：

```bash
# PyInstaller 会把构建机（ubuntu-22.04，GCC 11）的 libstdc++/libgcc_s 收进
# _internal。在系统 libstdc++ 更新的发行版（如 SteamOS 的 GCC 14）上，这两把
# 旧库会抢先于系统库被加载，导致系统 Mesa 驱动链（radeonsi → libLLVM →
# libstdc++）与 libSPIRV-Tools 因缺 GLIBCXX_3.4.32 加载失败，QtWebEngine
# 无可用渲染后端而 abort。libstdc++ ABI 向后兼容，直接剔除、使用系统版本；
# 后续如需支持系统库过老的发行版，再引入 compat 目录按需加载（见 §6）。
rm -f "$APP_DIR/_internal/libstdc++.so.6" "$APP_DIR/_internal/libgcc_s.so.1"
```

### 4.2 `.github/workflows/release-linux.yml`

在 "Build AppImage" 与 "Verify AppImage output" 之间（或紧跟其后）新增一步
回归断言，名称固定为 `Verify no bundled C++ runtime in AppImage`：

```yaml
      - name: Verify no bundled C++ runtime in AppImage
        run: |
          set -euo pipefail
          cd build-appimage
          ./MAW-x86_64.AppImage --appimage-extract >/dev/null 2>&1
          if [ -e squashfs-root/_internal/libstdc++.so.6 ] || [ -e squashfs-root/_internal/libgcc_s.so.1 ]; then
            echo "FAIL: AppImage 内置了 libstdc++/libgcc_s，会污染系统 Mesa 驱动加载（见 docs/HANDOVER-libstdcxx-appimage-fix.md）"
            exit 1
          fi
          echo "OK: 未内置 libstdc++/libgcc_s"
          rm -r squashfs-root
```

（步名与上一条 `test_appimage_build_drops_bundled_cpp_runtime` 的断言字符串保持
一致，改了名字要同步改测试。）

### 4.3 `tests/test_packaging_contract.py`

按该文件既有风格（读静态文件、断言子串）新增一个方法：

```python
def test_appimage_build_drops_bundled_cpp_runtime(self) -> None:
    """Given the AppImage build script and workflow, When the AppDir is assembled, Then bundled libstdc++/libgcc_s are removed and CI forbids them."""
    script = read_text("scripts/build-appimage.sh")
    workflow = read_text(".github/workflows/release-linux.yml")

    self.assertIn('rm -f "$APP_DIR/_internal/libstdc++.so.6" "$APP_DIR/_internal/libgcc_s.so.1"', script)
    self.assertIn("Verify no bundled C++ runtime in AppImage", workflow)
```

### 4.4 `CHANGELOG.md`

按发布约定补一条修复记录（版本号与发布流程一致）。

## 5. 验证

### 5.1 本机快速验证（SteamOS，无需完整重建）

用仓库里已缓存的 appimagetool 重打包现有 AppImage，只验证"剔除后能正常存活"：

```bash
cd /tmp && rm -rf mawverify && mkdir mawverify && cd mawverify
APPIMAGE_EXTRACT_AND_RUN=1 /home/deck/Applications/MAW-x86_64-v1.4.0-beta.7.AppImage --appimage-extract >/dev/null 2>&1
rm -f squashfs-root/_internal/libstdc++.so.6 squashfs-root/_internal/libgcc_s.so.1
/home/deck/MyCode/moys-asr-workflow/build-appimage/appimagetool-x86_64.AppImage \
  --appimage-extract-and-run squashfs-root MAW-fixed.AppImage
timeout 25 ./MAW-fixed.AppImage > /tmp/maw-fixed.log 2>&1
echo "status=$?   （124=事件循环存活，正常）"
```

判定标准：

- `status` 为 124（GUI 事件循环持续运行直到被 timeout 杀死）；
- `/tmp/maw-fixed.log` 中不再出现 `libva error ... GLIBCXX_3.4.32`、
  `Failed to create QRhi` / `QQuickWidget ... no rhi`、ANGLE 12289、
  `Failed to get system egl display`；
- 屏幕上能正常弹出 MAW Launcher 窗口（约 25 秒后自动关闭）。

注意：本机是 GCC 14，PyInstaller 在本机收集到的 libstdc++ 与系统同款，
本机重建**复现不了**"旧 vs 新"的冲突；真正的回归防线是 §4.2 的 CI 断言
（CI 构建机是 ubuntu-22.04，才会收集到旧库）。所以发布包必须走 CI 产出，
再在真机做 5.1 的冒烟。

### 5.2 CI 验证

push `feat/linux-compat` 后先跑一遍 `release-linux.yml`（workflow_dispatch），
确认新增步骤与既有 smoke 全绿。

### 5.3 自动化测试

```powershell
uv run python -m unittest discover -s tests -p "test_*.py"
git diff --check
```

## 6. 风险与备选方案（暂不做，仅记录）

- **系统库过老的发行版**：若某发行版 system libstdc++ 比剔掉的还旧且
  Qt 需要更高符号，会反过来缺符号。届时方案是 AppRun 里按需加载：
  把两把库挪到 `_internal/compat/`，AppRun 检测
  `strings /usr/lib/libstdc++.so.6 | grep -q '^GLIBCXX_3.4.32$'` 失败时再把它
  们加入 `LD_LIBRARY_PATH`。当前 MAW 目标环境（SteamOS / Arch / Ubuntu 22.04+）
  均不需要，先不引入。
- **Wayland 残余问题**：若剔除 libstdc++ 后在某些环境下 EGL 仍失败，备用尝试
  （按顺序）：
  1. AppRun 加 `export QT_QPA_PLATFORM=xcb`（SteamOS 有 XWayland，xcb 最稳）；
  2. `QTWEBENGINE_CHROMIUM_FLAGS` 追加 `--disable-features=VaapiVideoDecoder`
     仅消除 libva 硬解尝试日志，不影响崩溃。
- 修复后 libva 硬解仍可能不可用（AppImage 不打包 libva 驱动栈），Chromium 会
  自动回退软件解码，无害，不用处理。

## 7. 结论速记

改 2 个文件 + 1 个测试：`scripts/build-appimage.sh`（rm 两把库）、
`release-linux.yml`（新增断言步骤）、`tests/test_packaging_contract.py`
（契约测试），另加 `CHANGELOG.md`。验证：CI 产出包 + 真机冒烟 + 单测。