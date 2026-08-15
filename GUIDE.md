# 技术博客使用指南

这份指南面向网站作者 shrrrrrrrr，说明如何预览网站、导入和导出内容、写第一篇 Markdown、正式发布文章，以及连接 GitHub、Cloudflare Pages 和 Vercel。

## 先理解两种文章状态

网站同时提供“作者工作台”和“公开文章”两种机制。

作者工作台适合试读和整理。你在网页上拖入 Markdown、JSON、TXT 或 HTML 后，文章保存在当前浏览器中。刷新或关闭页面不会立即丢失，但换电脑、换浏览器、使用无痕模式或清除浏览器数据时，这些文章不会自动同步。

工作台默认不展示给读者。需要使用时，在网站地址后加 `#studio`，例如 `https://你的网址/#studio`。

公开文章保存在项目的 `content/posts` 文件夹中，并登记在 `content/manifest.json`。这些文件提交到 GitHub 并重新部署后，所有网站访客都能看见。

因此，推荐流程是：

> 在编辑器中写 Markdown → 用网页导入试读 → 修改满意后放入 `content/posts` → 登记清单 → 提交 GitHub → 自动部署。

## 打开和预览网站

可以双击 `index.html` 快速查看页面。不过浏览器可能阻止本地文件读取文章清单，所以开发时最好使用本地服务器。

如果已经安装 Node.js，在项目目录打开终端并运行：

```powershell
npx serve .
```

然后打开终端显示的网址。完成代码修改后刷新浏览器即可。

正式检查部署产物时运行：

```powershell
npm run check
npm run build
npx serve dist
```

这会预览与部署平台完全相同的 `dist` 内容。

## 使用页面

### 切换主题

点击右上角的圆形开关，可以切换浅色和深色主题。选择会自动保存在浏览器中。

### 搜索文章

点击右上角放大镜，或直接按 `/`，页面会跳到文章区并聚焦搜索框。搜索范围包括标题、摘要、分类和标签。按 `Esc` 可以清空搜索并退出输入框。

### 按分类筛选

文章区右侧的分类下拉框来自已加载文章。选择分类后，只会显示对应文章。

### 阅读文章

点击文章标题或右侧箭头，会打开阅读弹窗。弹窗底部可以导出当前文章的 Markdown。本地导入文章还可以在这里删除；仓库内的公开文章不会显示删除按钮，因为它们应通过 Git 修改。

## 导入文章

访问 `#studio` 打开作者工作台后，点击虚线框选择文件，或者把多个文件直接拖入虚线框。

单个文件不能超过 2 MB。一次可以导入多个文件，某个文件失败不会阻止其他文件。这里的导入不是公开上传；它只保存在当前浏览器里，主要用于试读、整理和导出。

### Markdown

支持 `.md` 和 `.markdown`。这是最推荐的格式。

网站会读取文件顶部的 Front Matter：

```markdown
---
title: "文章标题"
date: 2026-08-13
category: "学习记录"
tags: ["软件工程", "Git"]
excerpt: "文章列表中显示的简短摘要。"
---

# 文章标题

正文从这里开始。
```

支持的字段如下：

| 字段 | 用途 | 缺失时的处理 |
|---|---|---|
| `title` | 文章标题 | 使用第一个一级标题，再没有则使用文件名 |
| `date` | 发布日期 | 使用导入当天 |
| `category` | 分类 | 使用“未分类” |
| `tags` | 标签数组 | 使用空数组 |
| `excerpt` | 列表摘要 | 从正文自动截取 |
| `id` | 可选稳定标识 | 本地导入时自动生成 |

Markdown 阅读器支持：

- 一到六级标题；
- 粗体和斜体；
- 有序、无序列表；
- 引用；
- 行内代码和围栏代码块；
- 链接；
- 分隔线。

为了保持项目轻量、安全和零依赖，当前没有实现表格、脚注、数学公式和 Mermaid。如果以后需要，可以接入经过安全配置的 Markdown 渲染库。

### JSON

JSON 适合完整备份与恢复。可以导入以下三种结构：单篇文章对象、文章对象数组，或者包含 `posts` 数组的备份对象。

推荐结构：

```json
{
  "posts": [
    {
      "title": "文章标题",
      "date": "2026-08-13",
      "category": "学习记录",
      "tags": ["软件工程"],
      "excerpt": "摘要",
      "content": "# 正文标题\n\n正文内容。"
    }
  ]
}
```

### TXT

网站把第一行非空文字作为标题，把整个文件作为正文。TXT 没有元数据，因此适合临时笔记，不适合作为长期的正式文章格式。

