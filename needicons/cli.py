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
    import shutil

    frontend_dir = pathlib.Path(__file__).resolve().parent.parent / "frontend"
    if not (frontend_dir / "package.json").exists():
        return None

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    # Check if node_modules exist
    if not (frontend_dir / "node_modules").exists():
        print("  Installing frontend dependencies...")
        subprocess.run([npm_cmd, "install"], cwd=frontend_dir, capture_output=True)

    # Clear Vite dep cache to avoid stale module errors on restart
    vite_cache = frontend_dir / "node_modules" / ".vite"
    if vite_cache.exists():
        shutil.rmtree(vite_cache, ignore_errors=True)

    # Find an open port for Vite
    vite_port = _find_open_port("127.0.0.1", 5173, 5173, 5200)

    env = os.environ.copy()
    env["VITE_API_PORT"] = str(backend_port)

    # Run via "npm run dev" so Vite is launched through Node properly,
    # passing the port via Vite CLI args after "--".
    proc = subprocess.Popen(
        [npm_cmd, "run", "dev", "--", "--port", str(vite_port)],
        cwd=frontend_dir,
        env=env,
    )

    print(f"  Vite dev server at http://localhost:{vite_port} (hot reload)")
    return proc


def _cmd_verify(args):
    """Check processing signature on image file(s)."""
    from pathlib import Path
    from PIL import Image
    from needicons.core.pipeline.signature import verify

    # Default: check all PNGs in the verify/ folder
    if args.file:
        files = [Path(args.file)]
    else:
        verify_dir = Path(__file__).resolve().parent.parent / "verify"
        files = sorted(verify_dir.glob("*.png"))
        if not files:
            print(f"  No PNG files found in {verify_dir}")
            print(f"  Drop a PNG into the verify/ folder and run again")
            sys.exit(1)

    any_fail = False
    for path in files:
        if not path.exists():
            print(f"  File not found: {path}")
            any_fail = True
            continue
        img = Image.open(path)
        result = verify(img)
        if result:
            print(f"  PASS — {path.name}")
        else:
            print(f"  FAIL — {path.name}")
            any_fail = True

    sys.exit(1 if any_fail else 0)


def main():
    parser = argparse.ArgumentParser(
        prog="needicons",
        description="NeedIcons — AI-powered icon pack generator",
    )
    sub = parser.add_subparsers(dest="command")

    # verify subcommand
    verify_p = sub.add_parser("verify", help="Check processing signature on exported images")
    verify_p.add_argument("file", nargs="?", default=None, help="Path to PNG (default: all PNGs in verify/ folder)")

    # server flags (default command)
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8420, help="Preferred port (auto-finds open port if busy)")
    parser.add_argument("--data-dir", default=None, help="Data directory path")
    parser.add_argument("--dev", action="store_true", help="Start Vite dev server alongside backend (hot reload)")

    args = parser.parse_args()

    if args.command == "verify":
        _cmd_verify(args)
        return

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
