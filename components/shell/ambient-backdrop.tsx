"use client";

import { useEffect, useRef, useState } from "react";

// Ambient backdrop — the wave of tiny glyphs behind the conversation column.
//
// One committed image (public/ambient-wave.avif, generated once with an image
// model in the site's own palette), animated by a small fragment shader: the
// glow sweeps slowly across the texture and the field breathes by a fraction
// of a glyph, but every pixel comes from that image. Image-to-video models
// were tried and redrew the texture into something else, which missed the
// point — the shader is the only way to animate *this exact image*, it loops
// seamlessly forever, and it costs no extra bytes.
//
// It extends idle mode (#14): under the empty state, back during idle, faded
// out while a conversation is on screen. The instrumentation policy line
// holds — ambient around the conversation, never in front of it — via the
// legibility scrim over the centre column and pointer-events-none throughout.
//
// Fallback order: reduced motion or no WebGL → the plain <img>, static.

const IMAGE_ASPECT = 1792 / 1024;
const FRAME_MS = 33; // ~30fps — a slow sweep gains nothing from 60

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// The sweep is multiplicative, so dark stays dark and only the lit glyphs
// swell; the warp is under half a glyph cell, so characters shimmer without
// visibly swimming.
const FRAG = `
precision mediump float;
uniform sampler2D t;
uniform vec2 r;
uniform float m;
void main() {
  vec2 uv = gl_FragCoord.xy / r;
  uv.y = 1.0 - uv.y;
  vec2 st = uv - 0.5;
  float ca = r.x / r.y;
  float ia = ${IMAGE_ASPECT.toFixed(4)};
  if (ca > ia) { st.y *= ia / ca; } else { st.x *= ca / ia; }
  uv = st + 0.5;
  vec2 w = vec2(
    sin(uv.y * 8.0 + m * 0.26) + 0.6 * sin(uv.y * 17.0 - m * 0.15),
    sin(uv.x * 9.0 - m * 0.21) + 0.6 * sin(uv.x * 15.0 + m * 0.12)
  ) * 0.0038;
  vec3 c = texture2D(t, uv + w).rgb;
  float sweep = 1.0
    + 0.24 * sin(uv.x * 5.0 - m * 0.55 + 1.5 * sin(uv.y * 3.0 + m * 0.18))
    + 0.10 * sin(uv.x * 11.0 + m * 0.34 + uv.y * 4.0);
  gl_FragColor = vec4(c * sweep, 1.0);
}
`;

export function AmbientBackdrop({ visible }: { visible: boolean }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Static until the shader proves it can run; flipping to true swaps the
  // canvas in over the img, which has the same fit and opacity classes.
  const [live, setLive] = useState(false);

  // Pointer parallax — a few pixels on the whole layer, shader or not.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = layerRef.current;
    if (!layer) return;

    function onMove(e: PointerEvent) {
      if (!layer) return;
      const dx = (e.clientX / window.innerWidth - 0.5) * 14;
      const dy = (e.clientY / window.innerHeight - 0.5) * 8;
      layer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // The shader. Torn down whenever the backdrop is faded out so a hidden
  // homepage tab spends nothing; the img underneath covers the gap on the
  // way back in while the first frame compiles.
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    let raf = 0;
    let disposed = false;

    function compile(kind: number, src: string): WebGLShader | null {
      if (!gl) return null;
      const s = gl.createShader(kind);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "r");
    const uTime = gl.getUniformLocation(prog, "m");

    const img = new Image();
    img.src = "/ambient-wave.avif";
    img.decode().then(() => {
      if (disposed) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      let last = 0;
      function frame(now: number) {
        if (disposed || !gl || !canvas) return;
        raf = requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.round(canvas.clientWidth * dpr);
        const h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, now / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
      setLive(true);
    }).catch(() => {
      /* img fallback stays up */
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      setLive(false);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [visible]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Bled past the edges so the parallax never shows a seam. */}
      <div
        ref={layerRef}
        className="absolute -inset-8 transition-transform duration-700 ease-out will-change-transform"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed
            decorative backdrop; next/image's wrapper would fight the
            parallax transform */}
        <img
          src="/ambient-wave.avif"
          alt=""
          decoding="async"
          className={`ambient-drift h-full w-full object-cover opacity-35 md:opacity-50 ${
            live ? "hidden" : ""
          }`}
        />
        <canvas
          ref={canvasRef}
          className={`h-full w-full opacity-35 md:opacity-50 ${
            live ? "" : "hidden"
          }`}
        />
      </div>
      {/* Legibility scrim: the texture keeps the margins, the words keep the
          middle. On small screens the column is the whole width, so the flat
          mobile scrim is heavier and the shaped one takes over from md up. */}
      <div className="absolute inset-0 bg-bg/55 md:hidden" />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(11,10,9,0.1) 0%, rgba(11,10,9,0.72) 30%, rgba(11,10,9,0.72) 70%, rgba(11,10,9,0.1) 100%)",
        }}
      />
    </div>
  );
}
