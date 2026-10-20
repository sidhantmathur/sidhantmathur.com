"use client";

import { useEffect, useRef, useState } from "react";

// Ambient backdrop: the wave of tiny glyphs behind the conversation column.
//
// One committed image (public/ambient-wave.avif) animated by a small fragment
// shader: every pixel comes from the image, the shader only displaces and
// lights it, so it loops seamlessly at no extra bytes.
//
// Shown under the empty state and during idle mode (docs/idea-decisions.md
// #14), faded out while a conversation is on screen. It stays behind the
// conversation via the legibility scrim and pointer-events-none. Reduced
// motion, a narrow screen or no WebGL falls back to the static <img>.

const IMAGE_ASPECT = 1792 / 1024;
const FRAME_MS = 33; // ~30fps — a slow sweep gains nothing from 60
// Must match the fade duration on the wrapper below. The shader keeps running
// for this long after `visible` goes false, so the canvas isn't swapped for a
// still frame of a different phase halfway through the fade.
const FADE_MS = 1000;

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Long waves travel across the field displacing it like water, and a soft
// crest of light rides each wave in phase. The crest is multiplicative, so
// dark stays dark. One motion only: two would fight and neither would read.
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
  float ph = uv.x * 4.0 - m * 0.28;
  float y = 0.018 * sin(ph) + 0.009 * sin(uv.x * 9.0 - m * 0.44 + 1.7);
  vec3 c = texture2D(t, uv + vec2(0.0, y)).rgb;
  float crest = 1.0
    + 0.22 * cos(ph)
    + 0.08 * sin(uv.x * 7.0 - m * 0.36 + uv.y * 2.0);
  gl_FragColor = vec4(c * max(crest, 0.3), 1.0);
}
`;

export function AmbientBackdrop({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Static until the shader proves it can run; flipping to true swaps the
  // canvas in over the img, which has the same fit and opacity classes.
  const [live, setLive] = useState(false);

  // The shader outlives `visible` by one fade, so teardown never lands
  // mid-transition. See FADE_MS.
  const [running, setRunning] = useState(visible);
  // Turning on is immediate (adjusted during render); turning off waits out
  // the fade.
  if (visible && !running) setRunning(true);
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => setRunning(false), FADE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  // Below md the 78% scrim covers the whole width and the motion is barely
  // perceptible, so phones get the static img rather than a canvas redrawing
  // on battery.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Torn down once the backdrop has faded out, so a hidden backdrop spends
  // nothing; the img underneath covers the gap while the shader recompiles.
  useEffect(() => {
    if (!running || !wide) return;
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
  }, [running, wide]);

  // Mount at opacity 0 and fade in on the next frame. Besides avoiding a snap,
  // this keeps the decorative texture from being reported as the page's
  // largest contentful paint in place of the headline. Reduced motion
  // collapses the fade via the global rule in globals.css.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // A frame, not a microtask: the transition only runs if the opacity-0
    // state has painted, and a microtask lands before that paint.
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
        visible && entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0">
        {/* Two encodings. Downscaling turns the glyphs to noise below
            ~1400px, so desktop keeps the full 242 KB file the shader samples;
            phones sit under a 78% scrim, where the 900px crop (68 KB) looks
            the same. `sizes` is the true slot, 100vw: a narrower value makes a
            DPR-2 phone ask for more pixels than the crop has and fetch the
            original. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed
            decorative backdrop; next/image adds nothing here */}
        <img
          src="/ambient-wave.avif"
          srcSet="/ambient-wave-sm.avif 900w, /ambient-wave.avif 1792w"
          sizes="100vw"
          alt=""
          decoding="async"
          // A large image near the top of the viewport looks important to the
          // browser's heuristic; nothing should queue behind this one.
          fetchPriority="low"
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
      <div className="absolute inset-0 bg-bg/78 md:hidden" />
      {/* The stops derive from --bg rather than repeating its hex, so the
          scrim can't drift away from the page behind it. */}
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background: `linear-gradient(90deg,
            color-mix(in srgb, var(--bg) 10%, transparent) 0%,
            color-mix(in srgb, var(--bg) 72%, transparent) 30%,
            color-mix(in srgb, var(--bg) 72%, transparent) 70%,
            color-mix(in srgb, var(--bg) 10%, transparent) 100%)`,
        }}
      />
    </div>
  );
}
