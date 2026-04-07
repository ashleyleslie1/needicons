"""NeedIcons CLI."""
from __future__ import annotations

import argparse
import socket
import sys
import os
import signal


def _kill_existing_needicons():
    """Kill any existing NeedIcons server processes."""
    try:
        import psutil
    except ImportError:
        # psutil not available — try platform-specific approach
        if sys.platform == "win32":
            import subprocess
            # Find python processes with needicons in command line
            result = subprocess.run(
                ["wmic", "process", "where",
                 "name='python.exe' or name='python3.exe'",
                 "get", "processid,commandline"],
                capture_output=True, text=True
            )
            my_pid = os.getpid()
            for line in result.stdout.splitlines():
                if "needicons" in line.lower() and "wmic" not in line.lower():
                    parts = line.strip().split()
                    if parts:
                        try:
                            pid = int(parts[-1])
                            if pid != my_pid:
                                os.kill(pid, signal.SIGTERM)
                                print(f"  Stopped existing NeedIcons process (PID {pid})")
                        except (ValueError, OSError):
                            pass
        return

    # psutil available — clean approach
    my_pid = os.getpid()
    for proc in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmdline = " ".join(proc.info["cmdline"] or []).lower()
            if "needicons" in cmdline and proc.info["pid"] != my_pid:
                proc.terminate()
                print(f"  Stopped existing NeedIcons process (PID {proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass


def _find_open_port(host: str, preferred: int, range_start: int = 8420, range_end: int = 8450) -> int:
    """Try preferred port first, then scan range for an open one."""
    ports_to_try = [preferred] + [p for p in range(range_start, range_end) if p != preferred]
    for port in ports_to_try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    print(f"  Error: No open port found in range {range_start}-{range_end}", file=sys.stderr)
    sys.exit(1)


def _start_vite_dev(backend_port: int):
    """Start the Vite dev server in the background, proxying API to backend."""
    import subprocess
    import pathlib

    frontend_dir = pathlib.Path(__file__).resolve().parent.parent / "frontend"
    if not (frontend_dir / "package.json").exists():
        return None

    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    # Check if node_modules exist
    if not (frontend_dir / "node_modules").exists():
        print("  Installing frontend dependencies...")
        subprocess.run([npm_cmd, "install"], cwd=frontend_dir, capture_output=True)

    env = os.environ.copy()
    # Tell Vite which backend port to proxy to (read in vite.config.ts)
    env["VITE_API_PORT"] = str(backend_port)

    proc = subprocess.Popen(
        [npx_cmd, "vite", "--port", "5173", "--strictPort", "false"],
        cwd=frontend_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Wait briefly and read output to find the actual port
    import time
    time.sleep(2)
    vite_port = 5173
    try:
        while proc.stdout and proc.stdout.readable():
            line = proc.stdout.readline().decode(errors="replace")
            if not line:
                break
            if "localhost:" in line:
                import re
                m = re.search(r"localhost:(\d+)", line)
                if m:
                    vite_port = int(m.group(1))
                break
    except Exception:
        pass

    print(f"  Vite dev server at http://localhost:{vite_port} (hot reload)")
    return proc


def main():
    parser = argparse.ArgumentParser(
        prog="needicons",
        description="NeedIcons — AI-powered icon pack generator",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8420, help="Preferred port (auto-finds open port if busy)")
    parser.add_argument("--data-dir", default=None, help="Data directory path")
    parser.add_argument("--dev", action="store_true", help="Start Vite dev server alongside backend (hot reload)")

    args = parser.parse_args()

    # Kill any existing NeedIcons processes
    _kill_existing_needicons()

    import uvicorn
    from needicons.server.app import create_app

    kwargs = {}
    if args.data_dir:
        kwargs["data_dir"] = args.data_dir

    app = create_app(**kwargs)
    port = _find_open_port(args.host, args.port)
    if port != args.port:
        print(f"  Port {args.port} busy, using {port}")

    vite_proc = None
    if args.dev:
        vite_proc = _start_vite_dev(port)

    if not args.dev:
        print(f"\n  NeedIcons running at http://{args.host}:{port}\n")
    else:
        print(f"  Backend API at http://{args.host}:{port}\n")

    try:
        uvicorn.run(
        "needicons.server.app:create_app",
        factory=True,
        host=args.host,
        port=port,
        log_level="info",
        reload=args.dev,
        reload_dirs=["needicons"] if args.dev else None,
    )
    finally:
        if vite_proc:
            vite_proc.terminate()


if __name__ == "__main__":
    main()
