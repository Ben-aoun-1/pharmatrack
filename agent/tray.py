"""System tray icon (pystray + Pillow). The icon is drawn programmatically."""

from typing import Callable

import pystray
from PIL import Image, ImageDraw


def _create_icon_image() -> Image.Image:
    # A green circle with a white border — no external asset file needed.
    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse(
        (4, 4, size - 4, size - 4),
        fill=(34, 197, 94, 255),
        outline=(255, 255, 255, 255),
        width=4,
    )
    return image


def create_tray_icon(on_quit: Callable) -> pystray.Icon:
    # pystray passes (icon, item) to menu callbacks; adapt to a no-arg on_quit.
    menu = pystray.Menu(
        pystray.MenuItem("Quitter PharmTrack", lambda icon, item: on_quit())
    )
    return pystray.Icon(
        "PharmTrack",
        icon=_create_icon_image(),
        title="PharmTrack actif",
        menu=menu,
    )


def run_tray(icon: pystray.Icon) -> None:
    # Blocking — must be called on the main thread.
    icon.run()