### HTML

网站会尝试读取 `<h1>`、`<title>`、描述和发布日期，再把正文转换成简化 Markdown。

为了安全，导入时会删除 `script`、`style`、`iframe`、`object` 和 `embed`。复杂排版可能无法完整保留，导入后应检查正文。

## 导出和备份

内容库提供三种完整导出格式：

- `.MD`：把所有文章组合成一个带 Front Matter 的 Markdown 文件，方便阅读或迁移。
- `.JSON`：保留最完整的数据结构，最适合以后重新导入本网站。
- `.HTML`：生成一个带基础样式的独立文章合集，双击就可以阅读。

建议每次集中修改文章后导出一份 JSON。备份文件可以放在私人云盘，不建议把包含未发布草稿的备份提交到公开仓库。

## 正式发布 Markdown

### 第一步：创建文件

复制 `templates/article-template.md` 到 `content/posts`。建议使用小写英文、数字和连字符命名，例如：

```text
content/posts/my-first-post.md
```

英文文件名可以减少跨平台路径和网址编码问题，文章标题仍然可以使用中文。

### 第二步：填写元数据和正文

修改 Front Matter。日期使用 `YYYY-MM-DD`，例如 `2026-08-13`。标签建议控制在二到五个，分类保持稳定，例如“课程学习”“项目实践”“读书笔记”。

### 第三步：登记文章

打开 `content/manifest.json`，把相对于 `content` 文件夹的路径加入 `posts`：

```json
{
  "posts": [
    "./posts/my-first-post.md",
    "./posts/another-post.md"
  ]
}
```

JSON 最后一项后面不能有逗号。

### 第四步：检查

运行：

```powershell
npm run check
```

如果清单路径拼错、文件不在 `content/posts` 或 JSON 格式错误，命令会提示问题。

### 第五步：提交 GitHub

```powershell
git add content
git commit -m "Publish my first post"
git push
```

GitHub Pages、Cloudflare Pages 或 Vercel 连接仓库后，会自动重新部署。

## 修改或撤下文章

修改文章时，直接编辑 `content/posts` 中的 Markdown，然后提交推送。

暂时撤下文章时，从 `content/manifest.json` 删除对应路径并提交。Markdown 文件可以继续留在仓库中，也可以移动到本地私人草稿目录。不要把未准备公开的隐私内容提交到 Public 仓库，因为 Git 历史仍可能保留旧版本。

## 更新首页作品区

首页的作品区写在 `index.html` 的 `projects` 区块中。每个作品是一张 `project-card`，可以修改作品名、说明、标签、截图和链接。

作品截图建议放在 `assets` 文件夹，例如：

```text
assets/my-project.png
```

然后在作品卡片里引用：

```html
<img src="./assets/my-project.png" alt="" />
```

如果项目还没有公开链接，可以先不写链接；等 GitHub 仓库或在线预览地址准备好后，再补上。

## 第一次上传 GitHub

### 在 GitHub 创建仓库

1. 登录 GitHub。
2. 点击右上角 `+`，选择 **New repository**。
3. Repository name 填写 `blog`。
4. 如果使用 GitHub 免费版 Pages，选择 **Public** 最省事。
5. 不勾选自动创建 README、`.gitignore` 或 License，因为本地已经有这些文件。
6. 点击 **Create repository**。

### 在本地连接仓库

在项目目录运行：

```powershell
git init -b main
git add .
git commit -m "Initial personal tech blog"
git remote add origin https://github.com/shrrrrrrrr/blog.git
git push -u origin main
```

首次推送可能要求浏览器登录 GitHub。如果使用 SSH，需要先在 GitHub 配置 SSH Key，再把远程地址换成 `git@github.com:shrrrrrrrr/blog.git`。

### 开启 GitHub Pages

1. 打开仓库 **Settings**。
2. 左侧选择 **Pages**。
3. Source 选择 **GitHub Actions**。
4. 返回仓库 **Actions**，等待带绿色勾的部署完成。
5. 地址会显示在部署详情和 Settings → Pages 中。

项目里的 `.github/workflows/deploy-pages.yml` 已经完成构建和部署配置，无需在 GitHub 网页再创建工作流。

## 连接 Cloudflare

