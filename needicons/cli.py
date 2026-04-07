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


def main():
    parser = argparse.ArgumentParser(
        prog="needicons",
        description="NeedIcons — AI-powered icon pack generator",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8420, help="Preferred port (auto-finds open port if busy)")
    parser.add_argument("--data-dir", default=None, help="Data directory path")

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
    print(f"\n  NeedIcons running at http://{args.host}:{port}\n")
    uvicorn.run(app, host=args.host, port=port, log_level="info")


if __name__ == "__main__":
    main()
