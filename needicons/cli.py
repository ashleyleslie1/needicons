"""NeedIcons CLI."""
from __future__ import annotations

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="needicons",
        description="NeedIcons — AI-powered icon pack generator",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8420, help="Port to bind to")
    parser.add_argument("--data-dir", default=None, help="Data directory path")

    args = parser.parse_args()

    import uvicorn
    from needicons.server.app import create_app

    kwargs = {}
    if args.data_dir:
        kwargs["data_dir"] = args.data_dir

    app = create_app(**kwargs)
    print(f"\n  NeedIcons running at http://{args.host}:{args.port}\n")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
