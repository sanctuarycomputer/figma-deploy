figma.showUI(__html__);

figma.ui.onmessage = msg => {
  if (msg.type === 'doit') {
    figma.ui.resize(1200, 600);
    figma.ui.postMessage(makeHTMLStringForFrame(topLevelFrames[0][0]))
    return;
  }

  figma.closePlugin();
};

/* UTILS */

const MARKDOWN_LINKS_PATTERN = /\[([^\[]+)\](\(.*\))/gm;

const kebabCase = s => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const camelCase = s => s.replace(/-([a-z])/g, (m, w) => w.toUpperCase());
const convertToKebabCase = str => {
  if (str.startsWith('@keyframes')) {
    return str;
  }

  const isFirstLetterCapitalized = /[A-Z]/.test(str[0]);
  const kebabed = isFirstLetterCapitalized
    ? `-${kebabCase(str)}`
    : kebabCase(str);

  // convert any strings inside brackets back to camelCase
  return kebabed.replace(/\[(.+?)\]/g, insideBrackets => {
    return camelCase(insideBrackets);
  });
};
const makeInlineStyles = (obj: object) => {
  return Object.keys(obj).map(k => `${convertToKebabCase(k)}:${obj[k]}`).join(';');
};

function colorString(color) {
  if (color.a) {
    return `rgba(${Math.round(color.r*255)}, ${Math.round(color.g*255)}, ${Math.round(color.b*255)}, ${color.a})`;
  }
  return `rgba(${Math.round(color.r*255)}, ${Math.round(color.g*255)}, ${Math.round(color.b*255)}, 1)`;
}

// function paintToLinearGradient(paint) {
//   const handles = paint.gradientHandlePositions;
//   const handle0 = handles[0];
//   const handle1 = handles[1];

//   const ydiff = handle1.y - handle0.y;
//   const xdiff = handle0.x - handle1.x;

//   const angle = Math.atan2(-xdiff, -ydiff);
//   const stops = paint.gradientStops.map((stop) => {
//     return `${colorString(stop.color)} ${Math.round(stop.position * 100)}%`;
//   }).join(', ');
//   return `linear-gradient(${angle}rad, ${stops})`;
// }


/* Find Top Level "Frames" in each Page that include a Markdown Link in their title: [Home Page](/) */
const topLevelFrames = figma.root.children.map((pageNode: PageNode) => {
  return pageNode.children.filter((sceneNode: SceneNode) => {
    return sceneNode.type === "FRAME" && sceneNode.name.match(MARKDOWN_LINKS_PATTERN);
  })
});

interface HTMLStyle {
  marginLeft?: string,
  marginRight?: string,
  marginTop?: string,
  marginBottom?: string,
  flexGrow?: number,
  width?: string,
  height?: string,
  minWidth?: string,
  minHeight?: string,
  justifyContent?: string,
  alignItems?: string,
  top?: string,
  opacity?: number,
  backgroundColor?: string,
  background?: string
}

const makeHTMLForRectangleNode = (node: RectangleNode) => {
  const parentNode = node.parent as SceneNode;
  let parentX: number = 0;
  let parentY: number = 0;
  switch (node.parent.type) {
    case "DOCUMENT":
    case "PAGE":
    case "SLICE":
    case "FRAME":
    case "GROUP":  
    case "COMPONENT": 
    case "INSTANCE":
      break;
    case "BOOLEAN_OPERATION":
    case "VECTOR":
    case "STAR":
    case "LINE":
    case "ELLIPSE":
    case "POLYGON":
    case "RECTANGLE":
    case "TEXT":
      parentX = node.parent.x;
      parentY = node.parent.y;
      break;
  }

  const styles: HTMLStyle = {};
  const outerStyles: HTMLStyle = {};

  const bounds = {
    left: node.x - parentX,
    right: (parentX + parentNode.width) - (node.x + node.width),
    top: node.y - parentY,
    bottom: (parentY + parentNode.height) - (node.y + node.height),
    width: node.width,
    height: node.height
  };

  let outerClass = 'outerDiv';
  let innerClass = 'innerDiv';
  const cHorizontal = node.constraints?.horizontal;
  const cVertical = node.constraints?.vertical;

  // Handle Horizontal Constraint
  if (cHorizontal === 'CENTER') {
    outerStyles.justifyContent = 'center';
    styles.width = `${bounds.width}px`;
    styles.marginLeft = bounds.left && bounds.right ? `${bounds.left - bounds.right}px` : null;
  } else if (cHorizontal === 'SCALE') {
    const parentWidth = bounds.left + bounds.width + bounds.right;
    styles.width = `${bounds.width*100/parentWidth}%`;
    styles.marginLeft = `${bounds.left*100/parentWidth}%`;
  } else if (cHorizontal === 'MAX') {
    outerStyles.justifyContent = 'flex-end';
    styles.marginRight = `${bounds.right}px`;
    styles.width = `${bounds.width}px`;
    styles.minWidth = `${bounds.width}`;
  } else if (cHorizontal === 'MIN') {
    outerStyles.justifyContent = 'flex-start';
    styles.marginLeft = `${bounds.left}px`;
    styles.width = `${bounds.width}px`;
    styles.minWidth = `${bounds.width}`;
  } else if (cHorizontal === 'STRETCH') {
    styles.marginLeft = `${bounds.left}px`;
    styles.marginRight = `${bounds.right}px`;
    styles.flexGrow = 1;
  }

  // Handle Vertical Constraint
  if (cVertical !== 'STRETCH') styles.height = `${bounds.height}px`;
  if (cVertical === 'CENTER') {
    outerClass += ' centerer';
    outerStyles.alignItems = 'center';
    styles.marginTop = `${bounds.top - bounds.bottom}px`;
  } else if (cVertical === 'SCALE') {
    outerClass += ' centerer';
    const parentHeight = bounds.top + bounds.height + bounds.bottom;
    styles.height = `${bounds.height*100/parentHeight}%`;
    styles.top = `${bounds.top*100/parentHeight}%`;
  } else if (cVertical === 'STRETCH') {
    outerClass += ' centerer';
    styles.marginTop = `${bounds.top}px`;
    styles.marginBottom = `${bounds.bottom}px`;
    styles.minHeight = `${bounds.height}px`;
    styles.height = null;
  } else if (cVertical === 'MAX') {
    outerClass += ' centerer';
    styles.marginTop = `${bounds.top}px`;
    styles.marginBottom = `${bounds.bottom}px`;
  } else if (cVertical === 'MIN') {
    outerClass += ' centerer';
    styles.marginTop = `${bounds.top}px`;
    styles.marginBottom = `${bounds.bottom}px`;
  }

  if (['FRAME', 'COMPONENT', 'INSTANCE'].indexOf(node.type) >= 0) {
    // styles.backgroundColor = colorString(node.backgroundColor);
    // if (node.clipsContent) styles.overflow = 'hidden';
  } else if (node.type === 'RECTANGLE') {
    if (Array.isArray(node.fills) && node.fills.length) {
      const lastFill = node.fills[node.fills.length - 1];
      if (lastFill.type === 'SOLID') {
        styles.backgroundColor = colorString(lastFill.color);
        styles.opacity = lastFill.opacity;
        console.log(styles);
      } else if (lastFill.type === 'IMAGE') {
        // styles.backgroundImage = imageURL(lastFill.imageHash);
        // styles.backgroundSize = backgroundSize(lastFill.scaleMode);
      } else if (lastFill.type === 'GRADIENT_LINEAR') {
        // styles.background = paintToLinearGradient(lastFill);
      } else if (lastFill.type === 'GRADIENT_RADIAL') {
        // styles.background = paintToRadialGradient(lastFill);
      }
    }
  }

  return `
    <div class="${outerClass}" style="${makeInlineStyles(outerStyles)}">
      <div class="${innerClass}" style="${makeInlineStyles(styles)}">
      </div>
    </div>
  `;
};

const makeHTMLForNode = (sceneNode: SceneNode) => {
  if (!sceneNode) return null;
  switch (sceneNode.type) {
    case "SLICE":
    case "FRAME":
    case "GROUP":
    case "COMPONENT":
    case "INSTANCE":
      return `<div>instance</div>`;
    case "BOOLEAN_OPERATION":
    case "VECTOR":
    case "STAR":
    case "LINE":
    case "ELLIPSE":
    case "POLYGON":
    case "RECTANGLE":
      return makeHTMLForRectangleNode(sceneNode as RectangleNode);
    case "TEXT":
      return `<div>text</div>`
    default:
      return `<div>${sceneNode}</div>`;
  }
};

const makeHTMLStringForFrame = (topLevelFrame: SceneNode) => {
  if (topLevelFrame.type === "FRAME") {
    const body = topLevelFrame.children.map(makeHTMLForNode);

return `<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
        position: absolute;
        width: 100%;
        min-height: 100%;
      }
      
      .root {
        position: absolute;
        width: 100%;
        min-height: 100%;
      }
      
      .outerDiv {
        position: relative;
        display: flex;
        width: 100%;
        pointer-events: none;
      }
      
      .innerDiv {
        position: relative;
        box-sizing: border-box;
        pointer-events: auto;
      }
      
      .centerer {
        position: absolute;
        height: 100%;
        top: 0;
        left: 0;
      }
    </style>
  </head>
  <body>
    <div class="root">
      ${body.join('')}
    </div>
  </body>
</html>`
    }
};
