/* ==========================================================================
 * shrrrrrrrr 的技术博客：浏览器端内容管理脚本
 *
 * 设计原则：
 * 1. 不依赖后端服务，文章默认保存在浏览器 localStorage 中。
 * 2. 支持 Markdown、JSON、TXT、HTML 的批量导入。
 * 3. 支持把完整内容库导出为 Markdown、JSON 或独立 HTML 文件。
 * 4. 不执行导入文件里的脚本；所有正文在显示前都会进行安全转义。
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * 1. 常量与页面元素
 * -------------------------------------------------------------------------- */

// 更改这个键名会创建一套新的本地内容库；旧数据不会自动迁移。
const STORAGE_KEY = "song-haoran-blog-posts-v1";
const THEME_KEY = "song-haoran-blog-theme";

// 导入文件的大小上限。localStorage 容量有限，所以限制单个文件为 2 MB。
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// 统一缓存页面元素，避免在每次渲染时反复查询 DOM。
const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const searchButton = document.querySelector(".search-jump");
const searchInput = document.querySelector("#article-search");
const categoryFilter = document.querySelector("#category-filter");
const articleList = document.querySelector("#article-list");
const articleCount = document.querySelector("#article-count");
const terminalCount = document.querySelector("#terminal-count");
const emptyState = document.querySelector("#empty-state");
const noResults = document.querySelector("#no-results");
const studioSection = document.querySelector("#studio");
const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const importStatus = document.querySelector("#import-status");
const exportButtons = [...document.querySelectorAll("[data-export]")];
const clearLibraryButton = document.querySelector("#clear-library");
const readerDialog = document.querySelector("#reader-dialog");
const readerTitle = document.querySelector("#reader-title");
const readerMeta = document.querySelector("#reader-meta");
const readerContent = document.querySelector("#reader-content");
const closeReaderButton = document.querySelector("#close-reader");
const exportCurrentButton = document.querySelector("#export-current");
const deleteCurrentButton = document.querySelector("#delete-current");
const toast = document.querySelector("#toast");

// 页面运行期间的状态。文章会从 localStorage 恢复，不会写死在 HTML 中。
let localPosts = loadPosts();
let publishedPosts = [];
let posts = [];
let currentPostId = null;
let toastTimer = null;

/* --------------------------------------------------------------------------
 * 2. 主题切换
 * -------------------------------------------------------------------------- */

/**
 * 应用浅色或深色主题，并同步更新按钮的无障碍名称。
 * @param {"light" | "dark"} theme 目标主题
 */
function setTheme(theme) {
  root.dataset.theme = theme;
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "切换浅色主题" : "切换深色主题",
  );
}

// 优先使用用户上次的选择，否则跟随操作系统主题。
const storedTheme = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
setTheme(storedTheme || (prefersDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
});

/* --------------------------------------------------------------------------
 * 3. 本地存储
 * -------------------------------------------------------------------------- */

/**
 * 从浏览器本地存储恢复文章。
 * 数据损坏时返回空数组，避免整个页面无法启动。
 * @returns {Array<object>} 已保存的文章列表
 */
function loadPosts() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);
    const parsedValue = savedValue ? JSON.parse(savedValue) : [];
    return Array.isArray(parsedValue)
      ? parsedValue.map((post) => normalizePost({ ...post, origin: "local" }))
      : [];
  } catch (error) {
    console.warn("无法读取本地文章，已使用空内容库。", error);
    return [];
  }
}

/**
 * 将当前文章列表写入本地存储。
 * @returns {boolean} 是否保存成功
 */
function savePosts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPosts));
    return true;
  } catch (error) {
    console.error("文章保存失败。", error);
    showToast("保存失败：浏览器本地空间可能已满，请先导出备份。", true);
    return false;
  }
}

/**
 * 把来自不同格式的数据整理成统一文章结构。
 * @param {object} rawPost 任意来源的文章对象
 * @returns {object} 标准文章对象
 */
