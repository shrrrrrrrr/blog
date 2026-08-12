# 宋浩然的技术博客

这是宋浩然的个人技术博客。宋浩然来自北京航空航天大学软件工程学院，目前是一名学生。

网站使用原生 HTML、CSS 和 JavaScript 构建，不依赖前端框架。它可以直接部署到 GitHub Pages、Cloudflare Pages 或 Vercel，并支持从 Markdown、JSON、TXT 和 HTML 文件导入文章。

## 当前状态

网站已经完成，文章库目前为空。项目不会使用虚构文章填充首页；当 `content/manifest.json` 中登记第一篇 Markdown 后，文章会自动出现在网站上。

## 功能

- 响应式技术博客首页，支持电脑、平板和手机。
- 浅色与深色主题，自动跟随系统并记住用户选择。
- 文章搜索和分类筛选。
- Markdown、JSON、TXT、HTML 批量导入。
- Markdown 阅读器，支持标题、列表、引用、代码块、链接等常用语法。
- 将内容库导出为 Markdown、JSON 或独立 HTML。
- 文章与主题保存在浏览器本地，不需要后端数据库。
- 仓库内 Markdown 自动加载，适合正式公开发布。
- 已配置 GitHub Pages、Cloudflare Pages 和 Vercel 自动部署。

## 项目结构

```text
.
├─ .github/workflows/deploy-pages.yml  # GitHub Pages 自动部署
├─ content/
│  ├─ manifest.json                    # 公开文章清单
│  └─ posts/                           # 正式公开的 Markdown 文章
├─ scripts/
│  ├─ build.mjs                        # 生成 dist 部署目录
│  └─ validate-content.mjs             # 检查文章清单和文件
├─ templates/article-template.md       # Markdown 写作模板
├─ GUIDE.md                            # 面向站点作者的完整使用手册
├─ index.html                          # 页面结构
├─ styles.css                          # 视觉样式与响应式布局
├─ script.js                           # 内容库、导入导出和阅读器逻辑
├─ package.json                        # 构建与检查命令
├─ vercel.json                         # Vercel 配置
└─ wrangler.toml                       # Cloudflare Pages 配置
```

`dist/` 是运行构建命令后自动产生的目录，已在 `.gitignore` 中忽略，不需要提交到 GitHub。

## 本地预览

### 方法一：直接打开

双击 `index.html` 可以查看页面和使用本地导入功能。部分浏览器在 `file://` 模式下会阻止加载 `content/manifest.json`，因此正式文章可能不会出现。

### 方法二：启动本地服务器（推荐）

如果安装了 Node.js，可以在项目目录运行：

```powershell
npx serve .
```

然后打开终端显示的本地网址。

也可以使用 Python：

```powershell
python -m http.server 8000
```

再访问 `http://localhost:8000`。

## 开发检查与构建

项目没有第三方运行依赖。只需安装 Node.js 20 或更高版本，然后执行：

```powershell
npm run check
npm run build
```

`npm run check` 会检查 JavaScript 语法、文章清单格式和文章文件路径。`npm run build` 会创建可部署的 `dist/`。

## 发布第一篇文章

1. 复制 `templates/article-template.md` 到 `content/posts/`。
2. 把文件重命名为简短的英文文件名，例如 `my-first-post.md`。
3. 修改文章顶部的标题、日期、分类、标签和摘要。
4. 在 `content/manifest.json` 的 `posts` 数组中加入相对路径：

```json
{
  "posts": [
    "./posts/my-first-post.md"
  ]
}
```

5. 运行 `npm run check`。
6. 提交并推送到 GitHub，已连接的平台会自动更新网站。

推荐的 Markdown 结构：

```markdown
---
title: "我的第一篇文章"
date: 2026-08-13
category: "学习记录"
tags: ["软件工程", "学习"]
excerpt: "文章列表中显示的一段简短说明。"
---

# 我的第一篇文章

从这里开始写正文。
```

## 本地导入与公开发布的区别

| 操作 | 保存位置 | 谁能看到 | 适合用途 |
|---|---|---|---|
| 网页内容库导入 | 当前浏览器 `localStorage` | 只有当前浏览器 | 试读、整理、格式转换 |
| 放入 `content/posts` 并登记清单 | GitHub 仓库 | 网站的所有访客 | 正式发布 |

