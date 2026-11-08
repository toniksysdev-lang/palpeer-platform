// Converts the inline CSS used by the Palpeer design into React Native style objects.
// Used two ways: by tools/convert.mjs at build time (static styles become plain objects
// in the generated screens) and at runtime by css() for styles that contain live values.
//
// A few keys are private to the runtime and never reach React Native directly:
//   _lhMul    unitless CSS line-height (multiplied by the font size in <T>)
//   _display  'flex' | 'grid' | 'block' | 'none' (layout model of the element)
//   _cols     grid column count for repeat(N, minmax(0, 1fr))
//   _nowrap   white-space: nowrap
//   _scroll   'y' | 'x' when the element scrolls
//   _objectFit image fit

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

function num(v) {
  v = String(v).trim();
  if (v === 'auto') return 'auto';
  if (/%$/.test(v)) return v;
  const m = /^(-?[\d.]+)(px)?$/.exec(v);
  if (m) return parseFloat(m[1]);
  return v;
}

function boxSides(prefix, value, out) {
  const parts = String(value).trim().split(/\s+/).map(num);
  const [t, r = t, b = t, l = r] = parts;
  const vals = [t, r, b, l];
  SIDES.forEach((s, i) => { out[prefix + s] = vals[i]; });
}

function parseBorder(value) {
  const v = String(value).trim();
  if (v === '0' || v === 'none' || v === '0px') return { width: 0 };
  const out = {};
  v.split(/\s+(?![^(]*\))/).forEach((p) => {
    if (/^-?[\d.]+(px)?$/.test(p)) out.width = parseFloat(p);
    else if (/^(solid|dashed|dotted|double|none)$/.test(p)) out.style = p === 'double' ? 'solid' : p;
    else out.color = p;
  });
  if (out.width == null && out.style && out.style !== 'none') out.width = 3; // CSS "medium"
  if (out.style === 'none') out.width = 0;
  return out;
}

function parseFlex(v, out) {
  const parts = String(v).trim().split(/\s+/);
  if (parts.length === 1) {
    if (parts[0] === 'none') { out.flexGrow = 0; out.flexShrink = 0; return; }
    if (parts[0] === 'auto') { out.flexGrow = 1; out.flexShrink = 1; out.flexBasis = 'auto'; return; }
    out.flexGrow = parseFloat(parts[0]); out.flexShrink = 1; out.flexBasis = 0; return;
  }
  out.flexGrow = parseFloat(parts[0]);
  out.flexShrink = parseFloat(parts[1]);
  if (parts[2] != null) out.flexBasis = num(parts[2]);
}

const FONT_WEIGHTS = { normal: '400', bold: '700' };