function normalizePost(rawPost = {}) {
  const normalizedTags = Array.isArray(rawPost.tags)
    ? rawPost.tags
    : String(rawPost.tags || "")
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);

  const title = String(rawPost.title || "未命名文章").trim();
  const content = String(rawPost.content || rawPost.body || "").trim();

  return {
    id: String(rawPost.id || createId()),
    title,
    date: normalizeDate(rawPost.date || rawPost.createdAt || new Date()),
    category: String(rawPost.category || rawPost.type || "未分类").trim(),
    tags: [...new Set(normalizedTags)],
    excerpt: String(rawPost.excerpt || createExcerpt(content)).trim(),
    content,
    sourceFormat: String(rawPost.sourceFormat || rawPost.format || "markdown").toLowerCase(),
    sourceName: String(rawPost.sourceName || rawPost.filename || "本地内容").trim(),
    importedAt: String(rawPost.importedAt || new Date().toISOString()),
    // origin 用于区分仓库内公开文章和当前浏览器临时导入的文章。
    origin: rawPost.origin === "published" ? "published" : "local",
  };
}

/**
 * 加载仓库 content/manifest.json 中登记的公开 Markdown。
 * 这个步骤让部署后的所有访客都能看到仓库内的文章。
 * @returns {Promise<Array<object>>} 公开文章数组
 */
async function loadPublishedPosts() {
  try {
    const manifestUrl = new URL("./content/manifest.json", window.location.href);
    const response = await fetch(manifestUrl, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`文章清单返回 ${response.status}`);
    }

    const manifest = await response.json();
    const filePaths = Array.isArray(manifest.posts) ? manifest.posts : [];
    const loadedPosts = [];

    for (const filePath of filePaths) {
      if (typeof filePath !== "string" || !/\.md(?:own)?$/i.test(filePath)) {
        console.warn("已跳过无效的公开文章路径：", filePath);
        continue;
      }

      try {
        const articleUrl = new URL(filePath, manifestUrl);
        const articleResponse = await fetch(articleUrl, { cache: "no-cache" });

        if (!articleResponse.ok) {
          throw new Error(`HTTP ${articleResponse.status}`);
        }

        const markdown = await articleResponse.text();
        loadedPosts.push(parseMarkdown(markdown, filePath, "published"));
      } catch (error) {
        console.warn(`无法加载公开文章 ${filePath}：`, error);
      }
    }

    return loadedPosts;
  } catch (error) {
    // 直接双击 index.html 时浏览器可能禁止 fetch；本地导入功能仍然可用。
    console.info("未加载公开文章清单，本地内容库仍可正常使用。", error);
    return [];
  }
}

/**
 * 合并公开文章与本地文章，并按“ID / 标题 + 日期”去重。
 * 公开版本优先，避免作者发布后在自己的浏览器里看到两份相同内容。
 */
function combinePosts() {
  const seenKeys = new Set();

  posts = [...publishedPosts, ...localPosts]
    .filter((post) => {
      const identityKeys = [post.id, `${post.title}::${post.date}`].filter(Boolean);

      if (identityKeys.some((key) => seenKeys.has(key))) {
        return false;
      }

      identityKeys.forEach((key) => seenKeys.add(key));
      return true;
    })
    .sort((firstPost, secondPost) => secondPost.date.localeCompare(firstPost.date));
}

/**
 * 创建在当前浏览器中足够唯一的文章 ID。
 * @returns {string} UUID 或带时间戳的回退 ID
 */
function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 将各种可识别日期统一为 YYYY-MM-DD。
 * @param {string | Date} value 原始日期
 * @returns {string} 标准日期
 */
function normalizeDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

/* --------------------------------------------------------------------------
 * 4. 文件导入与格式解析
 * -------------------------------------------------------------------------- */

/**
 * 批量读取用户选择或拖入的文件。
 * 每个文件独立处理，一个文件失败不会阻止其他文件导入。
 * @param {FileList | File[]} fileCollection 文件集合
 */
