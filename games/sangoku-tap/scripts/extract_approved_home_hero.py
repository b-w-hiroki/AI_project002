"""Extract the visible approved-mock home hero without inventing hidden pixels."""

from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "e2e" / "screenshots" / "mock-comparison-450x800.png"
OUTPUT = ROOT / "public" / "images" / "mock-extracts" / "st-approved-home-hero-visible.png"
AVATAR_OUTPUT = ROOT / "public" / "images" / "mock-extracts" / "st-approved-lord-avatar.png"


def main() -> None:
    source = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
    if source is None or source.shape[:2] != (844, 900):
        raise RuntimeError(f"unexpected approved comparison dimensions: {None if source is None else source.shape}")

    # The left column below its 44 px review heading is the approved 450x800 viewport.
    viewport = source[44:844, 0:450].copy()
    avatar = cv2.cvtColor(viewport[112:200, 0:88], cv2.COLOR_BGR2BGRA)
    avatar_alpha = np.zeros((88, 88), dtype=np.uint8)
    cv2.circle(avatar_alpha, (44, 44), 42, 255, thickness=-1, lineType=cv2.LINE_AA)
    avatar[:, :, 3] = avatar_alpha
    AVATAR_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(AVATAR_OUTPUT), avatar):
        raise RuntimeError(f"failed to write {AVATAR_OUTPUT}")
    mask = np.full(viewport.shape[:2], cv2.GC_BGD, dtype=np.uint8)

    # Only the visible back-facing rider is eligible. The deployment medallion and
    # all surrounding city/UI pixels remain background; hidden anatomy is not filled.
    probable = np.array(
        [[0, 584], [94, 599], [145, 573], [178, 563], [187, 541], [211, 531],
         [235, 542], [252, 580], [283, 612], [309, 625], [329, 662], [339, 690],
         [376, 706], [414, 748], [420, 800], [0, 800]],
        dtype=np.int32,
    )
    cv2.fillPoly(mask, [probable], cv2.GC_PR_FGD)

    sure_foreground = [
        np.array([[184, 553], [214, 541], [239, 553], [245, 584], [224, 613], [186, 602], [166, 578]], np.int32),
        np.array([[0, 610], [65, 616], [129, 590], [194, 588], [210, 626], [151, 665], [61, 691], [0, 668]], np.int32),
        np.array([[224, 619], [278, 620], [315, 655], [326, 699], [295, 743], [248, 706]], np.int32),
        np.array([[322, 688], [365, 708], [402, 750], [392, 793], [345, 764]], np.int32),
    ]
    for polygon in sure_foreground:
        cv2.fillPoly(mask, [polygon], cv2.GC_FGD)

    # Explicitly exclude the adjacent banners and live-UI deployment medallion.
    sure_background = [
        np.array([[68, 514], [166, 514], [166, 566], [150, 588], [110, 599], [68, 582]], np.int32),
        np.array([[136, 514], [195, 514], [184, 548], [164, 571], [150, 584], [136, 568]], np.int32),
        np.array([[236, 514], [302, 514], [302, 606], [282, 611], [257, 582], [246, 550]], np.int32),
        np.array([[304, 566], [449, 566], [449, 691], [383, 691], [342, 672], [322, 631]], np.int32),
    ]
    for polygon in sure_background:
        cv2.fillPoly(mask, [polygon], cv2.GC_BGD)
    cv2.ellipse(mask, (205, 805), (126, 91), 0, 0, 360, cv2.GC_BGD, thickness=-1)

    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(viewport, mask, None, background_model, foreground_model, 8, cv2.GC_INIT_WITH_MASK)

    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    # GrabCut cannot distinguish every dark city/banner pixel from the dark armor.
    # Intersect it with a conservative silhouette envelope so no adjacent scene/UI
    # survives merely because its color resembles the rider.
    envelope = np.zeros_like(alpha)
    silhouette_parts = [
        np.array([[0, 592], [56, 615], [112, 625], [155, 605], [180, 612], [211, 640],
                  [240, 659], [203, 687], [151, 715], [96, 744], [28, 777], [0, 779]], np.int32),
        np.array([[155, 605], [168, 585], [184, 575], [190, 552], [210, 545], [228, 553],
                  [241, 570], [250, 590], [248, 610], [232, 625], [205, 620], [180, 612]], np.int32),
        np.array([[220, 640], [245, 625], [272, 622], [300, 642], [325, 669], [339, 691], [372, 706],
                  [411, 750], [421, 800], [340, 800], [314, 760], [275, 735], [236, 700],
                  [204, 659]], np.int32),
    ]
    for polygon in silhouette_parts:
        cv2.fillPoly(envelope, [polygon], 255)
    outside_top = np.array(
        [[0, 0], [449, 0], [449, 691], [383, 691], [342, 672], [322, 631],
         [302, 610], [282, 611], [257, 582], [246, 558], [234, 552], [212, 545],
         [190, 552], [183, 568], [166, 584], [150, 600], [112, 625], [56, 615], [0, 592]],
        np.int32,
    )
    cv2.fillPoly(envelope, [outside_top], 0)
    alpha = envelope
    cv2.ellipse(alpha, (205, 805), (126, 91), 0, 0, 360, 0, thickness=-1)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, connectivity=8)
    if count > 1:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        alpha = np.where(labels == keep, 255, 0).astype(np.uint8)

    rgba = cv2.cvtColor(viewport, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(OUTPUT), rgba):
        raise RuntimeError(f"failed to write {OUTPUT}")

    print(f"wrote {OUTPUT} ({int(np.count_nonzero(alpha))} retained source pixels)")
    print(f"wrote {AVATAR_OUTPUT}")


if __name__ == "__main__":
    main()