Cloudflare 的 Git 集成会监听同一个 GitHub 仓库。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 打开 **Workers & Pages**，选择创建应用并连接 Git。
3. 第一次使用时，Cloudflare 会请求安装 GitHub App。只授权这个仓库即可，不必授权全部仓库。
4. 选择 `blog` 仓库。
5. Project name 填写 `blog`，生产分支选择 `main`。
6. Build command 填写 `npm run build`。
7. Deploy command 填写 `npx wrangler deploy`。
8. Root directory 填写 `/`。
9. API token 的变量名使用 `CLOUDFLARE_API_TOKEN`。
10. 保存并部署。

仓库里的 `wrangler.toml` 已记录项目名、兼容日期和静态资源目录。如果你在 Cloudflare 创建了不同名称的项目，需要把其中的 `name` 改成相同名称后再提交。

部署成功后，正式地址类似：

```text
https://blog.shrrrrrrrr.workers.dev
```

## 连接 Vercel

1. 登录 [Vercel](https://vercel.com/)。
2. 点击 **Add New → Project**，连接 GitHub。
3. 选择 `blog` 仓库并点击 Import。
4. Framework Preset 选择 `Other`。
5. Root Directory 保持 `./`。
6. `vercel.json` 已配置 Build Command 和 Output Directory，确认显示为 `npm run build` 与 `dist`。
7. 点击 Deploy。

部署成功后，正式地址类似：

```text
https://blog-shrrrrrrrr.vercel.app
```

## 三个平台如何取舍

这个项目可以同时部署到三个平台，但建议只选一个地址对外宣传。

GitHub Pages 最适合作为第一站，因为不需要额外账号体系，代码和部署在同一个地方。Cloudflare Pages 更适合以后绑定独立域名并获得分支预览。Vercel 操作直观，适合未来把网站升级为 React、Next.js 等应用。

如果同时部署，文章内容和代码仍然只维护一份：提交 GitHub 后，三个平台各自自动拉取同一次更新。

## 自定义网站

### 修改个人信息

公开展示信息写在 `index.html` 中。搜索“shrrrrrrrr”“北京航空航天大学”或“软件工程学院”即可找到。修改后检查 `<title>`、`description`、首页、终端名片、关于区域和页脚是否保持一致。

### 修改颜色

打开 `styles.css`，在顶部 `:root` 中修改变量：

- `--paper`：页面底色；
- `--ink`：正文和边框；
- `--muted`：辅助文字；
- `--acid`：荧光强调色；
- `--terminal`：深色内容库背景。

### 修改导入大小限制

打开 `script.js`，修改：

```javascript
const MAX_FILE_SIZE = 2 * 1024 * 1024;
```

不建议设置得很大，因为 `localStorage` 的总容量通常只有几 MB。

## 常见问题

### 网页显示“这里还没有文章”，但已经放入 Markdown

检查是否把路径加入 `content/manifest.json`，然后运行 `npm run check`。直接双击打开时也可能因浏览器安全限制无法读取清单，请用本地服务器预览。

### 本地导入的文章在手机上看不到

这是正常现象。本地导入只保存在当前浏览器。要跨设备访问，请把文章放入 `content/posts`，提交并部署。

### 导入后刷新文章消失

可能使用了无痕模式、浏览器禁止网站存储，或本地空间已满。请使用普通窗口，并导出 JSON 备份。

### HTML 导入后排版变化

HTML 会被安全转换为简化 Markdown。复杂表格、嵌入组件和样式不会保留。建议手动整理并保存为 Markdown。

### Cloudflare 或 Vercel 构建失败

先在本地运行：

```powershell
npm run check
npm run build
```

如果本地成功，再检查平台是否使用 `main` 分支、根目录是否为空、构建命令是否为 `npm run build`、输出目录是否为 `dist`。

### GitHub Pages 打开后没有样式

确认部署源选择的是 GitHub Actions，并查看 Actions 中的工作流是否完成。项目使用相对路径，能够适应 `用户名.github.io/仓库名/` 子目录，不需要手动添加仓库名前缀。

### 想换自定义域名

先购买域名，再到所选平台添加域名并按提示设置 DNS。建议只在一个平台绑定主域名，其他平台保留为备用预览地址。

## 推荐的日常维护习惯

1. 每篇文章单独保存为一个 Markdown 文件。
2. 正式文章全部进入 Git，不把浏览器本地存储当作唯一副本。
3. 发布前运行 `npm run check`。
4. 用清晰的提交信息，例如 `Publish notes on Git branching`。
5. 重要改动通过新分支和 Pull Request 预览。
6. 定期导出 JSON，并在私人位置备份未发布草稿。

当文章数量明显增长、需要在线编辑、多作者或评论系统时，再考虑引入静态站点生成器或内容管理系统。在此之前，这套零依赖结构更容易理解、维护和迁移。