async function importFiles(fileCollection) {
  const files = [...fileCollection];

  if (!files.length) {
    return;
  }

  importStatus.textContent = `正在读取 ${files.length} 个文件…`;
  const importedPosts = [];
  const failedFiles = [];

  for (const file of files) {
    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("文件超过 2 MB");
      }

      const parsedPosts = await parseFile(file);
      importedPosts.push(...parsedPosts);
    } catch (error) {
      failedFiles.push(`${file.name}（${error.message}）`);
    }
  }

  if (importedPosts.length) {
    // 新导入的文章放在最前，并按日期从新到旧排序。
    localPosts = [...importedPosts, ...localPosts].sort(
      (firstPost, secondPost) => secondPost.date.localeCompare(firstPost.date),
    );
    combinePosts();

    if (!savePosts()) {
      // 保存失败时不丢失当前页面内刚导入的内容，用户仍然可以立即导出。
      importStatus.textContent = "导入成功，但本地保存失败，请立即导出备份";
    } else {
      importStatus.textContent = `已导入 ${importedPosts.length} 篇文章`;
    }

    renderAll();
    showToast(`成功导入 ${importedPosts.length} 篇文章。`);
  }

  if (failedFiles.length) {
    const failureSummary = failedFiles.join("；");
    importStatus.textContent = `部分文件未导入：${failureSummary}`;
    showToast(`有 ${failedFiles.length} 个文件导入失败，请查看内容库状态。`, true);
  }

  // 清空 input，允许用户再次选择同一个文件。
  fileInput.value = "";
}

/**
 * 根据扩展名把一个文件解析为一篇或多篇文章。
 * JSON 文件可以包含一个对象、对象数组，或 { posts: [] } 结构。
 * @param {File} file 浏览器文件对象
 * @returns {Promise<Array<object>>} 标准文章数组
 */
async function parseFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const text = await file.text();

  if (["md", "markdown"].includes(extension)) {
    return [parseMarkdown(text, file.name)];
  }

  if (extension === "json") {
    return parseJson(text, file.name);
  }

  if (extension === "txt") {
    return [parseText(text, file.name)];
  }

  if (["html", "htm"].includes(extension)) {
    return [parseHtml(text, file.name)];
  }

  throw new Error("不支持的文件格式");
}

/**
 * 解析 Markdown 文件，包括可选的 YAML 风格 Front Matter。
 * 支持字段：title、date、category、tags、excerpt。
 * @param {string} text 文件正文
 * @param {string} fileName 原文件名
 * @returns {object} 标准文章对象
 */
