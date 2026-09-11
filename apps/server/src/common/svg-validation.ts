import { UnprocessableEntityException } from '@nestjs/common';
import { TextDecoder } from 'node:util';
import saxModule = require('sax');

interface SvgAttribute {
  local: string;
  uri: string;
  value: string;
}

interface SvgNode {
  local: string;
  uri: string;
  attributes: Record<string, SvgAttribute>;
}

interface SvgParser {
  onopentag: (node: SvgNode) => void;
  onclosetag: () => void;
  ondoctype: () => void;
  onprocessinginstruction: (instruction: {
    name: string;
    body: string;
  }) => void;
  onerror: () => void;
  write: (text: string) => SvgParser;
  close: () => SvgParser;
}

const sax = saxModule as {
  parser: (strict: boolean, options: { xmlns: boolean }) => SvgParser;
};

const svgNamespace = 'http://www.w3.org/2000/svg';
const xlinkNamespace = 'http://www.w3.org/1999/xlink';
const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
const xmlnsNamespace = 'http://www.w3.org/2000/xmlns/';
const elements = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'use',
  'symbol',
  'view',
  'clipPath',
  'mask',
  'pattern',
  'marker',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
]);
const styleProperties = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'display',
  'visibility',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'text-decoration',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'clip-path',
  'clip-rule',
  'mask',
  'filter',
  'stop-color',
  'stop-opacity',
  'flood-color',
  'flood-opacity',
  'lighting-color',
  'color-interpolation',
  'color-interpolation-filters',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  'text-rendering',
  'transform',
  'transform-origin',
]);
const fragment = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;

function rejectSvg(): never {
  throw new UnprocessableEntityException(
    'SVG 仅支持静态图形与内联样式，不允许脚本、事件、外链、样式表、嵌入文档或 DTD',
  );
}

function assertSafeValue(value: string) {
  if (/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
    rejectSvg();
  if (
    /@|\/\*|\*\/|(?:javascript|vbscript|data|https?|file):|\/\/|expression\s*\(/i.test(
      value,
    )
  )
    rejectSvg();
  const remaining = value.replace(
    /url\s*\(([^)]*)\)/gi,
    (_match, reference: string) => {
      const target = reference.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!fragment.test(target)) rejectSvg();
      return '';
    },
  );
  if (/url\s*\(/i.test(remaining)) rejectSvg();
}

export function assertSafeSvg(bytes: Buffer): void {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new UnprocessableEntityException('SVG 必须使用有效的 UTF-8 编码');
  }

  const parser = sax.parser(true, { xmlns: true });
  let depth = 0;
  let count = 0;
  let rootSeen = false;
  parser.onerror = rejectSvg;
  parser.ondoctype = rejectSvg;
  parser.onprocessinginstruction = ({ name, body }) => {
    if (name !== 'xml' || /encoding\s*=\s*['"](?!utf-8['"])/i.test(body))
      rejectSvg();
  };
  parser.onopentag = (node) => {
    if (!depth) {
      if (rootSeen || node.local !== 'svg') rejectSvg();
      rootSeen = true;
    }
    if (++depth > 64 || ++count > 10000) rejectSvg();
    if (node.uri !== svgNamespace || !elements.has(node.local)) rejectSvg();

    for (const attribute of Object.values(node.attributes)) {
      const name = attribute.local.toLowerCase();
      if (attribute.uri === xmlnsNamespace) {
        if (
          ![svgNamespace, xlinkNamespace, xmlNamespace].includes(
            attribute.value,
          )
        )
          rejectSvg();
        continue;
      }
      if (
        attribute.uri &&
        attribute.uri !== xlinkNamespace &&
        attribute.uri !== xmlNamespace
      )
        rejectSvg();
      if (name.startsWith('on') || ['base', 'src'].includes(name)) rejectSvg();
      if (name === 'href' && !fragment.test(attribute.value.trim()))
        rejectSvg();
      assertSafeValue(attribute.value);
      if (name === 'style') {
        for (const declaration of attribute.value
          .split(';')
          .filter((part) => part.trim())) {
          const separator = declaration.indexOf(':');
          if (
            separator < 1 ||
            !styleProperties.has(
              declaration.slice(0, separator).trim().toLowerCase(),
            )
          )
            rejectSvg();
        }
      }
    }
  };
  parser.onclosetag = () => {
    depth -= 1;
  };
  parser.write(text).close();
  if (!rootSeen || depth !== 0) rejectSvg();
}
