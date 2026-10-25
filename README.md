# Arietids Blog

独立静态博客，使用 Astro、Markdown/MDX。正式地址是 **https://blog.arietids.net/**，仓库为 `Arietids_Blog`。个人主页在独立仓库 `Arietids_Net`，博客只通过外链连接 `https://arietids.net/`，各自构建、部署和回滚。

博客延续个人主页的字体、色彩、亮暗主题、星空背景和动效语言。当前只有技术、学习、研究三个栏目；尚无正式文章。

## 本地运行

需要 Node.js 22.23.4 或更新版本。

```sh
npm ci
npm run dev
```

默认本地预览可以查看 `.drafts/` 中的待发布文章，带预览提示且禁止索引。`npm run dev:public` 仅显示已经公开并到达发布日期的文章。`SITE_URL` 仅供本地测试或独立预览覆盖站点 URL；正式构建默认使用 `https://blog.arietids.net`。

公开构建与校验：

```sh
npm run check
npm test
npm run build
node scripts/check-blog-urls.mjs
npm run preview:public
```

`dist/` 为公开部署产物，`out/` 为本地预览产物。独立 Vercel 项目通过原生 Git 集成关联 `ArietidsZ/Arietids_Blog`；使用 `npm run build`、输出目录 `dist`、域名 `blog.arietids.net`；无需主站路径重写。GitHub CI 只运行检查与测试。Vercel 在分支推送时构建预览，`main` 推送时构建生产版本；GitHub 的 `check` 检查通过后才把生产域名切到新版本。两站互不触发部署。

## 写作与发布

```sh
npm run post -- new my-first-post --category tech --lang zh
```

该命令创建 `.drafts/my-first-post.zh.md`，正文留空。栏目可用 `tech`、`study`、`research`，语言可用 `zh`、`en`。补全描述、日期和正文，再在本地检查；不以示例文章充数。

```sh
npm run post -- publish my-first-post --lang zh
npm run build
```

`publish` 会把完整稿件移入 `src/content/notes/`、设为公开并移除内部审阅字段；它不会自动提交 Git 或部署。发布前仍需检查改动与生成页面，随后提交到博客仓库并由博客项目构建上线。

同一篇文章的中英文使用相同 slug：`my-first-post.zh.md` 和 `my-first-post.en.md`（也可用 `.mdx`）。只有实际存在的语言版本才生成译文链接；缺少译文时语言切换返回对应语言的博客首页。

文章 slug 只用小写英文字母、数字和连字符；保留名为 `blog`、`category`、`en`、`index`、`notes`、`rss`。

## 路径与订阅

| 页面 | 中文 | 英文 |
| --- | --- | --- |
| 首页 | `/` | `/en/` |
| 技术 | `/category/tech/` | `/en/category/tech/` |
| 学习 | `/category/study/` | `/en/category/study/` |
| 研究 | `/category/research/` | `/en/category/research/` |
| 文章 | `/<slug>/` | `/en/<slug>/` |
| 全站订阅 | `/rss.xml` | `/en/rss.xml` |

每个栏目也有 `rss.xml`；站点地图为 `/sitemap.xml`。Canonical、Open Graph、RSS 和站点地图均指向博客自己的域名。

## 内容与素材边界

- `.drafts/` 被 Git 与 Vercel 忽略。私有研究、待确认资料、未发表稿件和相关附件留在这里或仓库外。
- `src/content/notes/` 只接受完整且 `visibility: public` 的文章。公开仓库中的源文件本身就是公开内容，未来日期不能隐藏 GitHub 中的源码。
- 公开构建按上海时区的发布日期筛选内容；未来文章需要在到期后重新构建，不会仅靠时间自动出现。
- 文章素材放在 `public/blog-media/<slug>/`，正文使用 `/blog-media/<slug>/...`。只有已经公开且到期文章的对应目录会被允许发布；整个目录都视为明确公开的素材包，请先移除无关文件。
- 未经批准的图片、被改名复制的草稿附件、草稿文字/路由及预览控件会使公开构建失败。不要通过 MDX 图片 import 绕开明确的素材目录；未知的哈希图片会被拦截。
- 发布检查是额外保护，不能替代对正文和素材的人工确认。

新增中文后若构建提示缺字，运行 `npm run fonts` 更新字体子集，再构建。字体程序会读取公开构建实际需要的字符；不要将完整字体和私有草稿一起加入仓库。

## 视觉与排版

博客与主站共用 `src/styles/tokens.css`、`src/styles/base.css`、主题与暂停开关、图标、星空脚本和面板光泽脚本，两边文件内容保持一致：细线在高分屏为一个物理像素，三级投影，页眉与菜单为半透明材质，支持 `corner-shape` 的浏览器使用连续曲率圆角，动效使用阻尼弹簧曲线。

- 首页与栏目页：栏目切换是分段控件，切换栏目时选中块在跨页过渡中滑到新位置；文章按年份分组。
- 标题断行（`src/lib/typeset.ts`）：中文标题只在词组之间换行，由构建时的 ICU 分词给出断行点；"的""了"等助词跟随前词，数字与量词、书名号内的名称、连字符复合词不拆开。只加入不可见的断行提示，复制时会去掉。
- 正文（`integrations/article.mjs`）：代码块带语言标签和复制按钮（无脚本时不显示按钮）；中文强调用着重号；中文文章的脚注标签为中文；表格只保留行间细线，按 Markdown 的对齐方式对齐数字。
- 文章页：宽屏时目录固定在右侧，标记随阅读位置滑动；窄屏时目录在正文前。从列表打开文章时，标题过渡为文章大标题，返回时还原（`src/scripts/transitions.ts`）。

## 验证

```sh
npx playwright install chromium
npm run test:e2e
npm run test:public
npm run test:blog:flow
```

浏览器测试覆盖桌面和手机、无 JavaScript 导航、空栏目、亮暗主题、动效开关、可访问性与资源开销。独立写作流程测试在临时目录生成文章，验证预览、双语、公式、代码、表格、发布、RSS 和私密/未来内容隔离；测试结束删除临时稿件，不向真实内容目录添加文章。设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 可使用本机 Chrome。
