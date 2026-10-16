# Creditos y recursos externos

Uso NO comercial (proyecto de clase). Todo lo de terceros aqui esta vendorizado en local
(sin CDN en tiempo de ejecucion) y tiene licencia permisiva.

## Fuentes (vendorizadas en assets/)
- **Bangers** — Vernon Adams / Google Fonts. Licencia SIL Open Font License 1.1 (OFL).
  Uso: titulos y rotulos de comic. Fichero: `assets/bangers.ttf`.
- **Baloo 2** — Ek Type / Google Fonts. Licencia SIL Open Font License 1.1 (OFL).
  Uso: texto de interfaz. Fichero: `assets/baloo2.ttf`.

## Codigo
- Motor (`js/engine.js`): portado del codigo Python propio del repo (extension/). Sin dependencias.
- Render 2.5D, personajes, editor de construccion, simulacion y audio: escritos a mano con
  Canvas 2D y WebAudio. Sin librerias de render (Phaser/Pixi/Kaplay). Se evaluaron pero para una
  rejilla de 40x17 el canvas vanilla resulta mas limpio y ligero (cero vendorizado de JS).

## Arte (sprites en assets/sprites/)
- Los sprites (16 objetos robables, el ladron, el policia y el coche) se han RECORTADO de las
  imagenes de referencia que aporto David (extension/referencias/: estanteria de objetos, elenco
  de policia y ladron). Uso de clase, no comercial.
- Recorte: pipeline Python de un solo uso (PIL + numpy) para encuadrar cada objeto; el fondo se
  elimino con **rembg** (modelo isnet-general-use, MIT) y, en los objetos de poco contraste contra
  la madera de la estanteria, con un recorte por luminancia + alfa eliptico suave. Salida WebP con
  alfa, ~276 KB en total. El pipeline no vive en el repo (venv desechable en /tmp).
- Las animaciones de los personajes (balanceo, squash & stretch, volteo, saltitos, gotas de sudor,
  estrellitas, esposas) y los efectos de luz nocturna se dibujan por codigo (Canvas 2D) sobre esos
  sprites; no se descargo ni calco ninguna imagen con copyright.

## Herramientas (no se distribuyen con la web)
- **rembg** 2.x (Daniel Gatis) — MIT. Solo para recortar los sprites; no se vendoriza.
- **onnxruntime**, **Pillow**, **numpy** — para el recorte. No forman parte del despliegue.

## Sonido
- Efectos sintetizados en tiempo real con la Web Audio API (osciladores). Ningun fichero de audio.
