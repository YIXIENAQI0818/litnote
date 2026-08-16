# LitNote

本地文献阅读与笔记管理工具。上传文献（或按 DOI / arXiv 号一键抓取），按分栏写结构化笔记，用文件夹 + 关键词分类，随时检索回顾。

> A local, self-hosted literature reader & note organizer — upload papers, take structured notes, and organize them with folders & tags.

## 功能特性

- **文献管理**：上传 PDF、录入元数据；输入 DOI 或 arXiv 号一键自动补全元数据（CrossRef / arXiv API）
- **arXiv PDF 自动下载**：保存带 arXiv 号的文献时自动抓取 PDF
- **结构化笔记**：分栏编辑（默认 创新点 / 借鉴内容 / 主要内容 / 结论，可自定义增删排序），Markdown 编辑 / 预览，自动保存
- **分类**：文件夹（树状层级）+ 关键词（标签，多对多）
- **检索**：按标题 / 作者 / 摘要 / 关键词搜索，按文件夹 / 关键词 / 年份筛选，多种排序
- **PDF 阅读**：新标签页打开，浏览器内嵌阅读

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.12 · FastAPI · SQLAlchemy · SQLite |
| 前端 | React 18 · Vite · React Router · react-markdown |

## 环境要求

- **Python 3.12+**
- **Node.js 18+**（含 npm）

## 安装与运行

### 1. 克隆仓库

```bash
git clone https://github.com/YIXIENAQI0818/litnote.git
cd litnote
```

> 使用 SSH 方式：`git clone git@github.com:YIXIENAQI0818/litnote.git`

### 2. 启动后端（终端 1）

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000
```

接口文档（Swagger UI）：http://localhost:8000/docs

### 3. 启动前端（终端 2）

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

浏览器打开 **http://localhost:5173** 即可使用。

> 首次启动后端会自动建表并预置默认笔记分栏（创新点 / 借鉴内容 / 主要内容 / 结论）。

## 使用说明

1. **新建文献**：点「＋ 新建文献」→ 填元数据，或在顶部输入 DOI / arXiv 号点「抓取」自动补全 → 保存
2. **记笔记**：点进一篇文献 → 下方分栏直接打字（停止输入自动保存）；「预览」切换渲染 Markdown；「管理分栏」增删、重命名、排序
3. **分类**：侧边栏「文件夹」「关键词」右侧 `+` 新建；编辑文献时可内联新建并自动选中
4. **检索**：顶部搜索框 + 文件夹 / 关键词 / 年份筛选 + 排序（更新时间 / 标题 / 年份）

## 数据存储

所有数据（SQLite 数据库 + PDF 原件）保存在本地 `data/` 目录，**不入库 git**。换机迁移时拷贝整个 `data/` 目录即可。

## 项目结构

```
litnote/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 入口（建表 + 种子分栏 + 路由装配）
│   │   ├── db.py            # 数据库引擎 / 会话
│   │   ├── models.py        # ORM 模型（papers/folders/tags/note_sections/notes）
│   │   ├── schemas.py       # Pydantic 请求 / 响应模型
│   │   └── routers/         # papers / folders / tags / notes / metadata
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # LibraryPage / PaperDetailPage
│   │   ├── components/      # PaperFormModal / SectionManagerModal
│   │   ├── App.jsx          # 路由
│   │   ├── api.js           # 后端 API 客户端
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js       # /api 代理到后端 8000
├── data/                    # 本地数据（gitignore）
└── .gitignore
```

## 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/papers` | 文献列表 / 新建 |
| GET/PUT/DELETE | `/api/papers/{id}` | 文献详情 / 更新 / 删除 |
| POST | `/api/papers/{id}/pdf` | 上传 PDF |
| GET | `/api/papers/{id}/pdf` | 读取 PDF（inline） |
| POST | `/api/papers/{id}/fetch-pdf` | 从 arXiv 自动下载 PDF |
| POST | `/api/metadata/fetch` | DOI / arXiv 元数据抓取 |
| CRUD | `/api/folders` `/api/tags` `/api/note-sections` | 文件夹 / 关键词 / 分栏 |
| GET/PUT | `/api/notes` | 笔记读取 / upsert |

完整文档见运行后的 http://localhost:8000/docs

## License

MIT
