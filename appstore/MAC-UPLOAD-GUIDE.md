# MERGE BLOOM iOS 上架：Mac + Xcode 手动上传指南

> 适用：`MergeBloom-iOS-mac.zip`（自包含 Xcode 工程，**不需要 node / npm / 终端命令**，依赖都在 `Vendor/` 里，不联网也能编译）。
> 本指南只到「上传构建版本到 App Store Connect」。**提交审核（Submit for Review）由你自己决定何时点。**
> 界面文字按 Apple 官方帮助文档（2026-11 查证）书写；Apple 偶尔改按钮名，若略有不同，以意思相近的按钮为准。

| 项目 | 值 |
|---|---|
| Bundle ID | `com.frankzhang.mergebloom` |
| 显示名称 | MERGE BLOOM |
| 版本 / 构建号 | 1.0.0 / 1 |
| Team ID | `B82V7J8MC5`（**待你核实**，见第 0 步） |
| 签名 | Automatically manage signing（自动签名） |
| 设备 / 方向 / 最低系统 | 仅 iPhone、仅竖屏、iOS 15.0+（Capacitor 8 的最低要求就是 iOS 15） |
| 加密声明 | Info.plist 已写 `ITSAppUsesNonExemptEncryption = NO`（上传后不会再问出口合规） |
| 隐私清单 | `App/App/PrivacyInfo.xcprivacy`（不追踪、不收集数据） |
| 类别 | Games → Puzzle（Info.plist `LSApplicationCategoryType = public.app-category.puzzle-games`） |

前提：
- 已加入 Apple Developer Program（付费会员已生效）。
- Mac 上装了**最新正式版 Xcode**（App Store 要求用较新的 SDK 构建；旧 Xcode 上传会被拒）。
- 账号持有人（Account Holder）已在 App Store Connect → **Business**（协议）里接受最新协议，否则不能新建 App。

---

## 第 0 步：核实 Team ID（1 分钟）

1. 浏览器打开 <https://developer.apple.com/account>，登录。
2. 页面里找到 **Membership details**（会员资格详细信息），看 **Team ID**（10 位字母数字）。
3. 如果不是 `B82V7J8MC5`：没关系，第 3 步在 Xcode 里选你自己的 Team 即可，Xcode 会自动改。

---

## 第 1 步：在 developer.apple.com 注册 Bundle ID（App ID）

（官方说明：<https://developer.apple.com/help/account/identifiers/register-an-app-id/>）
> 说明：Xcode 开着「自动签名」时，第一次 Archive 也会自动注册这个 ID。手动注册一次更稳，也方便第 2 步在下拉框里选到它。

1. 打开 <https://developer.apple.com/account/resources/identifiers/list>（**Certificates, Identifiers & Profiles**）。
2. 左侧点 **Identifiers**，再点标题旁边的 **蓝色 “+”** 按钮。
3. 选 **App IDs** → 点 **Continue**。
4. 类型选 **App**（通常已自动选好）→ **Continue**。
5. **Description**：填 `MERGE BLOOM`。
6. **Bundle ID**：选 **Explicit**，填 `com.frankzhang.mergebloom`。
7. **Capabilities**：什么都不用勾（不需要推送、iCloud 等）。
   - 以后若要加 Game Center 排行榜，再回来勾 **Game Center**（见文末附录）。
8. 点 **Continue** → 核对 → 点 **Register**。

如果提示 *“An App ID with Identifier 'com.frankzhang.mergebloom' is not available”*：说明这个 ID 已被别的账号占用 → 换成 `com.frankzhang.mergebloom.game` 之类，并在第 3 步把 Xcode 里的 Bundle Identifier 改成同一个。

---

## 第 2 步：在 App Store Connect 新建 App

（官方说明：<https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app>，页面里有官方截图）

1. 打开 <https://appstoreconnect.apple.com> → 点 **Apps**（App）。
2. 左上角点 **“+”** → 选 **New App**（新建 App）。
3. 在 **New App** 对话框里填：
   - **Platforms**：勾 **iOS**。
   - **Name**：`MERGE BLOOM`（若提示名称已被使用，用 `SUBMISSION.md` 里的备选名）。
   - **Primary Language**：English (U.S.)（中文介绍可以以后再加一个「简体中文」本地化）。
   - **Bundle ID**：下拉选 `MERGE BLOOM - com.frankzhang.mergebloom`（第 1 步注册后才会出现）。
   - **SKU**：自己起一个内部编号，例如 `mergebloom-ios-001`（用户看不到）。
   - **User Access**：选 **Full Access**。