function parseMarkdown(text, fileName, origin = "local") {
  const { attributes, body } = parseFrontMatter(text);
  const headingMatch = body.match(/^#\s+(.+)$/m);
  const fallbackTitle = removeExtension(fileName);

  return normalizePost({
    id:
      attributes.id ||
      (origin === "published" ? `published-${simpleHash(fileName)}` : undefined),
    title: attributes.title || headingMatch?.[1] || fallbackTitle,
    date: attributes.date,
    category: attributes.category,
    tags: attributes.tags,
    excerpt: attributes.excerpt,
    content: body,
    sourceFormat: "markdown",
    sourceName: fileName,
    origin,
  });
}

/**
 * 为公开文章路径生成稳定的短 ID，保证每次加载得到相同标识。
 * 这不是安全哈希，只用于前端去重和 DOM 定位。
 * @param {string} value 要计算的字符串
 * @returns {string} 36 进制短哈希
 */
function simpleHash(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

/**
 * 读取简化版 YAML Front Matter。
 * 为保持零依赖，这里只处理博客常用的单行键值和标签数组。
 * @param {string} text 完整 Markdown 文本
 * @returns {{attributes: object, body: string}} 元数据与正文
 */
function parseFrontMatter(text) {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const frontMatterMatch = normalizedText.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!frontMatterMatch) {
    return { attributes: {}, body: normalizedText.trim() };
  }

  const attributes = {};

  for (const line of frontMatterMatch[1].split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    let value = line.slice(separatorIndex + 1).trim();

    // 去掉成对引号，让 title: "标题" 和 title: 标题 得到相同结果。
    value = value.replace(/^(["'])(.*)\1$/, "$2");

    if (key === "tags") {
      value = value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(/[,，]/)
        .map((tag) => tag.trim().replace(/^(["'])(.*)\1$/, "$2"))
        .filter(Boolean);
    }

    attributes[key] = value;
  }

  return {
    attributes,
    body: normalizedText.slice(frontMatterMatch[0].length).trim(),
  };
}

/**
 * 解析 JSON 备份或第三方导出的文章数据。
 * @param {string} text JSON 字符串
 * @param {string} fileName 原文件名
 * @returns {Array<object>} 标准文章数组
 */
function parseJson(text, fileName) {
  const parsed = JSON.parse(text);
  const sourcePosts = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.posts)
      ? parsed.posts
      : [parsed];

  if (!sourcePosts.length || sourcePosts.some((post) => !post || typeof post !== "object")) {
    throw new Error("JSON 中没有可识别的文章对象");
  }

  return sourcePosts.map((post) =>
    normalizePost({
      ...post,
      // 备份被重新导入后属于当前浏览器，允许用户删除或清空。
      origin: "local",
      sourceFormat: "json",
      sourceName: post.sourceName || fileName,
    }),
  );
}

/**
 * TXT 文件以第一行作为标题，其余内容作为正文。
 * @param {string} text TXT 内容
 * @param {string} fileName 原文件名
 * @returns {object} 标准文章对象
 */
function parseText(text, fileName) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstContentLine = lines.find((line) => line.trim());

  return normalizePost({
    title: firstContentLine || removeExtension(fileName),
    content: text.trim(),
    sourceFormat: "txt",
    sourceName: fileName,
  });
}

/**
 * HTML 文件提取 title、article/main/body 正文和常见 meta 字段。
 * 导入的 HTML 会转换成纯文本风格 Markdown，脚本不会被执行。
 * @param {string} text HTML 内容
 * @param {string} fileName 原文件名
 * @returns {object} 标准文章对象
 */
function parseHtml(text, fileName) {
  const documentNode = new DOMParser().parseFromString(text, "text/html");

  // 在读取正文前移除脚本、样式等非文章元素。
  documentNode.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());

  const contentNode =
    documentNode.querySelector("article") ||
    documentNode.querySelector("main") ||
    documentNode.body;
  const title =
    documentNode.querySelector("h1")?.textContent?.trim() ||
    documentNode.title?.trim() ||
    removeExtension(fileName);
  const description = documentNode.querySelector('meta[name="description"]')?.content;
  const date =
    documentNode.querySelector('meta[property="article:published_time"]')?.content ||
    documentNode.querySelector("time")?.dateTime;

  return normalizePost({
    title,
    date,
    excerpt: description,
    content: htmlToMarkdown(contentNode),
    sourceFormat: "html",
    sourceName: fileName,
  });
}

/**
 * 把导入 HTML 的常见结构转换为可继续编辑的简化 Markdown。
 * @param {Element} contentNode 包含文章正文的元素
 * @returns {string} Markdown 文本
 */
function htmlToMarkdown(contentNode) {
  const clone = contentNode.cloneNode(true);

  clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    heading.replaceWith(`\n${"#".repeat(level)} ${heading.textContent.trim()}\n`);
  });
  clone.querySelectorAll("li").forEach((item) => item.replaceWith(`\n- ${item.textContent.trim()}`));
  clone.querySelectorAll("blockquote").forEach((quote) =>
    quote.replaceWith(`\n> ${quote.textContent.trim().replace(/\n/g, "\n> ")}\n`),
  );
  clone.querySelectorAll("pre").forEach((pre) => pre.replaceWith(`\n\`\`\`\n${pre.textContent.trim()}\n\`\`\`\n`));
  clone.querySelectorAll("br").forEach((breakElement) => breakElement.replaceWith("\n"));
  clone.querySelectorAll("p, div, section").forEach((block) => block.append("\n\n"));

  return clone.textContent.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 删除文件扩展名，作为缺少文章标题时的回退值。
 * @param {string} fileName 文件名
 * @returns {string} 不含扩展名的文件名
 */
function removeExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

/* --------------------------------------------------------------------------
 * 5. 页面渲染与文章阅读
 * -------------------------------------------------------------------------- */

/** 更新计数、分类选项、列表和按钮状态。 */
function renderAll() {
  articleCount.textContent = posts.length;
  terminalCount.textContent = posts.length;

  renderCategoryOptions();
  renderPosts();

  const hasPosts = posts.length > 0;
  exportButtons.forEach((button) => {
    button.disabled = !hasPosts;
  });
  clearLibraryButton.disabled = localPosts.length === 0;
}

/** 根据文章数据生成分类下拉框，并保留当前选择。 */
function renderCategoryOptions() {
  const previousValue = categoryFilter.value;
  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort();

  categoryFilter.replaceChildren(new Option("全部分类", "all"));

  for (const category of categories) {
    categoryFilter.add(new Option(category, category));
  }

  categoryFilter.value = categories.includes(previousValue) ? previousValue : "all";
}

/**
 * 根据搜索词和分类渲染文章列表。
 * 使用 createElement/textContent，避免把文件内容直接拼接为不安全的 HTML。
 */
function renderPosts() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const filteredPosts = posts.filter((post) => {
    const matchesCategory = selectedCategory === "all" || post.category === selectedCategory;
    const searchableText = [post.title, post.excerpt, post.category, ...post.tags]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || searchableText.includes(query);
    return matchesCategory && matchesQuery;
  });

  articleList.replaceChildren();

  filteredPosts.forEach((post, index) => {
    articleList.append(createPostRow(post, index));
  });

  emptyState.hidden = posts.length > 0;
  noResults.hidden = posts.length === 0 || filteredPosts.length > 0;
}

/**
 * 创建单篇文章对应的 DOM 节点。
 * @param {object} post 文章对象
 * @param {number} index 过滤结果中的序号
 * @returns {HTMLElement} article 元素
 */
function createPostRow(post, index) {
  const row = document.createElement("article");
  row.className = "article-row";

  const number = document.createElement("div");
  number.className = "article-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const main = document.createElement("div");
  main.className = "article-main";

  const meta = document.createElement("div");
  meta.className = "article-meta";
  appendTextElement(meta, "span", post.category);
  const time = appendTextElement(meta, "time", formatDate(post.date));
  time.dateTime = post.date;
  appendTextElement(meta, "span", post.sourceFormat.toUpperCase(), "source-badge");

  const heading = document.createElement("h3");
  const titleButton = document.createElement("button");
  titleButton.type = "button";
  titleButton.textContent = post.title;
  titleButton.addEventListener("click", () => openReader(post.id));
  heading.append(titleButton);

  const excerpt = document.createElement("p");
  excerpt.className = "article-excerpt";
  excerpt.textContent = post.excerpt || "这篇文章没有摘要。";

  const tags = document.createElement("div");
  tags.className = "tags";
  post.tags.forEach((tag) => appendTextElement(tags, "span", `# ${tag}`));

  main.append(meta, heading, excerpt, tags);

  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.className = "read-button";
  readButton.textContent = "↗";
  readButton.setAttribute("aria-label", `阅读《${post.title}》`);
  readButton.addEventListener("click", () => openReader(post.id));

  row.append(number, main, readButton);
  return row;
}

/**
 * 创建纯文本子元素并追加到父元素。
 * @param {HTMLElement} parent 父元素
 * @param {string} tagName 标签名
 * @param {string} text 文本
 * @param {string} className 可选类名
 * @returns {HTMLElement} 新元素
 */
function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  element.textContent = text;
  element.className = className;
  parent.append(element);
  return element;
}

/** 打开阅读弹窗，并把安全转换后的 Markdown 放入正文。 */
function openReader(postId) {
  const post = posts.find((candidate) => candidate.id === postId);

  if (!post) {
    return;
  }

  currentPostId = post.id;
  readerTitle.textContent = post.title;
  readerMeta.textContent = `${formatDate(post.date)} · ${post.category} · ${post.sourceName}`;
  readerContent.innerHTML = renderMarkdown(post.content);
  deleteCurrentButton.hidden = post.origin === "published";
  readerDialog.showModal();
}

/** 关闭弹窗并清除当前文章引用。 */
function closeReader() {
  readerDialog.close();
  currentPostId = null;
}

/**
 * 一个零依赖、安全优先的 Markdown 渲染器。
 * 它覆盖标题、列表、引用、链接、粗体、斜体、行内代码和代码块等常用语法。
 * @param {string} markdown Markdown 正文
 * @returns {string} 可放入页面的安全 HTML
 */
function renderMarkdown(markdown) {
  const codeBlocks = [];
  let source = String(markdown || "").replace(/\r\n?/g, "\n");

  // 先取出代码块，再转义所有 HTML，避免代码内容被后续规则误处理。
  source = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(
      `<pre><code data-language="${escapeHtml(language.trim())}">${escapeHtml(code.trim())}</code></pre>`,
    );
    return token;
  });

  source = escapeHtml(source);

  // 按行处理块级语法；列表通过状态变量自动打开和关闭。
  const lines = source.split("\n");
  const output = [];
  let paragraphLines = [];
  let activeList = null;

  const flushParagraph = () => {
    if (paragraphLines.length) {
      output.push(`<p>${applyInlineMarkdown(paragraphLines.join(" "))}</p>`);
      paragraphLines = [];
    }
  };

  const closeList = () => {
    if (activeList) {
      output.push(`</${activeList}>`);
      activeList = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const unorderedItem = trimmed.match(/^[-*+]\s+(.+)$/);
    const orderedItem = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const quoteMatch = trimmed.match(/^&gt;\s?(.*)$/);

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^@@CODE_BLOCK_\d+@@$/.test(trimmed)) {
      flushParagraph();
      closeList();
      output.push(trimmed);
      continue;
    }

    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      output.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
      continue;
    }

    if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextList = unorderedItem ? "ul" : "ol";

      if (activeList !== nextList) {
        closeList();
        output.push(`<${nextList}>`);
        activeList = nextList;
      }

      output.push(`<li>${applyInlineMarkdown((unorderedItem || orderedItem)[1])}</li>`);
      continue;
    }

    if (quoteMatch) {
      flushParagraph();
      closeList();
      output.push(`<blockquote><p>${applyInlineMarkdown(quoteMatch[1])}</p></blockquote>`);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  closeList();

  let html = output.join("\n");
  codeBlocks.forEach((block, index) => {
    html = html.replace(`@@CODE_BLOCK_${index}@@`, block);
  });

  return html;
}

