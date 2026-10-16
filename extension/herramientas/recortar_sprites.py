#!/usr/bin/env python3
"""Recorta los sprites del juego "El Golpe" desde las imagenes de referencia.

Entrada : extension/referencias/{3_estanteria_objetos.png, 4_policia_ladron.png, 2_mortadelo.png}
Salida  : extension/web/assets/sprites/<clave>.webp  (alfa, calidad 90)
Depuracion: /tmp/sprites_dbg/*.png y hojas de contactos en /tmp/

Tecnica por sprite (ver dict TECNICA): rembg para quitar fondo, o GrabCut para los
objetos de bajo contraste contra la madera. Despues, para TODOS: se queda el
componente conexo principal, rellena huecos, suaviza el borde y decontamina el halo.

Ejecutar con el venv de /tmp/sprites:
    /tmp/sprites/bin/python extension/herramientas/recortar_sprites.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter
import cv2
from scipy import ndimage  # viene con rembg

REPO = "/home/david/projects/baobab-project-heist/extension"
REF = os.path.join(REPO, "referencias")
OUT = os.path.join(REPO, "web/assets/sprites")
DBG = "/tmp/sprites_dbg"
os.makedirs(DBG, exist_ok=True)

EST = os.path.join(REF, "3_estanteria_objetos.png")
ELE = os.path.join(REF, "4_policia_ladron.png")
MOR = os.path.join(REF, "2_mortadelo.png")

# Cajas (x0,y0,x1,y1) fijadas a mano sobre las fuentes con rejilla numerada.
# Margen ~6-10 px alrededor de la silueta completa (incluida peana/base).
CAJAS = {
    # --- estanteria (16 objetos) ---
    "retrato":        (EST, (130,  52, 238, 190)),   # cuadro enmarcado del rey
    "busto":          (EST, (395,  52, 505, 200)),   # busto romano de piedra
    "mascara":        (EST, (543,  52, 658, 205)),   # mascara de Tutankamon
    "craneo_trex":    (EST, (658,  58, 802, 195)),   # craneo de T-rex
    "casco_samurai":  (EST, (835,  62, 968, 195)),   # casco samurai con cuernos dorados
    "reloj_arena":    (EST, (172, 193, 245, 305)),
    "fosil_pez":      (EST, (688, 203, 822, 302)),   # pez fosilizado en roca gris
    "amonite":        (EST, (808, 198, 932, 312)),   # amonite espiral
    "corona":         (EST, (328, 308, 448, 412)),
    "cofre":          (EST, (438, 318, 562, 418)),   # cofre del tesoro con monedas
    "trofeo":         (EST, (558, 298, 642, 418)),   # copa/caliz dorado sobre base
    "rubi":           (EST, (758, 328, 832, 415)),   # rubi rojo sobre peana de madera
    "anfora":         (EST, (248, 418, 348, 565)),   # anfora griega con figuras negras
    "globo":          (EST, (663, 443, 792, 572)),   # globo terraqueo sobre pie dorado
    "catalejo":       (EST, (843, 498, 972, 556)),   # catalejo de laton tumbado
    "casco_caballero":(EST, ( 53, 428, 178, 568)),   # yelmo con penacho rojo
    # --- elenco (fondo blanco) ---
    "coche":          (ELE, ( 20, 150, 440, 560)),
    "poli":           (ELE, (475, 130, 735, 625)),
    "ladron":         (ELE, (715, 165, 915, 645)),
}

# Tecnica de mascara por sprite:
#   "rembg:<modelo>"  -> red neuronal de segmentacion
#   "grabcut"         -> OpenCV GrabCut (caja = PR_FGD, centro = FGD)
#   "white"           -> umbral sobre fondo blanco (elenco)
TECNICA = {
    "retrato":        "rembg:isnet-general-use",
    "busto":          "rembg:birefnet-general",
    "mascara":        "rembg:isnet-general-use",
    "craneo_trex":    "rembg:isnet-general-use",
    "casco_samurai":  "grabcut",      # metal oscuro sobre madera: bajo contraste
    "reloj_arena":    "grabcut",      # cristal/madera clara sobre madera
    "fosil_pez":      "grabcut",      # roca gris sobre madera marron
    "amonite":        "grabcut",      # beige sobre madera
    "corona":         "rembg:isnet-general-use",
    "cofre":          "rembg:isnet-general-use",
    "trofeo":         "rembg:birefnet-general",
    "rubi":           "rembg:isnet-general-use",
    "anfora":         "rembg:birefnet-general",
    "globo":          "grabcut",      # pie dorado se confunde con madera
    "catalejo":       "grabcut",      # laton marron sobre madera: el caso peor
    "casco_caballero":"rembg:isnet-general-use",
    "coche":          "white",
    "poli":           "white",
    "ladron":         "white",
}

_sessions = {}
def _rembg(img_rgb, modelo):
    from rembg import remove, new_session
    if modelo not in _sessions:
        _sessions[modelo] = new_session(modelo)
    im = Image.fromarray(img_rgb)
    out = remove(im, session=_sessions[modelo],
                 alpha_matting=True, alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=15, alpha_matting_erode_size=3)
    return np.array(out.convert("RGBA"))[:, :, 3]


def _grabcut(img_rgb, mborde=0.12):
    h, w = img_rgb.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    bx, by = int(w * mborde), int(h * mborde)
    mask[by:h-by, bx:w-bx] = cv2.GC_PR_FGD          # interior = probable objeto
    cy0, cy1 = int(h*0.35), int(h*0.65)
    cx0, cx1 = int(w*0.35), int(w*0.65)
    mask[cy0:cy1, cx0:cx1] = cv2.GC_FGD             # semilla central = objeto seguro
    mask[0:2, :] = cv2.GC_BGD; mask[-2:, :] = cv2.GC_BGD
    mask[:, 0:2] = cv2.GC_BGD; mask[:, -2:] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img_rgb, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return np.full((h, w), 255, np.uint8)
    a = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    return a


def _white(img_rgb):
    # fondo blanco liso: no-blanco = objeto (incluye trazo negro y colores)
    g = img_rgb.min(axis=2).astype(np.int16)
    a = np.where(g < 235, 255, 0).astype(np.uint8)
    return a


def _componente_principal(a):
    """Se queda el componente conexo que contiene el centro (o el mayor)."""
    n, lab = cv2.connectedComponents((a > 127).astype(np.uint8))
    if n <= 1:
        return a
    h, w = a.shape
    centro = lab[h // 2, w // 2]
    if centro == 0:  # el centro es fondo: coge el mayor
        tam = [(lab == i).sum() for i in range(1, n)]
        centro = int(np.argmax(tam)) + 1
    return np.where(lab == centro, 255, 0).astype(np.uint8)


def _rellena_huecos(a):
    return (ndimage.binary_fill_holes(a > 127).astype(np.uint8)) * 255


def _limpia(a):
    """Morfologia pequena open/close para quitar motas y rebabas."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, k, iterations=1)
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, k, iterations=2)
    return a