4. 点 **Create**。成功后 App 状态显示 **Prepare for Submission**。
5. 资料（截图、描述、年龄分级、App 隐私等）照 `SUBMISSION.md` 填，可以等上传构建后再填。

---

## 第 3 步：Xcode 打开 → 选团队 → Archive → 上传

### 3.1 解压并打开
1. 双击 `MergeBloom-iOS-mac.zip`，得到文件夹 `MergeBloom-iOS`。**不要**把里面的 `App` 文件夹单独挪走（它和 `Vendor`、`debug.xcconfig` 是相对路径关系）。
2. 双击 `MergeBloom-iOS/App/App.xcodeproj` 用 Xcode 打开。
3. 等左侧导航栏下面的 **Package Dependencies** 出现 `capacitor-swift-pm`、`CapacitorApp`、`CapacitorHaptics`、`CapacitorStatusBar`（都是本地包，几秒钟，不用联网）。
4. ⚠️ 不要在这个文件夹里运行 `npx cap sync` / `npm install`，也不需要装 node。。

### 3.2 登录 Apple 账号（只需一次）
1. 菜单 **Xcode → Settings…**（设置）→ 顶部 **Accounts**（帐户）。
2. 左下角 **“+”** → 选 **Apple Account**（旧版叫 Apple ID）→ **Continue** → 登录开发者账号。

### 3.3 选团队（签名）
1. 左侧导航最上面点蓝色的 **App** 项目图标。
2. 中间 **TARGETS** 下选 **App**。
3. 顶部标签选 **Signing & Capabilities**。
4. 确认勾着 **Automatically manage signing**。
5. **Team** 下拉选你的开发者团队（显示为你的名字 + “(Team ID)”）。
6. **Bundle Identifier** 应为 `com.frankzhang.mergebloom`。下面不应有红色报错；如有，见第 4 步。
7. （可选核对）**General** 标签：**Display Name** = MERGE BLOOM，**Version** = 1.0.0，**Build** = 1，**Minimum Deployments** = iOS 15.0，**Supported Destinations** 只有 iPhone。

### 3.4 Archive
1. Xcode 窗口顶部中间的运行目标（scheme 旁边，默认可能显示某个模拟器），点开选 **Any iOS Device (arm64)**。
2. 菜单 **Product → Archive**。等 1–3 分钟。
   - 如果 Archive 菜单是灰的：说明运行目标还是模拟器，回到上一步改成 Any iOS Device。
3. 完成后自动弹出 **Organizer**（也可从 **Window → Organizer** 打开），左侧 **Archives** 里能看到 “App 1.0.0 (1)”。

### 3.5 上传到 App Store Connect
1. 在 Organizer 里选中刚才的归档。
2. （推荐）先点 **Validate App**，按默认选项走完，看到 “App validation complete” 再继续。
3. 点 **Distribute App**。
4. 选 **TestFlight & App Store** → 点 **Distribute**。
   - 这个选项会自动签名、上传符号文件，并可自动处理构建号。
   - 如果你更想手动选项：选 **Custom** → **App Store Connect** → **Upload** → 一路 **Next**（签名选 **Automatically manage signing**）→ **Upload**。
5. 看到 “Uploaded to Apple” / “App … successfully uploaded” 即完成。
6. 5–30 分钟后，App Store Connect → 你的 App → **TestFlight** 标签里会出现构建 1.0.0 (1)，状态从 *Processing* 变成可用（同时会收到邮件）。
7. 回到 **Distribution**（App Store）标签 → iOS App 1.0 → **Build** 区域点 **“+”/Add Build** 选这个构建，把 `SUBMISSION.md` 的资料填完。**最后的 “Add for Review / Submit for Review” 由你决定。**

---

## 第 4 步：常见报错怎么办