/**
 * 应用 Markdown 行内语法。链接只允许常见安全协议或相对地址。
 * @param {string} text 已完成 HTML 转义的文本
 * @returns {string} 带行内标签的 HTML
 */
function applyInlineMarkdown(text) {
  const inlineCodes = [];
  let result = text.replace(/`([^`]+)`/g, (_, code) => {
    // 占位符刻意不含 * 或 _，避免被斜体语法再次解析。
    const token = `@@INLINECODE${inlineCodes.length}TOKEN@@`;
    inlineCodes.push(`<code>${code}</code>`);
    return token;
  });

  result = result
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      const decodedUrl = url.replace(/&amp;/g, "&").trim();
      const safeUrl = /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i.test(decodedUrl)
        ? url
        : "#";
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

  inlineCodes.forEach((code, index) => {
    result = result.replace(`@@INLINECODE${index}TOKEN@@`, code);
  });

  return result;
}

/** 把特殊字符转换为 HTML 实体，阻止导入内容注入页面。 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** 从正文生成简短摘要，用于文章列表。 */
function createExcerpt(content) {
  const plainText = String(content || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plainText.length > 110 ? `${plainText.slice(0, 110)}…` : plainText;
}

/** 把 YYYY-MM-DD 转换成更适合中文页面阅读的格式。 */
function formatDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${year}.${month}.${day}`;
}

