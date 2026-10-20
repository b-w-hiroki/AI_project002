import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("check_docs", Path(__file__).parents[1] / "check_docs.py")
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


def impact(status="unchanged"):
    return {"status": status, "reason": "Existing behavior and architecture are preserved."}


class DocumentationGuardTest(unittest.TestCase):
    def setUp(self):
        self.policy = {"version": 1, "areas": {
            "game": {"prefixes": ["games/game/"], "spec": "docs/current/game/spec.md", "design": "docs/current/game/design.md"},
            "other": {"prefixes": ["games/other/"], "spec": "docs/current/other/spec.md", "design": "docs/current/other/design.md"},
            "platform": {"prefixes": ["games/shared/", ".github/"], "spec": "docs/current/platform-spec.md", "design": "docs/current/platform-design.md"},
        }}
        self.content = {rule[kind]: "# Document\n" for rule in self.policy["areas"].values() for kind in ("spec", "design")}
        self.content.update({"docs/current/README.md": "# Index\n", "docs/documentation-workflow.md": "# Workflow\n"})
        self.note_path = "docs/updates/change.json"
        self.note = {"summary": "Fix a regression", "areas": {"game": {"spec": impact(), "design": impact()}},
                     "validation": ["Unit regression passes"], "limitations": []}

    def check(self, changed=None, added=None):
        self.content[self.note_path] = json.dumps(self.note)
        return guard.validate(self.policy, set(changed or ["games/game/src/main.ts", self.note_path]),
                              set([self.note_path] if added is None else added), set(self.content), self.content.__getitem__)

    def test_reasoned_no_impact_passes(self):
        self.assertEqual(self.check(), [])

    def test_missing_new_note_fails(self):
        self.assertTrue(any("new docs/updates" in e for e in self.check(added=[])))

    def test_editing_old_note_does_not_count(self):
        self.assertTrue(self.check(added=[]))

    def test_updated_requires_corresponding_diff(self):
        self.note["areas"]["game"]["spec"] = impact("updated")
        self.assertTrue(any("did not change" in e for e in self.check()))

    def test_updated_with_diff_passes(self):
        self.note["areas"]["game"]["spec"] = impact("updated")
        self.assertEqual(self.check(["games/game/src/main.ts", "docs/current/game/spec.md", self.note_path]), [])

    def test_changed_doc_cannot_only_declare_unchanged(self):
        self.assertTrue(self.check(["docs/current/game/spec.md", self.note_path]))

    def test_stacked_notes_can_mix_updated_and_no_impact(self):
        first = json.loads(json.dumps(self.note))
        first["areas"]["game"]["spec"] = impact("updated")
        path = "docs/updates/first.json"
        self.content[path] = json.dumps(first)
        self.assertEqual(self.check(["docs/current/game/spec.md", path, self.note_path], [path, self.note_path]), [])

    def test_wrong_game_record_does_not_cover_other_game(self):
        self.assertTrue(any("other:" in e for e in self.check(["games/other/src/main.ts"])))

    def test_shared_changes_require_platform(self):
        self.assertTrue(any("platform:" in e for e in self.check(["games/shared/mobile.ts"])))

    def test_dependency_and_asset_changes_require_records(self):
        for path in ["games/game/package-lock.json", "games/game/public/images/hero.webp"]:
            with self.subTest(path=path):
                self.assertTrue(self.check([path], added=[]))

    def test_unknown_game_fails(self):
        self.assertTrue(any("Unregistered" in e for e in self.check(["games/new-game/main.ts"])))

    def test_deleted_design_fails(self):
        del self.content["docs/current/game/design.md"]
        self.assertTrue(any("Missing" in e for e in self.check()))

    def test_short_reason_fails(self):
        self.note["areas"]["game"]["spec"]["reason"] = "none"
        self.assertTrue(any("concrete reason" in e for e in self.check()))

    def test_invalid_status_and_missing_validation_fail(self):
        self.note["areas"]["game"]["design"]["status"] = "skip"
        self.assertTrue(self.check())
        self.note["validation"] = []
        self.assertTrue(self.check())

    def test_broken_link_fails(self):
        self.content["docs/current/game/spec.md"] += "[missing](not-found.md)"
        self.assertTrue(any("broken local link" in e for e in self.check()))

    def test_relative_directory_and_external_links_pass(self):
        self.content["docs/current/game/spec.md"] += "[design](design.md) [parent](../other) [web](https://example.com)"
        self.assertEqual(self.check(), [])

    def test_no_runtime_change_needs_no_impact_note(self):
        self.assertEqual(self.check(["docs/review/history.md"], added=[]), [])

    def test_git_cli_detects_committed_code_without_note(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            def command(*args):
                return subprocess.check_output(["git", *args], cwd=root).decode().strip()
            command("init", "-q")
            for path, content in self.content.items():
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            (root / "docs/docs-policy.json").write_text(json.dumps(self.policy), encoding="utf-8")
            command("add", ".")
            commit = ("-c", "user.name=Docs Test", "-c", "user.email=docs@example.invalid", "commit", "-qm")
            command(*commit, "baseline")
            base = command("rev-parse", "HEAD")
            path = root / "games/game/src/main.ts"
            path.parent.mkdir(parents=True)
            path.write_text("// change", encoding="utf-8")
            command("add", ".")
            command(*commit, "missing documentation")
            with patch.object(guard, "ROOT", root), patch("sys.argv", ["check_docs", "--base", base]):
                self.assertEqual(guard.main(), 1)
            path = root / self.note_path
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(self.note), encoding="utf-8")
            command("add", ".")
            command(*commit, "document impact")
            with patch.object(guard, "ROOT", root), patch("sys.argv", ["check_docs", "--base", base]):
                self.assertEqual(guard.main(), 0)


if __name__ == "__main__":
    unittest.main()
