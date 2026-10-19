"""Validate committed documentation impact records. Standard library + Git only."""
import argparse
import json
import posixpath
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
POLICY = "docs/docs-policy.json"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8")


def affected_areas(paths, areas):
    affected, errors = set(), []
    for path in paths:
        if path.startswith("games/"):
            game = path.split("/")[1]
            if game != "shared" and game not in areas:
                errors.append(f"Unregistered game: {game}; add specifications and policy mapping")
        for area, rule in areas.items():
            if (path in (rule["spec"], rule["design"])
                    or path in rule.get("files", [])
                    or any(path.startswith(prefix) for prefix in rule.get("prefixes", []))):
                affected.add(area)
    return affected, errors


def validate(policy, changed, added, files, read):
    errors = []
    areas = policy.get("areas", {})
    if policy.get("version") != 1 or not areas:
        return ["Invalid documentation policy"]
    for area, rule in areas.items():
        for kind in ("spec", "design"):
            path = rule.get(kind, "")
            if path not in files:
                errors.append(f"Missing {area} {kind}: {path}")
    affected, mapping_errors = affected_areas(changed, areas)
    errors.extend(mapping_errors)
    recorded = set()
    updated = set()
    notes = sorted(p for p in added if p.startswith("docs/updates/") and p.endswith(".json"))
    for path in notes:
        try:
            note = json.loads(read(path))
            if not isinstance(note, dict):
                raise ValueError("record must be an object")
            if not isinstance(note.get("summary"), str) or not note["summary"].strip():
                raise ValueError("summary is required")
            if not isinstance(note.get("validation"), list) or not note["validation"] or any(
                    not isinstance(item, str) or not item.strip() for item in note["validation"]):
                raise ValueError("validation must list evidence or explicit limitations")
            if not isinstance(note.get("limitations"), list) or any(
                    not isinstance(item, str) for item in note["limitations"]):
                raise ValueError("limitations must be a list (empty is allowed)")
            records = note.get("areas")
            if not isinstance(records, dict) or not records:
                raise ValueError("areas must be a nonempty object")
            for area, record in records.items():
                if area not in areas:
                    raise ValueError(f"unknown area: {area}")
                if not isinstance(record, dict):
                    raise ValueError(f"{area}: record must be an object")
                for kind in ("spec", "design"):
                    impact = record.get(kind)
                    if not isinstance(impact, dict) or impact.get("status") not in ("updated", "unchanged"):
                        raise ValueError(f"{area}.{kind}: status must be updated or unchanged")
                    reason = impact.get("reason")
                    if not isinstance(reason, str) or len(reason.strip()) < 10:
                        raise ValueError(f"{area}.{kind}: concrete reason of at least 10 characters required")
                    if impact["status"] == "updated" and areas[area][kind] not in changed:
                        errors.append(f"{path}: {area}.{kind} declared updated but file did not change")
                    if impact["status"] == "updated":
                        updated.add((area, kind))
                recorded.add(area)
        except (ValueError, TypeError, KeyError) as exc:
            errors.append(f"{path}: {exc}")
    for area in sorted(affected - recorded):
        errors.append(f"{area}: add a new docs/updates/*.json record for this PR")
    for area in affected & recorded:
        for kind in ("spec", "design"):
            if areas[area][kind] in changed and (area, kind) not in updated:
                errors.append(f"{area}.{kind}: document changed but no record declares updated")

    # Only the living set: historical documents are not retroactively reclassified.
    documents = {rule[kind] for rule in areas.values() for kind in ("spec", "design")}
    documents.update(("docs/current/README.md", "docs/documentation-workflow.md"))
    for path in sorted(documents):
        if path not in files:
            errors.append(f"Missing document: {path}")
            continue
        source = read(path)
        if not source.startswith("# "):
            errors.append(f"{path}: document title is missing")
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", source):
            target = target.strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), unquote(parsed.path)))
            if resolved.startswith("../") or (resolved not in files and not any(
                    item.startswith(resolved.rstrip("/") + "/") for item in files)):
                errors.append(f"{path}: broken local link: {target}")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="PR base ref or SHA")
    parser.add_argument("--head", default="HEAD", help="committed head ref or SHA")
    args = parser.parse_args()
    # Resolve refs before passing to diff, including names beginning with '-'.
    base = git("rev-parse", "--verify", "--end-of-options", args.base + "^{commit}").strip()
    head = git("rev-parse", "--verify", "--end-of-options", args.head + "^{commit}").strip()
    ancestor = git("merge-base", base, head).strip()
    changed = set(git("diff", "--no-renames", "--name-only", "-z", ancestor, head).split("\0")) - {""}
    added = set(git("diff", "--no-renames", "--diff-filter=A", "--name-only", "-z", ancestor, head).split("\0")) - {""}
    files = set(git("ls-tree", "-r", "--name-only", "-z", head).split("\0")) - {""}
    read = lambda path: git("show", f"{head}:{path}")
    try:
        errors = validate(json.loads(read(POLICY)), changed, added, files, read)
    except (ValueError, KeyError, TypeError) as exc:
        errors = [f"Invalid policy: {exc}"]
    if errors:
        print("Documentation check failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Documentation check passed: {len(changed)} changed paths, base {ancestor[:12]}, head {head[:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