/* --------------------------------------------------------------------------
 * 6. 内容导出
 * -------------------------------------------------------------------------- */

/** 根据用户点击的格式，生成并下载完整内容库。 */
function exportLibrary(format) {
  if (!posts.length) {
    return;
  }

  const fileDate = new Date().toISOString().slice(0, 10);

  if (format === "markdown") {
    const markdown = posts.map(postToMarkdown).join("\n\n---\n\n");
    downloadText(`song-haoran-blog-${fileDate}.md`, markdown, "text/markdown;charset=utf-8");
  }

  if (format === "json") {
    const backup = {
      version: 1,
      owner: "shrrrrrrrr",
      exportedAt: new Date().toISOString(),
      posts,
    };
    downloadText(
      `song-haoran-blog-${fileDate}.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8",
    );
  }

  if (format === "html") {
    downloadText(
      `song-haoran-blog-${fileDate}.html`,
      createStandaloneHtml(posts),
      "text/html;charset=utf-8",
    );
  }

  showToast(`内容库已导出为 ${format.toUpperCase()}。`);
}

/**
 * 把标准文章对象还原为带 Front Matter 的 Markdown。
 * @param {object} post 文章对象
 * @returns {string} Markdown 文件内容
 */
function postToMarkdown(post) {
  const safeTitle = post.title.replace(/"/g, '\\"');
  const safeCategory = post.category.replace(/"/g, '\\"');
  const safeExcerpt = post.excerpt.replace(/"/g, '\\"');
  const tags = post.tags.map((tag) => `"${tag.replace(/"/g, '\\"')}"`).join(", ");

  return [
    "---",
    `title: "${safeTitle}"`,
    `date: ${post.date}`,
    `category: "${safeCategory}"`,
    `tags: [${tags}]`,
    `excerpt: "${safeExcerpt}"`,
    "---",
    "",
    post.content,
  ].join("\n");
}

