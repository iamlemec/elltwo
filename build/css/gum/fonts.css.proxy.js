// [snowpack] add styles to the page (skip if no document exists)
if (typeof document !== 'undefined') {
  const code = "@font-face {\n    font-family: 'Montserrat';\n    font-style: normal;\n    font-weight: 100;\n    src: url('fonts/Montserrat-Thin.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'Montserrat';\n    font-style: normal;\n    font-weight: 300;\n    src: url('fonts/Montserrat-Light.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'Montserrat';\n    font-style: normal;\n    font-weight: 400;\n    src: url('fonts/Montserrat-Regular.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'Montserrat';\n    font-style: normal;\n    font-weight: 700;\n    src: url('fonts/Montserrat-Bold.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'Montserrat';\n    font-style: normal;\n    font-weight: 900;\n    src: url('fonts/Montserrat-Black.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'IBMPlexSans';\n    font-style: normal;\n    font-weight: 100;\n    src: url('fonts/IBMPlexSans-Thin.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'IBMPlexSans';\n    font-style: normal;\n    font-weight: 300;\n    src: url('fonts/IBMPlexSans-Light.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'IBMPlexSans';\n    font-style: normal;\n    font-weight: 400;\n    src: url('fonts/IBMPlexSans-Regular.ttf') format('truetype');\n}\n\n@font-face {\n    font-family: 'IBMPlexSans';\n    font-style: normal;\n    font-weight: 700;\n    src: url('fonts/IBMPlexSans-Bold.ttf') format('truetype');\n}\n";

  const styleEl = document.createElement("style");
  const codeEl = document.createTextNode(code);
  styleEl.type = 'text/css';
  styleEl.appendChild(codeEl);
  document.head.appendChild(styleEl);
}