/**
 * 为 GitHub Pages、Cloudflare Pages 和 Vercel 创建干净的部署目录。
 *
 * 项目本身不需要编译；构建步骤只把真正用于网站的文件复制到 dist，
 * 避免 README、开发脚本和 Git 配置被当成网站资源发布。
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 由当前脚本的位置反推出仓库根目录，因此可以从任何工作目录执行。
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectRoot, "dist");

// 这些是网站运行所需的根级静态文件。
const rootAssets = ["index.html", "styles.css", "script.js"];

// 每次构建都重新创建 dist，避免已经删除的旧文件残留在部署产物中。
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const asset of rootAssets) {
  await cp(path.join(projectRoot, asset), path.join(outputDirectory, asset));
}

// content 包含公开文章清单和 Markdown 文件，必须随网站一起部署。
await cp(path.join(projectRoot, "content"), path.join(outputDirectory, "content"), {
  recursive: true,
});

// assets 保存站点头像等公开静态资源，需要随页面一起发布。
await cp(path.join(projectRoot, "assets"), path.join(outputDirectory, "assets"), {
  recursive: true,
});

// GitHub Pages 看到 .nojekyll 后会直接提供静态文件，不再尝试 Jekyll 构建。
await writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8");

// 构建时做一次最低限度的入口检查，尽早发现文件复制错误。
const deployedHtml = await readFile(path.join(outputDirectory, "index.html"), "utf8");

if (!deployedHtml.includes("./script.js") || !deployedHtml.includes("./styles.css")) {
  throw new Error("index.html 缺少预期的脚本或样式引用，构建已停止。 ");
}

console.log(`静态网站已构建到：${outputDirectory}`);
