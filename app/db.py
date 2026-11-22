# -*- coding: utf-8 -*-
"""SQLite 数据层：用户、项目、专注记录、登录会话。"""
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "focus.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT,
    avatar TEXT DEFAULT '🙂',
    bio TEXT DEFAULT '',
    goal_minutes INTEGER DEFAULT 0,
    default_minutes INTEGER DEFAULT 25,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#FF3B2F',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    seconds INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_focus_user_ended ON focus_sessions(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_focus_project ON focus_sessions(project_id);
"""


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "username" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
        if "avatar" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '🙂'")
        if "bio" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
        if "goal_minutes" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN goal_minutes INTEGER DEFAULT 0")
        if "default_minutes" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN default_minutes INTEGER DEFAULT 25")
        conn.commit()


def start_of_today():
    now = datetime.now()
    return int(datetime(now.year, now.month, now.day).timestamp())


def start_of_week():
    now = datetime.now()
    monday = now - timedelta(days=now.weekday())
    return int(datetime(monday.year, monday.month, monday.day).timestamp())


def project_stats(conn, user_id):
    today = start_of_today()
    rows = conn.execute(
        """
        SELECT p.id, p.name, p.color, p.created_at,
               COALESCE(SUM(s.seconds), 0) AS total,
               COALESCE(SUM(CASE WHEN s.ended_at >= ? THEN s.seconds ELSE 0 END), 0) AS today,
               COUNT(s.id) AS count
        FROM projects p
        LEFT JOIN focus_sessions s ON s.project_id = p.id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.id
        """,
        (today, user_id),
    ).fetchall()
    return [dict(r) for r in rows]


def user_stats(conn, user_id):
    today = start_of_today()
    week = start_of_week()
    row = conn.execute(
        """
        SELECT COALESCE(SUM(seconds), 0) AS total,
               COALESCE(SUM(CASE WHEN ended_at >= ? THEN seconds ELSE 0 END), 0) AS today,
               COALESCE(SUM(CASE WHEN ended_at >= ? THEN seconds ELSE 0 END), 0) AS week,
               COUNT(*) AS count
        FROM focus_sessions WHERE user_id = ?
        """,
        (today, week, user_id),
    ).fetchone()
    return dict(row)


def recent_sessions(conn, user_id, limit=20):
    rows = conn.execute(
        """
        SELECT s.id, s.mode, s.seconds, s.started_at, s.ended_at, p.name AS project, p.color
        FROM focus_sessions s JOIN projects p ON p.id = s.project_id
        WHERE s.user_id = ?
        ORDER BY s.ended_at DESC, s.id DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]
