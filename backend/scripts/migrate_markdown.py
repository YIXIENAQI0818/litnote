#!/usr/bin/env python3
"""一次性迁移脚本：把旧版 Markdown 换行写法迁移到标准 Markdown。

背景
----
旧版笔记用「双回车」表示换行、「双回车 &nbsp; 双回车」表示分段，例如::

    第一行
    第二行

    &nbsp;

    第三行

新版改为标准 Markdown + CSS 段落间距（``.markdown-body p`` 的 margin 1.7em）：
- 「分段」→ 双回车（空一行，由 CSS 呈现）；
- 「换行」→ 行尾反斜杠 ``\\`` + 回车（硬换行 <br>）。

本脚本把旧写法迁移为新写法。

用法
----
    python3 backend/scripts/migrate_markdown.py                 # 默认 data/litnote.db
    python3 backend/scripts/migrate_markdown.py --db 路径        # 指定数据库
    python3 backend/scripts/migrate_markdown.py --dry-run       # 只预览，不写库

    Windows 下把 ``python3`` 换成 ``python``（取决于 Python 安装方式）。

安全
----
- 运行前自动备份数据库到 ``<db>.bak-<时间戳>``；
- 已迁移（内容里已含反斜杠硬换行 ``\\`` + 换行）的笔记自动跳过；
- 幂等：重复运行不会二次修改。
"""

import argparse
import re
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# 「独占一行的 &nbsp;」= 旧版分段标记（分号可选，含中文分号；或纯 U+00A0 空格）。
NBSP_LINE = re.compile(r"^[ \t]*(?:&nbsp[;；]?| +)[ \t]*$", re.MULTILINE)

# 私有区字符占位符，正常笔记里不会出现。
SEP = ""


def migrate(content: str) -> tuple[str, int, int]:
    """返回 (迁移后的内容, 迁移的分段数, 迁移的换行数)。"""
    if not content:
        return content, 0, 0
    # Windows 防御：万一笔记里混入 CRLF/CR 换行，先统一归一化为 LF。
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    # 幂等保护：已含反斜杠硬换行，视为已迁移。
    if "\\\n" in content:
        return content, 0, 0

    nbsp_count = len(NBSP_LINE.findall(content))
    total_double = content.count("\n\n")
    # 每个分段标记（&nbsp;）前后各贡献一个双回车，其余双回车都是「换行」。
    break_count = max(0, total_double - 2 * nbsp_count)

    # 1. 分段标记 &nbsp; 行 → 占位符（保护起来，避免被当成换行）。
    c = NBSP_LINE.sub(SEP, content)
    # 2. 换行：双回车 → 反斜杠 + 换行。
    c = c.replace("\n\n", "\\\n")
    # 3. 还原分段：硬换行 + 占位符 + 硬换行 → 双回车。
    c = c.replace("\\\n" + SEP + "\\\n", "\n\n")
    # 4. 边界兜底：占位符在开头/结尾或残留。
    c = c.replace(SEP + "\\\n", "\n\n")
    c = c.replace("\\\n" + SEP, "\n\n")
    c = c.replace(SEP, "\n\n")

    return c, nbsp_count, break_count


def main() -> int:
    parser = argparse.ArgumentParser(description="迁移旧版 Markdown 换行写法到标准 Markdown")
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="数据库路径（默认项目根目录 data/litnote.db）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印会改什么，不实际写库",
    )
    args = parser.parse_args()

    if args.db is None:
        # 脚本位于 backend/scripts/，向上三级即项目根目录 litnote/。
        root = Path(__file__).resolve().parent.parent.parent
        db_path = root / "data" / "litnote.db"
    else:
        db_path = args.db

    if not db_path.exists():
        print(f"[错误] 找不到数据库：{db_path}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"[预览] 数据库：{db_path}（--dry-run，不会实际修改）")
    else:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = db_path.with_name(db_path.name + f".bak-{ts}")
        shutil.copy2(db_path, backup)
        print(f"[备份] 已备份到 {backup}")

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT id, paper_id, section_id, content FROM notes"
        ).fetchall()

        changed = 0
        total_nbsp = 0
        total_break = 0

        for note_id, paper_id, section_id, content in rows:
            new_content, nbsp_count, break_count = migrate(content or "")
            if new_content == content:
                continue

            changed += 1
            total_nbsp += nbsp_count
            total_break += break_count
            print(
                f"[{'预览' if args.dry_run else '迁移'}] "
                f"note#{note_id} (paper={paper_id}, section={section_id}) "
                f"分段 {nbsp_count} 处，换行 {break_count} 处"
            )

            if not args.dry_run:
                conn.execute(
                    "UPDATE notes SET content = ? WHERE id = ?",
                    (new_content, note_id),
                )

        if not args.dry_run:
            conn.commit()

        print(
            f"\n完成：共 {len(rows)} 条笔记，迁移 {changed} 条，"
            f"分段 {total_nbsp} 处，换行 {total_break} 处。"
        )
        if args.dry_run:
            print("（--dry-run 模式，未实际修改数据库）")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