def _decontamina(rgb, a):
    """Erosiona 1 px el alfa y sustituye el color del borde por el del interior
    mas cercano (quita el halo claro/oscuro del fondo)."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    interior = cv2.erode(a, k, iterations=1)
    borde = (a > 127) & (interior <= 127)
    if borde.any():
        src = (interior > 127)
        if src.any():
            idx = ndimage.distance_transform_edt(~src, return_distances=False,
                                                 return_indices=True)
            rgb = rgb.copy()
            for c in range(3):
                ch = rgb[:, :, c]
                ch[borde] = ch[idx[0][borde], idx[1][borde]]
                rgb[:, :, c] = ch
    return rgb, a


def _feather(a, px=1.2):
    im = Image.fromarray(a).filter(ImageFilter.GaussianBlur(px))
    return np.array(im)


def procesa(clave):
    ref, (x0, y0, x1, y1) = CAJAS[clave]
    src = np.array(Image.open(ref).convert("RGB"))
    rgb = src[y0:y1, x0:x1].copy()
    tec = TECNICA[clave]
    if tec.startswith("rembg:"):
        a = _rembg(rgb, tec.split(":", 1)[1])
    elif tec == "grabcut":
        a = _grabcut(rgb)
    else:
        a = _white(rgb)

    a = _limpia(a)
    a = _componente_principal(a)
    a = _rellena_huecos(a)
    a = _limpia(a)
    a = _componente_principal(a)
    rgb, a = _decontamina(rgb, a)
    a = _feather(a, 1.2)

    # recorte a la caja minima del alfa + 2 px de margen transparente
    ys, xs = np.where(a > 20)
    if len(xs) == 0:
        raise RuntimeError(f"{clave}: alfa vacio")
    m = 2
    yy0, yy1 = max(0, ys.min()-m), min(a.shape[0], ys.max()+1+m)
    xx0, xx1 = max(0, xs.min()-m), min(a.shape[1], xs.max()+1+m)
    rgb = rgb[yy0:yy1, xx0:xx1]; a = a[yy0:yy1, xx0:xx1]

    # resolucion objetivo: ~340 px de alto, sin pasar de 2x el original (Lanczos)
    h = rgb.shape[0]
    obj = 340
    esc = min(obj / h, 2.0)
    if esc > 1.01:
        nw, nh = int(rgb.shape[1]*esc), int(h*esc)
        rgb = np.array(Image.fromarray(rgb).resize((nw, nh), Image.LANCZOS))
        a = np.array(Image.fromarray(a).resize((nw, nh), Image.LANCZOS))

    rgba = np.dstack([rgb, a])
    out = Image.fromarray(rgba, "RGBA")
    out.save(os.path.join(OUT, f"{clave}.webp"), "WEBP", quality=90, method=6)
    out.save(os.path.join(DBG, f"{clave}.png"))
    return out.size, _qa(a)


def _qa(a):
    """Comprobaciones automaticas: % de pixeles de borde con alfa, nº de
    componentes conexos y si el alfa es todo opaco (fondo sin quitar)."""
    b = a > 127
    borde = np.concatenate([b[0], b[-1], b[:, 0], b[:, -1]])
    pct_borde = 100.0 * borde.mean()
    n, _ = cv2.connectedComponents(b.astype(np.uint8))
    todo = 100.0 * b.mean()
    return dict(pct_borde=round(pct_borde, 1), comp=n-1, pct_opaco=round(todo, 1))


def mortadelo():
    """Mortadelo original ya tiene alfa; se limpia ruido y se re-exporta."""
    im = Image.open(MOR).convert("RGBA")
    arr = np.array(im)
    a = arr[:, :, 3]
    a = np.where(a > 40, a, 0).astype(np.uint8)
    a = _componente_principal(np.where(a > 127, 255, 0).astype(np.uint8)) & a
    ys, xs = np.where(a > 20)
    m = 2
    y0, y1 = max(0, ys.min()-m), min(a.shape[0], ys.max()+1+m)
    x0, x1 = max(0, xs.min()-m), min(a.shape[1], xs.max()+1+m)
    arr = arr[y0:y1, x0:x1]; arr[:, :, 3] = a[y0:y1, x0:x1]
    Image.fromarray(arr, "RGBA").save(os.path.join(OUT, "mortadelo.webp"),
                                      "WEBP", quality=92, method=6)
    Image.fromarray(arr, "RGBA").save(os.path.join(DBG, "mortadelo.png"))
    return (x1-x0, y1-y0)


def hoja_contactos(path, bg):
    claves = list(CAJAS) + ["mortadelo"]
    cols = 5
    cel = 220
    rows = (len(claves) + cols - 1) // cols
    sheet = Image.new("RGB", (cols*cel, rows*cel), bg)
    for i, k in enumerate(claves):
        sp = Image.open(os.path.join(DBG, f"{k}.png")).convert("RGBA")
        sc = min((cel-30)/sp.width, (cel-30)/sp.height)
        sp = sp.resize((int(sp.width*sc), int(sp.height*sc)), Image.LANCZOS)
        cx = (i % cols)*cel + (cel - sp.width)//2
        cy = (i // cols)*cel + (cel - sp.height)//2
        sheet.paste(sp, (cx, cy), sp)
    sheet.save(path)


if __name__ == "__main__":
    print("sprite            tam(px)      %borde comp %opaco")
    for k in CAJAS:
        size, qa = procesa(k)
        print(f"{k:16s} {str(size):12s} {qa['pct_borde']:5}  {qa['comp']:3}  {qa['pct_opaco']:5}")
    ms = mortadelo()
    print(f"{'mortadelo':16s} {str(ms)}")
    hoja_contactos("/tmp/sprites_v2_final.png", (0x3a, 0x2a, 0x1c))
    hoja_contactos("/tmp/sprites_v2_final_azul.png", (0x10, 0x1a, 0x33))
    print("hojas: /tmp/sprites_v2_final.png  /tmp/sprites_v2_final_azul.png")