/**
 * 生成一个不依赖原网站、可单独打开的 HTML 文章合集。
 * @param {Array<object>} libraryPosts 文章数组
 * @returns {string} 完整 HTML 文档
 */
function createStandaloneHtml(libraryPosts) {
  const articles = libraryPosts
    .map(
      (post) => `
        <article>
          <p class="meta">${escapeHtml(formatDate(post.date))} · ${escapeHtml(post.category)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <div class="tags">${post.tags.map((tag) => `<span># ${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="content">${renderMarkdown(post.content)}</div>
        </article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>shrrrrrrrr 的技术博客文章</title>
  <style>
    body{max-width:800px;margin:0 auto;padding:40px 22px;color:#1b1b18;background:#f4f2eb;font:17px/1.9 Georgia,"Noto Serif SC",serif}
    article{padding:40px 0 70px;border-bottom:1px solid #bbb8ae}h1{font-size:2.5em;line-height:1.2}.meta,.tags{color:#777;font:12px monospace}.tags{display:flex;gap:12px;margin:12px 0 35px;flex-wrap:wrap}
    pre{padding:18px;overflow:auto;color:#eee;background:#20211e}code{font-family:Consolas,monospace}blockquote{padding-left:18px;border-left:4px solid #bdd62f;color:#666}a{color:inherit;text-decoration-color:#bdd62f;text-decoration-thickness:3px}
  </style>
</head>
<body>
  <header><p>shrrrrrrrr · 北京航空航天大学软件工程学院</p></header>
  <main>${articles}</main>
</body>
</html>`;
}

/** 下载当前正在阅读的单篇 Markdown。 */
function exportCurrentPost() {
  const post = posts.find((candidate) => candidate.id === currentPostId);

  if (!post) {
    return;
  }

  downloadText(`${safeFileName(post.title)}.md`, postToMarkdown(post), "text/markdown;charset=utf-8");
  showToast("本篇文章已导出为 Markdown。 ");
}

/**
 * 使用 Blob 和临时链接触发浏览器下载。
 * @param {string} fileName 下载文件名
 * @param {string} content 文件内容
 * @param {string} mimeType MIME 类型
 */
function downloadText(fileName, content, mimeType) {
  const blob = new Blob(["\uFEFF", content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();

  // 某些浏览器需要在事件循环结束后才真正开始读取 Blob。
  // 延迟释放地址可以避免下载偶发得到空文件或被直接取消。
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** 移除 Windows 和常见系统不允许出现在文件名中的字符。 */
function safeFileName(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").slice(0, 80) || "article";
}

/* --------------------------------------------------------------------------
 * 7. 删除操作与提示
 * -------------------------------------------------------------------------- */

/** 删除当前正在阅读的文章。删除前必须由用户确认。 */
function deleteCurrentPost() {
  const post = posts.find((candidate) => candidate.id === currentPostId);

  if (!post || !window.confirm(`确定从当前浏览器删除《${post.title}》吗？删除后不可撤销。`)) {
    return;
  }

  if (post.origin === "published") {
    showToast("公开文章需要从 content/manifest.json 中移除后再提交。", true);
    return;
  }

  localPosts = localPosts.filter((candidate) => candidate.id !== post.id);
  combinePosts();
  savePosts();
  closeReader();
  renderAll();
  showToast("文章已从本地内容库删除。 ");
}

/** 清空所有文章。建议用户先导出 JSON 备份。 */
function clearLibrary() {
  if (!localPosts.length) {
    return;
  }

  const confirmed = window.confirm(
    `确定清空当前浏览器中的 ${localPosts.length} 篇本地文章吗？建议先导出 JSON 备份。`,
  );

  if (!confirmed) {
    return;
  }

  localPosts = [];
  combinePosts();
  savePosts();
  searchInput.value = "";
  categoryFilter.value = "all";
  importStatus.textContent = "内容库已清空";
  renderAll();
  showToast("本地内容库已清空。 ");
}

/**
 * 显示短暂的状态消息。
 * @param {string} message 消息内容
 * @param {boolean} isError 是否为错误消息
 */
function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

/* --------------------------------------------------------------------------
 * 8. 事件绑定
 * -------------------------------------------------------------------------- */

function syncStudioVisibility() {
  const isStudioHash = window.location.hash === "#studio";
  studioSection.hidden = !isStudioHash;
}

syncStudioVisibility();
window.addEventListener("hashchange", syncStudioVisibility);

// 文件选择与拖放导入。
fileInput.addEventListener("change", () => importFiles(fileInput.files));

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", (event) => importFiles(event.dataTransfer.files));

// 让聚焦在拖放框上的键盘用户可以按 Enter 或空格打开文件选择器。
dropZone.addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    fileInput.click();
  }
});

// 搜索与分类筛选。
searchInput.addEventListener("input", renderPosts);
categoryFilter.addEventListener("change", renderPosts);

function focusSearch() {
  document.querySelector("#articles").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => searchInput.focus(), 350);
}

searchButton.addEventListener("click", focusSearch);

document.addEventListener("keydown", (event) => {
  const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

  if (event.key === "/" && !isTyping && !readerDialog.open) {
    event.preventDefault();
    focusSearch();
  }

  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    searchInput.blur();
    renderPosts();
  }
});

// 导出与删除。
exportButtons.forEach((button) => {
  button.addEventListener("click", () => exportLibrary(button.dataset.export));
});
clearLibraryButton.addEventListener("click", clearLibrary);
closeReaderButton.addEventListener("click", closeReader);
exportCurrentButton.addEventListener("click", exportCurrentPost);
deleteCurrentButton.addEventListener("click", deleteCurrentPost);

// 点击弹窗边缘的灰色遮罩时关闭文章；点击正文不会触发关闭。
readerDialog.addEventListener("click", (event) => {
  if (event.target === readerDialog) {
    closeReader();
  }
});

// 用户按 Esc 关闭原生弹窗时，也要同步清除当前文章状态。
readerDialog.addEventListener("close", () => {
  currentPostId = null;
});

/**
 * 页面启动入口：先读取公开 Markdown，再与本地导入合并。
 * 即使公开清单加载失败，也会继续渲染本地内容。
 */
async function initializeBlog() {
  publishedPosts = await loadPublishedPosts();
  combinePosts();
  renderAll();
}

initializeBlog();