清除浏览器数据会删除本地导入内容。重要文章请导出 JSON 备份，或作为 Markdown 提交到仓库。

## 推送到 GitHub

在 GitHub 新建一个空仓库，例如 `song-haoran-tech-blog`。如果希望使用免费的 GitHub Pages，建议仓库设为 Public。

然后在本地项目目录运行：

```powershell
git init -b main
git add .
git commit -m "Initial personal tech blog"
git remote add origin https://github.com/你的用户名/song-haoran-tech-blog.git
git push -u origin main
```

如果这个目录已经初始化过 Git，请跳过第一条命令。如果已经存在名为 `origin` 的远程地址，请使用 `git remote set-url origin 新地址`，不要重复添加。

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy-pages.yml`，推送 `main` 后会自动构建。

首次使用还需要在 GitHub 网页完成一次设置：

1. 打开仓库的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 打开 **Actions** 页面，等待 `Deploy static blog to GitHub Pages` 完成。
4. 部署地址通常是 `https://你的用户名.github.io/仓库名/`。

如果仓库名正好是 `你的用户名.github.io`，地址会是 `https://你的用户名.github.io/`。

## 连接 Cloudflare Pages

建议使用 Git 集成，这样每次推送 GitHub 都会自动部署。

1. 登录 Cloudflare，进入 **Workers & Pages**。
2. 选择 **Create → Pages → Connect to Git**。
3. 授权 Cloudflare 访问 GitHub，并选择这个仓库。
4. 项目名建议填写 `song-haoran-tech-blog`，与 `wrangler.toml` 一致。
5. Production branch 选择 `main`。
6. Framework preset 选择 `None`。
7. Build command 填写 `npm run build`。
8. Build output directory 填写 `dist`。
9. Root directory 留空。
10. 点击 **Save and Deploy**。

完成后会得到一个 `*.pages.dev` 地址。Cloudflare 会在每次推送 `main` 时更新正式站点，在其他分支上生成预览站点。

Cloudflare 官方文档：[Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) 和 [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)。

## 连接 Vercel

1. 登录 Vercel，点击 **Add New → Project**。
2. 连接 GitHub 并导入这个仓库。
3. Framework Preset 选择 `Other`。
4. Root Directory 保持仓库根目录。
5. `vercel.json` 已经指定 `npm run build` 和 `dist`，通常无需再修改。
6. 点击 **Deploy**。

完成后会得到一个 `*.vercel.app` 地址。以后推送 `main` 会更新生产站点，Pull Request 会生成独立预览地址。

Vercel 官方文档：[Deployments](https://vercel.com/docs/deployments/overview) 和 [`vercel.json`](https://vercel.com/docs/project-configuration/vercel-json)。

## 应该选择哪个平台？

- GitHub Pages：最简单，和开源仓库结合紧密，适合这个纯静态博客。
- Cloudflare Pages：全球网络、预览部署和自定义域名体验很好。
- Vercel：部署界面直观，未来改用前端框架也很方便。

可以同时连接三个平台进行比较，但对外最好只公布一个正式网址，避免搜索引擎把相同内容识别为重复页面。对于当前项目，建议先使用 GitHub Pages；需要自定义域名或更完整的预览体验时再使用 Cloudflare Pages。

## 详细使用说明

文章导入格式、备份恢复、日常发布流程和故障排查请查看 [GUIDE.md](./GUIDE.md)。

## 数据与安全

- 导入过程完全在浏览器中完成，不会自动上传文件。
- HTML 导入会移除脚本、样式和 iframe，再转换为文本化 Markdown。
- Markdown 阅读器先转义 HTML，再处理受支持语法。
- 单个导入文件限制为 2 MB，以避免浏览器本地存储耗尽。
- 文章仍应保存在 GitHub 或其他可靠位置；浏览器本地存储不应作为唯一备份。

## 许可证

当前项目未声明开源许可证，默认保留全部权利。如果以后希望允许其他人复制或修改代码，可以添加 MIT 等开源许可证。
