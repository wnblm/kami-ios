# 卡密生成器 · iOS 未签名 IPA 打包包

**这份东西是干什么的**：把它传到 GitHub，GitHub 会**免费**用一台 macOS 机器帮你编译，
几分钟后你会得到一个 **`App.ipa`（未签名）**，下载后丢进你手机上的「万能签」签名安装即可。

> 为什么不能直接给你一个 IPA？
> iOS 的 App 里必须有一个**编译产出**的 arm64 可执行文件，只能用 macOS 上的 Xcode 生成。
> 这里借 GitHub 的免费 macOS 机器来编译——**你不需要有任何 Mac**。

---

## 先选一条上传方式（二选一）

### 方式 A：GitHub Desktop（推荐，最省事）

1. 下载安装 <https://desktop.github.com>（Windows 版，一路下一步）；
2. 打开它 → **Sign in to GitHub.com** 登录你的账号（没有就点 Create account 注册）；
3. 菜单 **File → Add local repository** → 选择**本文件夹**（解压后的这个目录）→ Add；
4. 右上角点 **Publish repository** → 名字填 `kami-ios` → **取消勾选 Keep this code private**（公开仓库 Actions 免费）→ Publish；
5. 发布后打开 <https://github.com/你的用户名/kami-ios/actions> 看编译进度。

### 方式 B：网页上传（不装任何软件）

1. 双击本目录里的 **「显示隐藏文件夹.bat」**（作用：把隐藏的 `.github` 文件夹显示出来，
   上传时最常踩的坑就是它看不见）；
2. 打开 <https://github.com/new> → 名字填 `kami-ios` → 选 **Public** → Create repository；
3. 点页面上的 **uploading an existing file**；
4. 回到本文件夹，**Ctrl+A 全选**（`.github`、`ios`、`www`、各种文件）→ 拖进网页；
   - 可以顺便把 `.git` 文件夹剔除掉（不影响编译，只是没必要上传历史）
5. 页面下方 **Commit changes**。

---

## 然后等编译、下载 IPA

1. 打开仓库的 **Actions** 标签（就在 Code 旁边）；
2. 会看到 **「构建 iOS 未签名 IPA」** 在跑（黄色圆点在转）；
   没自动开始就点进去 → **Run workflow** → 绿色按钮手动触发；
3. 等 **5～10 分钟**（第一次要下载依赖，久一点），变成绿色 ✅；
4. 点进任务 → 页面最下方 **Artifacts** → 下载 **`kami-ios-unsigned-ipa`**；
5. 解压得到 **`App.ipa`**。

## 最后：用「万能签」签名安装

把 `App.ipa` 传到手机 → 万能签 → 选证书签名 → 安装。

**⚠️ 重要提醒**

- 免费 Apple ID 签的 App **有效期只有 7 天**，过期用万能签**重新签一次**即可（App 内数据不受影响）；
- 建议**单独注册一个小号 Apple ID** 专门用来签名，不要用主力账号；
- 任何要你把 Apple ID 密码交给"第三方网站"的免签服务都别用。

---

## 出问题了怎么办

| 现象 | 原因与处理 |
|---|---|
| Actions 页面**没有任务** | `.github` 没上传成功。回到方式 B 第 1 步，先运行「显示隐藏文件夹.bat」 |
| 编译失败，红 ❌ | 点进任务看报错；或下载任务里的 **`编译日志-报错时看这个`**，把内容发我，我改 workflow |
| Artifacts 里没有 IPA | 任务没成功；或已过期（保留 30 天） |
| 万能签报"无效的 IPA" | 确认选的是「重签名已有 IPA」；把报错原文发我 |
| 装好后闪退 | 多半是证书/描述文件不匹配，换一种签名方式再签 |

---

## 目录说明

| 路径 | 说明 |
|---|---|
| `.github/workflows/build-ios.yml` | **编译脚本（核心）**，GitHub 靠它自动编译出 IPA，不能漏传 |
| `ios/` | 已生成好的 Xcode 工程：应用名「卡密生成器」、包名 `com.kami.generator`、图标、启动图；`public/` 由编译时自动生成，不需要手动放 |
| `www/` | 应用本体（网页代码），编译时会自动同步进 iOS 工程 |
| `capacitor.config.json` / `package.json` / `package-lock.json` | 配置与依赖（Capacitor 6.2.2，版本已锁死） |
| `显示隐藏文件夹.bat` / `恢复隐藏.bat` | 网页上传方式用的小工具 |
| `卡密生成器-单文件版.html` | 备用：iPhone 用 Safari 打开 → 添加到主屏幕，不用签名 |

**改了代码想重新出包**：把新的网页文件覆盖到 `www/`（或在 GitHub 网页上直接改），
再提交一次，Actions 会自动重新编译，重新下载 IPA 即可。