| 报错 / 现象 | 原因 | 怎么做 |
|---|---|---|
| `No Account for Team "B82V7J8MC5"` / `No signing certificate` | Xcode 没登录这个团队，或 Team ID 不对 | 3.2 登录账号；3.3 的 **Team** 下拉重新选你的团队 |
| `Failed Registering Bundle Identifier` / `… is not available` | Bundle ID 被别的账号用过 | 改成 `com.frankzhang.mergebloom.game`（3.3 里改 Bundle Identifier），第 1、2 步也用新 ID |
| `Your team has no devices from which to generate a provisioning profile` | 自动签名在 Archive 时想建开发描述文件，但账号下没有设备 | 用数据线把 iPhone 连上 Mac 并“信任此电脑”，运行目标先选这台 iPhone 一次（Xcode 会自动注册），再切回 Any iOS Device 重新 Archive |
| `Missing package product 'CapApp-SPM'` 或包解析失败 | 文件夹结构被拆开，或 Xcode 缓存旧 | 确认 `MergeBloom-iOS` 里 `App`、`Vendor` 同级；菜单 **File → Packages → Reset Package Caches**，再 **Product → Clean Build Folder**（⇧⌘K）后重试 |
| Product → Archive 是灰色 | 运行目标是模拟器 | 选 **Any iOS Device (arm64)** |
| 上传时 `No suitable application records were found` | App Store Connect 里还没有这个 Bundle ID 的 App | 先做第 2 步；Bundle ID 必须完全一致 |
| `The bundle version must be higher than the previously uploaded version` | 同一个 Build 号已上传过 | **General → Build** 改成 2、3…（Version 可以保持 1.0.0）再 Archive |
| `This app was built with an older SDK` / `SDK version issue` | Xcode 版本太旧 | 从 Mac App Store 更新 Xcode 到最新正式版 |
| `Invalid large app icon … alpha channel` | 图标有透明通道 | 本工程图标已是无透明通道的 1024×1024，正常不会出现；若你换过图标，导出为不带 Alpha 的 PNG |
| `You can't add an app … agreement` | 协议没签 | App Store Connect → **Business**，账号持有人接受最新协议 |
| 打开工程时提示“来自互联网的文件” | macOS 隔离属性 | 点 **打开**；或在 Finder 里对 zip 右键 → 打开 |
| 想在自己 iPhone 上先试玩 | — | 连上 iPhone，运行目标选这台 iPhone，点 ▶（⌘R）。注意：iPhone 静音模式打开时游戏音效会静音（设计如此，见下） |

### 已做好的设置（不用改）
- 内嵌网页来自 `v3-polish` 分支（preview3 那一版：教程、30 关地图、图鉴、皮肤、每日挑战）的离线构建；**没有 Service Worker、没有 Web Manifest、没有统计（GoatCounter 已在 App 内彻底去掉）、没有任何外部网络请求**，飞行模式下完全可玩。
- 声音：`AVAudioSession .ambient`——**跟随静音开关**（静音时不响），并且**不会打断你自己在放的音乐**。
- 触感（Capacitor Haptics）：落花轻震、合并中震、连消重震、过关“成功”震动、失败“错误”震动。
- 存档：关卡星数、图鉴、皮肤、声音开关都存在本机（WKWebView localStorage），每次变化立刻写入；切到后台时再保存一次并自动暂停（回来看到 PAUSED 面板）。已在 CI 模拟器里验证重启 App 后进度保留。
- 全面屏：画面铺满整个屏幕（背景延伸到状态栏和两侧），按钮和棋盘都在安全区内，**两侧不会出现白边**；已在 6.9 寸（iPhone 17 Pro Max）和小屏（iPhone 16e）模拟器上截图核对。
- App 内「Privacy」页面写明：iPhone App 不含统计、不收集任何数据。
- 已验证：GitHub Actions macOS 在断开 GitHub/npm 的干净机器上，用这份 zip 完成了无签名 `xcodebuild archive` 和两台模拟器测试：CI_RUN_URL

### 以后改网页代码时
本压缩包是“冻结”的成品。网页有更新时，由我在服务器上重新生成新的 zip（脚本 `native/scripts/make-ios-mac-bundle.sh`），**不要**在这个文件夹里跑 `npx cap sync`（它会把依赖路径改回 node_modules，Mac 上就编译不了了）。上传新版本时把 **Build** 号 +1。

---

## 附录：Game Center 排行榜（本版未加，被 4.2 拒时再加）
需要你在 App Store Connect 做的事：
1. 第 1 步的 App ID 里勾 **Game Center**。
2. App Store Connect → 你的 App → **Services**（服务）→ **Game Center** → 新建 **Leaderboard**（例如「总星数」`mergebloom.stars`，Integer，High to Low）。
3. 版本页面里 **Game Center** 开关打开并添加该排行榜。
我这边需要加一个原生插件并在 Xcode 里加 Game Center capability，未登录 Game Center 的玩家照常游戏、不弹窗。
