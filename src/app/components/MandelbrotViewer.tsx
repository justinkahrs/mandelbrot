"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { gsap } from "gsap";

export default function MandelbrotViewer() {
  /**
   * A WebGL-based Mandelbrot renderer.
   *
   * Key steps:
   * 1) We create a fullscreen quad in the vertex shader.
   * 2) In the fragment shader, each fragment maps its (x,y) screen coordinates
   *    to the complex plane, using the current center and scale (zoom).
   * 3) We iterate z_{n+1} = z_n^2 + c up to 'uMaxIter' times to determine if c (the pixel) is inside the set.
   * 4) If the magnitude of z escapes beyond 2.0 before hitting max iteration, we color the pixel based on iteration count.
   * 5) Otherwise, we color it black (inside).
   * 6) We animate the scale and hue shift using GSAP to demonstrate the fractal detail.
   *
   * Note: Since we're redrawing each frame, there's no extra memory to flush.
   * The key for performance is to limit numeric extremes and iteration cost.
   */

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // We'll animate these via GSAP
  const [hueShift, setHueShift] = useState(0);
  const [scale, setScale] = useState(100);

  const center = useMemo(() => ({ x: -0.7491, y: 0.1 }), []);
  const colorSpeed = 0.1;
  const zoomSpeed = 1.005;

  // Make the canvas fill the screen
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl") as WebGLRenderingContext;
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    /**************************************************************
     * Vertex Shader
     * Positions a full-screen quad from (-1,-1) to (1,1).
     **************************************************************/
    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    /**************************************************************
     * Fragment Shader
     *  - Maps screen coordinates to the complex plane.
     *  - Iterates z_{n+1} = z_n^2 + c to determine if c is inside/outside.
     *  - Colors points outside by iteration-based hue and inside as black.
     **************************************************************/
    const fragmentShaderSource = `
      precision highp float;

      // Uniforms supplied from JS
      uniform float uScale;       // Similar to "zoom" factor
      uniform float uHueShift;
      uniform vec2  uResolution;  // Canvas width/height
      uniform vec2  uCenter;      // Center point in complex plane
      uniform int   uMaxIter;     // Maximum number of iterations

      // The base width in the complex plane that corresponds to screen width,
      // e.g. 3.5 is a common default for the full fractal at scale=1.
      const float baseWidth = 3.5;

      // Helper function: convert HSL to RGB
      float hue2rgb(float p, float q, float t) {
          if(t < 0.0) t += 1.0;
          if(t > 1.0) t -= 1.0;
          if(t < 1.0/6.0) return p + (q - p) * 6.0 * t;
          if(t < 1.0/2.0) return q;
          if(t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
          return p;
      }
      vec3 hsl2rgb(float h, float s, float l) {
          float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
          float p = 2.0 * l - q;
          float r = hue2rgb(p, q, h + 1.0/3.0);
          float g = hue2rgb(p, q, h);
          float b = hue2rgb(p, q, h - 1.0/3.0);
          return vec3(r, g, b);
      }

      void main() {
        // 1) Maintain a consistent aspect ratio:
        float aspect = uResolution.y / uResolution.x;

        // 2) Compute how wide the fractal region is based on 'uScale'.
        float w = baseWidth / uScale;
        float h = w * aspect;

        // 3) Determine the min and max in the x and y directions in the complex plane
        float xMin = uCenter.x - w / 2.0;
        float xMax = uCenter.x + w / 2.0;
        float yMin = uCenter.y - h / 2.0;
        float yMax = uCenter.y + h / 2.0;

        // 4) Convert gl_FragCoord to the complex plane
        float x0 = xMin + (gl_FragCoord.x / uResolution.x) * (xMax - xMin);
        float y0 = yMin + (gl_FragCoord.y / uResolution.y) * (yMax - yMin);

        // Initialize z = 0
        float x = 0.0;
        float y = 0.0;
        int iter = 0;

        // 5) Iterate z_{n+1} = z_n^2 + c
        for(int i = 0; i < 20000; i++) {
          if(i >= uMaxIter) {
            break;
          }
          float xTemp = x*x - y*y + x0;
          y = 2.0*x*y + y0;
          x = xTemp;

          if(x*x + y*y > 4.0) {
            iter = i;
            break;
          }
        }

        // 6) Color
        if(iter == uMaxIter) {
          // Inside
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          // Outside
          float ratio = float(iter) / float(uMaxIter);
          float hue = mod(ratio * 360.0 + uHueShift, 360.0) / 360.0;
          vec3 color = hsl2rgb(hue, 1.0, 0.5);
          gl_FragColor = vec4(color, 1.0);
        }
      }
    `;

    // Utility to compile a shader
    function compileShader(source: string, type: number) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Failed to create shader.");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Could not compile shader: ${info}`);
      }
      return shader;
    }

    // Utility to create a program
    function createProgram(vsSource: string, fsSource: string) {
      const vShader = compileShader(vsSource, gl.VERTEX_SHADER);
      const fShader = compileShader(fsSource, gl.FRAGMENT_SHADER);
      const program = gl.createProgram();
      if (!program) throw new Error("Failed to create program.");
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Could not link program: ${info}`);
      }
      return program;
    }

    const program = createProgram(vertexShaderSource, fragmentShaderSource);

    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    const uResolutionLoc = gl.getUniformLocation(program, "uResolution");
    const uScaleLoc = gl.getUniformLocation(program, "uScale");
    const uHueShiftLoc = gl.getUniformLocation(program, "uHueShift");
    const uCenterLoc = gl.getUniformLocation(program, "uCenter");
    const uMaxIterLoc = gl.getUniformLocation(program, "uMaxIter");

    // Fullscreen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // We'll store the fractal center in state for animation

    let animationId: number;
    function render() {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      if (canvas) {
        gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      } else {
        console.error("Canvas is null.");
      }
      gl.uniform1f(uScaleLoc, scale);
      gl.uniform1f(uHueShiftLoc, hueShift);
      gl.uniform2f(uCenterLoc, center.x, center.y);
      const dynamicMaxIter = Math.floor(500 + 100 * Math.log(scale));
      gl.uniform1i(uMaxIterLoc, dynamicMaxIter);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationId = requestAnimationFrame(render);
    }
    render();

    return () => {
      cancelAnimationFrame(animationId);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [center, hueShift, scale]);

  // Animate hueShift and scale with GSAP
  useEffect(() => {
    // Hue shift just for color variety
    const hueTween = gsap.to(
      {},
      {
        duration: 100,
        repeat: -1,
        onUpdate: () => setHueShift((prev) => (prev + colorSpeed) % 360),
      }
    );

    // We'll limit scale growth. Let's define a max scale:
    const MAX_SCALE = 1.0e6;

    // When scale hits that limit, we'll reset it back to 1 and optionally shift
    // the center so we see "new" patterns, but avoid numeric extremes.
    const scaleTween = gsap.to(
      {},
      {
        duration: 60,
        repeat: -1,
        onUpdate: () => {
          setScale((prev) => {
            let newScale = prev * zoomSpeed;
            if (newScale >= MAX_SCALE) {
              newScale = 1.0;
            }
            return newScale;
          });
        },
      }
    );

    return () => {
      hueTween.kill();
      scaleTween.kill();
    };
  }, []);

  return <canvas ref={canvasRef} />;
}
