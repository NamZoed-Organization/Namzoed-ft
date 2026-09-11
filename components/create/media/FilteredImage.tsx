/**
 * One shader, two jobs: what you see while sliding, and what gets exported.
 *
 * The preview and the export **must** be the same arithmetic — an editor
 * whose output differs from the thing on screen is the one bug an editor
 * cannot have — so both go through `FRAGMENT` below. On screen it renders
 * into a `GLView`; on export it renders into a headless context at full
 * size and is snapshotted to a file. Nothing about the maths differs
 * between them, only where the pixels land.
 *
 * Why GL at all: React Native has no blend modes and no colour matrix, so
 * the usual trick — a tinted `View` laid over the picture at some opacity —
 * can fake exactly one of these controls (a tint) and none of the rest.
 * Saturation, contrast around mid-grey, an unsharp mask and a vignette all
 * need the pixels, and `expo-gl` is already in the app.
 */

import {
  resolveColor,
  type ColorAdjust,
  type ImageEdit,
} from "@/lib/mediaEdit";
import { Asset } from "expo-asset";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import React, { useCallback, useRef } from "react";
import { type StyleProp, type ViewStyle } from "react-native";

const VERTEX = `
precision highp float;
attribute vec2 position;
varying vec2 uv;
void main () {
  // Y is flipped: GL's origin is bottom-left and a decoded image's is
  // top-left, so sampling straight through renders it upside down.
  uv = vec2((position.x + 1.0) / 2.0, (1.0 - position.y) / 2.0);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * The order matters and is the conventional one: exposure, then contrast
 * around mid-grey, then white balance, then saturation, then the graded
 * tint, then the vignette. Sharpening last, against a small box blur —
 * sharpening before a contrast lift amplifies the halo it creates.
 *
 * `intensity` is applied at the very end as a blend against the untouched
 * pixel, which is what makes one slider able to dial a whole preset back
 * without unwinding each control separately.
 */
const FRAGMENT = `
precision highp float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 texel;
uniform float brightness;
uniform float contrast;
uniform float saturation;
uniform float warmth;
uniform float vignette;
uniform float sharpen;
uniform vec3 tint;
uniform float tintAmount;
uniform float intensity;

void main () {
  vec4 src = texture2D(tex, uv);
  vec3 c = src.rgb;

  c += brightness;
  c = (c - 0.5) * (1.0 + contrast) + 0.5;

  c.r += warmth * 0.09;
  c.b -= warmth * 0.09;

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, 1.0 + saturation);

  c = mix(c, tint, tintAmount);

  if (sharpen > 0.001) {
    vec3 blur = (
      texture2D(tex, uv + vec2(texel.x, 0.0)).rgb +
      texture2D(tex, uv - vec2(texel.x, 0.0)).rgb +
      texture2D(tex, uv + vec2(0.0, texel.y)).rgb +
      texture2D(tex, uv - vec2(0.0, texel.y)).rgb
    ) * 0.25;
    c += (c - blur) * sharpen * 1.6;
  }

  float d = distance(uv, vec2(0.5, 0.5));
  c *= 1.0 - vignette * smoothstep(0.32, 0.92, d);

  c = clamp(c, 0.0, 1.0);
  gl_FragColor = vec4(mix(src.rgb, c, intensity), src.a);
}`;

interface ColorParams {
  adjust: ColorAdjust;
  tint: [number, number, number];
  tintAmount: number;
  /** The preset's own strength is already folded into `adjust`; this is the
   *  final blend against the original, so a filter can be dialled back. */
  intensity: number;
}

export const paramsFor = (edit: ImageEdit): ColorParams => {
  const { adjust, tint, tintAmount } = resolveColor(edit);
  return { adjust, tint, tintAmount, intensity: 1 };
};

const compile = (gl: ExpoWebGLRenderingContext) => {
  const vert = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vert, VERTEX);
  gl.compileShader(vert);
  const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(frag, FRAGMENT);
  gl.compileShader(frag);

  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.useProgram(program);

  // Two triangles covering the clip space — there is no geometry here
  // beyond "the whole picture".
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return program;
};

const uploadTexture = async (
  gl: ExpoWebGLRenderingContext,
  uri: string,
): Promise<{ width: number; height: number }> => {
  const asset = Asset.fromURI(uri);
  await asset.downloadAsync();

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // CLAMP_TO_EDGE and LINEAR, because the sharpen pass samples one texel
  // outside the frame at the border and a repeat would fold the far edge in.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    asset as any,
  );
  return { width: asset.width ?? 1, height: asset.height ?? 1 };
};

const setUniforms = (
  gl: ExpoWebGLRenderingContext,
  program: WebGLProgram,
  p: ColorParams,
  size: { width: number; height: number },
) => {
  const u = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1f(u("brightness"), p.adjust.brightness);
  gl.uniform1f(u("contrast"), p.adjust.contrast);
  gl.uniform1f(u("saturation"), p.adjust.saturation);
  gl.uniform1f(u("warmth"), p.adjust.warmth);
  gl.uniform1f(u("vignette"), p.adjust.vignette);
  gl.uniform1f(u("sharpen"), p.adjust.sharpen);
  gl.uniform3f(u("tint"), p.tint[0], p.tint[1], p.tint[2]);
  gl.uniform1f(u("tintAmount"), p.tintAmount);
  gl.uniform1f(u("intensity"), p.intensity);
  gl.uniform2f(
    u("texel"),
    1 / Math.max(1, size.width),
    1 / Math.max(1, size.height),
  );
  gl.uniform1i(u("tex"), 0);
};

/**
 * The live preview.
 *
 * Re-renders on every parameter change, which is a full-frame draw of one
 * quad — cheap enough to sit under a slider being dragged, and the reason
 * the sliders can be continuous rather than stepped.
 */
export default function FilteredImage({
  uri,
  params,
  style,
  onReady,
}: {
  uri: string;
  params: ColorParams;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
}) {
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const draw = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    setUniforms(gl, program, paramsRef.current, sizeRef.current);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.flush();
    gl.endFrameEXP();
  }, []);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;
      programRef.current = compile(gl);
      sizeRef.current = await uploadTexture(gl, uri);
      draw();
      onReady?.();
    },
    [draw, onReady, uri],
  );

  // A prop change is a redraw, not a remount: recreating the context would
  // re-decode and re-upload the picture on every slider tick.
  React.useEffect(() => {
    draw();
  }, [draw, params]);

  return <GLView style={style} onContextCreate={onContextCreate} />;
}

/**
 * The same shader, off screen, at whatever size the export wants.
 *
 * A headless context rather than a snapshot of the on-screen view, because
 * the on-screen view is only as big as the phone: snapshotting it would
 * publish a 390pt-wide picture from a 4000px original. This renders the
 * full-size texture and writes a file.
 */
export const renderColorPass = async (
  uri: string,
  params: ColorParams,
  maxSide = 1440,
): Promise<string> => {
  const gl = await GLView.createContextAsync();
  const program = compile(gl);
  const size = await uploadTexture(gl, uri);

  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));

  gl.viewport(0, 0, width, height);
  setUniforms(gl, program, params, size);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.flush();
  gl.endFrameEXP();

  const snapshot = await GLView.takeSnapshotAsync(gl, {
    format: "jpeg",
    compress: 0.92,
    rect: { x: 0, y: 0, width, height },
  });
  const out = snapshot.uri;
  return typeof out === "string" ? out : String((out as any)?.uri ?? "");
};
