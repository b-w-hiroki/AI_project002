"""Extract only the visible cat pixels from the approved Potion home mock."""

from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / "docs" / "design" / "mocks" / "potion-workshop-flow.png"
OUTPUT = ROOT / "public" / "images" / "mock-extracts" / "pw-approved-cat-visible.png"


def main() -> None:
    source = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
    if source is None:
        raise RuntimeError(f"failed to read {SOURCE}")

    # First approved-home panel: the cat is visible only in this source rectangle.
    crop = source[548:730, 8:174].copy()
    # Trace the visible silhouette only. The lower gold prop and right cauldron
    # edge remain source pixels but are intentionally placed behind the live
    # cauldron at runtime, so no hidden body pixels are fabricated.
    silhouette = np.array(
        [[46, 181], [24, 169], [10, 148], [9, 126], [18, 111], [23, 91],
         [22, 72], [18, 55], [34, 64], [44, 59], [57, 57], [72, 54],
         [88, 55], [102, 59], [113, 69], [120, 83], [121, 97],
         [114, 109], [104, 119], [103, 140], [98, 159], [83, 176]],
        dtype=np.int32,
    )
    alpha = np.zeros(crop.shape[:2], dtype=np.uint8)
    cv2.fillPoly(alpha, [silhouette], 255, lineType=cv2.LINE_AA)

    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(OUTPUT), rgba):
        raise RuntimeError(f"failed to write {OUTPUT}")
    print(f"wrote {OUTPUT} ({int(np.count_nonzero(alpha))} retained source pixels)")


if __name__ == "__main__":
    main()
