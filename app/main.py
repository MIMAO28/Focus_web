# -*- coding: utf-8 -*-
"""FOCUS! 学习专注网站 —— 本地单人应用。

启动：python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
import os
import time
from contextlib import closing

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
COOKIE_NAME = "focus_sid"
SESSION_DAYS = 30
SECURE_COOKIE = os.getenv("FOCUS_SECURE_COOKIE", "0") == "1"
PALETTE = ["#FF3B2F", "#C6FF3D", "#FFD166", "#7BD389", "#8AB6FF", "#FF8FC7"]

app = FastAPI(title="FOCUS! 学习专注")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

db.init_db()


class Credentials(BaseModel):
    email: str
    password: str
    username: str = ""


class ProjectIn(BaseModel):
    name: str


class FocusIn(BaseModel):
    project_id: int
    mode: str
    seconds: int


def current_user(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="请先登录")
    now = int(time.time())
    with closing(db.connect()) as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.username, u.created_at, s.expires_at
            FROM auth_sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
        if row["expires_at"] < now:
            conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
            conn.commit()
            raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
        return {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"] or "",
            "created_at": row["created_at"],
        }


def me_payload(conn, user):
    stats = db.user_stats(conn, user["id"])
    return {
        "email": user["email"],
        "username": user.get("username", ""),
        "created_at": user["created_at"],
        "stats": stats,
        "projects": db.project_stats(conn, user["id"]),
    }


def begin_session(conn, user_id, response: Response):
    token = auth.new_token()
    now = int(time.time())
    conn.execute(
        "INSERT INTO auth_sessions(token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now, now + SESSION_DAYS * 86400),
    )
    conn.commit()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=SECURE_COOKIE,
    )


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.post("/api/register")
def register(body: Credentials, response: Response):
    email = (body.email or "").strip().lower()
    password = body.password or ""
    username = (body.username or "").strip()
    if not auth.valid_email(email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    if username and (len(username) < 2 or len(username) > 20):
        raise HTTPException(status_code=400, detail="用户名请填 2-20 个字符")
    with closing(db.connect()) as conn:
        exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="该邮箱已注册，请直接登录")
        salt, digest = auth.hash_password(password)
        now = int(time.time())
        cur = conn.execute(
            "INSERT INTO users(email, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
            (email, username, digest, salt, now),
        )
        user_id = cur.lastrowid
        conn.execute(
            "INSERT INTO projects(user_id, name, color, created_at) VALUES (?, ?, ?, ?)",
            (user_id, "默认项目", PALETTE[0], now),
        )
        conn.commit()
        begin_session(conn, user_id, response)
        user = {"id": user_id, "email": email, "username": username, "created_at": now}
        return me_payload(conn, user)


@app.post("/api/login")
def login(body: Credentials, response: Response):
    email = (body.email or "").strip().lower()
    password = body.password or ""
    with closing(db.connect()) as conn:
        row = conn.execute(
            "SELECT id, email, username, password_hash, salt, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if not row or not auth.verify_password(password, row["salt"], row["password_hash"]):
            raise HTTPException(status_code=401, detail="邮箱或密码不正确")
        begin_session(conn, row["id"], response)
        user = {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"] or "",
            "created_at": row["created_at"],
        }
        return me_payload(conn, user)


@app.post("/api/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with closing(db.connect()) as conn:
            conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
            conn.commit()
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/me")
def me(request: Request):
    user = current_user(request)
    with closing(db.connect()) as conn:
        return me_payload(conn, user)


@app.get("/api/projects")
def list_projects(request: Request):
    user = current_user(request)
    with closing(db.connect()) as conn:
        return {"projects": db.project_stats(conn, user["id"])}


@app.post("/api/projects")
def create_project(body: ProjectIn, request: Request):
    user = current_user(request)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    if len(name) > 40:
        raise HTTPException(status_code=400, detail="项目名称不超过 40 个字")
    with closing(db.connect()) as conn:
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM projects WHERE user_id = ?", (user["id"],)
        ).fetchone()["c"]
        color = PALETTE[count % len(PALETTE)]
        conn.execute(
            "INSERT INTO projects(user_id, name, color, created_at) VALUES (?, ?, ?, ?)",
            (user["id"], name, color, int(time.time())),
        )
        conn.commit()
        return {"projects": db.project_stats(conn, user["id"])}


@app.patch("/api/projects/{project_id}")
def rename_project(project_id: int, body: ProjectIn, request: Request):
    user = current_user(request)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    with closing(db.connect()) as conn:
        owned = conn.execute(
            "SELECT id FROM projects WHERE id = ? AND user_id = ?", (project_id, user["id"])
        ).fetchone()
        if not owned:
            raise HTTPException(status_code=404, detail="项目不存在")
        conn.execute("UPDATE projects SET name = ? WHERE id = ?", (name, project_id))
        conn.commit()
        return {"projects": db.project_stats(conn, user["id"])}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, request: Request):
    user = current_user(request)
    with closing(db.connect()) as conn:
        owned = conn.execute(
            "SELECT id FROM projects WHERE id = ? AND user_id = ?", (project_id, user["id"])
        ).fetchone()
        if not owned:
            raise HTTPException(status_code=404, detail="项目不存在")
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM projects WHERE user_id = ?", (user["id"],)
        ).fetchone()["c"]
        if total <= 1:
            raise HTTPException(status_code=400, detail="至少保留一个项目")
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return {"projects": db.project_stats(conn, user["id"])}


@app.get("/api/sessions")
def sessions(request: Request, limit: int = 20):
    user = current_user(request)
    limit = max(1, min(limit, 1000))
    with closing(db.connect()) as conn:
        return {"sessions": db.recent_sessions(conn, user["id"], limit)}


@app.get("/api/stats")
def stats(request: Request):
    user = current_user(request)
    with closing(db.connect()) as conn:
        return {
            "stats": db.user_stats(conn, user["id"]),
            "projects": db.project_stats(conn, user["id"]),
            "sessions": db.recent_sessions(conn, user["id"], 20),
        }


@app.post("/api/focus")
def add_focus(body: FocusIn, request: Request):
    user = current_user(request)
    if body.mode not in ("countdown", "countup"):
        raise HTTPException(status_code=400, detail="计时模式不正确")
    if body.seconds < 5:
        raise HTTPException(status_code=400, detail="低于 5 秒不记录")
    if body.seconds > 86400:
        raise HTTPException(status_code=400, detail="单次时长异常")
    now = int(time.time())
    with closing(db.connect()) as conn:
        owned = conn.execute(
            "SELECT id, name FROM projects WHERE id = ? AND user_id = ?",
            (body.project_id, user["id"]),
        ).fetchone()
        if not owned:
            raise HTTPException(status_code=404, detail="项目不存在")
        conn.execute(
            """INSERT INTO focus_sessions(user_id, project_id, mode, seconds, started_at, ended_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user["id"], body.project_id, body.mode, body.seconds, now - body.seconds, now),
        )
        conn.commit()
        return {
            "ok": True,
            "project": owned["name"],
            "projects": db.project_stats(conn, user["id"]),
            "stats": db.user_stats(conn, user["id"]),
            "sessions": db.recent_sessions(conn, user["id"], 20),
        }
