/**
 * 检查公开文章清单中登记的 Markdown 文件是否真实存在且格式正确。
 * 在部署前运行这个脚本，可以提前发现路径拼写或 JSON 语法错误。
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(projectRoot, "content", "manifest.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);

if (!Array.isArray(manifest.posts)) {
  throw new Error("content/manifest.json 必须包含 posts 数组。 ");
}

for (const relativePath of manifest.posts) {
  if (typeof relativePath !== "string" || !/\.md(?:own)?$/i.test(relativePath)) {
    throw new Error(`无效的文章路径：${String(relativePath)}`);
  }

  // 清单中的路径以 content/manifest.json 所在目录为基准。
  const absolutePath = path.resolve(projectRoot, "content", relativePath);
  const allowedDirectory = path.resolve(projectRoot, "content", "posts");

  if (!absolutePath.startsWith(`${allowedDirectory}${path.sep}`)) {
    throw new Error(`文章必须放在 content/posts 中：${relativePath}`);
  }

  await access(absolutePath);
}

console.log(`内容检查通过：${manifest.posts.length} 篇公开文章。`);