export function cssToRN(text) {
  const out = {};
  if (!text) return out;
  // split on ; that are not inside parentheses
  const decls = String(text).split(/;(?![^(]*\))/);
  for (const d of decls) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const prop = d.slice(0, i).trim().toLowerCase();
    const value = d.slice(i + 1).trim().replace(/\s*!important$/, '');
    if (!prop || value === '') continue;
    switch (prop) {
      case 'display':
        if (value === 'flex' || value === 'inline-flex') out._display = 'flex';
        else if (value === 'grid' || value === 'inline-grid') out._display = 'grid';
        else if (value === 'none') out._display = 'none';
        else out._display = 'block';
        break;
      case 'flex-direction': out.flexDirection = value; break;
      case 'flex-wrap': out.flexWrap = value; break;
      case 'flex': parseFlex(value, out); break;
      case 'flex-grow': out.flexGrow = parseFloat(value); break;
      case 'flex-shrink': out.flexShrink = parseFloat(value); break;
      case 'flex-basis': out.flexBasis = num(value); break;
      case 'align-items': out.alignItems = value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : value; break;
      case 'align-self': out.alignSelf = value; break;
      case 'align-content': out.alignContent = value; break;
      case 'justify-content': out.justifyContent = value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : value; break;
      case 'gap': {
        const [r, c = r] = value.split(/\s+/).map(num);
        out.rowGap = r; out.columnGap = c; break;
      }
      case 'row-gap': out.rowGap = num(value); break;
      case 'column-gap': out.columnGap = num(value); break;
      case 'grid-template-columns': {
        const m = /repeat\(\s*(\d+)/.exec(value);
        out._cols = m ? parseInt(m[1], 10) : value.split(/\s+/).length;
        break;
      }
      case 'padding': boxSides('padding', value, out); break;
      case 'margin': boxSides('margin', value, out); break;
      case 'padding-top': case 'padding-right': case 'padding-bottom': case 'padding-left':
      case 'margin-top': case 'margin-right': case 'margin-bottom': case 'margin-left': {
        const [a, b] = prop.split('-');
        out[a + b[0].toUpperCase() + b.slice(1)] = num(value); break;
      }
      case 'width': case 'height': case 'min-width': case 'min-height': case 'max-width': case 'max-height':
      case 'top': case 'left': case 'right': case 'bottom': {
        if (value === 'auto' && (prop === 'width' || prop === 'height')) break;
        const key = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        out[key] = num(value); break;
      }
      case 'inset': {
        const parts = value.split(/\s+/).map(num);
        const [t, r = t, b = t, l = r] = parts;
        out.top = t; out.right = r; out.bottom = b; out.left = l; break;
      }
      case 'position': out.position = value === 'relative' || value === 'static' ? 'relative' : 'absolute'; break;
      case 'z-index': out.zIndex = parseInt(value, 10); break;
      case 'overflow':
        if (value === 'auto' || value === 'scroll') out._scroll = 'y';
        else out.overflow = value === 'visible' ? 'visible' : 'hidden';
        break;
      case 'overflow-y': if (value === 'auto' || value === 'scroll') out._scroll = 'y'; else if (value === 'hidden') out.overflow = 'hidden'; break;
      case 'overflow-x': if (value === 'auto' || value === 'scroll') out._scroll = 'x'; else if (value === 'hidden') out.overflow = 'hidden'; break;
      case 'background': case 'background-color':
        out.backgroundColor = value === 'none' ? 'transparent' : value; break;
      case 'color': out.color = value; break;
      case 'opacity': out.opacity = parseFloat(value); break;
      case 'border': case 'border-top': case 'border-right': case 'border-bottom': case 'border-left': {
        const b = parseBorder(value);
        const side = prop === 'border' ? '' : prop.slice(7, 8).toUpperCase() + prop.slice(8);
        if (b.width != null) out['border' + side + 'Width'] = b.width;
        if (b.color) out['border' + side + 'Color'] = b.color;
        if (b.style && !side) out.borderStyle = b.style;
        break;
      }
      case 'border-width': out.borderWidth = num(value); break;
      case 'border-color': out.borderColor = value; break;
      case 'border-style': out.borderStyle = value; break;
      case 'border-radius': {
        const parts = value.split(/\s+/).map(num);
        if (parts.length === 1) out.borderRadius = parts[0];
        else {
          const [tl, tr = tl, br = tl, bl = tr] = parts;
          out.borderTopLeftRadius = tl; out.borderTopRightRadius = tr;
          out.borderBottomRightRadius = br; out.borderBottomLeftRadius = bl;
        }
        break;
      }
      case 'box-shadow': if (value !== 'none') out.boxShadow = value; break;
      case 'font-size': out.fontSize = num(value); break;
      case 'font-weight': out.fontWeight = FONT_WEIGHTS[value] || String(value); break;
      case 'font-style': out.fontStyle = value; break;
      case 'font-family': out.fontFamily = value; break;
      case 'line-height': {
        if (/^[\d.]+$/.test(value)) out._lhMul = parseFloat(value);
        else if (/px$/.test(value)) out.lineHeight = parseFloat(value);
        else if (value === 'normal') out._lhMul = 1.36;
        break;
      }
      case 'letter-spacing': out.letterSpacing = num(value); break;
      case 'text-align': out.textAlign = value === 'start' ? 'left' : value === 'end' ? 'right' : value; break;
      case 'text-transform': out.textTransform = value; break;
      case 'text-decoration': case 'text-decoration-line':
        out.textDecorationLine = /underline/.test(value) ? 'underline' : /line-through/.test(value) ? 'line-through' : 'none';
        break;
      case 'white-space': if (value === 'nowrap') out._nowrap = true; break;
      case 'object-fit': out._objectFit = value; break;
      case 'aspect-ratio': out.aspectRatio = parseFloat(value.split('/')[0]) / (parseFloat(value.split('/')[1]) || 1); break;
      // ignored on native: box-sizing, cursor, overflow-wrap, transition, outline, etc.
      default: break;
    }
  }
  return out;
}

const cache = new Map();
// Runtime entry point for styles that contain live values.
export function css(text) {
  let s = cache.get(text);
  if (!s) {
    s = cssToRN(text);
    if (cache.size > 4000) cache.clear();
    cache.set(text, s);
  }
  return s;
}
