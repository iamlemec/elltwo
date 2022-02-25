// [snowpack] add styles to the page (skip if no document exists)
if (typeof document !== 'undefined') {
  const code = "@import \"./core.css\";\n\n#prompt {\n  position: relative;\n  width: 100%;\n  height: 80px;\n  top: 40px;\n  text-align: center;\n  font-size: 20px;\n}\n\n#prompt a {\n    color: var(--font-col);\n}\n\n.notification {\n    position: relative;\n    width: 100%;\n    min-height: 50px;\n    top: -10%;\n    text-align: center;\n}\n\n#title {\n   font-size: 40px;\n}\n\n#query {\n    position: fixed;\n    min-height: 40px;\n    left: 20%;\n    top: 160px;\n    width: 49%;\n    font-size: 130%;\n}\n\n#full_text {\n    position: fixed;\n    right: 31%;\n    top: 160px;\n    height: 40px;\n    margin-right: 10px;\n}\n\n.toggle-track {\n    margin-left: 10px;\n}\n\n#submit {\n    position: fixed;\n    height: 40px;\n    font-size: 100%;\n    right: 20%;\n    width: 10%;\n    top: 160px;\n}\n\n::-moz-placeholder { /* Firefox 19+ */\n    color: var(--hl-col);\n    font-size: 60%;\n}\n\n::-webkit-input-placeholder {\n    color: var(--hl-col);\n    font-size: 60%;\n}\n\n.result {\n    display: block;\n    margin-bottom: 10px;\n    padding: 5px;\n    padding-left: 10px;\n}\n\n#results_outer {\n    position: fixed;\n    font-size: 120%;\n    left: 20%;\n    top: 240px;\n    width: 60%;\n    height: calc(100% - 280px);\n}\n\n#results {\n    position: relative;\n    overflow-y: scroll;\n    scrollbar-width: none;\n    width: 100%;\n    height: 100%;\n}\n\n.res_title{\n    padding: 4px;\n    font-size: 75%;\n    text-align: center;\n    border-bottom: 1px solid var(--font-col);\n    margin-bottom: 10px;\n}\n\n.blurb {\n    margin-top: 5px;\n    font-size: 60%;\n}\n\n.par_title {\n    font-size: 60%;\n    font-family: monospace;\n    font-weight: bold;\n}\n\n.par_text {\n    font-family: monospace;\n    font-size: 60%;\n}\n\n.blurb_name {\n    position: relative;\n    text-align: right;\n    margin-bottom: 3px;\n    right: 0;\n    color: var(--bg-hl2-col);\n    font-family: monospace;\n    font-size: 60%;\n    font-weight: bold;\n}\n\n.art_link .blurb_name {\n    position: absolute;\n    right: 5px;\n}\n\n.box {\n    position: fixed;\n    width: 40%;\n    top: 45%;\n    left: 30%;\n    background-color: var(--bg-hl2-col);\n    padding: 15px;\n    padding-top: 15px;\n}\n\n.notification {\n    padding: 3px;\n    text-align: center;\n}\n\n.result {\n    border-left: 2px solid var(--bg-col);\n}\n\n.result.selected {\n    border-left: 2px solid var(--hl-col);\n}\n\n.hl {\n    color: var(--hl2-col);\n    font-weight: bold;\n}\n\n.toggle {\n    font-size: 70%;\n}\n\n@media only screen and (max-width: 1000px) {\n\n#prompt {\n  height: 60px;\n  top: 20px;\n  text-align: center;\n  font-size: 15px;\n}\n\n#title {\n    font-size: 30px;\n}\n\n#desc {\n    line-height: 60px;\n    display: inline-block;\n    justify-content: middle;\n    transform: translateY(-8px);\n    margin-left: 20px;\n}\n\n#query {\n    top: 85px;\n    width: 80%;\n    left: 10%;\n}\n\n#submit {\n    width: 100px;\n    right: calc(10% + 5px);\n    height: 25px;\n    top: 130px;\n    font-size: 100%;\n    border-radius: 24px;\n    border: 1px solid black;\n    background-color: var(--bg-col);\n}\n\n#full_text {\n    position: fixed;\n    left: calc(10% + 5px);\n    height: 25px;\n    top: 130px;\n}\n\n#results_outer {\n    position: fixed;\n    font-size: 120%;\n    left: 10%;\n    top: 200px;\n    width: 80%;\n    height: calc(100% - 210px);\n}\n\n.blurb {\n    margin-top: 10px;\n    font-size: 70%;\n}\n\n.box {\n    position: fixed;\n    width: 80%;\n    top: 30%;\n    left: 10%;\n    background-color: var(--bg-hl2-col);\n    padding: 15px;\n    padding-top: 15px;\n}\n\n.toggle-track {\n\theight: 25px;\n    margin-left: 5px;\n}\n\n.toggle-indicator {\n\tborder-radius: 21px;\n\tbottom: 1px;\n\theight: 21px;\n}\n\n}\n\n@media only screen and (max-width: 600px) and (max-device-width: 800px) {\n}\n";

  const styleEl = document.createElement("style");
  const codeEl = document.createTextNode(code);
  styleEl.type = 'text/css';
  styleEl.appendChild(codeEl);
  document.head.appendChild(styleEl);
}